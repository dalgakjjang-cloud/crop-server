# 키워드 · SEO 거버넌스

> FreeJJang Stock Studio의 스톡 메타데이터(제목·키워드·카테고리) 생성 규칙을 한 파일에 고정한다.
> 목적은 "감으로 키워드를 다는 것"을 막고, 플랫폼별 상한·순서·품질을 자동 검사 가능한 계약으로 못박는 것.
> 규칙 표기는 RFC 2119(MUST / MUST NOT / SHOULD / MAY)를 따른다.
>
> 이 문서는 `atlassian.design/DESIGN.md`의 2층 구조(토큰 + 이유 + 금지사항)를 우리 양산 라인에 이식한 것이다.
> UI 토큰 대신 **메타데이터 토큰**을 고정한다.

---

## 0. 왜 이 파일이 필요한가 (Rationale)

- 지금까지 키워드는 대시보드 HTML 배열에만 컷당 5~6개로 떠다녔고, 저장소에 커밋된 정본이 없었다.
- 어도비 스톡은 키워드를 **최대 49개**까지 받고, 그중 **앞 10개에 검색 가중치**를 크게 준다.
  컷당 5~6개는 판매 검색 노출을 스스로 90% 버리는 것.
- 스톡 판매는 "그림 품질"만큼 "검색어 커버리지"가 매출을 좌우한다. 키워드는 장식이 아니라 **유통 채널**이다.

정본 위치는 `seo/metadata/<batch>.csv` **하나뿐**이다. 대시보드·업로드·검사기 모두 이 CSV를 읽는다.

---

## 1. 메타데이터 스키마 (MUST)

각 배치의 정본은 `seo/metadata/<batch>.csv`이며, 컬럼은 다음으로 **고정**한다:

| 컬럼 | 설명 | 필수 |
|---|---|---|
| `filename` | 업로드 파일명 (컷 라벨 기반, 예: `miri-kawaii-01.png`) | MUST |
| `asset_type` | `photo` \| `video` — 5초+ 영상은 `video` | MUST |
| `title_en` | 영문 제목, 자연스러운 서술문 (키워드 나열 금지) | MUST |
| `title_ko` | 한글 제목 | MUST |
| `keywords_en` | 영문 키워드, 쉼표 구분, **중요도 순** | MUST |
| `keywords_ko` | 한글 키워드, 쉼표 구분, 영문과 대응 | MUST |
| `category` | 어도비 카테고리 번호·명 (예: `9. Graphic Resources`) | MUST |
| `batch` | 배치명 (예: `kawaii_24`) | MUST |
| `axis_subject` | 주제축 (signals.csv와 동일 어휘) | SHOULD |
| `axis_color` | 색축 | SHOULD |

- **MUST NOT** 컬럼 순서·이름을 배치마다 바꾼다. 검사기가 이 스키마에 고정돼 있다.
- **MUST** `asset_type`을 모든 행에 채운다. 영상 채널이 열려도 같은 CSV·같은 검사기를 쓴다.

---

## 2. 키워드 순서 규칙 (MUST) — 3티어 모델

어도비는 앞쪽 키워드에 가중치를 준다. 그래서 개수뿐 아니라 **순서**가 계약이다.

- **Tier 1 (1~10위): 최고 구매의도.** 핵심 주제 + 주요 용도 + 대표 스타일.
  예: `heart, love, pink, valentine, cute, background, 3d render, decoration, greeting card, copy space`
- **Tier 2 (11~20위): 속성.** 색·재질·무드·구도.
- **Tier 3 (21~28위): 확장·발견.** 광의어(`design element`, `isolated`, `no people`, `pastel`, `kawaii` 등).

각 컷 키워드는 세 축을 반드시 커버한다:
1. **무엇인가** (주제·형태) — signals.csv `주제축`에서 파생
2. **어디에 쓰나** (용도) — background, template, banner, social media, greeting card, invitation
3. **어떤 느낌인가** (색·무드) — signals.csv `색축` + kawaii/pastel/soft 무드

---

## 3. 개수 규칙 (MUST)

| 플랫폼 | 최소 권장 | 최대(하드) | 근거 |
|---|---|---|---|
| Adobe Stock | 25 | 49 | 앞 10개 가중, 25 미만은 노출 손해 |
| Shutterstock | 25 | 50 | 앞 7개 가중 |
| iStock/Getty | 20 | 50 | 통제 어휘, 과다 페널티 |
| Freepik | 20 | 50 | — |

- **MUST** 컷당 영문 키워드 **≥ 25개** (어도비 기준). 상한 초과 시 검사기가 막는다.
- **MUST** 한글 키워드 **≥ 15개** (미리캔버스·국내 채널용).
- 정확한 수치는 `platform-limits.yaml`이 단일 진실 공급원. 이 표는 요약.

---

## 4. 품질 규칙 (MUST / MUST NOT)

- **MUST** 모든 키워드 소문자, 쉼표 구분, 앞뒤 공백 없음.
- **MUST NOT** 한 행 안에서 키워드 중복 (대소문자 무시).
- **MUST NOT** 브랜드명·상표·인물명·특정 캐릭터명 사용 (예: sanrio, disney, hello kitty, iphone …). 스톡 거절 사유 1순위.
- **MUST NOT** 이미지에 없는 것을 키워드로 넣는다 (스팸 판정). 예: 사람 없는 컷에 `woman`.
- **MUST NOT** 제목에 키워드를 나열한다. 제목은 사람이 읽는 자연문.
- **SHOULD** 단수형 우선 (`heart` > `hearts`), 단 관용 복수는 허용 (`sweets`).
- **SHOULD** 계절·이벤트 키워드를 해당 컷에 적극 부착 (valentine, christmas, birthday …) — 검색 급증 구간을 잡는다.

---

## 5. 비디오(5초+) 확장 규칙 (MUST when asset_type=video)

미리캔버스는 5초 이상 영상 제출이 가능하다. 영상 자산은 같은 CSV에 `asset_type=video`로 들어간다.

- **MUST** 정지 키워드에 **모션 키워드**를 추가: `motion graphics, animation, loop, seamless loop, moving background, animated, video background`.
- **MUST** `filename` 확장자를 `.mp4`로 표기.
- **MUST NOT** MJ 엔진 라벨을 비디오 행에 쓴다 (MJ는 영상 미지원). 비디오 엔진(Kling/Runway/Luma/Pika)으로 대체.
- 최소 길이 5초, 루프 친화 구도 SHOULD.

---

## 6. 검사 (자동 회귀)

`seo/seo-check.py`가 모든 `seo/metadata/*.csv`를 `platform-limits.yaml` + 이 문서 규칙에 대해 검사한다.
CI 게이트로 물릴 수 있다. 통과 못 하면 업로드용 아님.

```
python3 seo/seo-check.py            # 전체 배치 검사
python3 seo/seo-check.py kawaii_24  # 특정 배치만
```

---

## 7. 현재 커버리지

| 배치 | 컷 수 | 정본 파일 | EN 키워드/컷 | 검사 |
|---|---|---|---|---|
| kawaii_24 | 24 | `metadata/kawaii_24.csv` | 28 | PASS |
| exosome_40 | 40 | `metadata/exosome_40.csv` | 28 | PASS |
| bestsellers_36 | 36 | `metadata/bestsellers_36.csv` | 26~28 | PASS |
| **합계** | **100** | | | **에러 0** |

## 8. 개정 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-07-22 | 최초 제정. 스키마·3티어·플랫폼 상한·비디오 확장·검사기 계약 고정. 카와이24 확장. |
| 1.1 | 2026-07-22 | 엑소좀40·베스트셀러36 확장 → 100컷 전체 정본화. 금지어에서 'apple'(과일) 제거. |
