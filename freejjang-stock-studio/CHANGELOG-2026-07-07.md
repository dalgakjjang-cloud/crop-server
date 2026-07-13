# FreeJJang STOCK STUDIO — 7월 7일 이후 변경사항 상세

> **파일**: `freejjang-stock-studio/src/App.jsx`  
> **기간**: 2026-07-07 ~ 2026-07-13  
> **커밋 수**: 28개  
> **변경량**: +1,318줄 / -182줄  
> **배포**: https://dalgakjjang-cloud.github.io/crop-server/

---

## 목차

1. [전역 블러 금지 정책 (3중 방어)](#1-전역-블러-금지-정책-3중-방어)
2. [장르 자동 감지 엔진 (11종)](#2-장르-자동-감지-엔진-11종)
3. [BESTSELLER_REFERENCE 검증된 판매 공식 (20+종)](#3-bestseller_reference-검증된-판매-공식-20종)
4. [CLEAN_BACKDROP 승인 표본 배경 공식](#4-clean_backdrop-승인-표본-배경-공식)
5. [미리캔버스 실제 판매 데이터 시스템 (MIRI_PROVEN_SALES)](#5-미리캔버스-실제-판매-데이터-시스템-miri_proven_sales)
6. [미드저니 파이프라인 (배치 TXT + 이미지 불러오기)](#6-미드저니-파이프라인-배치-txt--이미지-불러오기)
7. [외부 프롬프트 가져오기 시스템](#7-외부-프롬프트-가져오기-시스템)
8. [음식 장르 정밀 제어](#8-음식-장르-정밀-제어)
9. [PIW 흰배경 제품격리 시스템](#9-piw-흰배경-제품격리-시스템)
10. [카메라 구도 프리셋 (9종)](#10-카메라-구도-프리셋-9종)
11. [한국인 캐스팅 자동 강제](#11-한국인-캐스팅-자동-강제)
12. [다크네온 SF 차단 + 테크 제품컷 강제](#12-다크네온-sf-차단--테크-제품컷-강제)
13. [밝기 강제 규칙](#13-밝기-강제-규칙)
14. [UI/UX 변경사항](#14-uiux-변경사항)
15. [Gemini 모델 업데이트](#15-gemini-모델-업데이트)
16. [미캔 전용 ZIP + XLSX 한글 인코딩 수정](#16-미캔-전용-zip--xlsx-한글-인코딩-수정)
17. [커밋 전체 목록](#17-커밋-전체-목록)

---

## 1. 전역 블러 금지 정책 (3중 방어)

**사용자 절대 규칙**: 배경 포함 화면 어디에도 블러/보케/얕은심도/아웃포커스 금지.

### 방어 레이어

| 레이어 | 위치 (라인) | 역할 |
|--------|-----------|------|
| **두뇌 규칙** | BESTSELLER_REFERENCE 끝 (L126) | `ABSOLUTE NO-BLUR POLICY` 문장으로 초안 두뇌에게 블러 생성 자체를 차단 |
| **JS scrub** | `scrubBlurText` (L37-47), `scrubSlotBlur` (L53-59) | 초안·외부 가져오기·자동수정 등 텍스트 생성 후 블러 표현을 선명 표현으로 치환 |
| **QC 거부** | buildSlotPrompt 가드 문구들 | `NO_BLUR_LINE` (L36) — 이미지 프롬프트에 `deep depth of field` 강제 주입 |

### 상수/함수 상세

```
L36  NO_BLUR_LINE = "deep depth of field, every part of the scene crisply sharp..."
L37  scrubBlurText(v) — EN+KR 블러 표현→선명 표현 치환 (정규식 6단계)
     - "blurred background" → "sharp background"
     - "shallow depth of field" → "deep depth of field"
     - "bokeh/defocused/out of focus" → "sharp"
     - "블러/보케/아웃포커싱" → "선명한"
L50  SCRUB_FIELDS = ["subject","props","camera","lighting","palette","copy_space","focal_placement","title"]
L51  BLUR_KW_EN — 영문 블러 키워드 정규식 (키워드에서 제거용)
L52  BLUR_KW_KR — 한글 블러 키워드 정규식
L53  scrubSlotBlur(item) — 슬롯 필드 일괄 스크럽 + 키워드에서 블러 단어 제거
```

### 적용 지점

- 초안 상세화 후 슬롯 생성 시
- 외부 프롬프트 가져오기 (`importPrompts`) 정제 후
- 자동수정/복구 시
- `toMidjourney()` 최종 프롬프트 출력 시 (L838)
- `buildMidjourneyPrompt()` 배치 출력 시 (L896)

---

## 2. 장르 자동 감지 엔진 (11종)

`buildSlotPrompt()` (L601)에서 슬롯의 subject/title/keywords/props를 정규식으로 스캔하여 장르별 스타일링/가드를 자동 주입.

| 장르 | 정규식 (라인) | 스타일링 | 가드 |
|------|-------------|---------|------|
| **골프** | `GOLF_RE` (L71) | `GOLF_STYLING` (L72) — 딥DOF, 잔디+하늘 선명 | `GOLF_GUARD` (L73) |
| **미캔 라이프스타일** | `MIRI_LIFESTYLE_RE` (L76) — 부동산·육아·반려동물·홈트 포함 | `MIRI_LIFESTYLE_STYLING` (L77) — 밝은 한국 홈 미학 | `MIRI_LIFESTYLE_GUARD` (L78) |
| **헬스케어** | `HEALTHCARE_RE` (L81) — 간병·요양·시니어케어 포함 | `HEALTHCARE_STYLING` (L84) | `HEALTHCARE_GUARD` (L85) |
| **신앙/워십** | `FAITH_RE` (L62) | 골든아워 역광 허용 | `FAITH_GUARD` (L63) |
| **음식** | `FOOD_RE` (L239) — 80+ 키워드 | `FOOD_STYLING` (L245) | `FOOD_GUARD` (L249) |
| **일본·한국 카페** | `JPKR_CAFE_RE` (L241) | 깅엄+파스텔 카와이 | (음식 가드 공유) |
| **밀프랩/도시락** | `MEALPREP_RE` (L243) | 칸막이 용기+화이트 하이키 | (음식 가드 공유) |
| **PIW 제품격리** | `PIW_RE` (L295) | `PIW_STYLING` (L296) | `PIW_GUARD` (L297) |
| **디지털 업무** | `WORK_TECH_RE` (L274) | `WORK_TECH_STYLING` (L276) — 기기 선명, 딥DOF | (상업 가드 공유) |
| **테크 하드웨어** | `TECH_PRODUCT_RE` (L279) | `TECH_PRODUCT_STYLING` (L281) — 밝은 제품컷 | (상업 가드 공유) |
| **감성 배경** | `EMOTIONAL_RE` (L146) | `EMOTIONAL_ATMOS` (L66) — 골든아워 빛내림 | `EMOTIONAL_GUARD` (L67) |
| **추상/배경화면** | `WALLPAPER_RE` (L144) — 그라데이션·텍스처·패턴 추가 | 모드 자동 전환 | (별도) |

### 장르 우선순위 (buildSlotPrompt 내부)

```
1. isWorkTech (디지털 업무) — 최우선, 음식/라이프/헬스케어 오분류 억제
2. isTechProduct — 상업 모드에서만 (배경화면·감성은 네온 허용)
3. isPIW — 심리스 화이트 격리
4. isFood — PIW·디지털업무 아닐 때
5. isJpkrCafe — PIW 아닐 때
6. isMealprep — PIW 아닐 때
7. isGolf — PIW·디지털업무·음식 아닐 때
8. isMiriLifestyle — 감성·음식·PIW·디지털업무·골프 아닐 때
9. isHealthcare — 위 전부 아닐 때
```

---

## 3. BESTSELLER_REFERENCE 검증된 판매 공식 (20+종)

**위치**: L102-128

두뇌(추천·초안)에 주입되는 장르별 판매 공식. 7월 7일 이후 추가/보강된 항목:

| 공식 | 상태 | 핵심 내용 |
|------|------|----------|
| **부동산/아파트** | 대폭 보강 | (A) 입주 후 일상 — 소파 가족씬, (B) 단지 외관 — 고층 녹지 전경 |
| **시즌 캠페인 그룹샷** | 신규 (L123) | 청년 3-4인 야외 시즌음료, 밝은 자연광, 시즌 컬러 |
| **반려동물 홈** | 신규 (L107) | 밝은 홈에서 주인+반려동물, 미캔 시그니처 |
| **육아/아기 마일스톤** | 신규 (L108) | 밝은 너서리, 돌잔치, 부모 독서, 웜뉴트럴 |
| **골프 라이프스타일** | 보강 (L113) | 딥DOF, 선명한 잔디+하늘, 맥스 3명 |
| **헬스케어** | 보강 (L114) | 글로벌 다양성, 한국 명시 시 한국 캐스팅 |
| **한국 실생활 패키지** | 보강 (L115) | 남성·부부·가족도 참여 (여성 한정 아님) |
| **밀프랩/도시락** | 보강 (L121) | 칸막이 용기 분리, 화이트 하이키 |
| **일본·한국 카페** | 보강 (L122) | 깅엄+파스텔 20+ 배치 승인 검증 |
| **AI 추상 배경** | 보강 (L105) | 2026 어도비 최고 세그먼트, 블러리스 3D |
| **PIW 제품격리** | 보강 (L116) | 시즌별 대량 배치 공식, 30-100 변형 |

### 두뇌 주입 위치

`${BESTSELLER_REFERENCE}${MIRI_SALES_REF}` 형태로 3곳에 주입:
- 초안 시스템 프롬프트 (L~1254)
- 초안 상세화 프롬프트 (L~1259)
- 오늘의 추천 프롬프트 (L~1452)

---

## 4. CLEAN_BACKDROP 승인 표본 배경 공식

**위치**: L289-291

승인 샘플 5장 분석에서 도출한 공통 배경 규칙. 라이프스타일/음식/밀프랩/헬스케어 등 실내 인물 장르에 공통 주입.

```
L289  CLEAN_BACKDROP — 피사체 뒤 빈 무지 벽, 소품 가장자리 1-2개, 톤+광 분리 (블러 아님)
L291  MJ_CLEAN_BACKDROP — 미드저니용 부정문 없는 안전판
```

**규칙 요약**:
- 피사체 바로 뒤 = 빈 벽/연속 면 (선반·액자·벽장식 금지)
- 소품 = 프레임 가장자리에 식물/램프/꽃병 최대 1-2개
- 전경 = 넓은 클린 면 (원목·침구·카운터) 지배
- 분리 = 벽보다 반 톤 깊은 피사체 + 부드러운 방향광 (블러 아님)

**적용 장르**: 미캔라이프스타일, 음식(jpkr_cafe·PIW 제외), 헬스케어, 실내 인물
**제외**: PIW(심리스 화이트), 깅엄카페(깅엄 패브릭), 감성/신앙(역광), 야외/풍경

---

## 5. 미리캔버스 실제 판매 데이터 시스템 (MIRI_PROVEN_SALES)

**위치**: L88-99 (신규)

실제 승인·판매된 이미지의 공통점을 축적하는 배열. 항목 추가만 하면 자동으로 두뇌 프롬프트에 반영.

### 구조

```javascript
const MIRI_PROVEN_SALES = [
  { id: "24700816", file: "realestate004", date: "2026-06-30",
    category: "부동산·인테리어",
    desc: "한국 가족(부부+아이)이 밝은 거실 화이트 소파..." },
  { id: "24700736", file: "realestate006", date: "2026-06-30",
    category: "부동산·인테리어",
    desc: "한국 아파트 단지 외관 — 현대식 고층..." },
  { id: "24832168", file: "여름캠페인", date: "2026-07-02",
    category: "시즌·캠페인",
    desc: "한국 청년 4인 그룹이 여름 음료..." },
];
```

### 자동 변환

```javascript
const MIRI_SALES_REF = MIRI_PROVEN_SALES.length
  ? `\nMIRICANVAS ACTUAL SALES DATA (${MIRI_PROVEN_SALES.length} proven sold images...):\n` +
    MIRI_PROVEN_SALES.map((s, i) => `${i+1}. [${s.category}] ${s.desc} (sold ${s.date})`).join("\n")
  : "";
```

### 새 판매 데이터 추가 방법

`MIRI_PROVEN_SALES` 배열에 객체 추가:
```javascript
{ id: "미캔ID", file: "파일명", date: "YYYY-MM-DD",
  category: "카테고리명", desc: "승인된 구도 상세 설명" }
```
→ `MIRI_SALES_REF` 자동 재생성 → 두뇌 프롬프트 3곳에 자동 주입

---

## 6. 미드저니 파이프라인 (배치 TXT + 이미지 불러오기)

### 6-1. 미드저니 인터랙티브 변환

**함수**: `toMidjourney(slot, mode, tone, people, aspect, hands)` — L792

슬롯 → MJ 단일 프롬프트. 핵심 처리:
- 가드 문자열 전부 제거 (MJ가 부정어를 유인어로 읽는 사고 방지)
- `NO_TEXT_LOCK` 제거 (한글/서예 명사가 오히려 그려짐)
- `MJ_POSITIVE_FIXES` (L762-780) — 부정문→긍정문 치환 28쌍
- `MJ_WINDOW_FIXES` (L782-791) — 창문·역광 → 정면광 치환
- 한국인 캐스팅 → 프롬프트 선두 복제 (앞 토큰 가중치)
- `--no` 네거티브 구성: 기본(`MJ_NEG_BASE`) + 상업(`MJ_NEG_COMMERCIAL`) + 네온(`MJ_NEG_NEON`) + PIW(`MJ_NEG_PIW`) + 품질(`MJ_NEG_QUALITY`)
- 전역 블러 금지 → `--no blur, bokeh, shallow depth of field...`
- 승인 배경 공식 → `--no cluttered background, shelves, wall art...`

### 6-2. 배치 TXT 내보내기

**함수**: `exportMidjourneyBatch()` — L1776

슬롯 → `buildMidjourneyPrompt()` (L851) → TXT 파일 저장.
- 헤더에 사용법 주석 포함 (`python mj_batch.py --prompts <파일>.txt`)
- `--style raw`, `--no`, `--ar` 파라미터 자동 포함
- 한 줄 = 프롬프트 하나, `#` 줄은 mj_batch.py가 무시

### 6-3. MJ 배치 이미지 불러오기 (신규)

**함수**: `onMjBatchImages(e)` — L1791

mj_batch.py로 생성한 이미지를 슬롯에 다시 연결:
1. 파일 선택 (복수 선택 가능, `multiple` 속성)
2. PNG/JPG/WebP만 필터
3. 파일명 자연정렬 (`localeCompare` numeric)
4. 슬롯 순서대로 1:1 매칭
5. FileReader → dataUrl → Image → 자연 크기(px) 추출
6. 슬롯에 `dataUrl`, `px`, `status:"success"`, `engine:"midjourney"` 세팅
7. 초과/부족 시 안내 메시지

**UI**: L~2725 — hidden file input (`mjImgRef`) + "MJ 이미지 불러오기" 버튼 (미드저니 배치 TXT 옆)

### 라운드트립 플로우

```
[앱] 프롬프트 생성 → exportMidjourneyBatch() → TXT 파일
    ↓
[외부] mj_batch.py --prompts <파일>.txt → 이미지 폴더
    ↓
[앱] onMjBatchImages() → 이미지를 슬롯에 연결 → 제출 팩/ZIP 다운로드
```

---

## 7. 외부 프롬프트 가져오기 시스템

### 7-1. 텍스트 분할

**함수**: `splitRawPrompts(raw)` — L902

외부 TXT를 슬롯 단위로 자동 분할:
- 우선순위: (1) 명시 구분선 (`---`, `===`, `***`) → (2) 빈 줄 블록 → (3) 줄 단위
- `#` 주석 줄 제거, 번호/불릿 머리표 제거, 3자 미만 버림

### 7-2. 정제 시스템

**상수**: `IMPORT_SYSTEM` — L920-935

외부 프롬프트 → 어도비/미캔용 정제 슬롯 변환 두뇌 지시:
- 사용자 의도(피사체·플레이팅·앵글·무드) 보존
- 모델 문법 노이즈 제거 (`--ar`, `--no`, `8k`, `hyperdetailed` 등)
- 상업 구도로 업그레이드
- 메타데이터 완비: 제목(EN/KR), 35 EN 키워드, 25 KR 키워드, 카테고리
- 전역 블러 금지 오버라이드 적용
- CLEAN BACKDROP 공식 강제

### 7-3. 가져오기 함수

**함수**: `importPrompts(rawText)` — L1345

1. `splitRawPrompts`로 분할 (최대 50개)
2. 3개씩 배치로 두뇌에 병렬 전송
3. `scrubSlotBlur`로 블러 스크럽
4. `padKeywordsEN`/`padKeywordsKR`로 키워드 보충
5. 슬롯 생성 → review 단계로 진입

**파일 입력**: `onPromptFile(e)` — L1406 — 파일 선택 → `importPrompts` 호출

---

## 8. 음식 장르 정밀 제어

### 자동 감지 정규식

```
L239  FOOD_RE — 80+ EN/KR 음식 키워드 (떡·쿠키·밀프랩 등 추가됨)
L241  JPKR_CAFE_RE — 일본·한국 카페 컴포트 (깅엄+파스텔 자동 감지)
L243  MEALPREP_RE — 밀프랩/도시락 (칸막이 용기 + 화이트 강제)
L256  FOOD_TOPVIEW_RE — 탑뷰 자동 감지 (샐러드·밀프랩·플랫레이·피자 등)
L258  FOOD_EYELEVEL_RE — 아이레벨 자동 감지 (음료·국물·칵테일 등)
L259  FOOD_ANGLE45_RE — 45도 자동 감지 (버거·파스타·케이크·스테이크 등)
```

### 조명/구도 상수

```
L245  FOOD_STYLING — 밝고 초근접 실사 인스타 느낌
L247  FOOD_STYLING_TOPVIEW — 탑뷰 전용 (접사 표현 제외)
L249  FOOD_GUARD — 밝고 식욕 자극 + 전역 노블러
L253  FOOD_LIGHT — 상업 음식 조명 시그니처 (뒤 45도 주광 + 반사판 + 레이킹)
L260  pickFoodAnglePhrase(themeAll) — 요리 형태별 최적 앵글 자동 선택
L269  FOOD_FULLFRAME — 음식 단독 주제 풀프레임 (짤림 0)
L271  FOOD_TOPVIEW_FULLFRAME — 탑뷰 전용 풀프레임 + 전 영역 딥DOF
```

### 음식 장르 REEDO 프리셋 (13종)

**위치**: L211-237 (`REEDO_FOOD`, `REEDO_FOOD_PHRASE`)

| 키 | 설명 |
|----|------|
| `jpkr_cafe` | 일본·한국 카페 컴포트 — 어도비 20+ 배치 승인 |
| `brunch` | 브런치/카페 |
| `world_brunch` | 나라별 브런치 (미국/영국/프랑스/일본/한국/중동/멕시코) |
| `dessert` | 디저트/베이커리 |
| `trending` | 트렌딩 디저트 (버터떡·두쫀쿠·약과·크루키) |
| `cafe_drink` | 카페 시즌 드링크 (그라디언트 레이어·딸기라떼 등) |
| `korean` | 한식/집밥 |
| `steak` | 스테이크/그릴 (미디엄레어 단면·캐스트아이언) |
| `beverage` | 음료/커피 |
| `finedining` | 파인다이닝/플레이팅 |
| `healthy` | 건강식/샐러드 |
| `street` | 분식/길거리 |
| `homecook` | 홈쿠킹/재료 |
| `flatlay` | 푸드 플랫레이(탑뷰) |
| `piw` | 흰배경 제품컷 (푸드) |
| `mealprep` | 밀프랩/도시락 (칸막이 용기) |

---

## 9. PIW 흰배경 제품격리 시스템

**위치**: L295-297

```
L295  PIW_RE — 제품컷·흰배경·심리스·오브젝트격리·e-commerce 감지
L296  PIW_STYLING — 심리스 화이트, 60-80% 히어로, 균일 무영광, 탁샤프
L297  PIW_GUARD — 순수 화이트, 무영광, 배경 없음, 인물 없음
```

buildSlotPrompt에서 PIW가 감지되면:
- 음식/라이프스타일 장르보다 우선 적용
- 별도 구도 문자열: "product hero on seamless pure white background"
- MJ에서도 별도 네거티브: `MJ_NEG_PIW`

---

## 10. 카메라 구도 프리셋 (9종)

**위치**: L162-173

| 키 | 라벨 | 프레이즈 |
|----|------|---------|
| `auto` | 자동 | (초안 카메라 그대로) |
| `eye_level` | Eye Level (정면) | 50mm 렌즈, 균형 |
| `low_angle` | Low Angle (올려다보기) | 다이나믹, 파워풀 |
| `high_angle` | High Angle (내려다보기) | 정리된 탑다운 뷰 |
| `top_down` | Top-Down (탑다운/항공뷰) | 90도 직하, 플랫레이 (7/9 신규) |
| `wide` | Wide (와이드) | 24mm, 넓은 환경 컨텍스트 |
| `angle_45` | Angle 45 (사선 45도) | 3/4 앵글, 자연스러운 깊이 |
| `over_shoulder` | Over Shoulder (어깨 너머) | 캔디드 프레이밍 |
| `closeup` | Closeup (클로즈업) | f/8 탁샤프, 딥DOF |
| `macro` | Macro (초근접 접사) | 포커스스택, 전체 선명 |

---

## 11. 한국인 캐스팅 자동 강제

**커밋**: 250c88f (2026-07-08)

```
L83  KOREAN_EXPLICIT_RE — 한국 지명·국가명 감지
L631 isKoreanExplicit = koreanCast || KOREAN_EXPLICIT_RE.test(themeAll)
L676-678 koreanCastLine — "authentically Korean with natural East Asian Korean facial features"
```

- 주제/지역이 한국이면 인물을 한국인으로 강제 캐스팅
- 어도비 글로벌 다양성 규칙은 이때만 억제
- `toMidjourney()`에서는 프롬프트 선두로 "Korean East Asian people" 복제 (L813)

---

## 12. 다크네온 SF 차단 + 테크 제품컷 강제

**커밋들**: d80bcae, aacf349 (2026-07-09)

```
L279  TECH_PRODUCT_RE — 반도체·서버·로봇·드론·AI 등 자동 감지
L281  TECH_PRODUCT_STYLING — 밝은 배경·균일광·실물 재질 (발광 없음)
L612-614 isTechProduct — 상업 모드에서만 적용 (배경화면·감성은 네온 허용)
```

- 어도비 대량 거절 패턴인 "다크 네온 SF 렌더" 차단
- 승인 공식 = 밝은 클린룸/랩 or 심리스 배경의 프리미엄 제품컷
- 배경화면·감성 모드의 테크는 네온이 판매 미학이라 밝은 제품컷으로 뭉개지 않음

---

## 13. 밝기 강제 규칙

**커밋**: 8f38430 (2026-07-08)

```
L179  MOODY_ALLOWED_RE — 어두움이 판매 포인트인 니치 (풍경·여행·야경·크리스마스)
L181  BRIGHT_ENFORCEMENT — 밝은 하이키 상업 톤 강제 문구
L668-670 moodyOk 판정 → brightLine 적용
```

적용 조건: 감성/무디풍경/시네마틱 톤/밤·일몰 명시 아닐 때 → 상업 슬롯 기본

---

## 14. UI/UX 변경사항

| 커밋 | 내용 |
|------|------|
| a6f9a70 | 밝은/어두운 테마 토글 (Sun/Moon 아이콘) |
| ebbc318 | 상단 헤더·설정 영역 간격 축소 |
| 3370dec, b1a90c6 | 두뇌·API 키·이미지 엔진 설정을 한 줄로 통합 |
| 5b62b35 | 한글 텍스트 렌더 원천 차단 + 자동 수정 버튼 + 추천·폼 필드 복원 |

### 손 포함/미포함 셀렉터 (신규)

```
L319-335  REEDO_HANDS, REEDO_HANDS_PHRASE, HANDS_FINAL
```

음식·제품샷에서 손 포함 여부를 사용자가 선택:
- `auto`: AI 자율
- `with`: 핸즈온 (들기·붓기·정리)
- `without`: 순수 스타일링 (인물/손 없음)

---

## 15. Gemini 모델 업데이트

```
L135  GEMINI_IMG_DEFAULT = "gemini-3.1-flash-image" (Nano Banana 2)
L136  GEMINI_IMG_PRESETS = ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "gemini-2.5-flash-image"]
L361  GEMINI_MODEL_DEFAULT = "gemini-3.5-flash" (두뇌, 무료 API)
L363  GPT_MODEL_PRESETS = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4o"]
L364  GEMINI_MODEL_PRESETS = ["gemini-3.5-flash", "gemini-3.1-flash", ... "gemini-2.5-pro"]
```

- 존재하지 않는 `gpt-5-4-mini` 프리셋 제거 (커밋 182cf67)
- Gemini 이미지 모델 근사 단가 (L138): flash-image $0.039, lite-image $0.034

---

## 16. 미캔 전용 ZIP + XLSX 한글 인코딩 수정

**커밋**: f6a0c8b (2026-07-09), c5286e5 (2026-07-08)

- 미리캔버스 전용 ZIP 다운로드 — 승인율 높은 미캔만 구성
- XLSX 한글 셀을 명시적으로 텍스트 타입으로 고정 → UTF-16 인코딩 오류 방지

---

## 17. 커밋 전체 목록 (7/7 ~ 7/13)

| 날짜 | 해시 | 제목 |
|------|------|------|
| 07-13 | 58179cb | feat: 미리캔버스 실제 판매 데이터 기반 프롬프트 개선 시스템 |
| 07-13 | db79bdf | PIW 제품컷 시스템 + 음식 장르 확장 + 오늘의 추천 시드모드·트렌드 소품 |
| 07-12 | 25c7105 | feat: MJ 배치 이미지 불러오기 — mj_batch.py 결과물을 슬롯에 연결 |
| 07-09 | f6a0c8b | feat: 미리캔버스 전용 ZIP 다운로드 |
| 07-09 | 5b62b35 | 한글 텍스트 렌더 원천 차단 + 자동 수정 버튼 + 추천·폼 필드 복원 |
| 07-09 | 182cf67 | 존재하지 않는 gpt-5-4-mini 프리셋 제거 |
| 07-09 | f0f0955 | GPT 모델 프리셋에 gpt-5-4-mini 추가 |
| 07-09 | aacf349 | 다크네온 차단을 모드별로 정교화 — 배경화면 테크 미학은 허용 |
| 07-09 | d80bcae | 다크네온 SF 구조 차단 + 테크 제품컷 강제 |
| 07-09 | 07ca2ef | 카메라 구도에 Top-Down(탑다운/항공뷰) 전용 옵션 추가 |
| 07-09 | 857202c | 미드저니 부정문 소독 + 정면광 강제 — 역광·창밖거리·서양인 재발 차단 |
| 07-09 | f3434db | 미드저니용 TXT 순수 영어 프롬프트만 출력 — 제목·넘버링 제거 |
| 07-09 | b018d39 | 상업 배경 미니멀·선명 강제 — 미드저니 과한 아웃포커싱 차단 |
| 07-09 | 3a8ab1c | 미드저니 TXT 한글 제목 주석 처리 — MJ 인식 방지 |
| 07-09 | c82c430 | 디지털 업무 장면 과한 아웃포커싱·네거티브 누락 해소 |
| 07-08 | 250c88f | 한국인 캐스팅 자동 강제 + 자동검수 모순 해소 |
| 07-08 | b1a90c6 | 두뇌·이미지 엔진 설정을 한 줄로 통합 |
| 07-08 | 3370dec | 두뇌·API 키 설정을 한 줄로 통합 |
| 07-08 | ebbc318 | 상단 헤더·설정 영역 간격 축소 |
| 07-08 | a6f9a70 | UI 레이아웃 수정 + 밝은/어두운 테마 토글 |
| 07-08 | 74b9eec | 라이프 패키지 확장: 남성·부부·가족도 함께 돕는 장면 허용 |
| 07-08 | 7cdb6f2 | 패키지 모드 완화: 무드 응집만, 인물·의상은 자유 |
| 07-08 | 25ac174 | 패키지 모드: 라이프 세트용 응집 매트릭스 |
| 07-08 | 8f38430 | 밝기 강제 규칙: 상업 슬롯 기본 밝음, 어두움은 니치 한정 |
| 07-08 | dcde279 | 어도비 헬스케어 톱셀러 공식 + 글로벌 다양성 규칙 |
| 07-08 | 11ed50b | 미캔 라이프스타일 시그니처: 밝은 한국 홈 미학 |
| 07-08 | c5286e5 | Fix MiriCanvas XLSX Korean encoding corruption |
| 07-08 | cc281bb | 음식 장르 강화: 밝은 초근접 매크로 실사 인스타 느낌 |
| 07-08 | f5c890c | 감성 배경 모드, 프롬프트 압축, MJ 내보내기, Google API 헤더 인증 |

---

## 다른 계정에서 업데이트하기

이 파일의 모든 라인 번호는 커밋 `58179cb` 기준입니다.

1. `git pull origin main` (또는 해당 브랜치)
2. `freejjang-stock-studio/src/App.jsx` 열기
3. 위 라인 번호로 해당 상수/함수 위치 확인
4. 수정 후 `npm run dev`로 로컬 테스트
5. 커밋 & 푸시 → GitHub Pages 자동 배포
