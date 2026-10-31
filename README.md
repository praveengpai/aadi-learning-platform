# AADI Content Library — open and government learning materials

Part of the CIF Learning Platform. This folder holds the **catalogue and downloader** for every learning material
we found that is free to download from a government source or under an open licence, organised for the AADI
Smart Learning Centre (Komalikudi, Idukki): Class 1–SSLC tuition, PSC/SSC/bank coaching, language, literacy,
life skills and counselling.

Built 31 Oct 2026 from: the "Text Books All" blog (textbooksall.co.in), traced back to each file's official source;
SCERT Kerala and KITE Samagra; Kerala PSC, SSC, IBPS, RRB; NCERT, NIOS; NCFE, RBI, CERT-In, NCERT-CIET;
Publications Division, PIB, State Planning Board; StoryWeaver (CC BY 4.0) and other open sources.

## How to download (on the server)

```
cd /opt && git clone --depth 1 --branch content-library https://github.com/praveengpai/aadi-learning-platform aadi-content-tools
bash /opt/aadi-content-tools/run.sh            # library goes to /opt/aadi-content
```
It runs in the background (a few hours; ~6–10 GB). Run the same `run.sh` again any time: finished files are
skipped, so it only retries failures and adds new manifest rows. Test first with
`python3 fetch.py --dry-run`.

## Folder structure

```
/opt/aadi-content/
  01_School/                  Textbooks | Teacher_Texts | Activity_Books | Question_Papers | Curriculum_Framework |
                              Calendars_Plans | Scholarship_Exams_LSS_USS_NMMS | Remedial_Catch_Up
        Textbooks/Std_01 … Std_10/<Subject>/<Medium>/<title>__<source-id>.pdf
  02_Exam_Prep/               Kerala_PSC | SSC | Banking | Railways_RRB | NCERT_Textbooks | NIOS | Current_Affairs | Reference
  03_Language/                English | Hindi | Storybooks_Reading | Tribal_Language_Bridge
  04_Literacy_Equivalency/
  05_Life_Skills/             Financial_Literacy | Digital_Literacy | Health_Hygiene | Govt_Schemes | General
  06_Counselling_Wellbeing/   Career_Guidance | Wellbeing | Child_Protection
  07_Teacher_Development/     D.El.Ed and teacher training
  99_Other/
  manifest.csv                every item: title, class, subject, medium, edition, file link, source page, owner, licence
  _lists/                     what was NOT downloaded, and why (see below)
  _reports/download_log.csv   every file: where it came from, size, SHA-256 checksum, date, errors
```
Every downloaded file can be traced back to its source through `_reports/download_log.csv` (file name → source
URL, source page, publisher and licence).

## What the licence classes mean

| Class | Meaning | Downloaded? |
|---|---|---|
| GOV_FREE | Official government file, free to download (SCERT, KITE, PSC, NCERT, NIOS, RBI …). Copyright stays with the government body. | Yes — for use inside AADI centres. Ask before republishing or putting them on a public site. |
| OPEN_LICENCE | Creative Commons or similar (e.g. StoryWeaver CC BY 4.0). | Yes, with attribution. |
| MANUAL | Open or free, but needs a browser or a free login (StoryWeaver, NCERT Barkha flipbooks, DIKSHA, NCFE Malayalam handbook). | No — see `_lists/manual_downloads.csv`. |
| MIRROR | A blog's re-upload of an official SCERT file. The official copy is taken instead. | No |
| OUTDATED | An older edition superseded by the 2024/2025 books. | No — listed for reference |
| COPYRIGHTED | Made by private teachers, blogs, publishers or NGOs. | No — see `_lists/permission_needed.csv` and `_lists/copyright_owners.csv` |
| LINK_ONLY | Portals, apps, video channels (Samagra, First Bell, PSC question search). | No — see `_lists/links_portals_videos.csv` |

## Editions

Kerala's revised textbooks: classes 1, 3, 5, 7, 9 from 2024; classes 2, 4, 6, 8, 10 from 2025. The manifest takes
these from SCERT's own pages. Revised Plus One books (2026) cover languages and humanities only so far.

## Known gaps (not online anywhere — request them)

* Muthuvan / Mannan bridge material (Samagra Shiksha Kerala Idukki — "Padippurasi" modules for Edamalakudy).
* Kerala State Literacy Mission course books (equivalency, Pacha Malayalam, tribal literacy primer).
* Malayalam versions of child-protection, Childline and Tele-MANAS posters; ST Department scheme booklets.
* Kerala Pareeksha Bhavan's SSLC/LSS/USS/NMMS papers (site unreachable during the survey; retry).

## Rights note

Government textbooks are free to download but carry no open licence. Keep them on the centre hubs for AADI learners;
write to SCERT (scertkerala@gmail.com) and KITE (contact@kite.kerala.gov.in) before distributing them further or
hosting them publicly — see `_lists/copyright_owners.csv`.

© Community Innovations Foundation (catalogue and scripts). Listed materials belong to their owners.
