#!/usr/bin/env python3
"""
Build the browsable library index for /opt/aadi-content (run automatically at the end of fetch.py).

Writes, in the library folder:
  index.html      one page listing every usable item: downloaded files open from the hub (offline);
                  everything else opens at its ORIGINAL web page (online only) — we point to the owner's page,
                  we do not copy it.
  catalogue.json  the same list as data, for the platform's library module to import.

Items left out on purpose: blog copies of official files (the official copy is offline) and old editions.
"""
import argparse, csv, json, os, re, urllib.parse
from datetime import date

SECTION = {"01": ("School (Class 1–12)", "tuition"), "02": ("Exam preparation", "exams"),
           "03": ("Language and reading", "language"), "04": ("Literacy and equivalency", "literacy"),
           "05": ("Life skills and digital", "lifeskills"), "06": ("Counselling and wellbeing", "counselling"),
           "07": ("Teacher development", "teacher"), "08": ("Videos", "video"), "99": ("Other", "other")}
TEACHER_CATS = {"Teacher_Texts", "Teaching_Manuals", "Curriculum_Framework", "Calendars_Plans", "Teacher_Training"}
DOWNLOADABLE = {"GOV_FREE", "OPEN_LICENCE", "PERMITTED"}
ONLINE_LABEL = {"COPYRIGHTED": "Online only · owner's website", "MANUAL": "Online · free sign-in may be needed",
                "LINK_ONLY": "Online · portal / video", "GOV_FREE": "Online · not downloaded yet",
                "OPEN_LICENCE": "Online · not downloaded yet", "PERMITTED": "Online · not downloaded yet"}


def http(u):
    return u if u and re.match(r"https?://", u) else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--dest", required=True)
    a = ap.parse_args()
    import importlib.util
    spec = importlib.util.spec_from_file_location("fetch", os.path.join(os.path.dirname(os.path.abspath(__file__)), "fetch.py"))
    fetch = importlib.util.module_from_spec(spec); spec.loader.exec_module(fetch)

    rows = list(csv.DictReader(open(a.manifest, encoding="utf-8")))
    gpath = os.path.join(os.path.dirname(os.path.abspath(a.manifest)), "lists", "permissions_granted.csv")
    granted = set()
    if os.path.exists(gpath):
        granted = {g["owner_id"].strip() for g in csv.DictReader(open(gpath, encoding="utf-8")) if g.get("owner_id")}

    # latest good file(s) per manifest row from the download log
    files = {}
    log = os.path.join(a.dest, "_reports", "download_log.csv")
    if os.path.exists(log):
        for l in csv.DictReader(open(log, encoding="utf-8")):
            if l["status"] in ("downloaded", "exists") and l["file"]:
                p = os.path.join(l["folder"], l["file"])
                if os.path.exists(os.path.join(a.dest, p)):
                    files.setdefault(l["manifest_id"], {})[p] = l

    items = []
    for r in rows:
        lc = r["licence_class"]
        if lc in ("COPYRIGHTED", "MANUAL") and r.get("owner_id") in granted:
            lc = "PERMITTED"
        if lc in ("MIRROR", "OUTDATED"):
            continue
        folder = fetch.folder_for(r)
        top = folder.split("/")[0][:2]
        section, track = SECTION.get(top, SECTION["99"])
        audience = "teacher" if (r["category"] in TEACHER_CATS or
                                 re.search(r"answer key|teacher|handbook|manual|scheme of work", r["title"], re.I)) else "learner"
        base = dict(manifest_id=r["id"], section=section, track=track, category=r["category"],
                    cls=r.get("class", ""), subject=r.get("subject", ""), medium=r.get("medium", ""),
                    edition=r.get("edition_year", ""), owner=r.get("publisher_owner", ""), owner_id=r.get("owner_id", ""),
                    licence=lc, licence_detail=r.get("licence_detail", ""), audience=audience,
                    source_page=http(r.get("source_page", "")))
        got = files.get(r["id"])
        if lc in DOWNLOADABLE and got:
            for p, l in got.items():
                title = r["title"] if len(got) == 1 else os.path.splitext(l["file"])[0].replace("_", " ")
                items.append(dict(base, title=title, access="offline",
                                  href=urllib.parse.quote(p), bytes=int(l["bytes"] or 0), sha256=l["sha256"]))
            continue
        # online only: COPYRIGHTED and MANUAL open at the page where the owner publishes them
        if lc in ("COPYRIGHTED", "MANUAL"):
            url = http(r.get("source_page")) or http(r.get("file_url"))
        else:
            url = http(r.get("file_url")) or http(r.get("source_page"))
        if not url:
            continue
        items.append(dict(base, title=r["title"], access="online", href=url, note=ONLINE_LABEL.get(lc, "Online")))

    order = {v[0]: k for k, v in SECTION.items()}
    def ckey(c):
        m = re.search(r"\d+", c or "")
        return int(m.group()) if m else 99
    items.sort(key=lambda i: (order.get(i["section"], "99"), ckey(i["cls"]), i["subject"], i["medium"], i["title"]))

    meta = dict(built=str(date.today()), total=len(items),
                offline=sum(i["access"] == "offline" for i in items),
                online=sum(i["access"] == "online" for i in items))
    json.dump(dict(meta=meta, items=items), open(os.path.join(a.dest, "catalogue.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    data = json.dumps(dict(meta=meta, items=items), ensure_ascii=False).replace("</", "<\\/")
    page = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "index_template.html"), encoding="utf-8").read()
    open(os.path.join(a.dest, "index.html"), "w", encoding="utf-8").write(page.replace("__DATA__", data))
    print(f"Library index: {meta['total']} items ({meta['offline']} offline, {meta['online']} online-only) -> "
          f"{os.path.join(a.dest, 'index.html')}")


if __name__ == "__main__":
    main()
