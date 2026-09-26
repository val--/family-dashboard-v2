#!/usr/bin/env bash
# Nightly backup of the post-it board (database + photos + stickers) to the NAS.
#
# One dated snapshot per day under $BACKUP_DIR/YYYY-MM-DD/. Unchanged photos are hard links to the
# previous snapshot, so each day costs only what's new. The last $KEEP_DAYS snapshots are kept, and
# $BACKUP_DIR/latest points to the newest one.
#
# Restore: stop the API, copy <snapshot>/postits.db and <snapshot>/photos/ back into ./data/, start it.
#
# Env: BACKUP_DIR (default /mnt/synology_movies/_backups/family-dashboard), KEEP_DAYS (default 30)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$REPO/data"
BACKUP_DIR="${BACKUP_DIR:-/mnt/synology_movies/_backups/family-dashboard}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TODAY="$(date +%F)"

log() { echo "$(date '+%F %T') $*"; }

# Never write into an empty mount point: if the NAS is not mounted, fail loudly instead
EXISTING="$BACKUP_DIR"
while [ ! -e "$EXISTING" ]; do EXISTING="$(dirname "$EXISTING")"; done  # the folder may not exist yet
NAS_MOUNT="$(findmnt -n -o TARGET --target "$EXISTING" 2>/dev/null | head -n1 || true)"
if [ -z "$NAS_MOUNT" ] || [ "$NAS_MOUNT" = "/" ] || ! mountpoint -q "$NAS_MOUNT"; then
  log "ERREUR: le NAS n'est pas monté ($BACKUP_DIR), sauvegarde annulée" >&2
  exit 1
fi

# 1. Consistent copy of the live SQLite database, made inside the API container (which owns the files).
#    It lands in ./data/.backup/ (the container's volume): docker is a snap here, with its own /tmp.
docker compose --project-directory "$REPO" exec -T api python3 - <<'PY'
import os, sqlite3
os.makedirs("/app/data/.backup", exist_ok=True)
src = sqlite3.connect("/app/data/postits.db")
dst = sqlite3.connect("/app/data/.backup/postits.tmp")
src.backup(dst)
assert dst.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
dst.close()
os.replace("/app/data/.backup/postits.tmp", "/app/data/.backup/postits.db")
PY
DB_COPY="$DATA/.backup/postits.db"
NOTES=$(python3 -c "import sqlite3,sys; print(sqlite3.connect('file:'+sys.argv[1]+'?mode=ro', uri=True).execute('select count(*) from notes').fetchone()[0])" "$DB_COPY")

# 2. Snapshot: photos hard-linked to the previous snapshot when unchanged (-rlt: NFS maps owners to nobody)
mkdir -p "$BACKUP_DIR/$TODAY"
LINK=()
[ -d "$BACKUP_DIR/latest/photos" ] && LINK=(--link-dest="$BACKUP_DIR/latest/photos")
rsync -rlt --delete "${LINK[@]}" "$DATA/photos/" "$BACKUP_DIR/$TODAY/photos/"
cp "$DB_COPY" "$BACKUP_DIR/$TODAY/postits.db"
ln -sfn "$TODAY" "$BACKUP_DIR/latest"

# 3. Keep the newest $KEEP_DAYS snapshots
ls -1d "$BACKUP_DIR"/20??-??-?? 2>/dev/null | sort | head -n "-$KEEP_DAYS" | while read -r old; do
  rm -rf "$old"
  log "ancienne sauvegarde supprimée: $(basename "$old")"
done

log "sauvegarde OK: $BACKUP_DIR/$TODAY ($NOTES post-it, $(ls "$DATA/photos" | wc -l) fichiers photo, $(du -sh "$BACKUP_DIR/$TODAY" | cut -f1))"
