#!/usr/bin/env python3
"""
AADI content repository downloader  (CIF Learning Platform)

Reads manifest.csv and downloads every item whose licence_class is
GOV_FREE or OPEN_LICENCE into a categorised folder tree. COPYRIGHTED and
LINK_ONLY rows are never downloaded; they are listed in the reports so
permission can be sought (see COPYRIGHT_OWNERS.csv).

Rows whose format is INDEX are web pages listing many files: the page is
fetched and every PDF/ZIP/EPUB link on the same site is downloaded into
that row's folder (one level deep, no wandering off-site).

Re-running is safe: files already present are skipped (resume).

Usage (on the server, as any user that can write the target folder):
    python3 fetch.py                         # download everything allowed
    python3 fetch.py --dry-run               # show what would happen
    python3 fetch.py --only School           # only rows whose folder starts with this
    python3 fetch.py --max-index-files 300   # cap files taken from each INDEX page
    python3 fetch.py --dest /opt/aadi-content

Standard library only (Python 3.8+). Polite: one request at a time, a pause
between requests, retries with back-off, identifies itself as AADI.
"""
import argparse, csv, datetime, hashlib, html.parser, os, re, shutil, sys, time
import urllib.parse, urllib.request, urllib.error

ALLOWED = {"GOV_FREE", "OPEN_LICENCE"}
UA = "AADI-Content-Fetcher/1.0 (CIF Learning Platform; non-commercial education; contact: praveengpai@gmail.com)"
FILE_EXT = (".pdf", ".zip", ".epub", ".doc", ".docx", ".ppt", ".pptx", ".odt", ".mp3", ".jpg", ".png")

# category -> top-level folder
TOP = {
    "School_Textbooks": "01_School/Textbooks", "Teacher_Texts": "01_School/Teacher_Texts",
    "Teaching_Manuals": "01_School/Teaching_Manuals", "Activity_Books": "01_School/Activity_Books",
    "Study_Notes": "01_School/Study_Notes", "Worksheets": "01_School/Worksheets",
    "Question_Papers": "01_School/Question_Papers", "Scholarship_Exams": "01_School/Scholarship_Exams_LSS_USS_NMMS",
    "Remedial_Programmes": "01_School/Remedial_Catch_Up", "Curriculum_Framework": "01_School/Curriculum_Framework",
    "Calendars_Plans": "01_School/Calendars_Plans", "Reading_Cards": "01_School/Reading_Cards", "Quiz": "01_School/Quiz",
    "PSC_Exam": "02_Exam_Prep/Kerala_PSC", "SSC_Exam": "02_Exam_Prep/SSC", "Bank_Exam": "02_Exam_Prep/Banking",
    "RRB_Exam": "02_Exam_Prep/Railways_RRB", "Entrance": "02_Exam_Prep/Entrance",
    "NCERT_Textbooks": "02_Exam_Prep/NCERT_Textbooks", "NIOS": "02_Exam_Prep/NIOS",
    "Current_Affairs": "02_Exam_Prep/Current_Affairs", "Reference": "02_Exam_Prep/Reference",
    "Language_English": "03_Language/English", "Language_Hindi": "03_Language/Hindi",
    "Storybooks": "03_Language/Storybooks_Reading", "Tribal_Language": "03_Language/Tribal_Language_Bridge",
    "Literacy_Equivalency": "04_Literacy_Equivalency", "Equivalency": "04_Literacy_Equivalency",
    "Life_Skills": "05_Life_Skills/General", "Financial_Literacy": "05_Life_Skills/Financial_Literacy",
    "Digital_Literacy": "05_Life_Skills/Digital_Literacy", "Health_Hygiene": "05_Life_Skills/Health_Hygiene",
    "Govt_Schemes": "05_Life_Skills/Govt_Schemes",
    "Career_Guidance": "06_Counselling_Wellbeing/Career_Guidance",
    "Counselling_Wellbeing": "06_Counselling_Wellbeing/Wellbeing",
    "Child_Protection": "06_Counselling_Wellbeing/Child_Protection",
    "Teacher_Training": "07_Teacher_Development", "Video": "08_Video_Links",
}


def safe(s, n=80):
    s = re.sub(r"[^\w\-. ]+", "_", (s or "").strip(), flags=re.UNICODE)
    s = re.sub(r"[ _]+", "_", s).strip("._")
    return s[:n] or "item"


def folder_for(row):
    top = TOP.get(row.get("category", ""), "99_Other/" + safe(row.get("category", "Misc")))
    parts = [top]
    cls = (row.get("class") or "").strip()
    if cls and cls.lower() not in ("all", "na", "n/a", "-"):
        m = re.match(r"^\D*(\d{1,2})\D*$", cls)
        parts.append("Std_%02d" % int(m.group(1)) if m else safe(cls, 40))
    if row.get("subject"):
        parts.append(safe(row["subject"], 50))
    med = (row.get("medium") or "").strip()
    if med and med.lower() not in ("na", "n/a", "-", "all"):
        parts.append(safe(med, 30))
    return os.path.join(*parts)


def request(url, tries=4, pause=1.5):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            return urllib.request.urlopen(req, timeout=90)
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (403, 404, 410):
                raise
        except Exception as e:  # network hiccup
            last = e
        time.sleep(pause * (2 ** i))
    raise last


class Links(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for k, v in attrs:
                if k == "href" and v:
                    self.links.append(v)


def index_links(url, max_files):
    with request(url) as r:
        page = r.read().decode("utf-8", "replace")
    p = Links(); p.feed(page)
    host = urllib.parse.urlparse(url).netloc.split(":")[0].replace("www.", "")
    out, seen = [], set()
    for href in p.links:
        full = urllib.parse.urljoin(url, href)
        u = urllib.parse.urlparse(full)
        is_drive = "drive.google.com" in u.netloc and DRIVE_ID.search(full) and "/folders/" not in full
        if not is_drive:
            if not u.path.lower().endswith(FILE_EXT):
                continue
            if host not in u.netloc:
                continue
        if full not in seen:
            seen.add(full); out.append(full)
        if len(out) >= max_files:
            break
    return out


DRIVE_ID = re.compile(r"(?:/file/d/|[?&]id=)([A-Za-z0-9_-]{20,})")


def direct_url(url):
    """Official SCERT files sit on Google Drive: turn a viewer link into a direct download."""
    if "drive.google.com" in url or "docs.google.com" in url:
        m = DRIVE_ID.search(url)
        if m and "/folders/" not in url:
            return ("https://drive.usercontent.google.com/download?id=%s&export=download&confirm=t" % m.group(1),
                    "gdrive_" + m.group(1))
    return url, None


MIN_FREE_GB = float(os.environ.get("AADI_MIN_FREE_GB", "10"))


class DiskFull(Exception):
    pass


def check_space(path):
    probe = path
    while not os.path.exists(probe):
        probe = os.path.dirname(probe) or "/"
    free = shutil.disk_usage(probe).free / 1e9
    if free < MIN_FREE_GB:
        raise DiskFull(f"stopped: only {free:.1f} GB free (keeping at least {MIN_FREE_GB:g} GB for the server)")


def download(url, dest_dir, title, dry):
    if not dry:
        check_space(dest_dir)
    url, drive_name = direct_url(url)
    name = drive_name or os.path.basename(urllib.parse.unquote(urllib.parse.urlparse(url).path)) or "file"
    stem, ext = os.path.splitext(name)
    if drive_name:
        stem, ext = drive_name, ".pdf"
    if not ext:
        ext = ".pdf"
    fname = safe(title, 70) + "__" + safe(stem, 40) + ext.lower() if title else safe(stem, 100) + ext.lower()
    path = os.path.join(dest_dir, fname)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return "exists", path, os.path.getsize(path), sha256(path)
    if dry:
        return "would_download", path, 0, ""
    os.makedirs(dest_dir, exist_ok=True)
    tmp = path + ".part"
    with request(url) as r, open(tmp, "wb") as f:
        ctype = r.headers.get("Content-Type", "")
        if "text/html" in ctype and ext.lower() != ".html":
            raise ValueError("got a web page, not a file (link may need login or be moved)")
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)
    os.replace(tmp, path)
    return "downloaded", path, os.path.getsize(path), sha256(path)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--manifest", default=os.path.join(here, "manifest.csv"))
    ap.add_argument("--dest", default=os.path.join(here, "library"))
    ap.add_argument("--only", default="")
    ap.add_argument("--max-index-files", type=int, default=400)
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    rows = list(csv.DictReader(open(a.manifest, encoding="utf-8")))
    log_path = os.path.join(a.dest, "_reports", "download_log.csv")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    new_log = not os.path.exists(log_path)
    log = open(log_path, "a", newline="", encoding="utf-8")
    w = csv.writer(log)
    if new_log:
        w.writerow(["when", "manifest_id", "status", "folder", "file", "bytes", "sha256",
                    "file_url", "source_page", "publisher_owner", "licence_class", "licence_detail", "error"])

    # owners who have given written permission -> their items become downloadable
    granted = set()
    gpath = os.path.join(os.path.dirname(os.path.abspath(a.manifest)), "lists", "permissions_granted.csv")
    if os.path.exists(gpath):
        granted = {g["owner_id"].strip() for g in csv.DictReader(open(gpath, encoding="utf-8")) if g.get("owner_id")}
    for r in rows:
        if r.get("licence_class") in ("COPYRIGHTED", "MANUAL") and r.get("owner_id") in granted:
            r["licence_class"] = "PERMITTED"
    allowed = ALLOWED | {"PERMITTED"}
    skipped = [r for r in rows if r.get("licence_class") not in allowed]
    todo = [r for r in rows if r.get("licence_class") in allowed and r.get("file_url")]
    if a.only:
        todo = [r for r in todo if folder_for(r).startswith(a.only)]
    print(f"{len(rows)} manifest rows: {len(todo)} to fetch, {len(skipped)} not downloadable (copyright / link-only)")

    counts = {}
    for i, r in enumerate(todo, 1):
        if counts.get("stopped_disk_space"):
            break
        folder = os.path.join(a.dest, folder_for(r))
        urls = [r["file_url"]]
        if (r.get("format") or "").upper() == "INDEX" and a.dry_run:
            print(f"  would_crawl    {r['id']}  {folder_for(r)}  <- {r['file_url']}")
            counts["would_crawl"] = counts.get("would_crawl", 0) + 1
            continue
        if (r.get("format") or "").upper() == "INDEX":
            try:
                urls = index_links(r["file_url"], a.max_index_files)
                print(f"[{i}/{len(todo)}] INDEX {r['id']}: {len(urls)} files on {r['file_url']}")
            except Exception as e:
                w.writerow([now(), r["id"], "index_error", folder, "", 0, "", r["file_url"], r.get("source_page"),
                            r.get("publisher_owner"), r.get("licence_class"), r.get("licence_detail"), str(e)])
                counts["index_error"] = counts.get("index_error", 0) + 1
                continue
        for u in urls:
            title = r.get("title") if len(urls) == 1 else ""
            try:
                status, path, size, digest = download(u, folder, title, a.dry_run)
                err = ""
            except DiskFull as e:
                print("\n" + str(e)); counts["stopped_disk_space"] = 1
                break
            except Exception as e:
                status, path, size, digest, err = "error", "", 0, "", str(e)[:200]
            counts[status] = counts.get(status, 0) + 1
            w.writerow([now(), r["id"], status, folder_for(r), os.path.basename(path), size, digest, u,
                        r.get("source_page"), r.get("publisher_owner"), r.get("licence_class"),
                        r.get("licence_detail"), err])
            log.flush()
            print(f"  {status:14} {r['id']}  {os.path.relpath(path, a.dest) if path else u}  {err}")
            if status == "downloaded":
                time.sleep(a.delay)

    # list of what was NOT downloaded and why
    with open(os.path.join(a.dest, "_reports", "not_downloaded_permission_or_link.csv"), "w",
              newline="", encoding="utf-8") as f:
        ww = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        ww.writeheader(); ww.writerows(skipped)
    print("\nSummary:", counts)
    print("Log:", log_path)
    if not a.dry_run:
        import subprocess
        subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_index.py"),
                        "--manifest", a.manifest, "--dest", a.dest], check=False)


def now():
    return datetime.datetime.now().isoformat(timespec="seconds")


if __name__ == "__main__":
    main()
