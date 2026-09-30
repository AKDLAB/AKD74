#!/usr/bin/env python3
"""Refresh the site from Google Scholar.

Reads Prof. Akash Deep's Google Scholar profile and rebuilds the Publications
page: the paper list (journal articles ordered by impact factor, then books and
conference papers), citation counts, h-index, i10-index and the citations-per-
year chart. It also refreshes the Scholar figures (citations, h-index, i10-index,
citations by period) of everyone on the People page who has a Scholar link.

Standard library only. Run from anywhere:

    python3 tools/update_scholar.py            # fetch and rewrite the pages
    python3 tools/update_scholar.py --dry-run  # fetch and report, change nothing

The Mac runs it every Monday through tools/weekly-update.sh, which also
publishes the change. (Not GitHub Actions: Google Scholar refuses GitHub's
servers.) If Scholar refuses the request, or the result looks wrong (far fewer
papers than the page already lists), it stops without touching the pages and
exits with an error.

Editable inputs, next to this script:
  journal-impact-factors.json  journal name (lower case) -> impact factor, for ordering
  scholar-exclude.txt          titles to leave off (other people named "A Deep", broken entries)
"""
import datetime
import html
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
PI_USER = "ZGwOqJkAAAAJ"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
PAGE = 100

CONF_KW = ['ecs meeting', 'meeting abstracts', 'ieee', 'isec', 'conference', 'proceedings', 'workshop',
           'symposium', 'conf.', '대한', 'energy procedia', 'advanced materials research', 'ecce']
BOOK_KW = ['polyoxometalate-based', 'handbook', 'metal organic framework (mofs) catalytic', 'nanosensors for',
           'nanotechnology applications for food', 'elsevier', 'metal-organic frameworks-based hybrid',
           'metal-organic framework-based nanomaterials', 'advanced biosensors for virus',
           'sustainable polymer composites', 'advances in nanosensors', 'next generation point-of-care',
           'nanotechnol. nov.', 'biotechnology: prospects', 'iron control technologies']

TODAY = datetime.date.today()
YEAR = TODAY.year


class Blocked(Exception):
    pass


# ---------------------------------------------------------------- fetching

def fetch(url, tries=3):
    for attempt in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 403):
                raise Blocked(f"Google Scholar refused the request (HTTP {e.code})")
            if attempt == tries - 1:
                raise
            time.sleep(10 * (attempt + 1))
            continue
        if "gs_captcha" in body or "unusual traffic" in body or "id=\"gs_captcha" in body:
            raise Blocked("Google Scholar asked for a CAPTCHA")
        return body
    raise RuntimeError("unreachable")


def pause():
    time.sleep(random.uniform(4, 9))


def text(fragment):
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def profile_summary(page):
    """Citations, h-index and i10-index (all time and since), and citations per year."""
    cells = [int(v) for v in re.findall(r'class="gsc_rsb_std">(\d+)<', page)]
    if len(cells) < 6:
        raise RuntimeError("couldn't read the citation table on the Scholar profile")
    since = re.search(r'class="gsc_rsb_sth">Since (\d{4})<', page)
    years = [int(y) for y in re.findall(r'<span class="gsc_g_t"[^>]*>(\d{4})</span>', page)]
    counts = {}
    # Each bar sits right-to-left by z-index (1 = newest year); years with no citations have no bar.
    for z, v in re.findall(r'class="gsc_g_a"[^>]*z-index:(\d+)[^>]*><span class="gsc_g_al">(\d+)</span>', page):
        idx = len(years) - int(z)
        if 0 <= idx < len(years):
            counts[years[idx]] = int(v)
    per_year = [(y, counts.get(y, 0)) for y in years]
    return {
        "citations": cells[0], "citations_since": cells[1],
        "h": cells[2], "h_since": cells[3],
        "i10": cells[4], "i10_since": cells[5],
        "since": int(since.group(1)) if since else YEAR - 5,
        "per_year": per_year,
    }


def profile_rows(page):
    rows = []
    for tr in re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', page, re.S):
        title = re.search(r'class="gsc_a_at">(.*?)</a>', tr, re.S)
        grays = re.findall(r'<div class="gs_gray">(.*?)</div>', tr, re.S)
        cites = re.search(r'class="gsc_a_ac[^"]*">(\d*)</a>', tr)
        year = re.search(r'class="gsc_a_h[^"]*">(\d*)</span>', tr)
        rows.append({
            "t": text(title.group(1)) if title else "",
            "a": text(grays[0]) if grays else "",
            "v": text(grays[1]) if len(grays) > 1 else "",
            "y": year.group(1) if year else "",
            "c": int(cites.group(1)) if cites and cites.group(1) else 0,
        })
    return rows


def profile_url(user, start=0, size=PAGE):
    return f"https://scholar.google.com/citations?user={user}&hl=en&cstart={start}&pagesize={size}"


def fetch_pi():
    first = fetch(profile_url(PI_USER))
    summary = profile_summary(first)
    rows = profile_rows(first)
    start, more = 0, rows
    # A full page means there may be more; Scholar shows at most 100 per page.
    while len(more) == PAGE and start < 3000:
        start += PAGE
        pause()
        more = profile_rows(fetch(profile_url(PI_USER, start)))
        rows += more
    return summary, rows


# ---------------------------------------------------------------- publications page

def norm(t):
    return re.sub(r"[^a-z0-9]", "", t.lower())[:80]


def load_excludes():
    out = []
    for line in open(os.path.join(TOOLS, "scholar-exclude.txt"), encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"):
            out.append(norm(line))
    return out


def excluded(title, excludes):
    n = norm(title)
    return any(n == e or (len(e) >= 20 and n.startswith(e)) for e in excludes)


def journal_of(v):
    v = re.sub(r",\s*(19|20)\d{2}\s*$", "", v)
    v = re.sub(r"\s+\d.*$", "", v)
    v = re.sub(r",.*$", "", v)
    return v.strip()


def sort_pubs(rows):
    IF = json.load(open(os.path.join(TOOLS, "journal-impact-factors.json"), encoding="utf-8"))
    excludes = load_excludes()
    seen = {}
    for p in rows:
        if not p["t"].strip() or excluded(p["t"], excludes):
            continue
        k = norm(p["t"])
        if k in seen and seen[k]["c"] >= p["c"]:
            continue
        seen[k] = p
    journals, confs, books = [], [], []
    for p in seen.values():
        # Scholar shows the year after the venue; keep "Venue, Year" as on the page.
        if p["y"] and not re.search(r"(19|20)\d{2}\s*$", p["v"]):
            p["v"] = (p["v"] + ", " if p["v"] else "") + p["y"]
        p["if"] = IF.get(journal_of(p["v"]).lower())
        low = p["v"].lower()
        if p["if"] is None and any(k in low for k in CONF_KW):
            confs.append(p)
        elif p["if"] is None and any(k in low for k in BOOK_KW):
            books.append(p)
        else:
            journals.append(p)
    yr = lambda p: int(p["y"]) if p["y"] else 0
    journals.sort(key=lambda p: (-(p["if"] or 0), -p["c"], -yr(p)))
    confs.sort(key=lambda p: -yr(p))
    books.sort(key=lambda p: -yr(p))
    return journals, books, confs


E = html.escape


def item(p):
    authors = E(p["a"]).replace("A Deep", "<strong>A Deep</strong>")
    cites = f'<span class="cites">Cited by {p["c"]}</span>' if p["c"] else ""
    return (f'<li><div class="pub-title">{E(p["t"])}</div>'
            f'<div class="pub-authors">{authors}</div>'
            f'<div class="pub-venue">{E(p["v"])}{cites}</div></li>')


def section(title, items):
    lis = "\n".join(item(p) for p in items)
    return (f'<h2 class="group-subtitle">{title} <span class="count">({len(items)})</span></h2>\n'
            f'<ol class="pub-list" start="1">\n{lis}\n</ol>\n')


def column_chart(cites):
    slot, bar_w, top, plot_h, axis_h = 30, 18, 20, 100, 20
    w, base = slot * len(cites), top + plot_h
    full = [v for y, v in cites if y != YEAR] or [1]
    peak = max(full)
    peak_year = next(y for y, v in cites if v == peak and y != YEAR) if cites else YEAR
    last = cites[-1][0]
    out = [f'<svg class="col-chart" viewBox="0 0 {w} {base + axis_h}" role="img" '
           f'aria-label="Citations per year, {cites[0][0]} to {last}. Peak of {peak:,} in {peak_year}.">',
           f'<line class="baseline" x1="0" x2="{w}" y1="{base + 0.5}" y2="{base + 0.5}"/>']
    for i, (yr, v) in enumerate(cites):
        h = max(min(v / peak, 1) * plot_h, 1.5)
        x, y, r = i * slot + (slot - bar_w) / 2, base - h, min(4, h)
        cls = "bar bar--peak" if (v == peak and yr != YEAR) else ("bar bar--partial" if yr == YEAR else "bar")
        d = (f"M{x},{base}V{y + r:.1f}Q{x},{y:.1f} {x + r},{y:.1f}H{x + bar_w - r}"
             f"Q{x + bar_w},{y:.1f} {x + bar_w},{y + r:.1f}V{base}Z")
        label = f'{yr}{" (to date)" if yr == YEAR else ""}: {v:,} citations'
        out.append(f'<path class="{cls}" style="--i:{i}" d="{d}"/>')
        out.append(f'<rect class="hit" x="{i * slot}" y="{top - 16}" width="{slot}" height="{plot_h + 16}" '
                   f'tabindex="0" aria-label="{label}" data-tip="{label}"/>')
        if v == peak and yr != YEAR:
            out.append(f'<text class="peak-label" x="{x + bar_w / 2}" y="{y - 6:.1f}">{v:,}</text>')
    out.append(f'<text class="axis-label" x="{slot / 2}" y="{base + 15}">{cites[0][0]}</text>')
    star = "*" if last == YEAR else ""
    out.append(f'<text class="axis-label" x="{w - slot / 2}" y="{base + 15}">{last}{star}</text>')
    out.append("</svg>")
    return "\n".join(out)


def ring(value, of, caption):
    r, c = 42, 2 * 3.14159265 * 42
    dash = value / of * c if of else 0
    return (f'<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">'
            f'<circle class="ring-track" cx="50" cy="50" r="{r}"/>'
            f'<circle class="ring-fill" cx="50" cy="50" r="{r}" transform="rotate(-90 50 50)" '
            f'style="--len:{c:.1f};--val:{dash:.1f}"/></svg>'
            f'<div class="ring-caption"><span class="swatch swatch--1"></span>{caption}</div>')


def donut(parts):
    r, c, gap = 42, 2 * 3.14159265 * 42, 2
    tot = sum(v for _, v, _ in parts)
    segs, legend, start = [], [], 0.0
    for i, (name, v, cls) in enumerate(parts):
        seg = v / tot * c
        segs.append(f'<circle class="donut-seg {cls}" cx="50" cy="50" r="{r}" transform="rotate(-90 50 50)" '
                    f'style="--val:{max(seg - gap, 0.5):.1f};--len:{c:.1f};--off:{-start:.1f};--i:{i}" '
                    f'data-key="{cls}"/>')
        legend.append(f'<li data-key="{cls}"><span class="swatch {cls.replace("seg", "swatch")}"></span>'
                      f'{name}<strong>{v}</strong></li>')
        start += seg
    return (f'<div class="donut-wrap"><svg class="donut" viewBox="0 0 100 100" role="img" '
            f'aria-label="{", ".join(f"{n}: {v}" for n, v, _ in parts)}">{"".join(segs)}</svg>'
            f'<div class="donut-center"><span class="stat-num" data-count="{tot}">{tot}</span></div></div>'
            f'<ul class="donut-legend">{"".join(legend)}</ul>')


def publications_section(s, journals, books, confs):
    cites = [(y, v) for y, v in s["per_year"] if y >= 2012] or s["per_year"]
    rows = "".join(f'<tr><td>{y}{"*" if y == YEAR else ""}</td><td>{v:,}</td></tr>' for y, v in cites)
    total = len(journals) + len(books) + len(confs)
    month = TODAY.strftime("%B %Y")
    body = (section("Journal Articles &mdash; ordered by journal impact factor", journals)
            + section("Books &amp; Book Chapters", books)
            + section("Conference Papers &amp; Proceedings", confs))
    stats = f'''<div class="stats-row reveal">
      <div class="stat stat--wide tilt">
        <div class="stat-inner">
          <div class="stat-head">
            <div><div class="stat-label">Citations</div>
              <div class="stat-num" data-count="{s["citations"]}">{s["citations"]:,}</div>
              <div class="stat-sub">{s["citations_since"]:,} since {s["since"]}</div></div>
            <div class="stat-note">Citations per year</div>
          </div>
          <div class="chart-box">{column_chart(cites)}<div class="chart-tip" hidden></div></div>
          <details class="stat-data"><summary>Show data</summary>
            <table><thead><tr><th>Year</th><th>Citations</th></tr></thead><tbody>{rows}</tbody></table>
          </details>
          <p class="stat-foot">* {YEAR} is year to date. Highlighted bar: best full year.</p>
        </div>
      </div>
      <div class="stat tilt">
        <div class="stat-inner">
          <div class="stat-label">h-index</div>
          <div class="ring-wrap"><div class="ring-box">{ring(s["h_since"], s["h"], f'{s["h_since"]} since {s["since"]}')}
            <div class="ring-center"><span class="stat-num" data-count="{s["h"]}">{s["h"]}</span></div></div></div>
        </div>
      </div>
      <div class="stat tilt">
        <div class="stat-inner">
          <div class="stat-label">i10-index</div>
          <div class="ring-wrap"><div class="ring-box">{ring(s["i10_since"], s["i10"], f'{s["i10_since"]} since {s["since"]}')}
            <div class="ring-center"><span class="stat-num" data-count="{s["i10"]}">{s["i10"]}</span></div></div></div>
        </div>
      </div>
      <div class="stat tilt">
        <div class="stat-inner">
          <div class="stat-label">Publications</div>
          {donut([("Journal articles", len(journals), "seg-1"), ("Book chapters", len(books), "seg-2"),
                  ("Conference papers", len(confs), "seg-3")])}
        </div>
      </div>
    </div>'''
    return f'''<section style="padding-bottom:20px;">
  <div class="wrap">
    <h1 class="section-title">Publications</h1>
    <p class="section-sub">Publications of Prof. Akash Deep and the MMST Group ({total} entries).
      Full, up-to-date list on
      <a href="https://scholar.google.com/citations?user={PI_USER}&amp;hl=en" target="_blank" rel="noopener">Google Scholar</a>.</p>

    {stats}

    <p class="pub-note">Journal articles are ordered by the journal's impact factor (highest first).
      Citation counts from Google Scholar, {month}; updated automatically every week.</p>

{body}
  </div>
</section>'''


# ---------------------------------------------------------------- people page

def split_by_period(s):
    """Citations in two-year periods ending with this year, plus everything earlier or undated."""
    first = YEAR - 7 if YEAR % 2 == 0 else YEAR - 6   # 2026 -> 2019-20, 21-22, 23-24, 25-26
    per = dict(s["per_year"])
    out, counted = [], 0
    for start in range(first, YEAR + 1, 2):
        v = per.get(start, 0) + per.get(start + 1, 0)
        counted += v
        label = f"{start}–{str(start + 1)[2:]}" + ("*" if start + 1 >= YEAR else "")
        out.append([label, v])
    return [["Earlier / undated", max(s["citations"] - counted, 0)]] + out


def scholar_user(url):
    m = re.search(r"user=([\w-]+)", url)
    return m.group(1) if m else None


def update_people(path, summaries):
    page = open(path, encoding="utf-8").read()
    m = re.search(r'(<script type="application/json" id="people-data">\s*)(.*?)(\s*</script>)', page, re.S)
    data = json.loads(m.group(2))
    changed = []
    for key, person in data.items():
        sch = person.get("scholar")
        if not sch or not sch.get("url"):
            continue
        s = summaries.get(scholar_user(sch["url"]))
        if not s:
            continue
        sch["citations"] = f'{s["citations"]:,}'
        sch["h"] = s["h"]
        sch["i10"] = s["i10"]
        sch["split"] = split_by_period(s)
        changed.append(key)
    new = page[:m.start(2)] + json.dumps(data, indent=2, ensure_ascii=False) + page[m.end(2):]
    return new, changed


# ---------------------------------------------------------------- main

def main():
    dry = "--dry-run" in sys.argv
    pubs_path = os.path.join(ROOT, "publications.html")
    people_path = os.path.join(ROOT, "people.html")
    old_pubs = open(pubs_path, encoding="utf-8").read()
    old_count = len(re.findall(r'<div class="pub-title">', old_pubs))

    try:
        pi, rows = fetch_pi()
    except Blocked as e:
        print(f"Stopped: {e}. The site was left as it is.", file=sys.stderr)
        return 2
    journals, books, confs = sort_pubs(rows)
    total = len(journals) + len(books) + len(confs)
    print(f"Scholar: {len(rows)} entries, {total} after exclusions "
          f"({len(journals)} journal, {len(books)} book, {len(confs)} conference); "
          f"citations {pi['citations']:,}, h {pi['h']}, i10 {pi['i10']}")
    # A page that suddenly lists far fewer papers means Scholar sent something odd.
    if total < old_count * 0.9 or pi["citations"] <= 0:
        print(f"Stopped: only {total} papers (the page lists {old_count}). The site was left as it is.",
              file=sys.stderr)
        return 3

    summaries = {PI_USER: pi}
    people_html = open(people_path, encoding="utf-8").read()
    for url in re.findall(r'"url":\s*"(https://scholar\.google\.com/citations\?[^"]+)"', people_html):
        user = scholar_user(url)
        if user and user not in summaries:
            pause()
            try:
                summaries[user] = profile_summary(fetch(profile_url(user, 0, 20)))
            except Blocked as e:
                print(f"Stopped: {e}. The site was left as it is.", file=sys.stderr)
                return 2
            print(f"Scholar {user}: citations {summaries[user]['citations']:,}, "
                  f"h {summaries[user]['h']}, i10 {summaries[user]['i10']}")

    start = old_pubs.index("<section")
    end = old_pubs.index("</section>") + len("</section>")
    new_pubs = old_pubs[:start] + publications_section(pi, journals, books, confs) + old_pubs[end:]
    new_people, people_changed = update_people(people_path, summaries)

    for path, old, new in ((pubs_path, old_pubs, new_pubs), (people_path, people_html, new_people)):
        name = os.path.basename(path)
        if old == new:
            print(f"{name}: no change")
        elif dry:
            print(f"{name}: would change (dry run)")
        else:
            open(path, "w", encoding="utf-8").write(new)
            print(f"{name}: updated")
    print("People with Scholar figures:", ", ".join(people_changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
