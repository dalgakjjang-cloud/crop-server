# Midjourney 배치 자동화 (mj_batch)

txt 파일에 담긴 **20~50개 프롬프트**를 Midjourney 웹앱에 순서대로 입력해
이미지를 대량 생성합니다. 사람이 직접 하는 것처럼 **불규칙한 대기(휴먼 페이싱)**
를 넣어 동작합니다.

```
프롬프트 txt  →  브라우저 자동 조작(타이핑·제출)  →  텀 두고 반복  →  다음 프롬프트
```

---

## ⚠️ 먼저 읽어주세요 (중요)

- Midjourney에는 **공식 API가 없습니다.** 이 도구는 실제 웹앱 화면을 브라우저로
  자동 조작하는 방식입니다.
- **Midjourney / Discord 이용약관은 자동화(봇)를 금지합니다.** 따라서
  **계정 정지 위험이 실재**합니다. 이 리스크는 전적으로 사용자 책임입니다.
- 이 도구는 **본인 계정으로 본인의 창작 배치**를 돌리는 **개인 용도**를 전제로 합니다.
  스팸, 다계정 운용, 대량 배포 목적으로 쓰지 마세요.
- 위험을 낮추려면: **적당한 양(하루 수십 장)**, **넉넉한 텀**, **headless 금지(화면 보며)**,
  **밤새 무인 방치 금지**를 권장합니다. 아래 `max_per_run`으로 하루치를 나눠 돌리세요.

---

## 설치

```bash
cd midjourney-batch
python -m venv .venv && source .venv/bin/activate    # (선택) 가상환경
pip install -r requirements.txt
playwright install chromium
```

## 1) 최초 로그인 (1회만)

브라우저가 열리면 **직접 Midjourney에 로그인**하고 이미지 생성 화면까지 들어간 뒤,
터미널로 돌아와 Enter를 누릅니다. 세션이 `mj_profile/` 폴더에 저장돼 다음부터는
자동 로그인됩니다.

```bash
python mj_batch.py --login
```

> `mj_profile/`에는 로그인 쿠키·토큰이 들어있어 **`.gitignore`로 커밋 제외**되어 있습니다.
> 남에게 공유하지 마세요.

> **구글 로그인이 "이 브라우저는 안전하지 않습니다"로 막힐 때**
> 구글이 자동화 브라우저를 차단하는 경우입니다. `config.json`의 `browser_channel`이
> 컴퓨터에 설치된 진짜 브라우저를 쓰도록 해줍니다(기본값 `"chrome"`). 크롬 대신
> 엣지를 쓰면 `"msedge"`로 바꾸세요. 그래도 막히면 로그인 창에서 **Discord 로그인**을
> 이용하세요(가장 안정적).

## 2) 프롬프트 준비

두 가지 방법이 있습니다.

### (A) STOCK STUDIO에서 자동 내보내기 — 파이프라인 연결 ⭐

`freejjang-stock-studio` 앱에서 초안을 생성하면 슬롯마다 프롬프트가 만들어집니다.
백업·저장 툴바의 **`미드저니 배치 TXT`** 버튼을 누르면, 각 슬롯이 **Midjourney 문법**
(`--ar` 종횡비, `--style raw`, `--no text,...` 네거티브)으로 변환된 `*-midjourney.txt`가
저장됩니다. 이 파일을 아래 `--prompts`에 **그대로** 넣으면 됩니다.

```
STOCK STUDIO  →  [미드저니 배치 TXT]  →  <주제>-midjourney.txt  →  mj_batch.py --prompts
   (두뇌가 초안·구도·소품 설계)          (MJ 문법 자동 변환)         (사람처럼 대량 생성)
```

- 종횡비는 스튜디오 상단의 종횡비 설정이, 톤/인물은 리두(Re-do) 설정이 반영됩니다.
- 인물 설정이 "없음"이면 `--no ...people`이 자동으로 붙습니다.
- 버전을 고정하고 싶으면 txt의 각 줄 끝에 `--v 6.1` 등을 추가하세요(파일 상단 안내 참고).

### (B) 직접 작성

`prompts.example.txt`를 복사해 `prompts.txt`를 만들고 프롬프트를 채웁니다.

- **한 줄 = 프롬프트 하나**
- 빈 줄, `#` 주석 줄은 무시
- `--ar 3:2 --v 6` 같은 Midjourney 파라미터도 그대로 붙여쓰면 됨
- 아주 긴 프롬프트를 여러 줄로 나누고 싶으면 줄 끝에 `\`를 붙여 이어쓰기

```bash
cp prompts.example.txt prompts.txt   # 편집기로 내용 채우기
```

## 3) 실행

```bash
# 먼저 목록만 확인(제출 안 함)
python mj_batch.py --prompts prompts.txt --dry-run

# 실제 실행
python mj_batch.py --prompts prompts.txt
```

- 중간에 **Ctrl+C**로 안전 종료할 수 있고, 다시 실행하면 **이미 넣은 프롬프트는 건너뛰고**
  이어서 진행합니다(상태는 `prompts.txt.state.json`에 기록).
- 하루치를 나눠 돌리려면:
  ```bash
  python mj_batch.py --prompts prompts.txt --max-per-run 15
  ```

---

## 동작 방식 (휴먼 페이싱)

`config.json`의 `pacing`으로 사람처럼 보이는 리듬을 조절합니다(초/ms 단위, `[최소, 최대]` 랜덤).

| 항목 | 의미 | 기본값 |
|---|---|---|
| `think_before_typing` | 입력 전 '생각하는' 멈춤 | 1.5~5초 |
| `type_char_delay_ms` | 글자당 타이핑 간격(붙여넣기 아님) | 45~165ms |
| `after_submit_wait` | 제출 후 다음 프롬프트까지 기본 대기 | 35~95초 |
| `jitter` | 매 대기에 더해지는 흔들림 | 0~12초 |
| `long_break_every` | 몇 개마다 긴 휴식을 넣을지 | 7~12개 |
| `long_break_duration` | 긴 휴식 길이 | 3~7분 |
| `distraction_chance` | 가끔 '딴짓' 추가 멈춤 확률 | 0.12 |
| `distraction_extra` | 딴짓 멈춤 길이 | 20~60초 |

기본 설정 기준 **50개 프롬프트 ≈ 1~1.5시간** 정도 소요됩니다(텀 포함). 더 조심하려면
`after_submit_wait`와 `long_break_*`를 늘리세요.

## UI가 바뀌어 입력창을 못 찾을 때

Midjourney가 화면을 바꾸면 프롬프트 입력창 셀렉터가 안 맞을 수 있습니다.
그럴 땐 `config.json`의 `input_selectors` 목록만 현재 사이트에 맞게 고치면 됩니다
(브라우저 개발자도구 > 입력창 우클릭 > Copy selector). 실패 시 `screenshots/`에
에러 스크린샷이 남으니 참고하세요.

## 파일 구성

```
midjourney-batch/
├─ mj_batch.py          # 메인 스크립트
├─ config.json          # 페이싱/셀렉터/옵션 설정
├─ prompts.example.txt  # 프롬프트 작성 예시
├─ requirements.txt
├─ .gitignore           # mj_profile/, state, screenshots 제외
└─ README.md
```

## 옵션 요약

```
python mj_batch.py --login                 # 최초 로그인/세션 저장
python mj_batch.py --prompts FILE          # 배치 실행(자동 resume)
python mj_batch.py --prompts FILE --dry-run   # 제출 없이 목록만
python mj_batch.py --prompts FILE --max-per-run N   # 이번 실행 N개만
python mj_batch.py --prompts FILE --headless        # 화면 없이(비권장)
python mj_batch.py --config other.json ...          # 다른 설정파일
```
