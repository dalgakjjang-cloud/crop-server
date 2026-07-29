# FreeJJang 미드저니 자동배치 시스템 — 운영 매뉴얼

> **Midjourney 8.2 기준** · 2026-07 · Codex(Claude Code) 원격 세션에서도 프롬프트 생성 → 프롬프트 파일 관리까지 자동화 가능

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [아키텍처 & 파일 구조](#2-아키텍처--파일-구조)
3. [Midjourney 8.2 프롬프트 규칙](#3-midjourney-82-프롬프트-규칙)
4. [프롬프트 생성 — Codex 자동화](#4-프롬프트-생성--codex-자동화)
5. [mj_batch.py — 브라우저 배치 자동화](#5-mj_batchpy--브라우저-배치-자동화)
6. [야간 자동 루틴 (밤 10시/11시)](#6-야간-자동-루틴-밤-10시11시)
7. [STOCK STUDIO 연동](#7-stock-studio-연동)
8. [배포 가이드](#8-배포-가이드)
9. [트러블슈팅](#9-트러블슈팅)
10. [부록: 프롬프트 테마 라이브러리](#10-부록-프롬프트-테마-라이브러리)

---

## 1. 시스템 개요

```
┌────────────────────────────────────────────────────────────────────┐
│                    FreeJJang 스톡 이미지 파이프라인                    │
├─────────────────┬──────────────────┬───────────────────────────────┤
│  프롬프트 설계   │  이미지 생성       │  제출팩 내보내기                │
│                 │                  │                               │
│ ┌─────────────┐ │ ┌──────────────┐ │ ┌───────────────────────────┐ │
│ │ Codex/Claude│ │ │ Midjourney   │ │ │ Adobe Stock CSV + JPEG    │ │
│ │ (프롬프트    │─┤─│ 8.2 웹앱     │ │ │ MiriCanvas XLSX + 원본   │ │
│ │  자동 생성)  │ │ │ (mj_batch)   │ │ │ GPT/Gemini 직접 생성      │ │
│ └─────────────┘ │ ├──────────────┤ │ └───────────────────────────┘ │
│ ┌─────────────┐ │ │ GPT gpt-image│ │                               │
│ │ STOCK STUDIO│ │ │ Gemini Flash │ │ ┌───────────────────────────┐ │
│ │ (브라우저 앱)│─┤─│ Pollinations │ │ │ 자동 QC (7항목)           │ │
│ └─────────────┘ │ └──────────────┘ │ │ 자동 수리 (Auto-fix)      │ │
│                 │                  │ └───────────────────────────┘ │
└─────────────────┴──────────────────┴───────────────────────────────┘
```

**핵심 흐름**: 프롬프트 TXT 생성 → `mj_batch.py`로 MJ 웹앱에 대량 제출 → 생성된 이미지 다운로드 → QC → 제출팩

---

## 2. 아키텍처 & 파일 구조

```
crop-server/
├── midjourney-batch/              # MJ 배치 자동화 도구
│   ├── mj_batch.py                # 메인 스크립트 (Playwright 브라우저 자동화)
│   ├── config.json                # 페이싱/셀렉터/브라우저 설정
│   ├── prompts.example.txt        # 프롬프트 작성 예시
│   ├── requirements.txt           # Python 의존성
│   ├── run.bat                    # Windows 간편 실행
│   ├── .gitignore                 # mj_profile/, state, screenshots 제외
│   └── README.md                  # 도구 상세 문서
│
├── freejjang-stock-studio/        # 스톡 이미지 제작 웹앱
│   ├── src/App.jsx                # 메인 앱 (2,600+ 줄, 단일 파일)
│   ├── SKILL.md                   # 기능 맵
│   └── dist/                      # 빌드 결과 (GitHub Pages 배포)
│
├── server.py                      # Python 크롭 서버 (배경 제거)
├── .github/workflows/
│   └── deploy-pages.yml           # GitHub Pages 자동 배포
└── README.md                      # 프로젝트 루트 README
```

### 핵심 컴포넌트

| 컴포넌트 | 역할 | 기술 스택 |
|----------|------|-----------|
| `mj_batch.py` | MJ 웹앱에 프롬프트를 사람처럼 타이핑·제출 | Python 3 + Playwright |
| `STOCK STUDIO` | AI 두뇌로 초안 설계 → 이미지 생성 → QC → 제출팩 | React + Vite |
| `server.py` | 이미지 배경 제거 & 리사이즈 API | Python Flask |
| Codex/Claude Code | 프롬프트 대량 생성, 야간 자동 루틴 | Claude Code 원격 세션 |

---

## 3. Midjourney 8.2 프롬프트 규칙

### 8.2 변경사항 요약

| 항목 | 이전 (v7) | 현재 (8.2) |
|------|-----------|------------|
| 버전 플래그 | `--v 7` 필수 | **`--v` 생략** (8.2가 기본) |
| 디테일 | 수동 지정 | 자동 향상, 더 자연스러움 |
| AI 느낌 | 다소 인위적 | AI 특유 느낌 대폭 감소 |
| `--style raw` | 선택 | **필수** (포토리얼 작업) |

### 프롬프트 포맷 (한 줄 원라이너)

```
<프롬프트 본문>, copy space --ar 16:9 --style raw --no text, letters, numbers, logo, watermark, signature
```

### 프롬프트 작성 체크리스트

- [ ] `--v` 플래그 **없음** (8.2 자동 적용)
- [ ] `--style raw` 포함 (포토리얼/스톡용)
- [ ] `--no text, letters, numbers, logo, watermark, signature` 포함
- [ ] `copy space` 키워드 포함 (텍스트 오버레이 여백용)
- [ ] 한 줄에 하나의 프롬프트
- [ ] `#` 주석줄은 `mj_batch.py`가 자동 건너뜀
- [ ] 비율: `--ar 16:9` (가로), `--ar 9:16` (세로), `--ar 1:1` (정사각)

### 텍스트 차단 전략

MJ가 이미지에 글자를 렌더링하는 것을 방지하기 위한 다층 방어:

```
1단: 프롬프트 본문에 글자를 유도하는 단어 배제
     (sign, poster, headline, calligraphy, banner, book cover text 등)

2단: --no 네거티브에 포괄적 차단
     text, letters, numbers, logo, watermark, signature

3단: MiriCanvas/Adobe용 자동 QC에서 텍스트 감지 시 탈락
```

### GPT 이미지 생성용 프롬프트 포맷

MJ와 별도로 GPT(`gpt-image-1`)용 프롬프트도 생성합니다:

```
Generate a vivid [장르] photograph of [주제]. [디테일]. 
16:9 aspect ratio with copy space. 
The image must contain absolutely no text, letters, numbers, words, logos, watermarks, or signatures of any kind in any language.
```

- 자연어 형태 (MJ 파라미터 없음)
- 텍스트 차단 가드를 문장 끝에 명시

---

## 4. 프롬프트 생성 — Codex 자동화

### Codex(Claude Code)에서 프롬프트 생성하기

Claude Code 원격 세션(Codex)에서 프롬프트 파일을 직접 생성할 수 있습니다.
**브라우저 자동화(mj_batch.py)는 로컬 PC에서 실행해야 하지만, 프롬프트 TXT 생성은 Codex에서 완전 자동화됩니다.**

#### 사용 방법

1. **Claude Code 세션** 에서 원하는 테마를 자연어로 요청:
   ```
   "비비드한 내셔널지오그래픽 대자연 프롬프트 20개 만들어줘"
   "희귀동물 눈 매크로 프롬프트 MJ + GPT 각각 20개씩"
   "아프리카 소수민족 춤 세트 10개"
   ```

2. Claude가 프롬프트 파일을 생성하여 **세션 내 scratchpad 또는 저장소**에 저장

3. 파일을 **로컬 PC로 복사** 후 `mj_batch.py --prompts <파일>` 실행

#### 프롬프트 파일 명명 규칙

```
YYYY-MM-DD_HHmm.txt           # 날짜 기반 (예: 2026-07-28_2300.txt)
setNN-테마명-mj.txt            # 세트 기반 MJ (예: set01-희귀동물-mj.txt)
setNN-테마명-gpt.txt           # 세트 기반 GPT (예: set01-희귀동물-gpt.txt)
biz-N-분야명.txt               # 비즈니스 분야별 (예: biz-3-데이터분석.txt)
```

#### Codex에서 자동 생성 시 따라야 할 규칙

```python
# MJ 프롬프트 생성 규칙 (8.2)
RULES = {
    "version_flag": None,           # --v 플래그 사용하지 않음
    "style": "--style raw",         # 포토리얼 필수
    "negative": "--no text, letters, numbers, logo, watermark, signature",
    "copy_space": True,             # 모든 프롬프트에 'copy space' 포함
    "one_line": True,               # 한 줄 = 한 프롬프트
    "comment_prefix": "#",          # 메타정보는 # 주석으로
    "aspect_ratios": ["16:9", "9:16", "1:1", "3:2", "4:3"],
    "language": "ENGLISH_ONLY",     # 프롬프트 본문은 영어만
}
```

#### 자동 프롬프트 품질 체크리스트

Codex가 프롬프트를 생성할 때 내부적으로 확인하는 항목:

1. **`--v` 플래그 없음** — 8.2가 기본이므로 명시하지 않음
2. **`--style raw` 존재** — 포토리얼/스톡 사진에 필수
3. **네거티브 완전성** — `text, letters, numbers, logo, watermark, signature`
4. **`copy space` 포함** — 텍스트 오버레이 여백
5. **20개 이상 프롬프트 간 중복 없음** — 소재·구도·색감 모두 다르게
6. **한국어 없음** — 프롬프트 본문은 순수 영어
7. **MJ 유도 단어 없음** — `sign`, `poster`, `text on` 등 텍스트 렌더링 유발 단어 배제

---

## 5. mj_batch.py — 브라우저 배치 자동화

### 설치 (로컬 PC)

```bash
cd midjourney-batch
python -m venv .venv

# macOS/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
playwright install chromium
```

### 로그인 (최초 1회)

**방법 1: 쿠키 복사 (가장 안정적)**

1. 크롬에 [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) 확장프로그램 설치
2. `midjourney.com`(로그인 상태)에서 확장프로그램 클릭 → Export → `cookies.txt` 다운로드
3. `midjourney-batch/` 폴더에 `cookies.txt`로 저장

```bash
python mj_batch.py --prompts prompts.txt --cookies cookies.txt
```

**방법 2: 내 크롬 프로필 직접 사용**

```bash
# 크롬을 완전히 종료한 뒤:
python mj_batch.py --prompts prompts.txt --use-my-chrome

# 특정 프로필이 있으면:
python mj_batch.py --prompts prompts.txt --use-my-chrome --chrome-profile "Profile 1"
```

**방법 3: 직접 로그인**

```bash
python mj_batch.py --login
# 브라우저에서 로그인 후 터미널에서 Enter
```

### 실행

```bash
# 1) 목록만 확인 (제출 안 함)
python mj_batch.py --prompts prompts.txt --dry-run

# 2) 실제 실행
python mj_batch.py --prompts prompts.txt --cookies cookies.txt

# 3) 하루치 분할 (15개씩)
python mj_batch.py --prompts prompts.txt --cookies cookies.txt --max-per-run 15

# 4) Windows 간편 실행
run.bat
```

### 중단 & 이어하기

- 실행 중 `Ctrl+C`로 안전 종료
- 다시 같은 명령 실행 → 이미 제출한 프롬프트는 자동으로 건너뜀
- 상태 파일: `prompts.txt.state.json`

### 휴먼 페이싱 설정 (`config.json`)

사람처럼 보이게 하는 타이밍 설정 (초 단위, `[최소, 최대]` 랜덤):

| 항목 | 설명 | 기본값 |
|------|------|--------|
| `think_before_typing` | 타이핑 전 멈춤 | 1.5~5초 |
| `type_char_delay_ms` | 글자당 타이핑 간격 | 35~125ms |
| `review_before_submit` | Enter 전 검토 시간 | 17~20초 |
| `after_submit_wait` | 프롬프트 간 대기 | 60~200초 |
| `jitter` | 랜덤 추가 흔들림 | 0~30초 |
| `long_break_every` | N개마다 긴 휴식 | 7~12개 |
| `long_break_duration` | 긴 휴식 길이 | 3~7분 |
| `distraction_chance` | 딴짓 확률 | 12% |
| `distraction_extra` | 딴짓 시간 | 20~60초 |

> 기본 설정 기준: **50개 프롬프트 ≈ 1~1.5시간**

### 커맨드라인 옵션 전체

```
python mj_batch.py --login                                    # 최초 로그인
python mj_batch.py --prompts FILE                             # 배치 실행
python mj_batch.py --prompts FILE --dry-run                   # 미리보기
python mj_batch.py --prompts FILE --max-per-run N             # N개만 실행
python mj_batch.py --prompts FILE --headless                  # 화면 없이 (비권장)
python mj_batch.py --prompts FILE --cookies FILE              # 쿠키 파일 지정
python mj_batch.py --prompts FILE --use-my-chrome             # 내 크롬 프로필 사용
python mj_batch.py --prompts FILE --chrome-profile "Profile 1" # 특정 프로필
python mj_batch.py --grab-cookies                             # 크롬 쿠키 자동 추출
python mj_batch.py --config other.json --prompts FILE         # 설정 파일 변경
```

---

## 6. 야간 자동 루틴 (밤 10시/11시)

Claude Code 원격 세션에 등록된 두 개의 정기 루틴:

### 밤 10시 (KST) — 배치 실행 확인

```
Trigger: trig_011JckAai6uk3qQBXbeno4JP
Cron:    0 13 * * * (UTC)
동작:    "오늘 미드저니 배치 파일 실행하셨나요?" 질문
```

### 밤 11시 (KST) — 미응답 시 자동 생성

```
Trigger: trig_01NEDi4J8z6j9xTRia51BeEq
Cron:    0 14 * * * (UTC)
동작:    1시간 내 응답 없으면 프롬프트 25개 자동 생성
현재 스타일: 비비드 에디토리얼 푸드·라이프스타일
```

### 자동 생성 프롬프트 스타일 사양

```
- 아트방향: 단색 대담한 컬러블록 배경 (sage green, terracotta, bold red, cream 등)
- 조명: 드라마틱 단일방향광 + 강한 하드 그림자
- 색감: 고채도 먹음직스럽고 신선한 색
- 구성: 미니멀 + 히어로 피사체 하나
- 수량: 25개, 서로 겹치지 않는 다양한 주제
- 포맷: MJ 8.2 원라이너 (--ar 16:9 --style raw --no ...)
- 파일명: YYYY-MM-DD_HHmm.txt
```

### 루틴 스타일 변경

사용자가 대화창에서 스타일을 바꿀 수 있습니다:
```
"오늘부터 야간 자동생성 스타일을 '파스텔 몽환 일러스트'로 바꿔줘"
"비비드 추상화로 바꿔줘"
```

---

## 7. STOCK STUDIO 연동

### 파이프라인 플로우

```
STOCK STUDIO 앱                        midjourney-batch
┌────────────────────┐                 ┌──────────────────┐
│ 1. 오늘의 추천      │                 │                  │
│ 2. AI 두뇌 초안 설계 │                 │                  │
│ 3. REEDO 설정       │──── TXT ───→   │ mj_batch.py      │
│ 4. [미드저니 배치    │    내보내기      │   --prompts      │
│    TXT] 버튼 클릭   │                 │                  │
└────────────────────┘                 └──────────────────┘
```

### STUDIO에서 MJ 프롬프트 내보내기

1. STOCK STUDIO 앱에서 초안 생성 완료
2. 백업·저장 툴바 → **`미드저니 배치 TXT`** 버튼 클릭
3. `<주제>-midjourney.txt` 파일 자동 다운로드
4. 이 파일을 `midjourney-batch/` 폴더로 복사
5. `python mj_batch.py --prompts <파일>.txt --cookies cookies.txt`

### MJ 프롬프트 변환 규칙 (STUDIO 내부)

STUDIO의 `toMidjourney()` 함수가 처리하는 변환:

| STUDIO 설정 | MJ 변환 |
|------------|---------|
| 종횡비 드롭다운 | `--ar 16:9` / `--ar 9:16` 등 |
| `--style raw` | 항상 포함 |
| 인물 = "없음" | `--no ... people` 추가 |
| 한국어 네거티브 | 제거 (MJ에서 양성 토큰으로 오작동) |
| `NO_TEXT_LOCK` | 제거 (MJ 유도 방지) |
| 네거티브 키워드 | `--no text, letters, ... korean text, hangul, calligraphy, ...` |

---

## 8. 배포 가이드

### A. STOCK STUDIO (프론트엔드) — GitHub Pages

**자동 배포**: `main` 브랜치에 push하면 GitHub Actions가 자동 빌드·배포

```
URL: https://dalgakjjang-cloud.github.io/crop-server/
```

**수동 빌드 & 배포**:
```bash
cd freejjang-stock-studio
npm install
npm run build          # dist/ 생성
# dist/ 폴더를 원하는 정적 호스팅에 업로드
```

**지원 호스팅**: GitHub Pages, Netlify, Vercel, S3, Cloudflare Pages 등 어디든 가능 (정적 SPA)

### B. 크롭 서버 (Python 백엔드) — Render.com

현재 `render.yaml` 설정으로 Render.com에 자동 배포됨:

```yaml
services:
  - type: web
    name: jiwoni-crop-server
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn server:app --workers 2 --bind 0.0.0.0:$PORT
```

**다른 서비스에 배포하려면**:
```bash
# Docker
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt server.py ./
RUN pip install -r requirements.txt
CMD ["gunicorn", "server:app", "--workers", "2", "--bind", "0.0.0.0:8000"]
```

### C. mj_batch.py — 로컬 실행 전용

> mj_batch.py는 **브라우저 자동화** 도구이므로 서버 배포가 아닌 **로컬 PC에서 실행**합니다.

**다른 PC에 설치**:

```bash
# 1. 저장소 클론
git clone https://github.com/dalgakjjang-cloud/crop-server.git
cd crop-server/midjourney-batch

# 2. Python 가상환경 + 의존성
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

# 3. 쿠키 설정 (방법 택 1)
# (a) 크롬 확장프로그램으로 cookies.txt 내보내기
# (b) python mj_batch.py --login 으로 직접 로그인
# (c) python mj_batch.py --grab-cookies 로 자동 추출

# 4. 실행
python mj_batch.py --prompts <프롬프트>.txt --cookies cookies.txt
```

**Windows**: `run.bat` 더블클릭으로 간편 실행 가능

### D. Codex(Claude Code) 원격 세션에서 운영

Codex 세션은 **프롬프트 생성 + 파일 관리 + 야간 루틴** 담당:

```
┌─ Codex 원격 세션 ────────────────────────────────────┐
│                                                      │
│  1. 프롬프트 자동 생성 (테마별 MJ + GPT 파일)          │
│  2. 야간 10시 배치 확인 → 11시 미응답 시 자동 생성       │
│  3. git commit + push (프롬프트 파일 저장소 반영)        │
│  4. STOCK STUDIO 코드 수정·기능 추가                   │
│                                                      │
│  ※ 브라우저 자동화(mj_batch.py)는 로컬 PC에서 실행      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Codex에서 프롬프트 생성 → 로컬 실행 워크플로우**:

```bash
# 1. Codex 세션에서 프롬프트 생성 요청
#    → 파일이 저장소에 커밋·푸시됨

# 2. 로컬 PC에서 pull
cd crop-server
git pull origin main

# 3. 프롬프트 파일을 midjourney-batch/로 복사 또는 경로 직접 지정
python midjourney-batch/mj_batch.py --prompts <경로>/prompts.txt --cookies midjourney-batch/cookies.txt
```

---

## 9. 트러블슈팅

### mj_batch.py 관련

| 증상 | 원인 | 해결 |
|------|------|------|
| "프롬프트 입력창을 찾지 못했습니다" | MJ UI 변경 | `config.json`의 `input_selectors` 업데이트. 브라우저 개발자도구에서 입력창 셀렉터 확인 |
| "크롬이 아직 켜져 있어 프로필을 열 수 없습니다" | 크롬 미종료 | 작업관리자에서 chrome.exe 전부 종료 후 재실행 |
| 구글 로그인 차단 | 자동화 브라우저 감지 | `--cookies` 방식 사용 (쿠키 복사) |
| 타이핑 도중 중단 | 네트워크/UI 지연 | 자동으로 부분 제출 시도. `retries` 설정으로 재시도 |
| 쿠키 만료 | 며칠~몇 주 후 | 쿠키 재추출 (확장프로그램 → Export → cookies.txt 교체) |

### 프롬프트 관련

| 증상 | 원인 | 해결 |
|------|------|------|
| 이미지에 글자가 나옴 | 프롬프트에 텍스트 유도 단어 | `sign`, `poster`, `headline` 등 제거. `--no` 네거티브 확인 |
| 한국어/한글이 이미지에 나옴 | `calligraphy`, `wall lettering` 등 | 네거티브에 `korean text, hangul, calligraphy` 추가 |
| `--v 7` 플래그가 남아있음 | 이전 버전 프롬프트 | `--v 7` 제거 (8.2는 자동) |
| AI 느낌이 강함 | `--style raw` 누락 | `--style raw` 추가 |

### Codex/루틴 관련

| 증상 | 원인 | 해결 |
|------|------|------|
| 야간 루틴이 안 뜸 | 세션 비활성 | 세션 재시작 또는 루틴 재등록 |
| MCP 서버 연결 끊김 | 일시적 장애 | ToolSearch로 재연결 대기 |
| git push 실패 | 원격 브랜치 충돌 | `git pull --rebase origin <branch>` 후 재시도 |

---

## 10. 부록: 프롬프트 테마 라이브러리

지금까지 생성된 프롬프트 세트 목록:

### 자연/동물 계열

| 세트 | 수량 | 포맷 | 비율 |
|------|------|------|------|
| 내셔널지오그래픽 대자연 | 20개 | MJ | 16:9 |
| 내셔널지오그래픽 대자연 세로 | 10개 | MJ | 9:16 |
| 희귀·멸종위기 동물 | 20개 | MJ+GPT | 16:9 |
| 동물의 눈 극한 매크로 | 20개 | MJ+GPT | 16:9 |
| 깃털·날개 디테일 | 20개 | MJ+GPT | 16:9 |
| 뿔·엄니·앤틀러 구조 | 20개 | MJ+GPT | 16:9 |
| 심해·수중 희귀 생물 | 20개 | MJ+GPT | 16:9 |
| 파충류·곤충 비늘·질감 | 20개 | MJ+GPT | 16:9 |
| 야생 동물 행동·서식지 | 20개 | MJ+GPT | 16:9 |

### 민속/문화 계열

| 세트 | 수량 | 포맷 | 비율 |
|------|------|------|------|
| 아프리카 소수민족 의식·춤 | 20개 | MJ+GPT | 16:9 |
| 아시아·오세아니아 소수민족 춤 | 20개 | MJ+GPT | 16:9 |
| 남미·북미 원주민 춤 | 20개 | MJ+GPT | 16:9 |
| 세계 음식과 문화 | 25개 | MJ | 16:9 |
| 세계 면직물·염색 | 20개 | MJ | 16:9 |

### 비즈니스 계열

| 세트 | 수량 | 포맷 | 비율 |
|------|------|------|------|
| 한국인 30대 비즈니스 | 20개 | MJ | 16:9 |
| 국제 다양한 인종 비즈니스 | 20개 | MJ | 16:9 |
| 고객상담 CS | 10개 | MJ | 16:9 |
| AI 자동화 | 10개 | MJ | 16:9 |
| 데이터 분석 | 10개 | MJ | 16:9 |
| 회계·세무·재무 | 10개 | MJ | 16:9 |
| IT·개발·보안 | 10개 | MJ | 16:9 |
| 핀테크·금융 | 10개 | MJ | 16:9 |

### 일러스트/추상 계열

| 세트 | 수량 | 포맷 | 비율 |
|------|------|------|------|
| 파스텔 몽환 일러스트 (3세트) | 75개 | MJ | 9:16 |
| 비비드 추상화 (2세트) | 50개 | MJ | 9:16 |

### 푸드/라이프스타일 계열

| 세트 | 수량 | 포맷 | 비율 |
|------|------|------|------|
| 비비드 에디토리얼 푸드·라이프스타일 | 25개 | MJ | 16:9 |
| 야간 자동 생성분 (매일) | 25개/일 | MJ | 16:9 |

---

## 참고 & 주의사항

> **Midjourney 이용약관**: Midjourney/Discord는 자동화를 금지합니다. 이 도구는 **본인 계정으로 본인 창작 작업을 하는 개인 용도**로만 사용하세요. 계정 정지 위험은 전적으로 사용자 책임입니다.

> **위험 최소화 권장사항**: 하루 수십 장 이내, 넉넉한 텀, headless 금지 (화면 보며 실행), 밤새 무인 방치 금지, `max_per_run`으로 하루치 분할.

---

_FreeJJang Midjourney Auto-Batch System · v8.2 · 2026.07_
