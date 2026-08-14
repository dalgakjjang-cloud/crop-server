# 공냥 프롬프트 킷 참고 노트

> 이 문서는 외부 리포 [kimsh-1/gongnyang-prompt-kit](https://github.com/kimsh-1/gongnyang-prompt-kit) 의 방법론 중
> 우리 파이프라인(FreeJJang Stock Studio)에 참고할 만한 부분을 추려서 저장한 것입니다.
> 원문 복제가 아니라 **우리가 채택·재구성한 규칙**만 기록합니다.

---

## 기본 정보

| 항목 | 값 |
|---|---|
| 리포 | https://github.com/kimsh-1/gongnyang-prompt-kit |
| 저자 | kimsh-1 (일명 "공냥") |
| 최신 버전 | **v3.0.0** SKILL 기준 (2026-07-20 업데이트 반영) |
| 라이선스 | MIT |
| 성격 | Claude Code 스킬 형태의 이미지 프롬프트 컴파일러 (gpt-image-2 / Codex `$imagegen` 대상) |

---

## 왜 우리가 참고하나

우리 사업 로드맵(신호→스톡 루프 + 암묵지 에이전트화) 관점에서 공냥킷은 **B층(암묵지 에이전트화) 사례의 살아있는 참고서**입니다.
1,000장 규모의 실측 생성 결과를 성공/실패 패턴 비교로 규칙화했다는 점에서
"감을 명시지로 내리는 방법"의 실증 케이스로 가치가 있습니다.

우리 접근과 겹치는 부분:
- 밝은·선명 vs 어두운·글로우 라우팅 (우리의 `isAdobeEligible`)
- 검증기로 누락 차단 (우리의 QC 7항목 + `repairSlot`)
- 카테고리별 프리셋 (우리의 REEDO 구조 · 카메라 9종 · 톤 5종)

우리와 다른 지점:
- 공냥킷은 **개인 창작자용 프롬프트 컴파일러**, 우리는 **양산·판매 파이프라인**
- 공냥킷은 gpt-image-2 (Codex) 단일 엔진, 우리는 트리플 엔진(GPT·Gemini·Pollinations) + MJ + GenSpark
- 공냥킷은 예술적 통제 강조, 우리는 판매 신호 기반 성과 최적화

---

## 채택 가치가 있는 규칙 (우리 파이프라인에 적용 검토)

### 1. 부정문 금지 원칙 → 이미 우리도 부분 채택
> "no crowd 같은 장면 배제는 그대로 렌더된다. 전부 긍정형으로 변환."

우리도 `plain unlettered unbranded surfaces` 같은 긍정형 가드로 이미 쓰고 있음.
MJ의 `--no` 는 예외적으로 유지(파라미터 계열이라 성격 다름).

**액션:** GPT/GenSpark 프롬프트에서 남아있는 부정문 표현을 긍정형으로 리팩터링.

### 2. HEX 팔레트 명시 → 앞으로 도입 검토
> "컷당 3~5개 HEX 색상 코드를 프롬프트에 포함하면 색감 정확도 2배."

우리는 지금 `warm cream beige and soft wood` 같은 자연어 팔레트만 쓰는데,
K-beauty·Pink·Gold 등 **모노톤 세트**에는 HEX가 훨씬 유효할 것으로 예상.

**액션:** 모노톤 세트(핑크·골드·블루·그린)에 HEX 팔레트 병기 실험 → 신호 수집.

### 3. 카메라 EXIF 대신 결과 서술 → 이미 우리도 채택
> "50mm f/1.4 대신 shallow DoF, background falls off softly."

우리는 이미 `tack-sharp front-to-back, deep DOF, everything in focus` 같은 결과 서술 방식.
공냥킷 규칙과 정확히 일치.

### 4. 무드 형용사 금지 → 부분 채택
> "'멋지게/감성적으로' 대신 몸반응·수치·구체 예시로 환원."

우리는 미캔 감성 축에서 `cozy`, `hygge`, `serene` 같은 무드 형용사를 아직 쓰고 있음.
이걸 `soft window daylight + one plant + text-overlay area to one side` 같은 구체 요소로
바꾸면 프롬프트 안정성이 올라갈 여지 있음.

**액션:** 미캔 홈·인테리어 프롬프트에서 무드 형용사 → 구체 요소 치환 실험.

### 5. 카테고리 라우팅 표 (C1~C12, L1~L9, P1~P8, TP1~TP14)
공냥킷의 **카테고리 축·룩 축·홍보 축·타이포 축 4중 크로스브리드**는
우리 REEDO 시스템과 유사하지만 훨씬 세분화됨.

**액션:** 우리 REEDO에 홍보 축(P1~P8) 개념 추가 검토 → 이커머스 셀러용 배너 프롬프트 확장.

---

## v2.4 업데이트 (2026-07-19 오늘): 타이포그래피 포스터 TP1~TP14

**전체 목록:**

| # | 패턴명 | 용도 | 미캔 궁합 |
|---|---|---|---|
| TP1 | 포토 마스킹 | 여행·도시 포스터 | ⭐⭐⭐ 여행 카드뉴스 |
| TP2 | 텍스트 터널 | 반복·소용돌이 | ⭐⭐ |
| TP3 | 타입 건축 | 기하학 구조 | ⭐⭐ |
| TP4 | 광학 현상 | 빛 효과 | ⭐⭐⭐ 감성 카드 |
| TP5 | 물성 파괴 | 찢기·부서짐 | ⭐ |
| TP6 | **스위스 키네틱** | **미니멀** | ⭐⭐⭐⭐ **미캔 강세** |
| TP7 | **재질 조각** | **유리·젤리·대리석** | ⭐⭐⭐⭐⭐ **미캔 최애** |
| TP8 | 리퀴드 크롬 | Y2K 금속 | ⭐⭐⭐ 트렌디 |
| TP9 | **인플레이터블** | **풍선 3D, 푹신** | ⭐⭐⭐⭐⭐ **미캔 귀여움 최상** |
| TP10 | 옵아트 | 착시 | ⭐⭐ |
| TP11 | 애시드 | 클럽·레이브 | ⭐ |
| TP12 | 퓨처 미디벌 | 고딕 | ⭐⭐ |
| TP13 | 아나모픽 | 3D 착시 | 리트라이 필수 |
| TP14 | 미크로그래피 | 미세 글자 초상 | 리트라이 필수 |

**공통 설계 원칙:**
- 단어 1개가 화면 최대 시각 요소
- 2~4색 하드 락 + HEX
- 극단적 여백 또는 극단적 밀도 (중간값이 가장 나쁨)
- TP13·TP14는 첫 컷 실패 정상, 2~3회 리트라이 전제

**우리 채택 결정:**
미캔에서 "예쁨·귀여움" 축이 아직 요소·템플릿에서 잘 팔린다는 실측 판단에 따라,
공냥킷의 TP9 · TP7 · TP6 세 패턴을 미캔 밝은 화이트톤·한국형 스타일로 재해석해서
**`prompts/miri/miricanvas_typo_kawaii_24_*.txt`** 로 별도 프롬프트 세트 신설.

24컷 구성:
- TP9 인플레이터블 8컷 (풍선 3D 하트·리본·꽃·별 등)
- TP7 재질 조각 8컷 (유리·젤리·대리석 텍스처 오브젝트)
- TP6 스위스 키네틱 8컷 (미니멀 기하 배경)

원 저작 복제 방지: 공냥킷의 프롬프트 표현·용어는 그대로 옮기지 않고,
**우리 파이프라인의 기존 규칙(밝은 화이트톤 + 여백 확보 + tack-sharp)** 위에
TP 패턴 개념만 얹어 완전히 새 프롬프트를 작성.

---

## v3.0.0 업데이트 (2026-07-20 반영)

v2.4 → v3.0.0 은 **메이저 리라이트**. SKILL.md 전면 재작성.

### 핵심 변경점

| 항목 | v2.x | v3.0.0 |
|---|---|---|
| 구조 | 분산된 규칙 + 별도 TP/P/L 문서 | **단일 라우팅 테이블** (하나의 요청 → 하나의 카테고리 → 하나의 레퍼런스 파일) |
| 부정문 관리 | 일괄 금지 | **Tier 시스템** (Tier-0 / Tier-1 / Tier-2) |
| 핵심 규칙 | 여러 섹션에 분산 | **9개 아이언 룰**로 압축 |
| 대상 모델 | GPT-4 Vision 일반 | **gpt-image-2 (Codex `$imagegen`)** 명시 |
| 출력 포맷 | 자유형 | **Format A** (6섹션 라벨) + **Format B** (단일 플랫 문단 350~450자) |
| 검증 | 수동 | **`check_prompt.mjs`** 스크립트 검증 게이트 |
| AR 관리 | 자유 | **6개 안전 비율만 허용** (size lock) |

### 9개 아이언 룰 (Iron Rules)

1. **대괄호 금지** — `[AR x:y SIZE]` 식 프론트 브래킷 불가, AR 토큰은 끝에만
2. **긍정형 장면 서술** — gpt-image-2는 부정문을 그대로 렌더. Tier 시스템으로 관리
3. **SD 시대 어휘 금지** — `"masterpiece"`, `"8k"`, 가중치 구문 등 노이즈 제거
4. **장비→결과 변환** — 카메라 스펙(50mm f/1.4) 대신 시각 결과(shallow DoF) 서술
5. **수치 구체화** — HEX 팔레트 3~5색, 켈빈 값, 비율 표기
6. **1줄=1컷=1API콜** — 멀티컷 그리드 금지
7. **자연 피부 질감** — 이상화 금지, `"natural texture, visible pores"` 명시
8. **실제 브랜드·인물 참조 금지**
9. **후처리 텍스트 합성 금지** — 이미지 안에서 텍스트 렌더링만 허용

### Tier 시스템 (부정문 가드레일)

| Tier | 대상 | 허용 범위 |
|---|---|---|
| Tier-0 | 기본 (항상 적용) | **전면 긍정형만** — 부정문 일체 불가 |
| Tier-1 | 텍스트 렌더링 컷 | 화이트리스트 7개 구문만 허용 (no duplicate text, no watermark 등) |
| Tier-2 | 에디토리얼 패션 | 선언적 안전 어설션 + 네거티브 테일 페어링 구조 |

**우리 파이프라인 적용:**
- GPT/GenSpark 프롬프트 → Tier-0 원칙 유지 (이미 채택 중)
- MJ `--no` 파라미터 → MJ 전용이므로 Tier 시스템 밖 (기존 유지)
- 미캔 카와이 24컷 → Tier-1 수준 (문장 끝 "No text, logo, watermark" 허용)

### 출력 포맷 2종

- **Format A** (라벨 6섹션): Scene / Camera / Lighting / Color grading / Texture·Medium / Text-in-image — 포스터·인포그래픽·카드용
- **Format B** (플랫 문단): 콤마 구분 단일 문단 350~450자 — 에디토리얼 패션, 기본 AR `2:3`

**우리 적용:** 우리 GPT Compact v2 포맷(camera: / lighting: / palette: 라벨)은 Format A의 변형. 호환성 좋음.

### 확장된 라이브러리 체계

| 축 | 범위 | 설명 |
|---|---|---|
| C (카테고리) | C1~C12 | 에디토리얼, 포스터, 인포그래픽, 프레젠테이션 등 |
| TP (타이포 포스터) | TP1~TP14 | 포토마스킹~미크로그래피 (v2.4와 동일) |
| P (프로모) | P1~P8 | 홍보 자료 |
| L (룩 프리셋) | L1~L9 | 무드 필터 |
| M (컨셉 변주) | M1~M10 | 메인 컨셉 변주 축 |
| R / X / T | R, X, T1~T5 | 추가 변주 축 |

기존 C×L×P×TP 4중 크로스브리드에 **M/R/X/T 컨셉 변주 축**이 추가됨.

### 검증 스크립트

```bash
node skills/image-prompt/scripts/check_prompt.mjs [파일]        # 기본 검증
node skills/image-prompt/scripts/check_prompt.mjs --tier 2 [파일]  # Tier-2 검증
node skills/image-prompt/scripts/check_prompt.mjs --jsonl [파일]   # JSONL 배치 검증
node skills/image-prompt/scripts/check_prompt.mjs --test           # 회귀 테스트
```

**우리 적용 검토:** 우리 QC 7항목 + `repairSlot` 검증 체계와 병행 가능. 공냥킷 검증기를 우리 프롬프트에 돌려보면 누락 패턴 발견에 도움.

### 우리 파이프라인에 새로 참고할 점

1. **Size Lock 개념**: 6개 안전 비율만 허용 → 우리도 플랫폼별(미캔 4:5, 어도비 3:2/16:9) 비율 락 도입 검토
2. **자연 피부 질감 명시**: 우리 인물 프롬프트(가족 라이프스타일 등)에 `natural texture, visible pores` 추가 검토
3. **Format A/B 이원화**: 용도별 포맷 분리 → 우리도 오브젝트 컷 vs 인물 컷 포맷 분리 고려
4. **검증 스크립트 게이트**: CI/CD에 프롬프트 검증 단계 추가 → 양산 파이프라인 품질 안정화

---

## 참고 링크

- 리포 홈: https://github.com/kimsh-1/gongnyang-prompt-kit
- SKILL: https://github.com/kimsh-1/gongnyang-prompt-kit/blob/main/skills/image-prompt/SKILL.md
- TP 라우터: https://github.com/kimsh-1/gongnyang-prompt-kit/blob/main/skills/image-prompt/references/typo-poster-router.md
- 예시 컬렉션: https://github.com/kimsh-1/gongnyang-prompt-kit/tree/main/examples
- 데모 사이트: https://kimsh-1.github.io/gongnyang-prompt-kit
- 릴리스: https://github.com/kimsh-1/gongnyang-prompt-kit/releases

---

_최초 작성: 2026-07-19 · v3.0.0 업데이트 반영: 2026-07-20 · 다음 리뷰: 공냥킷 v3.1 릴리스 시_
