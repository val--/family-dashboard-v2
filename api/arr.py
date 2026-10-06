"""Radarr and Sonarr (downloads in progress, missing items, adding a movie) and TMDb (French titles, streaming)."""
import json as jsonlib
import os
import urllib.error
import urllib.parse
import urllib.request

from flask import Blueprint, jsonify, request

bp = Blueprint("arr", __name__)

# -- Radarr config --
RADARR_URL = os.environ.get("RADARR_URL", "http://localhost:7878")
RADARR_API_KEY = os.environ.get("RADARR_API_KEY", "")

# -- Sonarr config --
SONARR_URL = os.environ.get("SONARR_URL", "http://localhost:8989")
SONARR_API_KEY = os.environ.get("SONARR_API_KEY", "")

# -- TMDb config --
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")

def _arr_request(base_url, api_key, path, method="GET", data=None):
    """Radarr and Sonarr share the same API style: JSON, key in a header."""
    headers = {"X-Api-Key": api_key, "Content-Type": "application/json"}
    req = urllib.request.Request(f"{base_url}{path}", headers=headers, method=method)
    if data:
        req.data = jsonlib.dumps(data).encode()
    with urllib.request.urlopen(req, timeout=10) as resp:
        return jsonlib.loads(resp.read())


def poster_url(item):
    """The poster of a Radarr movie or a Sonarr series (their remote, TMDb-hosted, version)."""
    for img in item.get("images", []):
        if img.get("coverType") == "poster":
            return img.get("remoteUrl")
    return None


@bp.route("/api/radarr/status")
def radarr_status():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    try:
        queue_data = radarr_request("/api/v3/queue?pageSize=10&includeMovie=true")

        seen_movies = {}
        for record in queue_data.get("records", []):
            if record.get("status") != "downloading":
                continue
            movie = record.get("movie", {})
            movie_id = record.get("movieId")
            progress = round(100 - (record.get("sizeleft", 0) / max(record.get("size", 1), 1) * 100))
            poster = poster_url(movie)
            size_gb = round(record.get("size", 0) / (1024**3), 1)
            sizeleft_gb = round(record.get("sizeleft", 0) / (1024**3), 1)
            quality_name = record.get("quality", {}).get("quality", {}).get("name")

            if movie_id not in seen_movies or progress > seen_movies[movie_id]["progress"]:
                seen_movies[movie_id] = {
                    "title": movie.get("title"),
                    "year": movie.get("year"),
                    "progress": progress,
                    "eta": record.get("estimatedCompletionTime"),
                    "poster": poster,
                    "release": record.get("title"),
                    "quality": quality_name,
                    "size": size_gb,
                    "sizeleft": sizeleft_gb,
                    "downloadClient": record.get("downloadClient"),
                    "indexer": record.get("indexer"),
                    "timeleft": record.get("timeleft"),
                }
        downloading = list(seen_movies.values())

        # Fetch missing/monitored movies
        all_movies = radarr_request("/api/v3/movie")

        missing = []
        for movie in all_movies:
            if movie.get("monitored") and not movie.get("hasFile"):
                poster = poster_url(movie)
                missing.append({
                    "title": movie.get("title"),
                    "year": movie.get("year"),
                    "poster": poster,
                })

        return jsonify({
            "downloading": downloading,
            "missing": missing,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def radarr_request(path, method="GET", data=None):
    return _arr_request(RADARR_URL, RADARR_API_KEY, path, method, data)


@bp.route("/api/radarr/search")
def radarr_search():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    term = request.args.get("term", "").strip()
    if not term:
        return jsonify({"results": []})

    try:
        encoded = urllib.parse.quote(term)
        data = radarr_request(f"/api/v3/movie/lookup?term={encoded}")

        # Get existing library tmdbIds for duplicate check
        library = radarr_request("/api/v3/movie")
        library_ids = {m.get("tmdbId") for m in library}

        results = []
        for movie in data[:10]:
            poster = poster_url(movie)

            title = movie.get("title")
            overview = movie.get("overview", "")

            # Fetch French title/overview from TMDb
            tmdb_id = movie.get("tmdbId")
            if TMDB_API_KEY and tmdb_id:
                try:
                    tmdb_url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={TMDB_API_KEY}&language=fr-FR"
                    req = urllib.request.Request(tmdb_url)
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        tmdb_data = jsonlib.loads(resp.read())
                    if tmdb_data.get("title"):
                        title = tmdb_data["title"]
                    if tmdb_data.get("overview"):
                        overview = tmdb_data["overview"]
                except Exception:
                    pass

            results.append({
                "tmdbId": tmdb_id,
                "title": title,
                "year": movie.get("year"),
                "overview": overview,
                "runtime": movie.get("runtime"),
                "ratings": movie.get("ratings", {}),
                "genres": [g for g in movie.get("genres", [])][:4],
                "poster": poster,
                "inLibrary": movie.get("tmdbId") in library_ids,
            })

        return jsonify({"results": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/radarr/config")
def radarr_config():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    try:
        root_folders = radarr_request("/api/v3/rootfolder")
        profiles = radarr_request("/api/v3/qualityprofile")

        return jsonify({
            "rootFolderPath": root_folders[0]["path"] if root_folders else "/movies",
            "qualityProfileId": profiles[0]["id"] if profiles else 1,
            "profiles": [{"id": p["id"], "name": p["name"]} for p in profiles],
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/radarr/add", methods=["POST"])
def radarr_add():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    try:
        body = request.get_json()
        tmdb_id = body.get("tmdbId")
        if not tmdb_id:
            return jsonify({"error": "tmdbId required"}), 400

        quality_id = body.get("qualityProfileId")

        # Get config — pick root folder with most free space
        config = radarr_request("/api/v3/rootfolder")
        root_folder = max(config, key=lambda f: f.get("freeSpace", 0))["path"] if config else "/movies"
        if not quality_id:
            profiles = radarr_request("/api/v3/qualityprofile")
            quality_id = profiles[0]["id"] if profiles else 1

        # Lookup full movie details
        movie = radarr_request(f"/api/v3/movie/lookup/tmdb?tmdbId={tmdb_id}")

        result = radarr_request("/api/v3/movie", method="POST", data={
            "tmdbId": tmdb_id,
            "title": movie.get("title"),
            "year": movie.get("year"),
            "qualityProfileId": quality_id,
            "rootFolderPath": root_folder,
            "monitored": True,
            "addOptions": {"searchForMovie": True},
        })

        return jsonify({"success": True, "title": result.get("title")})

    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else str(e)
        return jsonify({"error": error_body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/tmdb/streaming/<int:tmdb_id>")
def tmdb_streaming(tmdb_id):
    if not TMDB_API_KEY:
        return jsonify({"error": "TMDB_API_KEY not configured"}), 500

    try:
        url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/watch/providers?api_key={TMDB_API_KEY}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = jsonlib.loads(resp.read())

        # Get French providers (fallback to US)
        country = data.get("results", {}).get("FR") or data.get("results", {}).get("US")
        if not country:
            return jsonify({"providers": []})

        providers = []
        for p in country.get("flatrate", []):
            providers.append({
                "name": p.get("provider_name"),
                "logo": f"https://image.tmdb.org/t/p/w92{p['logo_path']}" if p.get("logo_path") else None,
            })

        return jsonify({"providers": providers})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- Sonarr --

def sonarr_request(path, method="GET", data=None):
    return _arr_request(SONARR_URL, SONARR_API_KEY, path, method, data)


@bp.route("/api/sonarr/status")
def sonarr_status():
    if not SONARR_API_KEY:
        return jsonify({"error": "SONARR_API_KEY not configured"}), 500

    try:
        queue_data = sonarr_request("/api/v3/queue?pageSize=50&includeSeries=true&includeEpisode=true")

        # Group downloading items by series
        seen_series = {}
        for record in queue_data.get("records", []):
            if record.get("status") != "downloading":
                continue
            series = record.get("series", {})
            series_id = record.get("seriesId")
            episode = record.get("episode", {})
            size = record.get("size", 0)
            sizeleft = record.get("sizeleft", 0)
            progress = round(100 - (sizeleft / max(size, 1) * 100))

            poster = poster_url(series)

            size_gb = round(size / (1024**3), 1)
            sizeleft_gb = round(sizeleft / (1024**3), 1)
            quality_name = record.get("quality", {}).get("quality", {}).get("name")

            if series_id not in seen_series:
                seen_series[series_id] = {
                    "title": series.get("title"),
                    "year": series.get("year"),
                    "progress": progress,
                    "eta": record.get("estimatedCompletionTime"),
                    "poster": poster,
                    "release": record.get("title"),
                    "quality": quality_name,
                    "size": size_gb,
                    "sizeleft": sizeleft_gb,
                    "downloadClient": record.get("downloadClient"),
                    "indexer": record.get("indexer"),
                    "timeleft": record.get("timeleft"),
                    "episodeCount": 1,
                    "season": episode.get("seasonNumber"),
                    "episode": episode.get("episodeNumber"),
                }
            else:
                # Aggregate: sum sizes, recompute overall progress
                existing = seen_series[series_id]
                existing["episodeCount"] += 1
                total_size = existing["size"] + size_gb
                total_left = existing["sizeleft"] + sizeleft_gb
                existing["size"] = round(total_size, 1)
                existing["sizeleft"] = round(total_left, 1)
                existing["progress"] = round(100 - (total_left / max(total_size, 0.1) * 100))
                # Keep the latest ETA
                if record.get("estimatedCompletionTime") and (
                    not existing["eta"] or record["estimatedCompletionTime"] > existing["eta"]
                ):
                    existing["eta"] = record["estimatedCompletionTime"]
                    existing["timeleft"] = record.get("timeleft")

        downloading = list(seen_series.values())

        # Fetch missing/monitored episodes
        wanted = sonarr_request("/api/v3/wanted/missing?pageSize=20&includeSeries=true")

        missing_series = {}
        for record in wanted.get("records", []):
            series = record.get("series", {})
            sid = series.get("id")
            if sid in missing_series or sid in seen_series:
                continue
            poster = poster_url(series)
            missing_series[sid] = {
                "title": series.get("title"),
                "year": series.get("year"),
                "poster": poster,
                "season": record.get("seasonNumber"),
                "episode": record.get("episodeNumber"),
            }

        return jsonify({
            "downloading": downloading,
            "missing": list(missing_series.values()),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
