#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""판정 규칙이 바뀌었을 때 trends.csv 의 파생 컬럼만 다시 계산한다.

RAW 컬럼(수집일·썸네일날짜·순위 등)은 손대지 않고,
파생 컬럼(노출후보플래그·신호라벨·신뢰도·판정규칙버전)만 현재 규칙으로 새로 채운다.
이게 가능한 이유: 파생값은 전부 RAW 로부터 `intake.derive()` 하나로만 나오기 때문이다.

사용법:
    python3 recompute.py            # trends.csv 를 현재 규칙으로 재계산
    python3 recompute.py --dry-run  # 몇 행이 바뀌는지만 미리 봄

원본이 걱정되면 templates/imports/ 의 JSON 으로 intake 를 다시 돌려도 된다 —
이 스크립트는 그 지름길일 뿐이다.
"""
import argparse
import csv
import os
from datetime import datetime

import intake  # 같은 폴더의 intake.py 재사용 (derive·상수·컬럼 정의)


def main():
    ap = argparse.ArgumentParser(description="trends.csv 파생 컬럼 재계산")
    ap.add_argument("--dry-run", action="store_true", help="파일 안 쓰고 변경 건수만")
    args = ap.parse_args()

    path = intake.TRENDS_CSV
    if not os.path.exists(path):
        raise SystemExit("trends.csv 가 없습니다.")

    with open(path, "r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    changed = 0
    for row in rows:
        thumb_date = row.get("썸네일날짜", "")
        collected = row.get("수집일", "")
        days = intake.days_between(thumb_date, collected) if thumb_date else 0
        kw = row.get("검색키워드", "")
        rank_raw = row.get("순위", "")
        try:
            rank = int(rank_raw)
        except (ValueError, TypeError):
            rank = None
        new = intake.derive(days, kw, rank)
        seen = row.get("노출횟수", "")
        if str(seen).isdigit() and int(seen) >= 2 and new["신뢰도"] == "중간":
            new["신뢰도"] = "높음"
        for k, v in new.items():
            if str(row.get(k, "")) != str(v):
                changed += 1
                row[k] = v

    print("재계산 대상 %d행 · 값이 바뀐 셀 %d개 · 현재 규칙버전 %s"
          % (len(rows), changed, intake.RULE_VERSION))
    if args.dry_run:
        print("(dry-run — 파일은 그대로)")
        return
    if not changed:
        print("바뀐 값이 없어 파일을 다시 쓰지 않았습니다.")
        return

    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=intake.COLUMNS)
        w.writeheader()
        for row in rows:
            w.writerow({c: row.get(c, "") for c in intake.COLUMNS})
    print("재계산 저장 완료: %s" % os.path.relpath(path, intake.ROOT))


if __name__ == "__main__":
    main()
