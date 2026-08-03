#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""trends.csv → 사람이 훑을 수 있는 마크다운 리포트.

인입된 데이터가 쌓이면 '이번 주 뭐 뜨나 / 오래 살아남는 결 뭐 있나'를
사람 언어로 뽑아낸다. 리포트는 templates/reports/ 에 날짜별로 저장.

핵심 관점 3개:
1. 이번 수집의 검색 키워드 TOP N — 상위 순위·최다 등장
2. 스테디셀러 후보 — 승인 오래됐는데 순위 앞줄인 것 (다음 배치 방향의 힌트)
3. 최근 승인 신작 — 지난 N일 안에 승인된 것 (지금 뜨는 결)
"""
import argparse
import csv
import os
from collections import Counter, defaultdict
from datetime import datetime, timedelta

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
    raise SystemExit("저장소 루트를 찾지 못했습니다.")


ROOT = find_repo_root(HERE)
TRENDS_CSV = os.path.join(ROOT, "templates", "trends.csv")
REPORTS_DIR = os.path.join(ROOT, "templates", "reports")


def load_rows():
    if not os.path.exists(TRENDS_CSV):
        raise SystemExit("trends.csv 가 없습니다. 먼저 intake.py 로 JSON 을 인입하세요.")
    with open(TRENDS_CSV, "r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def as_int(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


def top_keywords(rows, limit=15):
    """검색키워드별로: 등장 템플릿 수 · 상위 순위(중앙값) · 스테디 수 · 프리미엄 비율."""
    by_kw = defaultdict(list)
    for r in rows:
        kw = (r.get("검색키워드") or "").strip()
        if not kw:
            continue
        by_kw[kw].append(r)
    out = []
    for kw, rs in by_kw.items():
        ranks = sorted([as_int(r.get("순위")) for r in rs if as_int(r.get("순위")) is not None])
        median = ranks[len(ranks) // 2] if ranks else None
        steady = sum(1 for r in rs if r.get("스테디플래그") == "O")
        prem = sum(1 for r in rs if r.get("프리미엄") == "O")
        out.append({
            "keyword": kw, "count": len(rs),
            "median_rank": median, "steady": steady,
            "premium_pct": round(100 * prem / len(rs)) if rs else 0,
        })
    # 노출 많고 순위 앞쪽인 순서
    out.sort(key=lambda x: (x["count"], -(x["median_rank"] or 999)), reverse=True)
    return out[:limit]


def top_steady(rows, limit=20):
    """스테디 플래그 O 인 것 중 순위 앞쪽·페이지 많은 순서."""
    steady = [r for r in rows if r.get("스테디플래그") == "O"]
    def key(r):
        rank = as_int(r.get("순위")) or 999
        pages = as_int(r.get("페이지수")) or 0
        return (rank, -pages)
    steady.sort(key=key)
    return steady[:limit]


def top_new(rows, days=7, limit=20):
    """수집일 기준 최근 승인 신작. 승인일 최신순."""
    today = datetime.now()
    cutoff = today - timedelta(days=days)
    new = []
    for r in rows:
        approve = r.get("승인일") or ""
        try:
            d = datetime.strptime(approve, "%Y-%m-%d")
        except ValueError:
            continue
        if d >= cutoff:
            new.append((d, r))
    # 중복 템플릿(같은 ID) 제거 — 검색어별로 여러 행 있을 수 있음
    seen = set()
    dedup = []
    for d, r in sorted(new, key=lambda x: x[0], reverse=True):
        tid = r.get("템플릿ID")
        if tid in seen:
            continue
        seen.add(tid)
        dedup.append(r)
    return dedup[:limit]


def kw_line(k):
    md_rank = k["median_rank"] if k["median_rank"] is not None else "-"
    return "| %s | %d | %s | %d | %d%% |" % (
        k["keyword"], k["count"], md_rank, k["steady"], k["premium_pct"])


def cut_line(r):
    name = (r.get("이름") or "(이름 없음)").replace("|", "／")
    return "| %s | %s | %s | %s | %s | %s |" % (
        r.get("승인일", ""), name[:40], r.get("카테고리", ""),
        r.get("페이지수", ""), r.get("검색키워드", ""), r.get("순위", ""))


def build_report(rows, days_new):
    now = datetime.now().strftime("%Y-%m-%d")
    total = len(rows)
    templates = len({r.get("템플릿ID") for r in rows if r.get("템플릿ID")})
    imports = sorted({r.get("수집일") for r in rows if r.get("수집일")})

    lines = []
    lines.append("# 미캔 템플릿 트렌드 리포트 — %s" % now)
    lines.append("")
    lines.append("수집일 기록: %s ~ %s · 총 %d행 · 고유 템플릿 %d개"
                 % (imports[0] if imports else "?", imports[-1] if imports else "?",
                    total, templates))
    lines.append("")
    lines.append("---")
    lines.append("")

    lines.append("## 1. 검색 키워드 TOP")
    lines.append("")
    lines.append("| 키워드 | 노출 템플릿 수 | 순위 중앙값 | 스테디 수 | 프리미엄 비율 |")
    lines.append("|---|---:|---:|---:|---:|")
    kws = top_keywords(rows)
    if kws:
        for k in kws:
            lines.append(kw_line(k))
    else:
        lines.append("| — | — | — | — | — |")
        lines.append("")
        lines.append("> 아직 검색 키워드 데이터가 없어요. 분석기에서 **검색창에 키워드를 넣고** 수집하면 채워져요.")
    lines.append("")

    lines.append("## 2. 스테디셀러 후보 (승인 30일↑ · 순위 20위 이내)")
    lines.append("")
    lines.append("> 오래 살아남으면서 아직도 앞줄에 노출되는 결. **다음 배치의 중심축 후보**.")
    lines.append("")
    lines.append("| 승인일 | 이름 | 카테고리 | 페이지 | 검색어 | 순위 |")
    lines.append("|---|---|---|---:|---|---:|")
    steady = top_steady(rows)
    if steady:
        for r in steady:
            lines.append(cut_line(r))
    else:
        lines.append("| — | — | — | — | — | — |")
        lines.append("")
        lines.append("> 스테디셀러 조건에 걸린 템플릿이 아직 없어요.")
    lines.append("")

    lines.append("## 3. 최근 %d일 승인 신작" % days_new)
    lines.append("")
    lines.append("> 지금 심사를 뚫고 있는 결. **어떤 결이 지금 통과되나** 확인용.")
    lines.append("")
    lines.append("| 승인일 | 이름 | 카테고리 | 페이지 | 검색어 | 순위 |")
    lines.append("|---|---|---|---:|---|---:|")
    fresh = top_new(rows, days=days_new)
    if fresh:
        for r in fresh:
            lines.append(cut_line(r))
    else:
        lines.append("| — | — | — | — | — | — |")
    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## 다음 단계 (사람 검토)")
    lines.append("")
    lines.append("1. 위 표에서 눈에 띄는 키워드·템플릿을 골라 미캔에서 실제로 열어본다")
    lines.append("2. 레이아웃·기능(사진 슬롯 수, 가격 배지, 페이지 구성)을 눈으로 분해한다")
    lines.append("3. 그 결과를 `templates/specs/<주제>.md` 명세서로 옮긴다 (2단계 스킬)")
    lines.append("4. 명세서에서 필요한 부품을 `stock-batch` 스킬로 생성한다")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description="trends.csv → 마크다운 리포트")
    ap.add_argument("--days", type=int, default=7, help="'최근 신작' 기준 일수 (기본 7)")
    ap.add_argument("--out", help="출력 파일 경로. 기본은 templates/reports/<날짜>.md")
    args = ap.parse_args()

    rows = load_rows()
    md = build_report(rows, args.days)
    out = args.out or os.path.join(REPORTS_DIR, "trend-%s.md"
                                   % datetime.now().strftime("%Y-%m-%d"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(md)
    print("리포트 완료: %s (%d행 기반)" % (os.path.relpath(out, ROOT), len(rows)))


if __name__ == "__main__":
    main()
