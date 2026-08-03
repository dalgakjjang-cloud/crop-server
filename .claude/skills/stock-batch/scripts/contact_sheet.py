#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""배치 콘택트시트 — 만들 컷을 한눈에 보고, 산출 수량을 대조한다.

stock-batch 5단계(검수·패키징)의 도구다. 아직 이미지는 없고 프롬프트만 있는
단계에서, "무엇을 몇 개 만들지"를 색 팔레트까지 시각화해 한 장(HTML)으로 보여준다.

두 가지 일을 한다 (지피티 5단계 권고 반영):
  1. 미리보기  — 컷별 라벨·제목·형태·색칩을 카드로. 색이 의도대로 통일됐는지 눈으로 검수.
  2. 수량 대조 — 선언 count vs sources 컷 vs 메타데이터 CSV 행 vs clean 프롬프트 줄 수를
                4중 대조. 하나라도 어긋나면 빨갛게 표시 → "86개 실수" 같은 사고를 원천 차단.

사용법:
    python3 contact_sheet.py chuseok_bg_8 chuseok_png_12 chuseok_frame_6
    python3 contact_sheet.py chuseok_bg_8 --title "추석 부품 세트" --out previews/추석.html

정본은 sources/<batch>.json. 이미지가 생긴 뒤에도 같은 시트로 "다 나왔나" 대조하면 된다.
"""
import argparse
import csv
import glob
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def find_repo_root(start):
    d = start
    for _ in range(8):
        if os.path.isdir(os.path.join(d, "freejjang-stock-studio")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    raise SystemExit("저장소 루트를 찾지 못했습니다 (freejjang-stock-studio/ 없음).")


ROOT = find_repo_root(HERE)
STUDIO = os.path.join(ROOT, "freejjang-stock-studio")
SOURCES = os.path.join(STUDIO, "seo", "sources")
METADATA = os.path.join(STUDIO, "seo", "metadata")
PROMPTS = os.path.join(STUDIO, "prompts")
PREVIEWS = os.path.join(STUDIO, "seo", "previews")


def load_spec(batch):
    path = os.path.join(SOURCES, "%s.json" % batch)
    if not os.path.exists(path):
        raise SystemExit("스펙이 없습니다: seo/sources/%s.json" % batch)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def count_csv_rows(batch):
    """메타데이터 CSV 행 수 (헤더 제외). 없으면 None."""
    path = os.path.join(METADATA, "%s.csv" % batch)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8", newline="") as f:
        return sum(1 for _ in csv.reader(f)) - 1


def count_clean_lines(batch, slug):
    """clean 프롬프트 줄 수 = 배치 입력창에 붙일 줄 = 컷 수. 없으면 None."""
    hits = glob.glob(os.path.join(PROMPTS, "*", "miricanvas_%s_*_GenSpark_clean.txt" % batch))
    if not hits:
        # slug 기반 파일명도 시도 (batch와 slug가 다를 때)
        hits = glob.glob(os.path.join(PROMPTS, "*", "*%s*_clean.txt" % slug))
    if not hits:
        return None
    with open(hits[0], "r", encoding="utf-8") as f:
        return sum(1 for line in f if line.strip())


def reconcile(spec, batch):
    """4중 수량 대조. (선언, sources, csv, clean) 튜플과 일치 여부."""
    declared = spec.get("count")
    n_cuts = len(spec.get("cuts", []))
    n_csv = count_csv_rows(batch)
    n_clean = count_clean_lines(batch, spec.get("slug", batch))
    nums = [n for n in (declared, n_cuts, n_csv, n_clean) if n is not None]
    ok = len(set(nums)) == 1
    return {"declared": declared, "cuts": n_cuts, "csv": n_csv,
            "clean": n_clean, "ok": ok, "n": n_cuts}


def esc(s):
    return html.escape(str(s if s is not None else ""))


def contrast_text(hexcode):
    """배경 hex에 대비되는 글자색 (밝으면 검정, 어두우면 흰)."""
    h = hexcode.lstrip("#")
    try:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except (ValueError, IndexError):
        return "#000"
    # 상대 밝기 (YIQ)
    return "#111" if (r * 299 + g * 587 + b * 114) / 1000 > 140 else "#fff"


def swatch(p):
    hexcode = "#" + str(p.get("hex", "")).lstrip("#")
    name = esc(p.get("name", ""))
    fg = contrast_text(hexcode)
    return ('<span class="sw" style="background:%s;color:%s" title="%s">%s</span>'
            % (hexcode, fg, name, esc(hexcode.upper())))


def cut_card(cut):
    palette = cut.get("palette", []) or []
    chips = "".join(swatch(p) for p in palette)
    label = esc(cut.get("label_ko") or cut.get("axis_subject", ""))
    return """
    <div class="card">
      <div class="card-h">
        <span class="num">%02d</span>
        <span class="shape">%s</span>
      </div>
      <div class="label">%s</div>
      <div class="title">%s</div>
      <div class="axis">%s · %s</div>
      <div class="chips">%s</div>
    </div>""" % (
        cut.get("n", 0),
        esc(cut.get("shape", "")),
        label,
        esc(cut.get("title_ko", "")),
        esc(cut.get("axis_subject", "")),
        esc(cut.get("axis_color", "")),
        chips,
    )


def batch_section(spec, batch):
    rec = reconcile(spec, batch)
    cells = []
    for key, lab in (("declared", "선언"), ("cuts", "스펙"), ("csv", "CSV"), ("clean", "clean")):
        v = rec[key]
        cells.append('<td>%s<b>%s</b></td>' % (lab + " ", "—" if v is None else v))
    badge = ('<span class="ok">✓ 수량 일치</span>' if rec["ok"]
             else '<span class="bad">⚠ 수량 불일치 — 확인 필요</span>')
    cards = "".join(cut_card(c) for c in spec.get("cuts", []))
    note = esc(spec.get("header_note", ""))
    return """
  <section>
    <h2>%s <span class="cnt">%d컷</span></h2>
    <p class="note">%s</p>
    <table class="recon">
      <tr>%s<td class="badge">%s</td></tr>
    </table>
    <div class="grid">%s</div>
  </section>""" % (esc(batch), rec["n"], note, "".join(cells), badge, cards)


CSS = """
* { box-sizing: border-box; }
body { margin:0; font-family: -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;
       background:#faf8f3; color:#222; line-height:1.5; }
:root[data-theme="dark"] body, :root:not([data-theme="light"]) body {}
@media (prefers-color-scheme: dark) {
  body { background:#1a1a1e; color:#e8e6e0; }
}
:root[data-theme="dark"] body { background:#1a1a1e; color:#e8e6e0; }
:root[data-theme="light"] body { background:#faf8f3; color:#222; }
header { padding:28px 24px 8px; }
h1 { margin:0 0 4px; font-size:22px; }
.sub { opacity:.7; font-size:14px; margin:0; }
.total { margin:12px 24px 0; padding:10px 14px; border-radius:10px;
         background:#eee7d6; font-size:14px; display:inline-block; }
@media (prefers-color-scheme: dark){ .total{ background:#2a2a30; } }
:root[data-theme="dark"] .total{ background:#2a2a30; }
:root[data-theme="light"] .total{ background:#eee7d6; }
.total b { font-size:16px; }
section { padding:8px 24px 24px; }
h2 { font-size:17px; margin:20px 0 4px; border-bottom:2px solid #d8cfb8; padding-bottom:6px; }
@media (prefers-color-scheme: dark){ h2{ border-color:#3a3a42; } }
.cnt { font-size:13px; opacity:.6; font-weight:normal; }
.note { font-size:13px; opacity:.75; margin:4px 0 10px; }
.recon { border-collapse:collapse; font-size:13px; margin-bottom:14px; }
.recon td { padding:4px 12px; border:1px solid #ddd4bf; }
@media (prefers-color-scheme: dark){ .recon td{ border-color:#3a3a42; } }
.recon b { margin-left:2px; }
.badge { border:none !important; }
.ok { color:#2e7d32; font-weight:600; }
.bad { color:#c62828; font-weight:700; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:12px; }
.card { border:1px solid #e2d9c2; border-radius:12px; padding:12px 14px; background:#fff; }
@media (prefers-color-scheme: dark){ .card{ background:#232329; border-color:#38383f; } }
:root[data-theme="dark"] .card{ background:#232329; border-color:#38383f; }
:root[data-theme="light"] .card{ background:#fff; border-color:#e2d9c2; }
.card-h { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.num { font-weight:700; font-size:15px; opacity:.55; }
.shape { font-size:11px; padding:2px 8px; border-radius:999px; background:#f0ead9; opacity:.9; }
@media (prefers-color-scheme: dark){ .shape{ background:#33333b; } }
.label { font-weight:700; font-size:14px; }
.title { font-size:12px; opacity:.7; margin:2px 0 6px; }
.axis { font-size:11px; opacity:.55; margin-bottom:8px; }
.chips { display:flex; flex-wrap:wrap; gap:5px; }
.sw { font-size:10px; padding:3px 7px; border-radius:6px; font-weight:600;
      border:1px solid rgba(0,0,0,.08); letter-spacing:.3px; }
"""


def build_html(specs, title):
    total_cuts = sum(len(s["cuts"]) for _, s in specs)
    all_ok = all(reconcile(s, b)["ok"] for b, s in specs)
    status = ('<span class="ok">전 배치 수량 일치 ✓</span>' if all_ok
              else '<span class="bad">일부 배치 수량 불일치 ⚠</span>')
    sections = "".join(batch_section(s, b) for b, s in specs)
    return """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s</title><style>%s</style></head><body>
<header>
  <h1>%s</h1>
  <p class="sub">제작 미리보기 · 색 팔레트 검수 · 수량 대조 (stock-batch 5단계)</p>
</header>
<div class="total">배치 %d개 · 총 <b>%d컷</b> · %s</div>
%s
</body></html>""" % (esc(title), CSS, esc(title), len(specs), total_cuts, status, sections)


def main():
    ap = argparse.ArgumentParser(description="배치 콘택트시트(제작 미리보기+수량 대조) 생성")
    ap.add_argument("batches", nargs="+", help="배치명 (예: chuseok_bg_8 chuseok_png_12)")
    ap.add_argument("--title", default="", help="시트 제목")
    ap.add_argument("--out", default="", help="출력 경로 (기본 seo/previews/<첫배치>.html)")
    args = ap.parse_args()

    specs = [(b, load_spec(b)) for b in args.batches]
    title = args.title or ("배치 콘택트시트 — %s" % ", ".join(args.batches))

    if args.out:
        out = args.out if os.path.isabs(args.out) else os.path.join(ROOT, args.out)
    else:
        os.makedirs(PREVIEWS, exist_ok=True)
        out = os.path.join(PREVIEWS, "%s.html" % args.batches[0])
    os.makedirs(os.path.dirname(out), exist_ok=True)

    with open(out, "w", encoding="utf-8") as f:
        f.write(build_html(specs, title))

    print("콘택트시트 생성: %s" % os.path.relpath(out, ROOT))
    print()
    print("수량 대조:")
    all_ok = True
    for b, s in specs:
        r = reconcile(s, b)
        mark = "✓" if r["ok"] else "⚠ 불일치"
        all_ok = all_ok and r["ok"]
        print("  %-18s 선언 %s · 스펙 %s · CSV %s · clean %s  %s"
              % (b, r["declared"], r["cuts"], r["csv"], r["clean"], mark))
    print()
    total = sum(len(s["cuts"]) for _, s in specs)
    print("  총 %d컷 · %s" % (total, "전량 일치 ✓" if all_ok else "불일치 있음 ⚠ — 확인 필요"))


if __name__ == "__main__":
    main()
