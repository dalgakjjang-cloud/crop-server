#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
agbrowse 배치 자동화 (agbrowse_batch)

txt 파일에 담긴 프롬프트를 ChatGPT / Gemini / Grok 웹 UI에 순서대로 입력해
이미지를 대량 생성합니다. 실제 브라우저 화면을 조작하는 방식이며, 사람이 직접
하는 것처럼 불규칙한 대기(휴먼 페이싱)를 넣습니다.

    프롬프트 txt → agbrowse web-ai query(브라우저 조작) → 이미지 저장 → 텀 두고 반복

이 스크립트는 이미지 생성 자체를 직접 하지 않습니다. Node CLI인 `agbrowse`
(https://github.com/lidge-jun/agbrowse)의 `web-ai query --output-image` 를
프롬프트마다 호출하고, 그 사이 페이싱·재시도·요약만 담당하는 얇은 드라이버입니다.

⚠️ 먼저 README.md 를 읽어주세요. 웹 UI 자동화는 각 서비스 이용약관 위반 소지와
   계정 정지 위험이 있습니다. 본인 계정으로 본인 창작 배치를 돌리는 개인 용도 전제입니다.
"""

import argparse
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG = os.path.join(HERE, "config.json")

# vendor -> 기본 URL (config.json 으로 덮어쓸 수 있음)
DEFAULT_URLS = {
    "chatgpt": "https://chatgpt.com/",
    "gemini": "https://gemini.google.com/app",
    "grok": "https://grok.com/",
}


def load_config(path):
    cfg = {
        "vendor": "chatgpt",
        "urls": {},
        "output_dir": "./out",
        "agbrowse_cmd": "agbrowse",
        "extra_args": [],           # agbrowse 에 항상 붙일 추가 인자 (예: ["--inline-only"])
        "pacing": {
            "before_prompt": [2.0, 6.0],       # 프롬프트 보내기 전 "생각" 시간
            "after_submit_wait": [45, 120],    # 생성 대기(그림이 나올 때까지)
            "jitter": [0, 20],
            "long_break_every": [6, 10],       # N개마다 긴 휴식
            "long_break_duration": [120, 300],
            "distraction_chance": 0.1,         # 가끔 딴짓(추가 대기)
            "distraction_extra": [15, 45],
        },
        "max_per_run": 0,           # 0 = 전체
        "per_prompt_timeout_sec": 300,
        "retries": 2,
    }
    if path and os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            user = json.load(f)
        # 얕은 병합 + pacing 은 키 단위 병합
        for k, v in user.items():
            if k == "pacing" and isinstance(v, dict):
                cfg["pacing"].update(v)
            else:
                cfg[k] = v
    return cfg


def slugify(text, maxlen=30):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return (s[:maxlen] or "prompt")


def read_prompts(path):
    """'#' 주석 줄과 빈 줄을 무시하고, 한 줄 = 프롬프트 하나로 읽는다."""
    prompts = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            prompts.append(line)
    return prompts


def rnd(pair):
    lo, hi = pair
    if lo >= hi:
        return float(lo)
    return random.uniform(lo, hi)


def human_sleep(seconds, label=""):
    seconds = max(0.0, float(seconds))
    if label:
        print(f"    … {label} {seconds:.1f}s", flush=True)
    time.sleep(seconds)


def build_command(cfg, vendor, url, prompt, out_path):
    cmd = [cfg["agbrowse_cmd"], "web-ai", "query",
           "--vendor", vendor,
           "--url", url,
           "--output-image", out_path,
           "--prompt", prompt]
    extra = cfg.get("extra_args") or []
    cmd.extend(extra)
    return cmd


def run_one(cfg, vendor, url, prompt, out_path, timeout, dry_run):
    cmd = build_command(cfg, vendor, url, prompt, out_path)
    printable = " ".join(
        (f'"{c}"' if (" " in c and not c.startswith("-")) else c) for c in cmd
    )
    print(f"    $ {printable}", flush=True)
    if dry_run:
        return True, "(dry-run)"
    try:
        proc = subprocess.run(cmd, timeout=timeout, capture_output=True, text=True)
    except FileNotFoundError:
        return False, (f"'{cfg['agbrowse_cmd']}' 실행 파일을 찾을 수 없습니다. "
                       f"`npm install -g agbrowse` 후 다시 시도하세요.")
    except subprocess.TimeoutExpired:
        return False, f"타임아웃({timeout}s) 초과"
    ok = proc.returncode == 0 and os.path.exists(out_path)
    if ok:
        return True, out_path
    tail = (proc.stderr or proc.stdout or "").strip().splitlines()
    tail = " ".join(tail[-3:]) if tail else f"exit={proc.returncode}"
    return False, tail


def main():
    ap = argparse.ArgumentParser(
        description="agbrowse 로 ChatGPT/Gemini/Grok 웹 UI에 프롬프트를 대량 입력해 이미지를 생성합니다.")
    ap.add_argument("--prompts", required=True, help="프롬프트 txt 파일 (한 줄 = 프롬프트 하나)")
    ap.add_argument("--vendor", choices=list(DEFAULT_URLS.keys()),
                    help="chatgpt | gemini | grok (기본: config.json)")
    ap.add_argument("--url", help="벤더 URL 직접 지정 (기본: config.json / 내장 기본값)")
    ap.add_argument("--out", help="이미지 저장 폴더 (기본: config.json 의 output_dir)")
    ap.add_argument("--max", type=int, help="이번 실행 최대 개수 (0=전체)")
    ap.add_argument("--config", default=DEFAULT_CONFIG, help="config.json 경로")
    ap.add_argument("--agbrowse", help="agbrowse 실행 파일 경로 (기본: config.json / 'agbrowse')")
    ap.add_argument("--dry-run", action="store_true",
                    help="실제 실행 없이 호출할 명령만 출력(페이싱 없음)")
    args = ap.parse_args()

    cfg = load_config(args.config)
    vendor = args.vendor or cfg.get("vendor", "chatgpt")
    if args.agbrowse:
        cfg["agbrowse_cmd"] = args.agbrowse
    url = args.url or (cfg.get("urls", {}) or {}).get(vendor) or DEFAULT_URLS[vendor]
    out_dir = args.out or cfg.get("output_dir", "./out")
    max_per_run = args.max if args.max is not None else cfg.get("max_per_run", 0)
    retries = int(cfg.get("retries", 2))
    timeout = int(cfg.get("per_prompt_timeout_sec", 300))
    pacing = cfg["pacing"]

    if not os.path.exists(args.prompts):
        print(f"[오류] 프롬프트 파일이 없습니다: {args.prompts}")
        sys.exit(1)

    prompts = read_prompts(args.prompts)
    if not prompts:
        print("[오류] 유효한 프롬프트가 없습니다(주석/빈 줄만 있음).")
        sys.exit(1)

    if max_per_run and max_per_run > 0:
        prompts = prompts[:max_per_run]

    os.makedirs(out_dir, exist_ok=True)

    if not args.dry_run and shutil.which(cfg["agbrowse_cmd"]) is None \
            and not os.path.exists(cfg["agbrowse_cmd"]):
        print(f"[주의] '{cfg['agbrowse_cmd']}' 를 PATH 에서 찾지 못했습니다. "
              f"`npm install -g agbrowse` 가 필요할 수 있습니다.\n"
              f"        (그래도 계속 진행합니다 — 각 호출에서 다시 확인)")

    print(f"=== agbrowse 배치 시작 ===")
    print(f"  벤더: {vendor}  |  URL: {url}")
    print(f"  프롬프트: {len(prompts)}개  |  저장: {out_dir}")
    print(f"  agbrowse: {cfg['agbrowse_cmd']} {' '.join(cfg.get('extra_args') or [])}".rstrip())
    if args.dry_run:
        print("  ** DRY-RUN: 실제 실행/페이싱 없음 **")
    print("  ⚠ 웹 UI 자동화 = 이용약관 위반 소지 · 계정 정지 위험. 개인 용도 전제.\n")

    done, failed = 0, 0
    fail_lines = []
    next_long_break = int(rnd(pacing["long_break_every"]))

    for i, prompt in enumerate(prompts, start=1):
        base = f"{i:03d}-{slugify(prompt)}"
        out_path = os.path.join(out_dir, f"{base}.png")
        print(f"[{i}/{len(prompts)}] {prompt[:80]}{'…' if len(prompt) > 80 else ''}")

        if not args.dry_run:
            human_sleep(rnd(pacing["before_prompt"]), "생각 중")

        ok, info = False, ""
        for attempt in range(1, retries + 2):  # 최초 1회 + retries 재시도
            ok, info = run_one(cfg, vendor, url, prompt, out_path, timeout, args.dry_run)
            if ok:
                break
            if attempt <= retries:
                back = 5 * attempt + rnd(pacing["jitter"])
                print(f"    ↻ 실패({info}) — {attempt}차 재시도까지 {back:.0f}s 대기", flush=True)
                if not args.dry_run:
                    human_sleep(back)

        if ok:
            done += 1
            print(f"    ✓ 저장: {info}")
        else:
            failed += 1
            fail_lines.append(f"[{i}] {prompt[:60]} — {info}")
            print(f"    ✗ 실패: {info}")

        if i < len(prompts) and not args.dry_run:
            # 생성 대기 + 지터
            wait = rnd(pacing["after_submit_wait"]) + rnd(pacing["jitter"])
            # 가끔 딴짓
            if random.random() < float(pacing.get("distraction_chance", 0)):
                wait += rnd(pacing["distraction_extra"])
                print("    (딴짓: 추가 대기)", flush=True)
            human_sleep(wait, "다음 프롬프트까지")

            # 긴 휴식
            if i >= next_long_break:
                lb = rnd(pacing["long_break_duration"])
                print(f"    ☕ 긴 휴식 {lb:.0f}s", flush=True)
                human_sleep(lb)
                next_long_break = i + int(rnd(pacing["long_break_every"]))

    print("\n=== 완료 ===")
    print(f"  성공 {done} · 실패 {failed} · 총 {len(prompts)}")
    if fail_lines:
        print("  실패 목록:")
        for ln in fail_lines:
            print(f"   - {ln}")
    sys.exit(1 if failed and done == 0 else 0)


if __name__ == "__main__":
    main()
