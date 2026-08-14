#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""미캔 분석기 JSON → templates/trends.csv 병합.

분석기가 내보내는 `micans_templates_YYYY-MM-DD.json`을 받아,
컷당 여러 행(검색 키워드마다 한 행)으로 풀어 trends.csv 에 이어붙인다.

핵심 원칙:
- 신뢰하는 신호만 뽑는다 (승인일·검색순위·페이지수·프리미엄·이름·카테고리).
- 도구가 제목 첫/두 번째 단어로 만든 "색상/무드" 태그는 부정확하므로 버린다.
- 스테디셀러 플래그(승인 30일↑ AND 검색순위 20위 이내)를 인입 시점에 계산해 붙인다.
- 원본 JSON은 templates/imports/ 에 그대로 남긴다 (재계산·감사용).

사용법:
    python3 intake.py <micans_templates_YYYY-MM-DD.json>
    python3 intake.py <파일> --dry-run
"""
import argparse
import csv
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone

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
TEMPLATES_DIR = os.path.join(ROOT, "templates")
IMPORTS_DIR = os.path.join(TEMPLATES_DIR, "imports")
TRENDS_CSV = os.path.join(TEMPLATES_DIR, "trends.csv")

# 컬럼은 두 갈래로 나뉜다 (GPT 지적 반영):
#  · RAW  = 분석기가 준 값을 그대로 옮긴 것. 절대 덮어쓰지 않는다.
#  · 파생 = 우리 규칙으로 계산한 것. 규칙이 바뀌면 RAW 로부터 다시 계산하면 된다.
# 원본 JSON 전체는 templates/imports/ 에 무손실 보존되므로 최종 재계산 근거는 항상 남는다.
COLUMNS = [
    # ---- RAW (원본 보존, 덮어쓰기 금지) ----
    "수집일",         # [RAW] observedAt — JSON exportedAt 의 날짜. 우리가 관찰한 시각
    "템플릿ID",       # [RAW] 분석기의 id (썸네일 고유번호)
    "이름",           # [RAW] name — 분석기가 img alt 또는 API title 로 채운 값
    "썸네일날짜",     # [RAW] thumbDateRaw — 썸네일 URL 에서 뽑은 날짜. 코드상 '승인일'로
                      #        검증된 값이 아님. '썸네일 기준 날짜 신호'로만 취급 (GPT 지적)
    "카테고리",       # [RAW] 첫 세그먼트만 (예: cardnews, presentation)
    "검색키워드",     # [RAW] 이 템플릿이 어떤 검색어로 발견됐나. 없으면 빈 칸
    "순위",           # [RAW] 그 검색어에서 처음 발견된 순서. 세션마다 달라질 수 있는 '노출 순서'.
                      #        수집일(관찰시각)과 한 행에 묶여 저장 → 행이 쌓이면 곧 순위 이력
    "페이지수",       # [RAW] 다중 페이지 여부 (카드뉴스 5장 등)
    "프리미엄",       # [RAW] 유료 템플릿 여부 (O/X)
    "폭", "높이",     # [RAW] 썸네일 픽셀 크기 (비율 계산용)
    "노출횟수",       # [RAW] seenCount — 여러 세션에서 본 누적
    "썸네일URL",      # [RAW] 시각 확인·리서치용
    # ---- 파생 (규칙으로 계산, RAW 로부터 언제든 재계산 가능) ----
    "노출후보플래그", # [파생] 썸네일날짜 EXPOSURE_MIN_DAYS↑ · 순위 EXPOSURE_MAX_RANK 이내 → O.
                      #        '판매' 증거 아님. '검색 노출 기반 후보' 신호일 뿐
    "신호라벨",       # [파생] signalLabel — 이 행이 어떤 종류의 신호인지 사람 언어로
    "신뢰도",         # [파생] confidence — 이 행 신호를 얼마나 믿을지 (높음/중간/낮음)
    "판정규칙버전",   # [파생] 어떤 규칙 버전으로 파생값을 계산했나 (규칙 바뀌면 재계산 구분용)
]

# 파생 컬럼(RAW 원본 컬럼)만 골라내는 목록 — 재계산 스크립트가 참고한다.
RAW_COLUMNS = [c for c in COLUMNS if c not in
               ("노출후보플래그", "신호라벨", "신뢰도", "판정규칙버전")]

# 썸네일날짜에서 며칠 지났고 순위가 얼마 이내면 '노출 기반 후보'로 볼지.
# 30·20 은 미캔 감으로 잡은 기본값 — 데이터 쌓이면 조정한다.
# 주의: 이 플래그는 '판매·수익'을 뜻하지 않는다. 검색에 오래·앞줄 노출된다는 신호일 뿐.
EXPOSURE_MIN_DAYS = 30
EXPOSURE_MAX_RANK = 20

# 파생값을 만든 규칙의 버전. 판정 기준을 바꾸면 이 값을 올린다 →
# 옛 행과 새 행이 어떤 규칙으로 계산됐는지 CSV 안에서 구분된다.
RULE_VERSION = "1.0"

# category 문자열 안의 " [검색:xxx]" 태그. 여기서 키워드를 뽑는다.
KW_RE = re.compile(r"\[검색:([^\]]+)\]")


def base_category(cat):
    """복수 세그먼트('a | b [검색:x]')의 첫 base 카테고리만."""
    if not cat:
        return ""
    first = cat.split(" | ")[0]
    return first.split(" [")[0]


def days_between(approve_date, import_date):
    """YYYY-MM-DD 두 날짜 사이 일수. 파싱 실패 시 0."""
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            a = datetime.strptime(approve_date, fmt)
            i = datetime.strptime(import_date, "%Y-%m-%d")
            return max(0, (i - a).days)
        except (ValueError, TypeError):
            continue
    return 0


def import_date_of(export):
    """JSON 최상단 exportedAt 에서 YYYY-MM-DD 만 뽑는다. 없으면 오늘."""
    raw = (export or {}).get("exportedAt", "")
    if raw:
        try:
            return raw[:10]
        except Exception:
            pass
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def derive(days, kw, rank):
    """RAW 값(날짜차·키워드·순위)에서 파생 필드를 계산한다.

    이 함수만 파생값을 만든다 — RAW 를 절대 건드리지 않으므로, 규칙이 바뀌면
    imports/ 의 원본이나 CSV 의 RAW 컬럼으로부터 이 함수를 다시 돌리면 재계산된다.
    """
    has_rank = isinstance(rank, (int, float))
    is_candidate = (days >= EXPOSURE_MIN_DAYS and has_rank and rank <= EXPOSURE_MAX_RANK)

    if is_candidate:
        label = "노출기반후보"       # 날짜 오래 + 앞줄 노출 (판매 아님)
    elif kw and has_rank:
        label = "노출관측"           # 검색에서 순위와 함께 관측됨
    else:
        label = "목록관측"           # 카테고리 브라우징으로만 봄 (키워드/순위 없음)

    # 신뢰도: 근거가 많을수록 높다. 노출횟수는 호출부에서 반영하기 애매하므로
    # 여기서는 키워드·순위 유무만으로 잡고, 정밀화는 데이터 쌓인 뒤로 미룬다.
    if kw and has_rank:
        confidence = "중간"
    else:
        confidence = "낮음"

    return {
        "노출후보플래그": "O" if is_candidate else "X",
        "신호라벨": label,
        "신뢰도": confidence,
        "판정규칙버전": RULE_VERSION,
    }


def rows_from_template(t, import_date):
    """한 템플릿 → 검색 키워드마다 한 행. kwr(키워드별 순위)이 여러 개면 여러 행."""
    kwr = t.get("kwr") or {}
    cat = base_category(t.get("category", ""))
    thumb_date = (t.get("thumbDate") or "")[:10]
    days = days_between(thumb_date, import_date) if thumb_date else 0
    seen = t.get("seenCount", "") or ""
    base = {
        "수집일": import_date,
        "템플릿ID": t.get("id", ""),
        "이름": t.get("name", "") or "",
        "썸네일날짜": thumb_date,
        "카테고리": cat,
        "페이지수": t.get("pages", "") or "",
        "프리미엄": "O" if t.get("premium") else "X",
        "폭": t.get("w", "") or "",
        "높이": t.get("h", "") or "",
        "노출횟수": seen,
        "썸네일URL": (t.get("thumb") or "").split("?")[0],
    }
    out = []
    if kwr:
        for kw, rank in kwr.items():
            row = dict(base)
            row["검색키워드"] = kw
            row["순위"] = rank
            row.update(derive(days, kw, rank))
            # 여러 세션 관측(노출횟수≥2)이면 신뢰도 한 단계 올린다
            if str(seen).isdigit() and int(seen) >= 2 and row["신뢰도"] == "중간":
                row["신뢰도"] = "높음"
            out.append(row)
    else:
        # 카테고리 브라우징으로만 본 템플릿 — 키워드/순위 정보 없음
        row = dict(base)
        row["검색키워드"] = ""
        row["순위"] = ""
        row.update(derive(days, "", None))
        out.append(row)
    return out


def load_existing_keys():
    """이미 trends.csv 에 있는 (수집일, 템플릿ID, 검색키워드) 조합. 중복 방지용."""
    if not os.path.exists(TRENDS_CSV):
        return set()
    keys = set()
    with open(TRENDS_CSV, "r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            keys.add((row.get("수집일", ""), row.get("템플릿ID", ""), row.get("검색키워드", "")))
    return keys


def append_rows(rows, dry_run):
    """헤더 없으면 새로 쓰고, 있으면 이어붙인다. 중복 (수집일·템플릿·키워드)는 건너뛴다."""
    existing = load_existing_keys()
    fresh = [r for r in rows if
             (r["수집일"], r["템플릿ID"], r.get("검색키워드", "")) not in existing]
    if dry_run:
        return fresh, len(rows) - len(fresh)

    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    new_file = not os.path.exists(TRENDS_CSV)
    with open(TRENDS_CSV, "a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        if new_file:
            w.writeheader()
        for row in fresh:
            w.writerow({c: row.get(c, "") for c in COLUMNS})
    return fresh, len(rows) - len(fresh)


def preserve_original(json_path, import_date, dry_run):
    """원본 JSON은 imports/ 로 옮겨 보존한다 (재계산·감사용). 이미 있으면 건너뜀."""
    dest = os.path.join(IMPORTS_DIR, "micans_templates_%s.json" % import_date)
    already = os.path.exists(dest)
    if dry_run:
        return dest, ("dry-run(안 씀)" if not already else "이미 있음")
    if already:
        return dest, "이미 있음"
    os.makedirs(IMPORTS_DIR, exist_ok=True)
    shutil.copy2(json_path, dest)
    return dest, "신규 보관"


def main():
    ap = argparse.ArgumentParser(description="미캔 분석기 JSON → trends.csv 인입")
    ap.add_argument("json_path", help="micans_templates_YYYY-MM-DD.json 경로")
    ap.add_argument("--dry-run", action="store_true", help="파일 안 쓰고 결과만 미리 봄")
    args = ap.parse_args()

    with open(args.json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    templates = data.get("templates") or []
    if not templates:
        print("이 파일에는 templates 배열이 비어 있습니다.")
        sys.exit(1)

    import_date = import_date_of(data)
    all_rows = []
    for t in templates:
        all_rows.extend(rows_from_template(t, import_date))

    fresh, skipped = append_rows(all_rows, args.dry_run)
    saved_path, saved_new = preserve_original(args.json_path, import_date, args.dry_run)

    tag = " (dry-run)" if args.dry_run else ""
    print("인입 완료%s" % tag)
    print("  수집일         %s" % import_date)
    print("  원본 템플릿    %d" % len(templates))
    print("  생성 행         %d (검색 키워드 여러 개면 컷당 여러 행)" % len(all_rows))
    print("  신규 추가      %d" % len(fresh))
    print("  중복 건너뜀     %d" % skipped)
    print("  원본 보관      %s%s" % (os.path.relpath(saved_path, ROOT),
                                     "" if saved_new else " (이미 있음)"))
    exposure = sum(1 for r in fresh if r["노출후보플래그"] == "O")
    if exposure:
        print("  노출 기반 후보  %d행 (썸네일날짜 %d일↑ · 순위 %d위 이내 — 판매 아님)"
              % (exposure, EXPOSURE_MIN_DAYS, EXPOSURE_MAX_RANK))
    print("\n다음: python3 .claude/skills/trend-intake/scripts/report.py")


if __name__ == "__main__":
    main()
