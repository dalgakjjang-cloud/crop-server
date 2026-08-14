# 배치 스펙 JSON 형식

`build_batch.py`가 읽는 입력 파일. **이 파일 하나가 배치의 정본**이고,
프롬프트 4종·메타데이터 CSV·signals 행은 전부 여기서 파생된다.

## 목차
- [최상위 필드](#최상위-필드)
- [pools — 키워드 풀](#pools--키워드-풀)
- [sections — 섹션 구분](#sections--섹션-구분)
- [cuts — 컷 하나하나](#cuts--컷-하나하나)
- [프롬프트 절 구조](#프롬프트-절-구조)
- [엔진별 출력 비교](#엔진별-출력-비교)
- [전체 예시](#전체-예시)

---

## 최상위 필드

| 필드 | 필수 | 설명 |
|---|---|---|
| `batch` | ✅ | 메타데이터 배치명. **밑줄** 표기 — `vivid_abstract_20`. CSV 파일명이 된다 |
| `signals_batch` | | signals.csv용 배치 id. **하이픈** 표기 — `vivid-abstract-20`. 생략하면 `batch`의 밑줄을 하이픈으로 바꿔 쓴다 |
| `slug` | ✅ | 프롬프트 파일명 중간 조각 — `miricanvas_<slug>_<컷수>_MJ.txt` |
| `prefix` | ✅ | 컷 라벨 접두사 — `miri-vivid` → `miri-vivid-01` |
| `count` | | 예상 컷 수. `cuts` 개수와 다르면 에러로 잡아준다 (오타 방지) |
| `header_note` | | 프롬프트 파일 헤더 첫 줄 설명 |
| `asset_type` | | `photo`(기본) 또는 `video` |
| `category` | | 어도비 카테고리 기본값. 기본 `9. Graphic Resources` |
| `platform` | | `어도비+미캔`(기본) 또는 `미캔전용` |
| `pools` | ✅ | 키워드 풀 (아래) |
| `sections` | | 프롬프트 파일 섹션 구분선 (아래) |
| `cuts` | ✅ | 컷 배열 (아래) |

**밑줄/하이픈이 다른 건 오타가 아니다.** 이 저장소는 메타데이터에서 `kawaii_24`,
signals에서 `exosome-40`을 쓰는 관행이 이미 굳어 있어 양쪽을 맞춰준다.

### 기본값을 덮어쓰고 싶을 때

배치 성격이 다르면 시그니처 문구도 바꿔야 한다. 예를 들어 엑소좀처럼 어두운 네온 배치는
기본 네거티브에 있는 `dark, moody`를 빼야 한다 — 안 그러면 원하는 그림이 안 나온다.

| 필드 | 기본값 |
|---|---|
| `mj_flags` | `--raw --s 200 --v 8.2` |
| `mj_negative` | `text, letters, words, numbers, logo, watermark, brand, signature, shallow depth of field, soft focus, motion blur, dark, moody` |
| `genspark_negative` | `No text, logo, watermark, or blur — sharp throughout.` |
| `sharp_mj` | `tack-sharp front-to-back, deep depth of field, everything in focus` |
| `sharp_gpt` | `tack-sharp with everything in focus` |
| `sharp_genspark` | `everything sharp and in focus` |
| `surface_tail` | `plain unlettered unbranded surface, one continuous scene` |
| `keywords_en_cap` | `28` |
| `keywords_ko_cap` | `24` |

---

## pools — 키워드 풀

컷마다 반복해서 적기 싫은 공통 키워드를 모아두는 곳. 스크립트가 이 순서로 병합한다:

```
core_en → color_en → usecase_en → group_en[grp] → universal_en   (앞 28개만)
```

**순서가 곧 티어다.** 어도비는 앞 10개에 검색 가중치를 크게 주므로,
구매의도가 높은 말일수록 `core_en`에 넣는다. `universal`은 뒤쪽 확장·발견용이다.

```json
"pools": {
  "usecase_en": ["greeting card", "social media", "banner", "template", "invitation"],
  "usecase_ko": ["카드", "소셜 미디어", "배너", "템플릿", "초대장"],

  "group_en": {
    "A": ["geometric", "abstract", "bold", "vivid"],
    "B": ["gradient", "fluid", "organic", "flowing"]
  },
  "group_ko": {
    "A": ["기하학", "추상", "볼드", "비비드"],
    "B": ["그라데이션", "유동적", "유기적"]
  },

  "universal_en": ["background", "copy space", "design element", "modern", "no people"],
  "universal_ko": ["배경", "여백", "디자인 요소", "모던", "사람 없음"]
}
```

`group_en`의 키는 컷의 `grp` 값과 맞아야 한다. 안 맞으면 그 그룹 키워드가 조용히 빠지고
키워드 개수 하한에 걸린다 — 스크립트가 실행 전에 잡아준다.

### 개수 감각

컷당 영문 25개가 하한이다. 대략 이렇게 채우면 맞는다:

```
core_en 6 + color_en 2 + usecase 5 + group 7 + universal 8 = 28
```

`universal`은 모든 컷에 공통으로 붙으니 넉넉히(8~16개) 준비해두면 컷별 부담이 준다.

---

## sections — 섹션 구분

프롬프트 파일에 넣을 구분선. 그룹을 묶어서 제목을 단다.

```json
"sections": [
  {"title": "🎨 볼드 기하 · 비비드 축 (A)", "groups": ["A"]},
  {"title": "🌊 유동 그라데이션 축 (B)", "groups": ["B"]}
]
```

컷 순서대로 훑다가 섹션이 바뀌는 지점에 구분선이 들어간다.
그러니 **`cuts`는 그룹끼리 붙여서 정렬**해두는 게 좋다. 생략하면 구분선 없이 나열된다.

---

## cuts — 컷 하나하나

| 필드 | 필수 | 설명 |
|---|---|---|
| `n` | ✅ | 컷 번호(정수). 라벨은 `prefix-01`처럼 두 자리로 채워진다 |
| `grp` | ✅ | 그룹 코드. `pools.group_en`의 키와 일치해야 한다 |
| `shape` | ✅ | 형태 4종 중 하나 — `배경형`/`제품형`/`인물형`/`설명형` |
| `axis_subject` | ✅ | 주제축. signals 집계 단위라 같은 계열은 같은 말로 통일한다 |
| `axis_color` | | 색축 — `밝은 웜톤`, `다크·달빛` 같은 한글 요약 |
| `platform` | | 컷별로 다를 때만. 없으면 배치 기본값 |
| `category` | | 컷별로 다를 때만 (인물 컷만 `14. People` 등) |
| `label_ko` | ✅ | GPT 파일의 한글 라벨 — `--- 01 인플레이터블 핑크 하트 ---` |
| `title_en` | ✅ | 영문 제목. **자연문**, 키워드 나열 금지 |
| `title_ko` | ✅ | 한글 제목 |
| `core_en` / `core_ko` | ✅ | 이 컷의 핵심 검색어. 가중치 최상단 |
| `color_en` / `color_ko` | | 색 키워드 |
| `subject` | ✅ | 프롬프트 첫 절 — 무엇이 어디에 있는지 |
| `detail` | | 형태·질감 보충 |
| `camera` | ✅ | `eye-level hero shot`, `45-degree hero close shot`, `overhead flat shot` |
| `lighting` | ✅ | `bright soft studio daylight` 등 |
| `palette` | | `[{"name": "soft pink", "hex": "FFC1D8"}, ...]` |
| `palette_tail` | | 팔레트 뒤 꼬리말 — `with white highlight` |
| `copy_space` | | `generous clean copy space around the heart` (절 전체를 적는다) |
| `style` | ✅ | 스타일 태그. 뒤에 ` styling`이 자동으로 붙는다 |

제목은 **사람이 읽는 문장**으로 쓴다. 키워드를 나열한 제목은 어도비 거절 사유다.
`copy space` 같은 말은 키워드로 이미 잡히니 제목에서는 뺀다.

---

## 프롬프트 절 구조

컷의 프롬프트 필드는 이 순서로 이어붙는다:

```
subject, detail, camera, lighting, palette, copy_space, <선명도>, <표면>, style styling
```

`<선명도>`와 `<표면>`은 배치 공통값이라 컷마다 안 적는다.
이 뒤에 엔진별 꼬리(MJ는 플래그, GenSpark는 자연어 네거티브)가 붙는다.

---

## 엔진별 출력 비교

같은 컷이 엔진에 따라 이렇게 갈린다. **차이는 전부 기계적**이라 스크립트가 처리한다.

| | MJ | GPT | GenSpark | clean |
|---|---|---|---|---|
| 라벨 | `miri-x-01)` 인라인 | `--- 01 한글이름 ---` 윗줄 | `miri-x-01)` 인라인 | 없음 |
| 첫 글자 | 소문자 | 소문자 | **대문자** | 대문자 |
| 카메라 | `eye-level hero shot` | `camera: eye-level hero` | `eye-level hero shot` | 〃 |
| 조명 | 그대로 | `lighting: ...` | 그대로 | 〃 |
| HEX | `hex FFC1D8` | `#FFC1D8` | `hex FFC1D8` | 〃 |
| 선명도 | `tack-sharp front-to-back, deep depth of field, everything in focus` | `tack-sharp with everything in focus` | `everything sharp and in focus` | 〃 |
| 네거티브 | `--no text, letters, ...` | 없음 | `. No text, logo, ... — sharp throughout.` | 〃 |
| 헤더·구분선 | 있음 | 있음 | 있음 | **없음** |

`clean`은 GenSpark와 본문이 글자 단위로 같고, 헤더·구분선·라벨·빈 줄만 걷어낸 것이다.
컷 수 = 줄 수가 되어 배치 입력창에 그대로 붙여넣을 수 있다.

---

## 전체 예시

컷 2개짜리 최소 스펙. 실제로는 20컷 안팎으로 채운다.

```json
{
  "batch": "vivid_abstract_20",
  "signals_batch": "vivid-abstract-20",
  "slug": "vivid_abstract",
  "prefix": "miri-vivid",
  "count": 2,
  "header_note": "비비드 추상 20컷 — 어도비 2026 트렌드",
  "platform": "어도비+미캔",

  "pools": {
    "usecase_en": ["background", "banner", "template", "presentation", "social media"],
    "usecase_ko": ["배경", "배너", "템플릿", "프레젠테이션", "소셜 미디어"],
    "group_en": {
      "A": ["geometric", "bold", "vivid", "graphic", "flat lay", "composition", "shape"],
      "B": ["gradient", "fluid", "organic", "flowing", "wave", "smooth", "blend"]
    },
    "group_ko": {
      "A": ["기하학", "볼드", "비비드", "그래픽", "구성", "도형"],
      "B": ["그라데이션", "유동적", "유기적", "웨이브", "부드러운"]
    },
    "universal_en": ["abstract", "modern", "minimal", "design element", "copy space",
                     "no people", "colorful", "contemporary", "digital art", "wallpaper"],
    "universal_ko": ["추상", "모던", "미니멀", "디자인 요소", "여백",
                     "사람 없음", "컬러풀", "현대적", "디지털 아트", "월페이퍼"]
  },

  "sections": [
    {"title": "🎨 볼드 기하 · 비비드 축 (A)", "groups": ["A"]},
    {"title": "🌊 유동 그라데이션 축 (B)", "groups": ["B"]}
  ],

  "cuts": [
    {
      "n": 1, "grp": "A", "shape": "배경형",
      "axis_subject": "볼드 기하 블록", "axis_color": "비비드 오렌지-코발트",
      "label_ko": "볼드 기하 블록",
      "title_en": "Bold vivid geometric color block composition on white background",
      "title_ko": "화이트 배경 위 볼드 비비드 기하 컬러블록 구성",
      "core_en": ["color block", "geometric", "bold color", "square", "rectangle", "layout"],
      "core_ko": ["컬러블록", "기하학", "볼드 컬러", "사각형", "레이아웃"],
      "color_en": ["orange", "cobalt blue"],
      "color_ko": ["오렌지", "코발트 블루"],
      "subject": "a bold vivid geometric color block composition on a clean white background",
      "detail": "crisp overlapping rectangles with hard edges",
      "camera": "overhead flat shot",
      "lighting": "bright even studio light",
      "palette": [
        {"name": "vivid orange", "hex": "FF6B2C"},
        {"name": "cobalt blue", "hex": "2B4FD8"}
      ],
      "palette_tail": "on clean white",
      "copy_space": "generous clean copy space in the lower third",
      "style": "bold graphic poster"
    },
    {
      "n": 2, "grp": "B", "shape": "배경형",
      "axis_subject": "유동 그라데이션", "axis_color": "비비드 마젠타-바이올렛",
      "label_ko": "유동 그라데이션 웨이브",
      "title_en": "Smooth flowing vivid gradient wave on light background",
      "title_ko": "밝은 배경 위 부드러운 비비드 그라데이션 웨이브",
      "core_en": ["gradient", "wave", "flowing", "curve", "smooth", "mesh gradient"],
      "core_ko": ["그라데이션", "웨이브", "곡선", "부드러운", "메시 그라데이션"],
      "color_en": ["magenta", "violet"],
      "color_ko": ["마젠타", "바이올렛"],
      "subject": "a smooth flowing vivid gradient wave sweeping across a light background",
      "detail": "soft continuous blend with no banding",
      "camera": "eye-level composed shot",
      "lighting": "bright soft daylight",
      "palette": [
        {"name": "vivid magenta", "hex": "E63FA8"},
        {"name": "deep violet", "hex": "7B3FE6"}
      ],
      "copy_space": "generous clean copy space on the right",
      "style": "fluid gradient abstract"
    }
  ]
}
```
