#!/usr/bin/env python3
"""
Kerala PSC official question papers and answer keys -> AADI library.

Walks Kerala PSC's own archive (keralapsc.gov.in "Answer Keys – OMR exams", ~20 exams per page, newest first),
keeps the exams AADI youth prepare for (see psc_filter.txt), in Malayalam or English, and downloads the question
paper and answer key PDFs into
    02_Exam_Prep/Kerala_PSC/Question_Papers/<year>/<exam code> <post>/

Licence: Kerala PSC says its material may be reproduced free of charge, acknowledging the source.
Resumable and polite like fetch.py. Log: _reports/psc_archive_log.csv (read by build_index.py).

    python3 psc_archive.py --dest /opt/aadi-content            # all pages
    python3 psc_archive.py --dest /opt/aadi-content --pages 60  # newest 60 pages only (~1,200 exams)
"""
import argparse, csv, html, os, re, sys, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fetch  # noqa: E402  (request, download helpers, safe)

BASE = "https://www.keralapsc.gov.in/index.php/answerkey_omrexams?tid=All&page=%d"
SKIP_MEDIUM = re.compile(r"\b(tamil|kannada)\b|[-\s(](T|K)(\s*\(|-|\.pdf|$)", re.I)


def load_filter():
    keep, drop = [], []
    for line in open(os.path.join(HERE, "psc_filter.txt"), encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        (drop if line.startswith("-") else keep).append(line.lstrip("-").strip())
    return re.compile("|".join(keep), re.I), (re.compile("|".join(drop), re.I) if drop else None)


def rows_on(page_html):
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page_html, re.S | re.I):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S | re.I)
        if len(cells) < 3:
            continue
        text = lambda c: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip()
        links = [(urllib.parse.urljoin("https://www.keralapsc.gov.in/", h), text(t))
                 for h, t in re.findall(r'<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)</a>', tr, re.S | re.I)]
        if links:
            texts = [text(c) for c in cells]
            words = [t for t in texts if t and not re.fullmatch(r"[\d.\s]+", t)]   # skip a serial-number column
            post = words[0] if words else ""
            details = " ".join(t for t in texts if t != post)
            yield post, details, texts, links


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", default="/opt/aadi-content")
    ap.add_argument("--pages", type=int, default=243)
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    keep, drop = load_filter()
    log_path = os.path.join(a.dest, "_reports", "psc_archive_log.csv")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    new = not os.path.exists(log_path)
    log = open(log_path, "a", newline="", encoding="utf-8"); w = csv.writer(log)
    if new:
        w.writerow(["when", "page", "status", "folder", "file", "bytes", "sha256", "file_url", "post", "details",
                    "kind", "medium", "year", "error"])
    counts, empty = {}, 0
    for p in range(a.pages):
        try:
            with fetch.request(BASE % p) as r:
                page = r.read().decode("utf-8", "replace")
        except Exception as e:
            print(f"page {p}: {e}"); counts["page_error"] = counts.get("page_error", 0) + 1; continue
        found = list(rows_on(page))
        if not found:
            empty += 1
            if empty >= 3:
                break
            continue
        empty = 0
        for post, details, cells, links in found:
            if not keep.search(post) or (drop and drop.search(post)):
                continue
            for url, label in links:
                name = os.path.basename(urllib.parse.unquote(url))
                if SKIP_MEDIUM.search(" ".join([details, name])) and not re.search(r"malayalam|english", details + name, re.I):
                    continue
                medium = "Malayalam" if re.search(r"malayalam|[-\s]M[\s.(-]", details + " " + name, re.I) else "English"
                ym = re.search(r"/files/(\d{4})-\d{2}/", url)
                year = ym.group(1) if ym else "undated"
                code = re.search(r"\b(\d{2,3}\s*[-/]\s*\d{2,4})", details)
                folder = os.path.join("02_Exam_Prep", "Kerala_PSC", "Question_Papers", year,
                                      fetch.safe(((code.group(1).replace("/", "-") + " ") if code else "") + post, 90))
                kind = "Answer key" if re.search(r"key", label + name, re.I) else "Question paper"
                try:
                    status, path, size, digest = fetch.download(url, os.path.join(a.dest, folder), kind + " " + medium, a.dry_run)
                    err = ""
                except fetch.DiskFull as e:
                    print("\n" + str(e)); print("Kerala PSC archive:", counts); return
                except Exception as e:
                    status, path, size, digest, err = "error", "", 0, "", str(e)[:200]
                counts[status] = counts.get(status, 0) + 1
                w.writerow([fetch.now(), p, status, folder, os.path.basename(path), size, digest, url, post, details,
                            kind, medium, year, err]); log.flush()
                print(f"  {status:14} p{p} {folder}/{os.path.basename(path)} {err}")
                if status == "downloaded":
                    time.sleep(a.delay)
        time.sleep(a.delay)
    print("\nKerala PSC archive:", counts, "\nLog:", log_path)


if __name__ == "__main__":
    main()
