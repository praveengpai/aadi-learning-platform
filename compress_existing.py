#!/usr/bin/env python3
"""Shrink PDFs already in the library (same settings as new downloads), then update the logs.

    python3 compress_existing.py --dest /opt/aadi-content
Log: _reports/compress_log.csv. Safe to re-run: files already compressed are skipped.
"""
import argparse, csv, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch

ap = argparse.ArgumentParser()
ap.add_argument("--dest", default="/opt/aadi-content")
a = ap.parse_args()
if not fetch.GS:
    sys.exit("Ghostscript (gs) is not installed: apt-get install -y ghostscript")
logp = os.path.join(a.dest, "_reports", "compress_log.csv")
done = set()
if os.path.exists(logp):
    done = {r["file"] for r in csv.DictReader(open(logp, encoding="utf-8"))}
new = not os.path.exists(logp)
log = open(logp, "a", newline="", encoding="utf-8"); w = csv.writer(log)
if new:
    w.writerow(["file", "old_bytes", "new_bytes"])
saved = 0
for root, _, files in os.walk(a.dest):
    if "/_" in root:
        continue
    for f in sorted(files):
        p = os.path.join(root, f)
        rel = os.path.relpath(p, a.dest)
        if not f.lower().endswith(".pdf") or rel in done:
            continue
        old, newb = fetch.compress_pdf(p)
        saved += old - newb
        w.writerow([rel, old, newb]); log.flush()
        print(f"{old/1e6:7.1f} -> {newb/1e6:6.1f} MB  {rel}")
print(f"Saved {saved/1e9:.2f} GB")

# keep sizes/checksums in the download logs in step with the shrunk files
for name in ("download_log.csv", "psc_archive_log.csv"):
    lp = os.path.join(a.dest, "_reports", name)
    if not os.path.exists(lp):
        continue
    rows = list(csv.DictReader(open(lp, encoding="utf-8")))
    for r in rows:
        fp = os.path.join(a.dest, r.get("folder", ""), r.get("file", ""))
        if r.get("file") and os.path.isfile(fp) and str(os.path.getsize(fp)) != r.get("bytes"):
            r["bytes"], r["sha256"] = os.path.getsize(fp), fetch.sha256(fp)
    if rows:
        wr = csv.DictWriter(open(lp, "w", newline="", encoding="utf-8"), fieldnames=rows[0].keys())
        wr.writeheader(); wr.writerows(rows)
