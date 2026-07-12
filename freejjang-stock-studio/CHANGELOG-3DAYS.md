# FreeJJang Stock Studio - 3일간 개발 최종본 (2026-07-07 ~ 07-09)

> PR #41 기준 | 브랜치: `claude/korean-content-display-eya8f1`
> 배포: https://dalgakjjang-cloud.github.io/crop-server/

---

## 1. PIW (흰배경 제품컷) 장르 시스템 신설

어도비 스톡 대량 승인 패턴 분석 결과를 반영한 제품격리 촬영 시스템.

### 자동 감지
```
PIW_RE: 제품컷, 흰배경, 화이트배경, 심리스, 정물, product isolation,
        white background, seamless, still life, e-commerce, studio product
```

### 스타일링 공식
- 심리스 퓨어 화이트 배경
- 제품 60-80% 프레임
- 랩어라운드 스튜디오 조명 (그림자 제거)
- front-to-back 탁샤프
- 카탈로그 미학

### 가드레일
- 배경 풍경, 바닥선, 수평선, 환경, 인물 완전 차단
- 미드저니 전용 네거티브: background scenery, floor line, horizon, gradient, harsh shadow

### 적용 범위
- `buildSlotPrompt` / `toMidjourney` 양쪽에 PIW 분기 통합
- 감지 우선순위: WorkTech > PIW > Food
- 두뇌(Brain) 장면설계 + 상세화 프롬프트에 PIW MODE/RULE 추가

---

## 2. 음식 장르 대폭 확장

기존 7개에서 **14개** 음식 장르로 확장.

| 장르 키 | 라벨 | 핵심 촬영 공식 |
|---|---|---|
| `jpkr_cafe` | 일본-한국 카페 컴포트 (어도비 승인) | 깅엄 체크 천 + 파스텔 접시 + 카와이 소품 |
| `brunch` | 브런치/카페 | 아보카도 토스트, 에그, 모던 카페 테이블 |
| `world_brunch` | 나라별 브런치 | 미국/영국/프랑스/일본/중동/멕시코/한국 - 나라당 1이미지 |
| `dessert` | 디저트/베이커리 | 케이크, 마카롱, 타르트, 파티스리 스타일링 |
| `trending` | 트렌딩 디저트 | 버터떡, 두쫀쿠, 약과, 크루키, 꽈배기 - 단면 히어로샷 |
| `cafe_drink` | 카페 신메뉴/시즌 드링크 | 딸기라떼, 말차, 타로, 아인슈페너 - 레이어드 컬러 유리잔 |
| `korean` | 한식/집밥 | 정통 한국 도자기/스테인리스 반찬 그릇, 밥상 |
| `steak` | 스테이크/그릴 | 미디엄레어 단면, 차그릴 마크, 허브버터, 스모크 |
| `beverage` | 음료/커피 | 응결/스팀, 카페 카운터 |
| `finedining` | 파인다이닝 | 엘레간트 미니멀 플레이팅 |
| `healthy` | 건강식/샐러드 | 선명한 신선 채소, 웰니스 스타일링 |
| `street` | 분식/길거리 | 떡볶이, 김밥, 호떡 |
| `homecook` | 홈쿠킹/재료 | 생재료, 러스틱 보드, 쿠킹 인프로그레스 |
| `flatlay` | 푸드 플랫레이(탑뷰) | 정돈된 접시+소품, 직하향 촬영 |
| `piw` | 흰배경 제품컷 (푸드) | 심리스 화이트 e-commerce 카탈로그 |
| `mealprep` | 밀프랩/도시락 | 칸막이 용기, 밥-반찬 분리, 화이트 하이키 |

### FOOD_RE 자동 감지 키워드 (40+)
영문: food, dish, meal, tempura, udon, omurice, takoyaki, tonkatsu, katsu, onigiri, acai, granola, brownie, tamagoyaki 등
한글: 떡, 버터떡, 쿠키, 두쫀쿠, 약과, 우동, 텐푸라, 오므라이스, 타코야키, 돈까스, 주먹밥, 계란말이, 아사이, 브라우니 등

---

## 3. 일본-한국 카페 컴포트 장르 (어도비 승인 검증)

어도비 포트폴리오 20장 배치 승인 분석에서 추출한 신규 장르.

### 자동 감지 (`JPKR_CAFE_RE`)
```
우동, 텐푸라, 오므라이스, 타코야키, 돈까스, 카츠, 주먹밥, 오니기리,
계란말이, 아사이, 그래놀라, 깅엄, 카와이, udon, tempura, omurice,
takoyaki, tonkatsu, katsu, onigiri, tamagoyaki, acai bowl, gingham, kawaii
```

### 승인된 촬영 공식
- **배경**: 깅엄 체크 천 (핑크 or 블루)
- **식기**: 파스텔 접시/도자기 (핑크, 민트, 크림)
- **소품**: 하트 케첩, 곰돌이 쿠키, 꽃, 데코 픽 등 카와이 요소
- **조명**: 따뜻한 소프트 자연광
- **앵글**: 오버헤드 or 45도
- **프레이밍**: 음식 70-85% 프레임, 천/접시가 스타일링 컨텍스트
- **금지**: 흰배경(PIW), 다크 무디 절대 사용 안함

### 승인된 메뉴 예시
텐푸라 우동, 오므라이스(하트 케첩), 타코야키(마요 드리즐), 치즈카츠, 브라우니+베리, 계란말이, 바게트 샌드위치, 아사이볼, 주먹밥, 타로라떼+곰돌이쿠키

---

## 4. 오늘의 추천 업그레이드

### 시드 주제 모드
- 주제칸에 "브런치" 입력 시 → 브런치 도메인 안에서 베스트셀러 각도/틈새시장 분석
- 무관한 주제로 바꾸지 않음

### 트렌드 소품 팔레트
- `trend_props_kr` 필드: 8-12개 큐레이션 소품
- 재질, 색, 형태까지 구체적으로 지정
- 톤앤매너 매칭
- **하드 밴**: 린넨 천, 머그컵, 커피/커피잔, 화분/식물

### 소품 분배 규칙
- 팁 필드로 주입
- 장면마다 2-4개씩 서로 다르게 분배
- 전 장면 동일 소품 반복 금지
- 텍스트영역 500자 → 900자 확대

---

## 5. 분할 컷 전면 금지 (`SINGLE_FRAME_GUARD`)

### 4중 레이어 방어
1. **상수**: `SINGLE_FRAME_GUARD` — 모든 프롬프트에 주입
2. **두뇌 장면설계**: SINGLE FRAME RULE
3. **두뇌 상세화**: SINGLE FRAME RULE
4. **미드저니 네거티브**: `--no split screen, diptych, collage, grid layout, multiple panels, side-by-side comparison`

### MJ 포지티브 변환
```
SINGLE_FRAME_GUARD → "one single continuous unified scene filling the entire frame edge-to-edge"
```

---

## 6. 손(Hands) 셀렉터

### UI 옵션
| 키 | 라벨 |
|---|---|
| `auto` | 선택 안함 (AI 자율) |
| `with` | 손 포함 (핸즈온) |
| `without` | 손 없음 (순수 스타일링) |

### 프롬프트 주입
- `with`: "natural hands interacting with the subject, hands only"
- `without`: "unattended styled still-life shot, the subject alone"
- `without` + 미드저니: `--no` 에 "hands, fingers, arms" 추가

### 적용 범위
- `buildSlotPrompt(slot, mode, tone, people, koreanCast, hands)` — 6번째 인자
- `toMidjourney(slot, mode, tone, people, aspect, hands)` — 6번째 인자
- 6개 호출 사이트 전부 업데이트

---

## 7. 밀프랩/도시락 칸막이 공식

### 자동 감지 (`MEALPREP_RE`)
```
도시락, 밀프랩, 밀프렙, 런치박스, dosirak, meal prep, bento, lunch box
```

### 촬영 규칙
- **칸막이 용기 필수**: 밥은 밥 칸, 반찬은 각자 칸, 절대 섞이지 않음
- **허용 용기**: 투명 유리 밀프랩 박스(스냅 뚜껑), 스테인리스 도시락 트레이(칸막이)
- **Subway 스타일 환영**: 랩 샌드위치, 샐러드볼, 과일컵, 오버나이트 오츠
- **스타일링**: 순백 카운터 + 에어리 하이키 데이라이트
- **금지**: 어두운 무드, 다크 우드, 칸 없이 뒤섞인 음식

---

## 8. 음식 밝기 규칙 (`FOOD BRIGHTNESS RULE`)

### 기본값
- 하얀/라이트마블 카운터
- 에어리 화이트 도미넌트 프레임
- 크리스프 하이키 데이라이트
- 선명한 음식 색감이 화이트 배경에서 팝

### 금지 (스테이크하우스/러스틱 제외)
- 다크 우드
- 어두운 배경
- 딤 warm-brown 무디 그레이딩

### 예외 (jpkr_cafe)
- 깅엄 체크 천 + 파스텔이 기본 → 화이트 브라이트니스 규칙 오버라이드

---

## 9. BESTSELLER_REFERENCE 누적 공식 (총 14개)

| 공식 | 마켓 |
|---|---|
| Faith/worship | 미캔 탑셀러 |
| Business growth/finance | 어도비 + 미캔 |
| Real estate/Korean apartment | 미캔 대형 |
| Korean family lifestyle | 미캔 코어 |
| Solo daily-life moments | 미캔 베이스 |
| Golf lifestyle | 미캔 레저 |
| Healthcare | 어도비 글로벌 |
| Practical Korean home-life packages | 어도비 + 미캔 |
| PIW (product-on-white) | 어도비 벌크 (수천 승인) |
| Trending Korean desserts | 어도비 + 미캔 바이럴 |
| International brunch | 어도비 글로벌 |
| Premium steak & grill | 어도비 프리미엄 |
| Cafe seasonal drinks | 어도비 + 미캔 라이프스타일 |
| Meal-prep / dosirak | 어도비 + 미캔 브라이트 |
| JP-KR cute cafe comfort | 어도비 배치 승인 (20+) |

---

## 10. UI/UX 수정

### 미리캔버스 ZIP 버튼 색상 대비 개선
- `text-teal-200` → `text-teal-400` (4곳)
- `border-teal-500/40` → `border-teal-500/50`
- 흰색/밝은 배경에서 가독성 대폭 향상

---

## 11. 두뇌(Brain) 프롬프트 최종 규칙 목록

### 장면설계 (Scene Design)
1. SINGLE FRAME RULE
2. HARD DIVERSITY RULES (위치/액션/앵글/조명 분산)
3. PRODUCT-ON-WHITE (PIW) MODE
4. FOOD DIVERSITY (앵글 믹스, 손 선택적)
5. FOOD BRIGHTNESS (화이트 도미넌트 기본)
6. JAPANESE-KOREAN CAFE COMFORT (깅엄+파스텔 공식)
7. LUNCHBOX/MEAL-PREP REALISM (칸막이 분리)
8. CLEAN SETTINGS (상업/비즈니스)
9. DARK-NEON BAN (상업 모드)
10. PHYSICAL PLAUSIBILITY
11. NO TEXT-BEARING SCENES

### 상세화 (Detail Expansion)
1. BRIGHTNESS RULE
2. PRODUCT-ON-WHITE (PIW) RULE
3. FOOD DIVERSITY RULE
4. JAPANESE-KOREAN CAFE COMFORT RULE
5. LUNCHBOX/MEAL-PREP RULE

---

## 12. 미드저니 네거티브 최종 목록

### 기본 (`MJ_NEG_BASE`)
```
text, watermark, logo, title, caption, label, border, frame, UI overlay,
split screen, diptych, collage, grid layout, multiple panels, side-by-side comparison
```

### PIW 전용 (`MJ_NEG_PIW`)
```
background scenery, floor line, horizon, environment, table cloth,
harsh shadow, gradient background, surface texture
```

### 손 없음 모드 추가
```
hands, fingers, arms
```

---

## 커밋 이력 (이번 PR 범위)

| 커밋 | 내용 |
|---|---|
| `9fff766` | PIW 장르 시스템 + 음식 장르 5개 신설 |
| `7025049` | 오늘의 추천: 시드 주제 모드 + 트렌드 소품 팔레트 |
| `0092772` | 분할 컷 금지 + 손 셀렉터 + 밀프랩 칸막이 공식 |
| `fa9b5b8` | 미리캔버스 ZIP 버튼 색상 대비 개선 |
| `01ed25c` | 일본-한국 카페 컴포트 장르 (어도비 승인 분석) |

---

*최종 업데이트: 2026-07-09*
