# -*- coding: utf-8 -*-
"""
스톡 메타데이터 회귀 검사기.

seo/metadata/*.csv 를 seo/platform-limits.yaml + keyword-governance.md 규칙에
대해 검사한다. 통과 못 하면 종료코드 1 (CI 게이트로 물릴 수 있음).

usage:
    python3 seo/seo-check.py            # 전체 배치
    python3 seo/seo-check.py kawaii_24  # 특정 배치만
"""
import csv
import os
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
META_DIR = os.path.join(HERE, "metadata")
LIMITS_PATH = os.path.join(HERE, "platform-limits.yaml")

REQUIRED_COLUMNS = ["filename", "asset_type", "title_en", "title_ko",
                    "keywords_en", "keywords_ko", "category", "batch"]


def load_limits():
    with open(LIMITS_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def split_kw(s):
    return [k.strip() for k in s.split(",") if k.strip()]


def check_row(row, limits, errors, warnings):
    plat = limits["platforms"][limits["default_platform"]]
    kw_max = plat["keywords_max"]
    kw_min = plat["keywords_recommended_min"]
    ko_min = limits["korean_keywords"]["recommended_min"]
    title_max = plat["title_max_chars"]
    title_rec = plat["title_recommended_chars"]
    banned = {b.lower() for b in limits["banned_terms"]}
    asset_ok = set(limits["asset_types"])
    motion_any = {m.lower() for m in limits["video_motion_keywords_any"]}

    fn = row.get("filename", "?")

    # 필수 컬럼
    for col in REQUIRED_COLUMNS:
        if not row.get(col, "").strip():
            errors.append(f"{fn}: 필수 컬럼 '{col}' 비어있음")

    # asset_type
    at = row.get("asset_type", "").strip()
    if at and at not in asset_ok:
        errors.append(f"{fn}: asset_type '{at}' 허용값 아님 {sorted(asset_ok)}")

    en = split_kw(row.get("keywords_en", ""))
    ko = split_kw(row.get("keywords_ko", ""))

    # 개수
    if len(en) < kw_min:
        errors.append(f"{fn}: 영문 키워드 {len(en)}개 < 권장하한 {kw_min}")
    if len(en) > kw_max:
        errors.append(f"{fn}: 영문 키워드 {len(en)}개 > 하드상한 {kw_max}")
    if len(ko) < ko_min:
        errors.append(f"{fn}: 한글 키워드 {len(ko)}개 < 권장하한 {ko_min}")

    # 중복 (대소문자 무시)
    for label, kws in (("EN", en), ("KO", ko)):
        seen, dups = set(), set()
        for k in kws:
            lk = k.lower()
            if lk in seen:
                dups.add(k)
            seen.add(lk)
        if dups:
            errors.append(f"{fn}: {label} 키워드 중복 {sorted(dups)}")

    # 금지어
    for k in en + ko:
        if k.lower() in banned:
            errors.append(f"{fn}: 금지어(브랜드/상표) '{k}'")

    # 제목 길이
    for tcol in ("title_en", "title_ko"):
        t = row.get(tcol, "")
        if len(t) > title_max:
            errors.append(f"{fn}: {tcol} {len(t)}자 > 상한 {title_max}")
        elif len(t) > title_rec:
            warnings.append(f"{fn}: {tcol} {len(t)}자 (권장 {title_rec} 초과)")

    # 비디오면 모션 키워드 필수
    if at == "video":
        low = {k.lower() for k in en}
        if not (low & motion_any):
            errors.append(f"{fn}: asset_type=video 인데 모션 키워드 없음 (하나 이상 필요)")
        if not row.get("filename", "").lower().endswith(".mp4"):
            warnings.append(f"{fn}: video 파일명이 .mp4 아님")


def check_file(path, limits):
    errors, warnings = [], []
    with open(path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        errors.append(f"{os.path.basename(path)}: 행 없음")
    for row in rows:
        check_row(row, limits, errors, warnings)
    return len(rows), errors, warnings


def main():
    limits = load_limits()
    target = sys.argv[1] if len(sys.argv) > 1 else None

    files = sorted(f for f in os.listdir(META_DIR) if f.endswith(".csv"))
    if target:
        files = [f for f in files if f[:-4] == target]
        if not files:
            print(f"배치 '{target}' 없음 (metadata/{target}.csv)")
            return 1

    total_err = 0
    for fname in files:
        path = os.path.join(META_DIR, fname)
        n, errors, warnings = check_file(path, limits)
        status = "PASS" if not errors else "FAIL"
        mark = "✓" if not errors else "✗"
        print(f"{mark} {fname}: {n}행 · {status} "
              f"(에러 {len(errors)} · 경고 {len(warnings)})")
        for w in warnings:
            print(f"    ⚠ {w}")
        for e in errors:
            print(f"    ✗ {e}")
        total_err += len(errors)

    print()
    if total_err:
        print(f"검사 실패 — 총 에러 {total_err}건. 업로드용 아님.")
        return 1
    print("전체 통과. 업로드 준비 완료.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
