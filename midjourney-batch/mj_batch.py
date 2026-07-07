#!/usr/bin/env python3
"""
mj_batch.py — Midjourney 웹앱(midjourney.com/imagine) 배치 자동화

txt 파일에 담긴 20~50개 프롬프트를 순서대로 Midjourney 웹앱에 입력해
이미지를 대량 생성합니다. 사람이 직접 타이핑하는 것처럼 보이도록
불규칙한 대기(휴먼 페이싱)를 넣어 동작합니다.

  ⚠️  주의: Midjourney/Discord 이용약관은 자동화를 금지합니다.
      본인 계정으로 본인 창작 작업을 돌리는 개인 용도로만 사용하세요.
      계정 정지 위험은 사용자 책임입니다. README.md 참고.

사용법:
  1) 최초 1회 로그인(브라우저가 열리면 직접 로그인 후 Enter):
       python mj_batch.py --login
  2) 배치 실행:
       python mj_batch.py --prompts prompts.txt
  3) 중단 후 이어하기(이미 넣은 프롬프트는 건너뜀):
       python mj_batch.py --prompts prompts.txt   # 자동 resume

옵션은 --help 또는 config.json 참고.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import signal
import sys
import time
from datetime import datetime
from pathlib import Path

def _import_playwright():
    """브라우저가 실제로 필요한 순간에만 playwright를 로드한다.
    (--help, --dry-run은 playwright 없이도 동작)"""
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
        return sync_playwright, PWTimeout
    except ImportError:
        print(
            "playwright가 설치되어 있지 않습니다.\n"
            "  pip install -r requirements.txt\n"
            "  playwright install chromium\n",
            file=sys.stderr,
        )
        sys.exit(1)


HERE = Path(__file__).resolve().parent
DEFAULT_CONFIG = HERE / "config.json"

# ----------------------------------------------------------------------------
# 설정
# ----------------------------------------------------------------------------

DEFAULTS = {
    # Midjourney 웹앱 프롬프트 입력창 주소
    "imagine_url": "https://www.midjourney.com/imagine",
    # 로그인 세션을 저장할 브라우저 프로필 디렉터리(폴더 하나가 통째로 세션)
    "profile_dir": "./mj_profile",
    # 프롬프트 입력창 셀렉터 후보(위에서부터 순서대로 시도). UI가 바뀌면 여기만 고치면 됨.
    "input_selectors": [
        "textarea",
        "input[placeholder*='imagine' i]",
        "textarea[placeholder*='imagine' i]",
        "[contenteditable='true']",
    ],
    # 사람처럼 보이게 하는 페이싱(초 단위). [min, max] 사이 랜덤.
    "pacing": {
        "think_before_typing": [1.5, 5.0],   # 프롬프트 붙여넣기 전 '생각하는' 시간
        "type_char_delay_ms": [45, 165],     # 글자당 타이핑 간격(ms)
        "after_submit_wait": [35, 95],       # 제출 후 다음 프롬프트까지 기본 대기
        "jitter": [0, 12],                   # 매 대기에 더해지는 잔여 흔들림
        "long_break_every": [7, 12],         # N개마다 긴 휴식(범위 내 랜덤으로 재설정)
        "long_break_duration": [180, 420],   # 긴 휴식 길이(3~7분)
        "distraction_chance": 0.12,          # 가끔 딴짓하는 듯한 추가 멈춤 확률
        "distraction_extra": [20, 60],       # 딴짓 추가 멈춤 길이
    },
    # 한 세션에서 최대 몇 개까지 넣고 멈출지(0 = 제한 없음). 하루치 나눠 돌릴 때 유용.
    "max_per_run": 0,
    # 브라우저를 화면에 띄울지(false=headless). 최초 로그인은 무조건 화면 표시.
    "headless": False,
    # 어떤 브라우저로 열지: "chrome"=컴퓨터에 설치된 진짜 크롬, "msedge"=엣지,
    # ""(빈값)=Playwright 내장 크로미움. 구글 로그인이 '안전하지 않은 브라우저'로
    # 막힐 때는 "chrome"으로 두면 대부분 통과됨. 크롬이 없으면 자동으로 크로미움 대체.
    "browser_channel": "chrome",
    # true면 새 로그인 대신 '컴퓨터에 이미 로그인된 진짜 크롬 프로필'을 그대로 사용.
    # 구글 계정처럼 자동화 로그인이 막히는 경우 유용(재로그인 불필요). 명령줄 --use-my-chrome 로도 켬.
    # 이 모드에서는 실행 중 평소 크롬을 쓸 수 없으니, 먼저 크롬을 완전히 종료해야 함.
    "use_my_chrome": False,
    # use_my_chrome일 때 어떤 크롬 프로필을 열지. ""(빈값)=기본 "Default" 프로필.
    # 크롬에 계정/프로필이 여러 개라 로그인이 "Profile 1" 등에 있으면 여기에 폴더명을 적음.
    # (chrome://version 의 'Profile Path' 마지막 폴더명) 명령줄 --chrome-profile 로도 지정.
    "chrome_profile_directory": "",
    # 페이지 로드/셀렉터 대기 타임아웃(ms)
    "nav_timeout_ms": 60000,
    # 제출 실패 시 재시도 횟수
    "retries": 2,
}


def load_config(path: Path | None) -> dict:
    cfg = json.loads(json.dumps(DEFAULTS))  # deep copy
    if path and path.exists():
        user = json.loads(path.read_text(encoding="utf-8"))
        _deep_update(cfg, user)
    return cfg


def _deep_update(base: dict, extra: dict) -> None:
    for k, v in extra.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_update(base[k], v)
        else:
            base[k] = v


# ----------------------------------------------------------------------------
# 프롬프트 / 진행상태
# ----------------------------------------------------------------------------

def read_prompts(path: Path) -> list[str]:
    """txt에서 프롬프트를 읽는다.

    규칙(단순·명확):
    - 한 줄 = 한 프롬프트
    - 빈 줄 무시
    - '#'로 시작하는 줄은 주석으로 무시
    - 줄 끝이 '\\'이면 다음 줄과 이어붙임(아주 긴 프롬프트를 여러 줄로 쓰고 싶을 때)
    """
    prompts: list[str] = []
    buffer = ""
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not buffer and (not stripped or stripped.startswith("#")):
            continue  # 빈 줄/주석 (단, 이어쓰기 도중이면 그대로 이어붙임)
        if line.endswith("\\"):
            buffer += line[:-1].rstrip() + " "
            continue
        buffer += stripped
        if buffer.strip():
            prompts.append(buffer.strip())
        buffer = ""
    if buffer.strip():
        prompts.append(buffer.strip())
    return prompts


class State:
    """이미 처리한 프롬프트를 기록해 중단 후 이어하기를 지원."""

    def __init__(self, prompts_path: Path):
        self.path = prompts_path.with_suffix(prompts_path.suffix + ".state.json")
        self.done: set[str] = set()
        self.log: list[dict] = []
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text(encoding="utf-8"))
                self.done = set(data.get("done", []))
                self.log = data.get("log", [])
            except Exception:
                pass

    def mark(self, prompt: str, status: str, note: str = "") -> None:
        if status == "ok":
            self.done.add(prompt)
        self.log.append(
            {"ts": datetime.now().isoformat(timespec="seconds"),
             "status": status, "note": note, "prompt": prompt[:120]}
        )
        self.save()

    def save(self) -> None:
        self.path.write_text(
            json.dumps({"done": sorted(self.done), "log": self.log},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


# ----------------------------------------------------------------------------
# 휴먼 페이싱
# ----------------------------------------------------------------------------

def rand_between(rng: list) -> float:
    lo, hi = rng
    return random.uniform(float(lo), float(hi))


def human_sleep(seconds: float, label: str = "") -> None:
    """중간에 Ctrl+C가 잘 먹도록 잘게 쪼개 잔다."""
    end = time.monotonic() + seconds
    if label:
        mins = seconds / 60
        pretty = f"{seconds:.0f}s" if seconds < 90 else f"{mins:.1f}min"
        print(f"    ⏳ {label} — {pretty} 대기…", flush=True)
    while time.monotonic() < end:
        time.sleep(min(1.0, end - time.monotonic()))


# ----------------------------------------------------------------------------
# 브라우저 조작
# ----------------------------------------------------------------------------

def find_input(page, selectors: list[str], timeout_ms: int):
    """여러 셀렉터 후보 중 화면에 보이는 첫 입력창을 반환."""
    last_err = None
    for sel in selectors:
        try:
            el = page.locator(sel).first
            el.wait_for(state="visible", timeout=timeout_ms // len(selectors) + 1000)
            return el
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(
        "프롬프트 입력창을 찾지 못했습니다. config.json의 input_selectors를 "
        f"현재 사이트에 맞게 수정하세요. (마지막 오류: {last_err})"
    )


def submit_prompt(page, cfg: dict, prompt: str) -> None:
    p = cfg["pacing"]
    box = find_input(page, cfg["input_selectors"], cfg["nav_timeout_ms"])

    # 1) 사람처럼 '생각하는' 시간
    human_sleep(rand_between(p["think_before_typing"]))

    # 2) 입력창 클릭 + 혹시 남은 텍스트 정리
    box.click()
    try:
        box.press("Control+a")
        box.press("Delete")
    except Exception:
        pass

    # 3) 글자 단위로 사람처럼 타이핑(붙여넣기 아님)
    char_delay = random.uniform(*p["type_char_delay_ms"])
    box.type(prompt, delay=char_delay)

    # 4) 잠깐 검토하는 척
    human_sleep(random.uniform(0.4, 1.6))

    # 5) 제출
    box.press("Enter")
    print(f"    ✅ 제출 완료 (타이핑 {char_delay:.0f}ms/글자)", flush=True)


def default_chrome_user_data_dir() -> Path | None:
    """OS별 '설치된 크롬'의 사용자 프로필(User Data) 폴더 위치를 반환.
    이미 로그인된 그 프로필을 그대로 쓰면 재로그인이 필요 없다."""
    if sys.platform.startswith("win"):
        base = os.environ.get("LOCALAPPDATA")
        if base:
            return Path(base) / "Google" / "Chrome" / "User Data"
    elif sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Google" / "Chrome"
    else:
        return Path.home() / ".config" / "google-chrome"
    return None


def open_context(pw, cfg: dict, headless: bool):
    channel = (cfg.get("browser_channel") or "").strip()
    use_my_chrome = bool(cfg.get("use_my_chrome"))

    if use_my_chrome:
        profile = default_chrome_user_data_dir()
        if not profile or not profile.exists():
            print("내 크롬 프로필 폴더를 찾지 못했습니다. 크롬이 설치돼 있는지 확인하세요.",
                  file=sys.stderr)
            sys.exit(1)
        channel = channel or "chrome"  # 내 프로필은 반드시 진짜 크롬으로 열어야 함
        print(f"(내 크롬 프로필 사용: {profile})")
        # 사용 가능한 프로필 폴더를 안내(로그인이 어디 있는지 못 찾을 때 참고)
        found = sorted(
            p.name for p in profile.iterdir()
            if p.is_dir() and (p.name == "Default" or p.name.startswith("Profile "))
        ) if profile.exists() else []
        if found:
            print(f"  이 크롬의 프로필 폴더들: {', '.join(found)}")
        print("  ⚠️  실행 중에는 평소 크롬을 쓸 수 없습니다. 먼저 크롬을 완전히 종료하세요.")
    else:
        profile = Path(cfg["profile_dir"]).expanduser().resolve()
        profile.mkdir(parents=True, exist_ok=True)

    extra_args = ["--disable-blink-features=AutomationControlled"]
    prof_dir = (cfg.get("chrome_profile_directory") or "").strip()
    if use_my_chrome and prof_dir:
        # 여러 프로필 중 특정 프로필(예: "Profile 1")을 선택
        extra_args.append(f"--profile-directory={prof_dir}")
        print(f"  선택한 프로필: {prof_dir}")

    launch_kwargs = dict(
        user_data_dir=str(profile),
        headless=headless,
        # 자동화 티가 나는 신호 제거 → 구글/미드저니가 '봇'으로 감지하기 어렵게.
        args=extra_args,
        ignore_default_args=["--enable-automation"],
    )
    # 내 프로필을 쓸 땐 원래 창 크기를 존중(뷰포트 강제 안 함)
    if use_my_chrome:
        launch_kwargs["no_viewport"] = True
    else:
        launch_kwargs["viewport"] = {"width": 1400, "height": 900}
    if channel:
        launch_kwargs["channel"] = channel

    try:
        ctx = pw.chromium.launch_persistent_context(**launch_kwargs)
        if channel:
            print(f"(설치된 '{channel}' 브라우저로 실행)")
    except Exception as e:
        msg = str(e)
        if use_my_chrome and ("ProcessSingleton" in msg or "already" in msg.lower()
                              or "SingletonLock" in msg or "profile" in msg.lower()):
            print("\n크롬이 아직 켜져 있어 프로필을 열 수 없습니다.\n"
                  "  → 크롬 창을 모두 닫고(작업관리자에서 chrome.exe 전부 종료) 다시 실행하세요.\n",
                  file=sys.stderr)
            sys.exit(1)
        if channel and not use_my_chrome:
            # 크롬/엣지가 설치돼 있지 않으면 내장 크로미움으로 대체
            print(f"(설치된 '{channel}' 브라우저를 못 찾아 내장 Chromium으로 대체합니다: {e})")
            launch_kwargs.pop("channel", None)
            ctx = pw.chromium.launch_persistent_context(**launch_kwargs)
        else:
            raise

    # navigator.webdriver 흔적까지 지워 자동화 감지를 한 번 더 낮춤
    try:
        ctx.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )
    except Exception:
        pass

    ctx.set_default_timeout(cfg["nav_timeout_ms"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    return ctx, page


# ----------------------------------------------------------------------------
# 명령
# ----------------------------------------------------------------------------

def cmd_login(cfg: dict) -> int:
    sync_playwright, _ = _import_playwright()
    print("브라우저를 엽니다. Midjourney에 로그인한 뒤 이미지 생성 화면까지 들어가세요.")
    with sync_playwright() as pw:
        ctx, page = open_context(pw, cfg, headless=False)
        try:
            page.goto(cfg["imagine_url"], wait_until="domcontentloaded")
        except Exception as e:
            print(f"(페이지 이동 경고: {e})")
        input("\n로그인/설정을 마쳤으면 이 터미널에서 Enter를 누르세요… ")
        ctx.close()
    if cfg.get("use_my_chrome"):
        print("내 크롬 프로필 확인 완료. 이제 다음처럼 실행하세요(매번 --use-my-chrome 필요):\n"
              "  python mj_batch.py --prompts <파일>.txt --use-my-chrome")
    else:
        print(f"세션이 '{cfg['profile_dir']}'에 저장되었습니다. 이제 --prompts로 실행하세요.")
    return 0


def cmd_run(cfg: dict, prompts_path: Path, dry_run: bool) -> int:
    prompts = read_prompts(prompts_path)
    if not prompts:
        print("프롬프트가 없습니다.", file=sys.stderr)
        return 1

    state = State(prompts_path)
    pending = [p for p in prompts if p not in state.done]
    total, remaining = len(prompts), len(pending)
    print(f"프롬프트 총 {total}개 · 남은 {remaining}개 "
          f"(이미 완료 {total - remaining}개)")

    if cfg["max_per_run"] and remaining > cfg["max_per_run"]:
        pending = pending[: cfg["max_per_run"]]
        print(f"이번 실행에서는 {len(pending)}개만 처리하고 멈춥니다 "
              f"(max_per_run={cfg['max_per_run']}).")

    if dry_run:
        print("\n--dry-run: 실제 제출 없이 목록만 표시합니다.\n")
        for i, p in enumerate(pending, 1):
            print(f"  {i:>3}. {p[:100]}")
        return 0

    sync_playwright, _ = _import_playwright()
    p = cfg["pacing"]
    stop = {"flag": False}

    def handle_sigint(signum, frame):
        print("\n⏹  중단 요청됨 — 현재 대기 후 안전하게 종료합니다. "
              "(다시 실행하면 이어서 진행)")
        stop["flag"] = True

    signal.signal(signal.SIGINT, handle_sigint)

    long_break_at = int(rand_between(p["long_break_every"]))
    done_this_run = 0

    with sync_playwright() as pw:
        ctx, page = open_context(pw, cfg, headless=cfg["headless"])
        try:
            page.goto(cfg["imagine_url"], wait_until="domcontentloaded")
        except Exception as e:
            print(f"(페이지 이동 경고: {e})")

        # 로그인 여부 대략 확인
        human_sleep(3)
        if "midjourney.com" in page.url and "/imagine" not in page.url \
                and "login" in page.url.lower():
            print("로그인이 안 되어 있는 것 같습니다. 먼저 `--login`을 실행하세요.",
                  file=sys.stderr)
            ctx.close()
            return 1

        for idx, prompt in enumerate(pending, 1):
            if stop["flag"]:
                break
            print(f"\n[{idx}/{len(pending)}] {prompt[:90]}")

            ok = False
            for attempt in range(cfg["retries"] + 1):
                try:
                    submit_prompt(page, cfg, prompt)
                    ok = True
                    break
                except Exception as e:
                    print(f"    ⚠️ 시도 {attempt+1} 실패: {e}", flush=True)
                    _screenshot(page, prompts_path, idx)
                    human_sleep(rand_between([8, 20]))

            state.mark(prompt, "ok" if ok else "fail",
                       "" if ok else "제출 실패")
            done_this_run += 1

            if idx >= len(pending):
                break

            # 다음 프롬프트까지 사람처럼 대기
            wait = rand_between(p["after_submit_wait"]) + rand_between(p["jitter"])
            if random.random() < p["distraction_chance"]:
                extra = rand_between(p["distraction_extra"])
                print(f"    🙈 잠깐 딴짓(+{extra:.0f}s)")
                wait += extra
            human_sleep(wait, label="다음 프롬프트까지")

            # 주기적 긴 휴식
            if done_this_run >= long_break_at:
                dur = rand_between(p["long_break_duration"])
                human_sleep(dur, label="☕ 긴 휴식")
                long_break_at = done_this_run + int(rand_between(p["long_break_every"]))

        ctx.close()

    n_ok = sum(1 for e in state.log if e["status"] == "ok")
    print(f"\n완료. 이번 실행 {done_this_run}개 처리. "
          f"누적 성공 {len(state.done)}/{total}. 상태파일: {state.path.name}")
    return 0


def _screenshot(page, prompts_path: Path, idx: int) -> None:
    try:
        shots = prompts_path.parent / "screenshots"
        shots.mkdir(exist_ok=True)
        out = shots / f"error_{idx:03d}_{int(time.monotonic())}.png"
        page.screenshot(path=str(out))
        print(f"    📸 스크린샷 저장: {out}")
    except Exception:
        pass


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="Midjourney 웹앱 배치 자동화 (휴먼 페이싱)")
    ap.add_argument("--prompts", type=Path, help="프롬프트 txt 파일 경로")
    ap.add_argument("--login", action="store_true",
                    help="브라우저를 열어 최초 로그인/세션 저장")
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG,
                    help=f"설정 파일(기본: {DEFAULT_CONFIG.name})")
    ap.add_argument("--headless", action="store_true",
                    help="브라우저를 화면에 띄우지 않음(로그인 후 무인 실행용)")
    ap.add_argument("--max-per-run", type=int,
                    help="이번 실행에서 최대 처리 개수(하루치 분할)")
    ap.add_argument("--dry-run", action="store_true",
                    help="실제 제출 없이 처리 목록만 출력")
    ap.add_argument("--use-my-chrome", action="store_true",
                    help="새 로그인 대신, 이미 로그인된 내 크롬 프로필을 그대로 사용"
                         "(구글 로그인이 막힐 때). 실행 전 크롬을 완전히 종료해야 함")
    ap.add_argument("--chrome-profile", type=str, default=None,
                    help="내 크롬에 프로필이 여러 개일 때 열 폴더명(예: \"Profile 1\"). "
                         "chrome://version 의 Profile Path 마지막 폴더명")
    args = ap.parse_args(argv)

    cfg = load_config(args.config)
    if args.headless:
        cfg["headless"] = True
    if args.max_per_run is not None:
        cfg["max_per_run"] = args.max_per_run
    if args.use_my_chrome:
        cfg["use_my_chrome"] = True
    if args.chrome_profile is not None:
        cfg["chrome_profile_directory"] = args.chrome_profile
        cfg["use_my_chrome"] = True  # 프로필 지정은 내 크롬 모드를 전제로 함

    if args.login:
        return cmd_login(cfg)

    if not args.prompts:
        ap.error("--prompts 또는 --login 중 하나가 필요합니다.")
    if not args.prompts.exists():
        print(f"파일을 찾을 수 없습니다: {args.prompts}", file=sys.stderr)
        return 1

    return cmd_run(cfg, args.prompts, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
