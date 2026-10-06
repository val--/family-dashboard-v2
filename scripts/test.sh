#!/usr/bin/env bash
# Runs every test, in Docker like the dashboard itself: nothing to install on the server.
#   scripts/test.sh          API (pytest, in the API image: same Python, same ffmpeg) + front (Vitest)
#   scripts/test.sh api      only the API
#   scripts/test.sh front    only the front
# The tests use a throwaway data folder and a fake family: the real post-its and settings are never touched.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:/snap/bin" # Docker is a snap on this server
what="${1:-all}"
status=0

if [[ "$what" == all || "$what" == api ]]; then
  echo "== API (pytest)"
  docker compose build -q api
  docker run --rm -v "$PWD/api:/src:ro" --entrypoint sh family-dashboard-v2-api -c \
    'cp -r /src /tmp/api && cd /tmp/api && pip install -q --disable-pip-version-check -r requirements-dev.txt >/dev/null && python -m pytest -q -p no:cacheprovider tests' \
    || status=1
fi

if [[ "$what" == all || "$what" == front ]]; then
  echo "== Front (Vitest)"
  docker run --rm -v "$PWD:/src:ro" node:22-alpine sh -c \
    'mkdir /app && cd /src && cp -r package.json package-lock.json index.html postit.html vite.config.js src /app/ && cd /app && npm ci --silent >/dev/null && npx vitest run' \
    || status=1
fi

exit $status
