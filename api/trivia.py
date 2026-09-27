"""Behind-the-scenes anecdotes about the last movie watched on Plex, taken from reference pages only.

Generated once per movie, in a background thread (a request never waits on it):
  1. the server itself fetches the sources: the movie's AlloCiné "secrets de tournage" page, and the
     production-related sections of its Wikipedia articles in French, English and the movie's original
     language (the right movie is found through Wikidata: a film, of that year);
  2. Gemini picks and rewrites 3-5 anecdotes using ONLY those extracts, without web search, citing the
     extract each one comes from;
  3. each anecdote is checked twice against its extract by a Pro model (every detail must be there), and a
     plain code check makes sure every number and proper name in it appears in that extract.
Only anecdotes passing every check are shown. So what's shown is backed by AlloCiné or Wikipedia text, not
by the model's memory. (IMDb's trivia would be the richest source but IMDb blocks automated access.) (Earlier versions let Gemini search the web itself: it rejected true facts and its
"source" could not be proven.)

The result is a small JSON file shared by the API's workers; a file lock makes sure only one of them works
on it at a time.
"""
import fcntl
import html
import json
import os
import re
import threading
import time
import unicodedata
import urllib.parse
import urllib.request

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
STATE_FILE = os.path.join(DATA_DIR, "trivia.json")
LOCK_FILE = os.path.join(DATA_DIR, "trivia.lock")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
WRITE_MODEL = os.environ.get("TRIVIA_WRITE_MODEL", "gemini-2.5-flash")
CHECK_MODEL = os.environ.get("TRIVIA_CHECK_MODEL", "gemini-3.1-pro-preview")
CHECK_RUNS = 2  # independent checks that must all agree

RETRY_AFTER_ERROR = 15 * 60  # a source or Gemini failed / timed out
RETRY_AFTER_NOTHING = 24 * 3600  # no source, or nothing survived the checks
MAX_ATTEMPTS = 3  # per movie, then it stays without anecdotes
GEMINI_TIMEOUT = 120  # generous: this runs in the background, not in a request
HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) family-dashboard/1.0", "Accept-Language": "fr-FR,fr"}

_running = threading.Lock()  # one generation per process; the file lock covers the other worker


def _load():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save(state):
    tmp = f"{STATE_FILE}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, ensure_ascii=False)
    os.replace(tmp, STATE_FILE)


def _gemini(prompt, model):
    """One Gemini call without tools (the facts come from the extracts in the prompt)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    config = {"temperature": 0.2}
    if model.startswith("gemini-3"):
        # Comparing a sentence with an extract needs little "thinking"; the default level is slow on Pro
        config["thinkingConfig"] = {"thinkingLevel": "low"}
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}], "generationConfig": config}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=GEMINI_TIMEOUT) as resp:
        data = json.loads(resp.read())
    return "".join(part.get("text", "") for part in data["candidates"][0]["content"]["parts"]).strip()


def _describe(movie):
    director = f", réalisé par {', '.join(movie['directors'])}" if movie["directors"] else ""
    return f"\"{movie['title']}\" ({movie['year']}{director})"


def _get(url, timeout=20):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HTTP_HEADERS), timeout=timeout) as r:
        return r.read()


def _wiki_api(lang, params):
    return json.loads(_get(f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})))


def _wikidata(qid):
    return json.loads(_get(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"))["entities"][qid]


def _wikidata_claim(claims, prop):
    try:
        return claims[prop][0]["mainsnak"]["datavalue"]["value"]
    except (KeyError, IndexError, TypeError):
        return None


def find_movie_entity(movie):
    """The movie's Wikidata entity: searched on French Wikipedia, then English (foreign films may only exist
    there). It must be a film (it has an IMDb title id; a soundtrack or an actor doesn't) of that year."""
    for lang in ("fr", "en"):
        hits = _wiki_api(lang, {"action": "query", "list": "search", "srsearch": f"{movie['title']} film {movie['year']}", "srlimit": 5})
        for hit in hits["query"]["search"]:
            pages = _wiki_api(lang, {"action": "query", "prop": "pageprops", "titles": hit["title"]})
            qid = next(iter(pages["query"]["pages"].values())).get("pageprops", {}).get("wikibase_item")
            if not qid:
                continue
            entity = _wikidata(qid)
            imdb = _wikidata_claim(entity["claims"], "P345") or ""
            date = _wikidata_claim(entity["claims"], "P577")
            year = date.get("time", "")[1:5] if isinstance(date, dict) else ""
            if imdb.startswith("tt") and (not movie["year"] or (year and abs(int(year) - int(movie["year"])) <= 1)):
                return entity
    return None


# Wikipedia sections worth reading for anecdotes, in the languages we are likely to meet
USEFUL_SECTION = re.compile(
    r"tournage|production|autour|anecdote|genèse|développement|musique|casting|"
    r"development|filming|pre-production|post-production|background|writing|trivia|music|"
    r"produzione|riprese|curiosità|sceneggiatura|producción|rodaje|curiosidades|"
    r"produktion|dreharbeiten|hintergrund|wissenswertes|entstehung|"
    r"製作|制作|撮影|エピソード|제작|촬영",
    re.IGNORECASE,
)
LANGUAGE_NAMES = {"en": "anglais", "it": "italien", "es": "espagnol", "de": "allemand", "ja": "japonais", "ko": "coréen",
                  "zh": "chinois", "pt": "portugais", "ru": "russe", "sv": "suédois", "da": "danois", "nl": "néerlandais"}
MAX_SOURCES = 22
PER_SOURCE_LIMIT = {"A": 10, "W": 4, "E": 4, "O": 4}  # AlloCiné, Wikipedia fr / en / original language
MAX_SOURCE_CHARS = 30000  # all extracts together, to keep the prompts reasonable


def _wikipedia_sections(lang, title):
    pages = _wiki_api(lang, {"action": "query", "prop": "extracts", "explaintext": 1, "titles": title})
    extract = next(iter(pages["query"]["pages"].values())).get("extract", "")
    sections = []
    for heading, body in re.findall(r"\n==+ ([^=]+?) ==+\n(.*?)(?=\n==|\Z)", "\n" + extract, re.S):
        body = re.sub(r"\s+", " ", body).strip()
        if USEFUL_SECTION.search(heading) and len(body) > 60:
            sections.append(body[:2500])
    return sections


def find_sources(movie):
    """[{"id", "site", "text"}] for THIS movie: AlloCiné (one extract per anecdote), then Wikipedia sections in
    French, English and the movie's original language."""
    entity = find_movie_entity(movie)
    if entity is None:
        return []
    claims, links = entity["claims"], entity.get("sitelinks", {})
    sources = []

    def add(prefix, site, text):
        # a quota per source, so a long AlloCiné page doesn't crowd Wikipedia out
        if sum(x["id"][0] == prefix for x in sources) >= PER_SOURCE_LIMIT[prefix]:
            return
        if len(sources) < MAX_SOURCES and sum(len(x["text"]) for x in sources) + len(text) <= MAX_SOURCE_CHARS:
            sources.append({"id": f"{prefix}{sum(x['id'][0] == prefix for x in sources) + 1}", "site": site, "text": text})

    allocine_id = _wikidata_claim(claims, "P1265")
    if allocine_id:
        try:
            page_html = _get(f"https://www.allocine.fr/film/fichefilm-{allocine_id}/secrets-tournage/").decode("utf-8", "ignore")
            for block in re.findall(r'<div class="trivia-news[^"]*".*?</div>\s*</div>', page_html, re.S):
                text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", block))).strip()
                if len(text) > 40:
                    add("A", "Allociné", text)
        except OSError:
            pass  # no "secrets de tournage" page, or AlloCiné unreachable: Wikipedia still counts

    languages = ["fr", "en"]
    original = _wikidata_claim(claims, "P364")  # original language of the film
    if isinstance(original, dict):
        code = _wikidata_claim(_wikidata(original["id"])["claims"], "P424")  # its Wikimedia language code
        if code and code not in languages:
            languages.append(code)
    for lang, prefix in zip(languages, "WEO"):
        title = links.get(f"{lang}wiki", {}).get("title")
        if not title:
            continue
        site = "Wikipédia" if lang == "fr" else f"Wikipédia ({LANGUAGE_NAMES.get(lang, lang)})"
        try:
            for text in _wikipedia_sections(lang, title):
                add(prefix, site, text)
        except OSError:
            pass
    return sources


def write_anecdotes(movie, sources):
    """[(anecdote, source)] rewritten by Gemini from the extracts only."""
    extracts = "\n".join(f"[{src['id']}] ({src['site']}) {src['text']}" for src in sources)
    prompt = (
        f"Voici des extraits de pages de référence sur le film {_describe(movie)}:\n{extracts}\n\n"
        f"Choisis les 3 à 5 anecdotes de coulisses les plus intéressantes (tournage, casting, secrets, clins d'œil), "
        f"en évitant le budget, le box-office et le résumé du scénario. Pour chacune, écris une ou deux phrases en "
        f"français (traduis fidèlement si l'extrait est dans une autre langue), ton conversationnel et sobre, "
        f"en n'utilisant QUE ce que dit l'extrait : n'ajoute aucun fait, "
        f"aucun nom, aucun chiffre, aucune date qui n'y figure pas, et n'extrapole pas.\n"
        f"Format OBLIGATOIRE, une ligne par anecdote : identifiant de l'extrait | anecdote\n"
        f"Exemple : A3 | Le réalisateur a découvert le livre grâce à une amie.\n"
        f"Pas de préambule, pas de numérotation."
    )
    by_id = {src["id"]: src for src in sources}
    out = []
    for line in _gemini(prompt, WRITE_MODEL).splitlines():
        m = re.match(r"^\W*\[?([A-Z]\d+)\]?\s*[|:–-]\s*(.+)$", line.strip())
        if m and m.group(1) in by_id and len(m.group(2)) > 20:
            out.append((m.group(2).strip(), by_id[m.group(1)]))
    return out[:5]


def _fold(text):
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def details_in_source(anecdote, source):
    """Code check, no AI: every number and every proper name of the anecdote must appear in its extract."""
    src = _fold(source)
    numbers = re.findall(r"\d+", anecdote)
    # capitalised words not at the start of a sentence (names, places, titles)
    names = [w for w in re.findall(r"(?<![.!?]\s)(?<!^)\b([A-ZÀ-Ý][\w'’-]{2,})", anecdote)]
    return all(n in src for n in numbers) and all(_fold(w).strip("'’") in src for w in names)


VERDICT = re.compile(r"^\W*(\d+)\W+(SUPPORTÉ|SUPPORTE|NON)\b", re.IGNORECASE)


def check_anecdotes(movie, pairs):
    """One independent check by the Pro model: is EVERY detail of each anecdote in its extract?"""
    listed = "\n\n".join(f"{i}. Anecdote : {a}\n   Extrait ({src['site']}) : {src['text']}" for i, (a, src) in enumerate(pairs, 1))
    prompt = (
        f"Tu es un vérificateur de faits très exigeant. Film : {_describe(movie)}.\n"
        f"Pour chaque anecdote ci-dessous, dis si l'extrait qui l'accompagne confirme TOUS ses détails "
        f"(noms, liens de parenté, chiffres, lieux, dates, qui a fait quoi). N'utilise que l'extrait, pas ta mémoire. "
        f"L'extrait peut être dans une autre langue que l'anecdote : compare alors le sens exact. "
        f"Une anecdote qui ajoute, déforme ou exagère quoi que ce soit n'est pas supportée.\n\n{listed}\n\n"
        f"Réponds avec exactement une ligne par anecdote, dans l'ordre : numéro | SUPPORTÉ ou numéro | NON | raison courte. "
        f"Pas de préambule."
    )
    verdicts = {}
    for line in _gemini(prompt, CHECK_MODEL).splitlines():
        m = VERDICT.match(line.strip())
        if m:
            verdicts[int(m.group(1))] = m.group(2).upper().startswith("SUPPORT")
    return [verdicts.get(i, False) for i in range(1, len(pairs) + 1)]


def _generate(movie):
    if not _running.acquire(blocking=False):
        return
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(LOCK_FILE, "w") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                return  # the other API worker is already on it

            state = _load()
            now = time.time()
            same = state.get("movie") == movie["key"]
            if not _due(state, movie, now):
                return  # done meanwhile by the other worker
            attempts = (state.get("attempts", 0) if same else 0) + 1
            base = {"movie": movie["key"], "attempts": attempts, "text": None, "sources": []}

            try:
                sources = find_sources(movie)
                pairs = write_anecdotes(movie, sources) if sources else []
                runs = [check_anecdotes(movie, pairs) for _ in range(CHECK_RUNS)] if pairs else []
            except Exception as e:
                _save({**base, "retry_after": now + RETRY_AFTER_ERROR, "last_error": str(e)[:200]})
                return

            kept, sites = [], []
            for i, (anecdote, src) in enumerate(pairs):
                if all(run[i] for run in runs) and details_in_source(anecdote, src["text"]):
                    kept.append(anecdote)
                    sites.append(src["site"])
            if kept:
                _save({**base, "text": " ★ ".join(kept), "sources": sorted(set(sites), key=sites.index),
                       "checked": len(pairs), "kept": len(kept), "generated_at": now})
            else:
                _save({**base, "checked": len(pairs), "kept": 0, "no_source": not sources,
                       "retry_after": now + RETRY_AFTER_NOTHING})
    finally:
        _running.release()


def _due(state, movie, now):
    """Once per movie: only when it changed, or when the earlier attempts gave nothing (a few times)."""
    if state.get("movie") != movie["key"]:
        return True
    if state.get("text"):
        return False
    return state.get("attempts", 0) < MAX_ATTEMPTS and now >= state.get("retry_after", 0)


def trivia_for(movie):
    """What to show now for this movie; starts the generation in the background when it's due."""
    state = _load()
    if GEMINI_API_KEY and _due(state, movie, time.time()):
        threading.Thread(target=_generate, args=(movie,), daemon=True, name="trivia").start()
    if state.get("movie") == movie["key"] and state.get("text"):
        return {
            "text": state["text"],
            "movie": movie["key"],
            "verified": {"kept": state.get("kept"), "checked": state.get("checked"), "runs": CHECK_RUNS},
            "sources": state.get("sources", []),
        }
    return {"text": None, "movie": movie["key"]}
