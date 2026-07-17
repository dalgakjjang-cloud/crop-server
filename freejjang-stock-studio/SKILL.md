# 🎨 FreeJJang STOCK STUDIO — 총 스킬 맵

> AI 두뇌가 초안을 설계하고, 트리플 엔진이 이미지를 생성하고, 자동 QC·업스케일을 거쳐
> **Adobe Stock · MiriCanvas 제출팩(ZIP)** 까지 원클릭으로 내보내는 브라우저 기반 스톡 이미지 제작소.

| 항목 | 값 |
|---|---|
| 스택 | React 18 + Vite 5 + Tailwind CSS 3 |
| 배포 | GitHub Pages — https://dalgakjjang-cloud.github.io/crop-server/ |
| 핵심 파일 | `src/App.jsx` (1,800+ 줄, 단일 파일 아키텍처) |
| 의존성 | react, react-dom, xlsx, jszip, pica, lucide-react |

---

## 📊 한눈에 보기

| 2 | 3 | 9 | 21 | 5 |
|:---:|:---:|:---:|:---:|:---:|
| AI 두뇌 | 이미지 엔진 | 카메라 프리셋 | Adobe 카테고리 | 톤/미학 모드 |

**파이프라인**

```
오늘의 추천 → 초안 설계 → 이미지 생성 → QC 검수 → 자동 수리 → 업스케일 → 제출팩 ZIP
(Gemini검색)  (장면매트릭스)  (트리플폴백)  (7항목자동)  (재작성+재생성) (pica 4MP)  (CSV+XLSX)
```

---

## 🧠 AI 두뇌 시스템 — `askBrain()`

- **듀얼 두뇌 라우터 + 자동 폴백** — GPT(Codex 계열) 또는 Gemini 선택. 한쪽 실패 시 자동으로 다른 두뇌로 전환하여 초안 설계가 중단되지 않음.
- **모델 직접 선택** — GPT: `gpt-5-mini`, `gpt-5`, `gpt-4.1-mini`, `gpt-4o` / Gemini: `gemini-3.1-flash`, `pro`, `2.5-flash` 등 프리셋 + 직접 입력.
- **장면 매트릭스 다양성 (2-Phase)** — `draftSlots()`
  - Phase A: 전체 세트에 걸친 고유 장소·구도·소품 매트릭스 설계
  - Phase B: 2장씩 병렬 확장하여 각 슬롯 디테일 완성 → 6장 찍어도 전부 다른 장면
- **Gemini google_search 그라운딩** — `askGeminiGrounded()` 실시간 트렌드 검색으로 '오늘의 추천 주제'가 실제 시장 수요를 반영.

## 🎨 이미지 생성 엔진 — `generateImage()`

- **트리플 엔진 자동 폴백** — GPT `gpt-image` → Gemini `2.5-flash-image` → Pollinations(Flux, 무료). 실패/한도 초과 시 자동 다음 엔진.
- **이코노미 2-Pass 렌더링** — `genOpenAIRefine()` 1차 `low` 초안 → 2차 OpenAI `images/edits`로 구도 보존하며 `medium`/`high` 리파인. 비용 1/4~1/8 절감.
- **Pollinations 무료 엔진** — `genPollinations()` API 키 없이 URL 기반 생성. 1024px 기반 비율 자동 맞춤(가로 늘림 방지).
- **비율 5종 · 카메라 9종 프리셋** — 1:1, 16:9, 4:3, 3:4, 9:16 + Eye Level, Low Angle, Wide, Closeup, Macro 등.
- **실시간 비용 추적** — GPT low `$0.005` ~ high `$0.165`, Gemini `$0.039`, Pollinations `$0` 누적 표시.

## 🛡 품질 관리 · Adobe 규정 준수

- **7항목 자동 QC** — 텍스트/로고, 안전성, 키워드 관련성, 해상도, 주제 중복, 구도 지침, Adobe 리뷰어 시점 기술 품질.
- **자동 수리(Auto-repair)** — `repairSlot()` QC 실패 시 두뇌가 장면 재작성 → 텍스트 포함 장면 차단 → 새 프롬프트로 재생성.
- **기술 품질 프롬프트 강화** — f/4~5.6 고선명, 균일 노출, 제로 노이즈, AI-플라스틱 질감 금지, 여백 40% 상한, 물리적 타당성(컵은 테이블 위).
- **텍스트 포함 장면 원천 차단** — 초안 매트릭스에서 슬라이드/포스터/간판 등 텍스트 렌더링 장면 설계 자체 금지.
- **QC 피드백 주입** — `buildSlotPrompt()` 거절 사유를 CRITICAL CORRECTION으로 재생성 프롬프트에 삽입.

## 📦 SEO · 메타데이터 · 제출팩 — `exportSubmitPack()`

- **Adobe SEO 키워드 자동 패딩 (EN 35개)** — `padKeywordsEN()` 제목·주제·소품에서 단어 추출, 불용어 제외 후 35개까지 보충.
- **MiriCanvas 한국어 키워드 (KR 25개)** — `padKeywordsKR()` 한글 25개 상한 검증, 한글 불용어 필터링.
- **자동 업스케일 → JPEG 변환** — `upscaleForAdobe()` pica(Lanczos + unsharp mask)로 Adobe 최소 4MP 업스케일, PNG → JPEG 자동.
- **듀얼 제출팩 ZIP** — `_adobe`(JPEG + CSV) + `_miri`(원본 + XLSX) 자동 분류, 파일명 CSV 일치.
- **Adobe 카테고리 21종 자동 분류** — Animals, Business, Technology, Travel 등 AI 자동 선정.

### ⚖ 플랫폼 라우팅 규칙 (핵심 · 전 브랜치 공통) — `isAdobeEligible()`

> **어도비 거절 ≠ 미리캔버스 거절.** 실측상 어도비가 기술심사로 반려한 컷도 미캔에서는 ~98% 승인·판매된다.
> 따라서 다크·글로우 컷을 억지로 어도비에 밀어넣지 않는다 — 계정 승인율만 깎이기 때문. 제출 팩이 자동 분리한다.

- **어도비 3대 기술거절 유발 유형** = ①어두운 곳의 과도한 네온·발광 ②소프트/크리미 블러·보케 ③다크·야간·컨셉 렌더. `DARK_GLOW_RE` + `mode(wallpaper/emotional)` + `tone(concept/cinematic)`로 감지.
- **라우팅** — 밝은·선명 상업컷 → **어도비 CSV + `adobe/` + 미캔**(양쪽). 다크·글로우·야간·컨셉 → **미캔 전용**(`miri/` + XLSX만, 어도비 CSV에서 제외).
- **미캔은 전량 수집** — 미캔 XLSX·`miri/`에는 성공 이미지 전부 담는다(관대·고승인).
- **`{base}-routing.txt`** — 어느 컷이 어도비/미캔 어디로 갔는지 요약 동봉, 제출 워크플로 추적용.
- 이 규칙은 양산 파이프라인의 캐논이며 다른 브랜치도 동일 적용한다(머지·리베이스로 전파).

## ⚡ UX · 워크플로

- **오늘의 추천** — `recommendToday()` Gemini google_search 트렌드 기반, 주제·우선 키워드·구도/소품 팁 원클릭.
- **판매시기 중복 방지** — `recoHistory` localStorage 보관, 같은 판매 윈도우 겹치는 주제 제외, 접기 가능 이력.
- **프롬프트 선행 표시** — 이미지 생성 전 최종 프롬프트를 슬롯에 먼저 표시.
- **슬롯 수 · 마감 시간 설정** — 3/5/10/15장 + 임의값, 초안 생성 최대 시간(분) 설정, 초과 시 자동 중단.
- **강제 실행 버튼** — `runGeneration(force)` 마감 지나도 남은 슬롯 계속 생성.
- **저해상도 경고** — `ADOBE_MIN_MP` 4MP 미만 경고 배지, 내보내기 시 자동 업스케일.
- **설정 자동 저장** — API 키·엔진·품질·에코 토글·추천 이력 유지, 키워드·소품 팁은 새로고침 시 초기화.

## ✍ 프롬프트 엔지니어링 — `buildSlotPrompt()`

- **REEDO 구조화 시스템** — 스타일(실사/3D/수채화/벡터/플랫레이…), 지역(미국/한국/유럽/일본/글로벌), 배경(흰배경/자연광/스튜디오/보케…), 인물(없음/1~2명/최대3명) 드롭다운 조합.
- **톤/판매 미학 5종** — `TONE_PHRASE` 판매 리얼(기본), 밝은 미니멀, 라이프스타일 온기, 시네마틱 무드, 미래 컨셉. 2026 베스트셀러 조사 기반.
- **지능형 분위기 필터** — `INDOOR_RE`/`NIGHT_RE` 실내/사무 감지 → 중립 화이트밸런스 자동(노란끼 배제).
- **GUARD 안전 규칙** — 텍스트·숫자·로고·워터마크·브랜드·저작권 캐릭터·미요청 인물 원천 차단.
- **배경화면/배너 여백 강화** — `WALLPAPER_RE` 감지 시 카피스페이스 확보 구문 자동 추가.

## 🔧 인프라 · 배포

- **GitHub Pages 자동 배포 + 재시도** — `.github/workflows/deploy-pages.yml` main push 시 자동 빌드·배포. 백엔드 쿨다운 거부 시 60초→120초 대기 후 최대 3회 재시도.
- **단일 파일 아키텍처** — `src/App.jsx` 1,800줄에 전체 파이프라인 집약.

---

## 🚀 다른 컴퓨터에 설치하기

### 사전 준비
- **Node.js 18 이상** ([nodejs.org](https://nodejs.org)에서 설치)
- Git

### 설치 & 실행

```bash
# 1. 저장소 클론
git clone https://github.com/dalgakjjang-cloud/crop-server.git
cd crop-server/freejjang-stock-studio

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행 → http://localhost:5173
npm run dev
```

### 프로덕션 빌드

```bash
npm run build      # dist/ 폴더 생성 (정적 파일)
npm run preview    # 빌드 결과 로컬 미리보기
```

`dist/` 폴더를 어떤 정적 호스팅(Netlify, Vercel, GitHub Pages, S3 등)에도 그대로 업로드하면 배포됩니다.

### API 키 입력

앱 상단 설정에서 입력합니다. **키는 브라우저 localStorage에만 저장**되며 서버로 전송되지 않습니다.

| 엔진 | 키 형식 | 발급처 |
|---|---|---|
| GPT (기본) | `sk-…` | OpenAI Platform |
| Gemini | `AQ…` (신규 · 2026-07-06~) 또는 `AIzaSy…` (구) | Google AI Studio |
| Pollinations | 불필요 (무료) | — |

> 💡 최소 GPT 또는 Gemini 키 하나만 있으면 동작하며, 키가 전부 없어도 **Pollinations 무료 엔진**으로 이미지 생성이 가능합니다.

---

_FreeJJang STOCK STUDIO · 2026.07_
