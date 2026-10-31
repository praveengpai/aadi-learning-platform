#!/usr/bin/env bash
# Download the AADI open-content library on the server.
# Usage:  bash run.sh [destination]        (default /opt/aadi-content)
# Safe to run again: finished files are skipped, so a second run only
# picks up what failed or is new in the manifest.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-/opt/aadi-content}"
mkdir -p "$DEST/_reports"

free_gb=$(df -BG --output=avail "$DEST" | tail -1 | tr -dc '0-9')
if [ "${free_gb:-0}" -lt 12 ]; then
  echo "Only ${free_gb} GB free on $(df --output=target "$DEST" | tail -1). The library needs about 6-10 GB."
  echo "Free some space or pass another destination, e.g.: bash run.sh /mnt/data/aadi-content"
  exit 1
fi

# copy the reference lists next to the library so it is self-describing
cp "$HERE/manifest.csv" "$HERE/README.md" "$DEST/"
mkdir -p "$DEST/_lists" && cp "$HERE"/lists/*.csv "$DEST/_lists/"

# PDF compression needs Ghostscript (screen/phone quality, typically 60-80% smaller)
if ! command -v gs >/dev/null 2>&1; then
  if [ "$(id -u)" = 0 ]; then apt-get install -y -qq ghostscript >/dev/null 2>&1 || true; fi
  command -v gs >/dev/null 2>&1 || echo "Note: Ghostscript not installed; PDFs will be kept at full size."
fi

LOG="$DEST/_reports/run-$(date +%Y%m%d-%H%M).log"
nohup bash -c "python3 -u '$HERE/compress_existing.py' --dest '$DEST'; \
  python3 -u '$HERE/fetch.py' --manifest '$HERE/manifest.csv' --dest '$DEST' --delay 2; \
  python3 -u '$HERE/psc_archive.py' --dest '$DEST'; \
  python3 -u '$HERE/build_index.py' --manifest '$HERE/manifest.csv' --dest '$DEST'" > "$LOG" 2>&1 &
echo "Started (process $!). It runs in the background, so you can close this window."
echo "Watch progress:   tail -f $LOG"
echo "When it finishes: tail -5 $LOG"
