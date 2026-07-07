# agbrowse 배치 자동화 (agbrowse_batch)

txt 파일에 담긴 프롬프트를 **ChatGPT / Gemini / Grok 웹 UI**에 순서대로 입력해
이미지를 대량 생성합니다. 사람이 직접 하는 것처럼 **불규칙한 대기(휴먼 페이싱)**를
넣어 동작합니다. `midjourney-batch/mj_batch.py`의 자매 도구이며, 대상만
Midjourney 대신 GPT/Gemini/Grok 웹 UI로 바뀐 것입니다.

```
프롬프트 txt  →  agbrowse web-ai query(브라우저 자동 조작)  →  이미지 저장  →  텀 두고 반복
```

이 스크립트는 이미지 생성을 **직접 하지 않습니다.** Node CLI인
[`agbrowse`](https://github.com/lidge-jun/agbrowse)의
`web-ai query --output-image` 를 프롬프트마다 호출하고, 그 사이의
**페이싱·재시도·요약**만 담당하는 얇은 드라이버(파이썬)입니다.

---

## ⚠️ 먼저 읽어주세요 (중요)

- ChatGPT / Gemini / Grok에는 이런 용도의 **공식 이미지 API가 이미 있습니다**
  (스톡 스튜디오는 기본적으로 그 유료 API를 씁니다). 이 도구는 그 대신 **웹 UI를
  브라우저로 자동 조작**해서 **구독 계정으로** 뽑는 우회 방식입니다 — 공짜가 아니라
  "리스크를 지고 구독으로 우회"하는 것입니다.
- **각 서비스 이용약관은 자동화(봇) 조작을 대체로 금지합니다.** 따라서
  **계정 정지 위험이 실재**합니다. 이 리스크는 전적으로 사용자 책임입니다.
- **본인 계정으로 본인의 창작 배치**를 돌리는 **개인 용도**를 전제로 합니다.
  스팸, 다계정 운용, 대량 배포 목적으로 쓰지 마세요.
- 위험을 낮추려면: **적당한 양**, **넉넉한 텀**, **headless 금지(화면 보며)**,
  **밤새 무인 방치 금지**를 권장합니다. `--max` 또는 `config.json`의
  `max_per_run`으로 하루치를 나눠 돌리세요.

---

## 설치

1) **agbrowse (Node CLI)** — 실제 브라우저 조작을 담당합니다. Node.js 18+ 필요.

```bash
npm install -g agbrowse
# 또는 소스에서:  git clone https://github.com/lidge-jun/agbrowse && cd agbrowse && npm install && npm link
```

2) **이 드라이버** — 파이썬 표준 라이브러리만 사용합니다(추가 pip 패키지 없음).
Python 3.8+ 이면 됩니다.

> agbrowse는 **headed(화면 표시) 크롬**을 권장합니다. 헤드리스는 각 서비스의
> 안티봇에 막히는 경우가 많습니다. 즉 이 도구는 **로컬 데스크톱 실행 전용**이며,
> 저장소의 크롭 서버(`server.py`)나 배포 환경(render.yaml)에는 얹지 않습니다.

## 1) 로그인 (한 번만)

agbrowse로 각 사이트에 **수동으로 한 번 로그인**해 둡니다. 세션은
`~/.browser-agent` 에 캐시되어 재사용됩니다.

```bash
agbrowse start
agbrowse navigate "https://chatgpt.com/"
agbrowse navigate "https://gemini.google.com/app"
agbrowse navigate "https://grok.com/"
```

열린 크롬 창에서 로그인만 끝내면 됩니다.

> `~/.browser-agent` 는 **세션 상태(로그인 쿠키 등)**를 담고 있습니다.
> **절대 커밋·공유하지 마세요.**

## 2) 프롬프트 준비

한 줄 = 프롬프트 하나. `#` 줄과 빈 줄은 무시됩니다. `prompts.example.txt` 참고.

> FreeJJang STOCK STUDIO 앱의 **`웹배치 TXT (agbrowse)`** 버튼을 누르면 각 슬롯을
> 문장형 프롬프트(노텍스트 GUARD 포함) 한 줄씩으로 내보내 이 파일 형식을
> 자동 생성합니다. 받은 `*-agbrowse.txt` 를 이 폴더에 두고 그대로 넣으면 됩니다.

## 3) 실행

```bash
cd agbrowse-batch

# ChatGPT 웹 UI로 생성 (기본 벤더는 config.json)
python agbrowse_batch.py --prompts prompts.example.txt --vendor chatgpt

# Gemini / Grok
python agbrowse_batch.py --prompts my-prompts.txt --vendor gemini --out ./out-gemini
python agbrowse_batch.py --prompts my-prompts.txt --vendor grok

# 하루치만 (앞 10개), 실제 실행 없이 명령만 미리보기
python agbrowse_batch.py --prompts my-prompts.txt --max 10
python agbrowse_batch.py --prompts my-prompts.txt --dry-run
```

결과 이미지는 `--out`(기본 `./out/`)에 `001-<슬러그>.png` 형태로 저장됩니다.
한 프롬프트가 여러 장을 만들면 agbrowse가 `...-2.png`, `...-3.png` 로 저장합니다.

## 옵션 요약

| 인자 | 설명 |
|---|---|
| `--prompts <파일>` | (필수) 프롬프트 txt |
| `--vendor chatgpt\|gemini\|grok` | 대상 웹 UI (기본: `config.json`의 `vendor`) |
| `--url <URL>` | 벤더 URL 직접 지정 |
| `--out <폴더>` | 이미지 저장 폴더 (기본: `config.json`의 `output_dir`) |
| `--max <N>` | 이번 실행 최대 개수 (0=전체) |
| `--agbrowse <경로>` | agbrowse 실행 파일 경로 (기본: `agbrowse`) |
| `--config <경로>` | config.json 경로 |
| `--dry-run` | 실제 실행/페이싱 없이 호출 명령만 출력 |

## config.json (페이싱 등)

`pacing` 값은 `[최소, 최대]` 초 범위이며 매번 그 사이에서 무작위로 뽑습니다.

| 키 | 뜻 |
|---|---|
| `before_prompt` | 프롬프트 보내기 전 "생각" 시간 |
| `after_submit_wait` | 생성이 끝날 때까지 대기 |
| `long_break_every` / `long_break_duration` | N개마다 긴 휴식 |
| `distraction_chance` / `distraction_extra` | 가끔 딴짓(추가 대기) 확률·시간 |
| `extra_args` | agbrowse에 항상 붙일 인자 (기본 `["--inline-only"]`) |
| `retries` | 프롬프트당 재시도 횟수 |

---

이 폴더는 **자립형**입니다. 필요 없어지면 `agbrowse-batch/` 폴더를 통째로
삭제하고, 스톡 스튜디오 앱의 `웹배치 TXT (agbrowse)` 버튼만 제거하면 깨끗이
사라집니다. 크롭 서버(`server.py`)와 기존 파이프라인에는 영향이 없습니다.
