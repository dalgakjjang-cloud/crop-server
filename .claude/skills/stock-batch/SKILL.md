---
name: stock-batch
description: 스톡 이미지 배치(컷 묶음)를 처음부터 끝까지 만들어낸다 — 프롬프트 4엔진(MJ·GPT·GenSpark·clean) + 어도비 SEO 메타데이터 CSV + signals.csv 등록까지 한 번에. 사용자가 "○○ 20컷 만들어", "새 배치 뽑자", "가을 시즌 배치", "비비드 추상 배치", "귀여움 PNG 요소 만들어", "프롬프트 세트 만들어줘", "키워드 메타데이터 만들어", "배치 등록해줘" 같은 말을 하면 반드시 이 스킬을 쓸 것. 주제만 정해졌고 컷을 늘려야 하는 상황, 프롬프트는 있는데 SEO 메타데이터가 없는 상황, signals.csv에 새 배치를 올려야 하는 상황 전부 해당한다. 어도비/미리캔버스 스톡 판매용 이미지 제작 이야기가 나오면 우선 이 스킬을 확인하라.
---

# 스톡 배치 생성

주제 하나를 받아 **판매 가능한 배치 한 벌**로 만든다. 산출물은 항상 이 네 가지다.

| 산출물 | 위치 |
|---|---|
| 프롬프트 4종 (MJ·GPT·GenSpark·clean) | `freejjang-stock-studio/prompts/` |
| SEO 메타데이터 CSV | `freejjang-stock-studio/seo/metadata/<batch>.csv` |
| signals 행 (컷당 1행) | `signals/signals.csv` |
| 등록부 갱신 | `signals/README.md` 표 + `seo/keyword-governance.md` §7 |

## 일이 나뉘는 지점

이 배치 작업에서 **사람의 판단이 필요한 부분은 딱 하나** — 어떤 컷을 뽑을지 정하는 것이다.
그 판단을 **스펙 JSON** 하나에 담으면, 나머지(엔진별 문법 변환, 키워드 티어 병합, 라벨 1:1 맞추기,
CSV 쓰기)는 전부 기계적이라 스크립트가 처리한다.

그래서 작업 순서는 이렇다:

```
1. 축 설계        ← 창작. 여기에 시간을 쓴다.
2. 스펙 JSON 작성  ← 1번을 구조화해서 옮겨적기
3. 스크립트 실행   ← 자동
4. seo-check      ← 자동 검증
5. 등록부 갱신     ← 3줄 편집
```

**프롬프트 텍스트를 손으로 4번 쓰지 마라.** 엔진 간 차이는 전부 기계적(플래그 유무, 라벨 모양,
`hex FFC1D8` vs `#FFC1D8`)이라 스크립트가 이미 안다. 손으로 쓰면 반드시 어긋난다.

---

## 1단계 — 축 설계

컷을 나열하기 전에 축부터 잡는다. 축 없이 컷을 뽑으면 비슷한 그림이 20장 나오고,
어도비는 유사성을 이유로 거절한다.

**4축 분산** (`signals/README.md`의 규칙):

```
주제 × 카메라앵글 × 배경톤 × 팔레트
```

승인된 스타일 하나를 이 네 축으로 흔들어 20컷 안팎으로 벌린다.
같은 주제라도 앵글이 다르고, 같은 앵글이라도 팔레트가 다르게.

**그룹 나누기**: 컷을 3~4개 그룹으로 묶는다 (`grp` 필드). 그룹은 두 가지 일을 한다.
- 프롬프트 파일에서 섹션 구분선이 된다
- 그룹별 키워드 풀(`group_en`/`group_ko`)이 붙는다 — 같은 그룹 컷끼리 검색어를 공유

**형태 4종**: 모든 컷은 반드시 하나로 분류된다. signals에서 "어떤 형태가 팔리는가"를
집계하는 근거라, 여기가 비면 나중에 판매 신호를 못 읽는다.

| 형태 | 쓰임 |
|---|---|
| `배경형` | 여백 중심, 사용자가 글자를 얹는 배경 |
| `제품형` | 물건이 주인공 |
| `인물형` | 사람·감정·라이프스타일 |
| `설명형` | 과학·웰니스·테크 개념 |

## 2단계 — 스펙 JSON 작성

`assets/spec-template.json`을 복사해서 채운다. 필드 의미와 전체 예시는
**`references/spec-format.md`를 읽어라** — 프롬프트 절(clause) 구조와 키워드 풀 설계가 거기 있다.

작업 파일은 저장소를 어지럽히지 않게 `/tmp`나 스크래치패드에 두면 된다.
(스펙을 남겨두고 싶으면 `freejjang-stock-studio/seo/sources/<batch>.json`)

키워드를 채울 때 기억할 것:
- 어도비는 **앞 10개**에 검색 가중치를 크게 준다. `core_en`에 구매의도가 가장 높은 말을 넣는다.
- 컷당 영문 25개 이상이 하한이다. `core_en` 6개 + `color_en` 2개로는 모자라니
  `pools`의 usecase·group·universal이 나머지를 메운다. 스크립트가 이 순서로 병합한다:
  `core → color → usecase → group → universal`
- 이미지에 없는 것을 키워드로 넣지 않는다(스팸 판정). 사람 없는 컷에 `woman` 같은 것.
- 브랜드·캐릭터명 금지. `seo/platform-limits.yaml`의 `banned_terms`에 목록이 있다.

## 3단계 — 실행

```bash
python3 .claude/skills/stock-batch/scripts/build_batch.py <spec.json> --dry-run
```

`--dry-run`으로 먼저 돌려 키워드 개수와 파일 경로를 확인한 뒤, 문제없으면 플래그를 빼고 다시 실행한다.
스크립트는 스펙을 먼저 검사하고, 키워드가 하한에 못 미치면 **파일을 쓰지 않고** 어느 컷이
몇 개 모자란지 알려준다. 프롬프트 파일이 이미 있으면 덮어쓰지 않고 멈춘다
(이 저장소는 프롬프트 파일을 지우거나 덮어쓰지 않는다).

## 4단계 — 검증

```bash
python3 freejjang-stock-studio/seo/seo-check.py <batch>
```

에러 0이어야 업로드용이다. 걸리면 스펙을 고치고 3단계부터 다시 — 생성물을 직접 손보지 마라.
스펙이 정본이고 CSV는 파생물이라, CSV만 고치면 다음 실행에 되돌아간다.

## 5단계 — 등록부 갱신

세 곳을 손으로 맞춘다. 자동화하지 않은 이유는 사람이 읽는 요약이라 문장이 필요해서다.

1. `signals/README.md`의 등록 배치 표에 행 추가
2. `seo/keyword-governance.md` §7 커버리지 표에 행 추가 + 합계 갱신
3. `seo/keyword-governance.md` §8 개정 이력에 한 줄

---

## 프롬프트는 있고 메타데이터만 없을 때

이미 `prompts/`에 파일이 있는 배치라면 프롬프트를 다시 만들면 안 된다.
기존 프롬프트를 읽어 스펙의 `cuts`를 채우되, 생성은 메타데이터와 signals만 한다:

```bash
python3 .claude/skills/stock-batch/scripts/build_batch.py <spec.json> --only metadata,signals
```

이 경우 `title_en`/`title_ko`와 키워드는 기존 프롬프트 내용에서 뽑아낸다.
프롬프트에 없는 요소를 메타데이터에 넣지 않는다 — 그게 스팸 판정의 정의다.

## 영상 배치일 때

`asset_type`을 `video`로 두면 파일 확장자가 `.mp4`로 바뀐다.
추가로 `pools.universal_en`에 모션 키워드를 반드시 넣어야 seo-check을 통과한다:
`motion graphics, animation, animated, loop, seamless loop, moving background, video background`

MJ는 영상을 못 만든다. 영상 배치의 프롬프트 파일은 엔진명을 `Kling` 등으로 따로 쓰므로
이 스크립트의 프롬프트 생성(`--only`에서 `prompts` 제외)은 건너뛰고 메타데이터만 만든다.

## 미드저니 버전

MJ 플래그 기본값은 `--raw --s 200 --v 8.2`다 (`CLAUDE.md`의 V8.2 기준).
버전이 올라가면 `scripts/build_batch.py`의 `DEFAULTS["mj_flags"]` 한 줄만 고치면
이후 배치가 전부 따라온다 — 기존 파일 일괄 수정은 별개 작업이다.

## 사용자에게 보고할 때

이 저장소 사용자는 개발 전문가가 아니다 (`CLAUDE.md` 소통 규칙).
경로를 나열하지 말고 **무엇이 몇 개 생겼고 다음에 뭘 하면 되는지**를 한 단계씩 알려준다.
명령어를 줄 때는 어느 창에 치는지(PowerShell 여는 법)까지 붙인다.
