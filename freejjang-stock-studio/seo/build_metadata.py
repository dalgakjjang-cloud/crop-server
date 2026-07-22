# -*- coding: utf-8 -*-
"""
배치별 스톡 메타데이터 정본(CSV) 생성기.

이 파일이 키워드의 '단일 진실 공급원'이다. 여기 구조화된 컷 데이터를 고치면
seo/metadata/<batch>.csv 가 재생성된다. (DESIGN.md식: 토큰 → 직렬화 산출물)

규칙: seo/keyword-governance.md
상한: seo/platform-limits.yaml
검사: seo/seo-check.py

usage:
    python3 seo/build_metadata.py          # 전 배치 생성
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "metadata")
SRC_DIR = os.path.join(HERE, "sources")

# ── 공통 키워드 풀 ─────────────────────────────────────────────
UNIVERSAL_EN = ["cute", "kawaii", "pastel", "soft", "3d render", "adorable",
                "decoration", "design element", "copy space", "background",
                "no people", "isolated", "minimal", "pretty", "sweet", "lovely"]
UNIVERSAL_KO = ["귀여운", "카와이", "파스텔", "부드러운", "3d 렌더", "사랑스러운",
                "데코레이션", "디자인 요소", "여백", "배경", "사람 없음", "오브젝트",
                "미니멀", "예쁜", "러블리"]

USECASE_EN = ["greeting card", "social media", "banner", "template", "invitation"]
USECASE_KO = ["카드", "소셜 미디어", "배너", "템플릿", "초대장"]

GROUP_EN = {
    "TP9": ["inflatable", "puffy", "glossy", "balloon", "three dimensional", "shiny", "rounded"],
    "TP7": ["translucent", "glossy", "premium", "luxury", "still life", "aesthetic", "elegant", "object"],
    "TP6": ["geometric", "abstract", "swiss design", "layout", "composition", "shape", "flat lay", "modern", "clean", "graphic"],
}
GROUP_KO = {
    "TP9": ["인플레이터블", "퍼피", "광택", "풍선", "입체", "반짝이는", "볼록한"],
    "TP7": ["반투명", "광택", "프리미엄", "럭셔리", "정물", "감성", "우아한"],
    "TP6": ["기하학", "추상", "스위스 디자인", "레이아웃", "구성", "도형", "플랫레이", "모던", "그래픽"],
}

# ── 카와이24 컷 데이터 (주제·색은 signals.csv와 정렬) ───────────
# core_en/ko: 컷 고유 최고의도 키워드 (Tier 1 선두). color_en/ko: 색축 파생.
KAWAII = [
 dict(n=1, grp="TP9", subj="인플레이터블 하트", axis_color="소프트 핑크",
   title_en="Cute puffy inflatable glossy 3D pink heart on cream background with copy space",
   title_ko="크림 배경 위 귀여운 인플레이터블 3D 핑크 하트, 여백 포함",
   core_en=["heart", "love", "pink heart", "valentine", "romance", "love heart"],
   core_ko=["하트", "사랑", "핑크 하트", "발렌타인", "로맨스"],
   color_en=["pink", "cream"], color_ko=["핑크", "크림"]),
 dict(n=2, grp="TP9", subj="인플레이터블 리본", axis_color="버터 옐로-민트",
   title_en="Cute puffy inflatable 3D pastel ribbon bow on white background with copy space",
   title_ko="화이트 배경 위 귀여운 인플레이터블 3D 파스텔 리본, 여백 포함",
   core_en=["ribbon", "bow", "gift bow", "present", "gift"],
   core_ko=["리본", "나비 리본", "선물", "보우"],
   color_en=["butter yellow", "mint"], color_ko=["버터 옐로", "민트"]),
 dict(n=3, grp="TP9", subj="인플레이터블 꽃", axis_color="피치 핑크-세이지",
   title_en="Cute puffy inflatable 3D flower on cream background",
   title_ko="크림 배경 위 귀여운 인플레이터블 3D 꽃, 여백 포함",
   core_en=["flower", "blossom", "cute flower", "floral", "petal"],
   core_ko=["꽃", "플라워", "플로럴", "꽃잎"],
   color_en=["peach", "sage green"], color_ko=["피치", "세이지"]),
 dict(n=4, grp="TP9", subj="인플레이터블 별", axis_color="베이비 블루-라벤더",
   title_en="Cute puffy inflatable 3D star cluster on white background with copy space",
   title_ko="화이트 배경 위 귀여운 인플레이터블 3D 별 클러스터, 여백 포함",
   core_en=["star", "stars", "cute star", "star cluster", "night"],
   core_ko=["별", "스타", "별 무리", "밤"],
   color_en=["baby blue", "lavender"], color_ko=["베이비 블루", "라벤더"]),
 dict(n=5, grp="TP9", subj="인플레이터블 구름", axis_color="페일 스카이 블루",
   title_en="Cute puffy inflatable 3D cloud set on pale blue background with copy space",
   title_ko="페일 블루 배경 위 귀여운 인플레이터블 3D 구름 세트, 여백 포함",
   core_en=["cloud", "clouds", "sky", "fluffy cloud", "weather"],
   core_ko=["구름", "하늘", "뭉게구름"],
   color_en=["sky blue", "white"], color_ko=["스카이 블루", "화이트"]),
 dict(n=6, grp="TP9", subj="인플레이터블 캔디", axis_color="딸기 핑크-민트",
   title_en="Cute puffy inflatable 3D wrapped candy on cream background with copy space",
   title_ko="크림 배경 위 귀여운 인플레이터블 3D 캔디, 여백 포함",
   core_en=["candy", "sweet", "sweets", "confection", "treat"],
   core_ko=["캔디", "사탕", "스위트", "간식"],
   color_en=["strawberry pink", "mint"], color_ko=["딸기 핑크", "민트"]),
 dict(n=7, grp="TP9", subj="인플레이터블 케이크", axis_color="피치 크림-핑크",
   title_en="Cute puffy inflatable 3D birthday cake on cream background with copy space",
   title_ko="크림 배경 위 귀여운 인플레이터블 3D 생일 케이크, 여백 포함",
   core_en=["cake", "birthday cake", "birthday", "dessert", "celebration", "party"],
   core_ko=["케이크", "생일", "디저트", "축하", "파티"],
   color_en=["peach cream", "pink"], color_ko=["피치 크림", "핑크"]),
 dict(n=8, grp="TP9", subj="인플레이터블 하트리본", axis_color="소프트 핑크-옐로",
   title_en="Cute puffy inflatable 3D hearts and bows set on white background",
   title_ko="화이트 배경 위 귀여운 인플레이터블 3D 하트와 리본 세트, 여백 포함",
   core_en=["heart", "bow", "love", "cute set", "collection"],
   core_ko=["하트", "리본", "세트", "모음"],
   color_en=["pink", "yellow"], color_ko=["핑크", "옐로"]),
 dict(n=9, grp="TP7", subj="유리 하트", axis_color="페일 핑크",
   title_en="Translucent glossy glass heart object on cream surface with copy space",
   title_ko="크림 배경 위 반투명 유리 하트 오브젝트, 여백 포함",
   core_en=["heart", "glass", "glass heart", "love", "crystal", "transparent"],
   core_ko=["하트", "유리", "글래스", "사랑", "투명"],
   color_en=["pink", "clear"], color_ko=["핑크", "투명"]),
 dict(n=10, grp="TP7", subj="젤리 별", axis_color="소프트 피치",
   title_en="Translucent glossy jelly star object on white surface with copy space",
   title_ko="화이트 배경 위 반투명 젤리 별 오브젝트, 여백 포함",
   core_en=["star", "jelly", "jelly star", "gummy", "translucent"],
   core_ko=["별", "젤리", "스타", "구미"],
   color_en=["peach"], color_ko=["피치"]),
 dict(n=11, grp="TP7", subj="대리석 플레이트", axis_color="화이트 마블",
   title_en="Polished white marble plate on cream surface with copy space",
   title_ko="크림 배경 위 광택 화이트 대리석 플레이트, 여백 포함",
   core_en=["marble", "plate", "marble plate", "tableware", "dish"],
   core_ko=["대리석", "접시", "마블", "식기"],
   color_en=["white marble"], color_ko=["화이트 마블"]),
 dict(n=12, grp="TP7", subj="크리스탈 큐브", axis_color="페일 블루",
   title_en="Translucent crystal cube object on cream surface with copy space",
   title_ko="크림 배경 위 반투명 크리스탈 큐브, 여백 포함",
   core_en=["crystal", "cube", "crystal cube", "gem", "glass"],
   core_ko=["크리스탈", "큐브", "보석", "유리"],
   color_en=["pale blue"], color_ko=["페일 블루"]),
 dict(n=13, grp="TP7", subj="유리 화병", axis_color="페일 세이지",
   title_en="Clear glass vase with a single flower on cream table with copy space",
   title_ko="크림 배경 위 유리 화병과 꽃 한 송이, 여백 포함",
   core_en=["vase", "glass vase", "flower vase", "flower", "glass"],
   core_ko=["화병", "꽃병", "유리", "꽃"],
   color_en=["sage"], color_ko=["세이지"]),
 dict(n=14, grp="TP7", subj="젤리 꽃", axis_color="소프트 코랄-민트",
   title_en="Translucent glossy jelly flower object on white surface with copy space",
   title_ko="화이트 배경 위 반투명 젤리 꽃 오브젝트, 여백 포함",
   core_en=["flower", "jelly", "jelly flower", "floral", "gummy"],
   core_ko=["꽃", "젤리", "플라워", "구미"],
   color_en=["coral", "mint"], color_ko=["코랄", "민트"]),
 dict(n=15, grp="TP7", subj="대리석 배경", axis_color="화이트 마블",
   title_en="White marble texture background with grey veining",
   title_ko="은은한 회색 결의 화이트 대리석 텍스처 배경, 여백 포함",
   core_en=["marble", "marble background", "texture", "marble texture", "stone", "surface"],
   core_ko=["대리석", "배경", "텍스처", "마블", "돌"],
   color_en=["white marble", "grey"], color_ko=["화이트 마블", "그레이"]),
 dict(n=16, grp="TP7", subj="크리스탈 다이아", axis_color="페일 라벤더",
   title_en="Translucent crystal diamond object on cream surface with copy space",
   title_ko="크림 배경 위 반투명 크리스탈 다이아몬드, 여백 포함",
   core_en=["diamond", "crystal", "gem", "jewel", "crystal diamond", "gemstone"],
   core_ko=["다이아몬드", "크리스탈", "보석", "쥬얼"],
   color_en=["lavender"], color_ko=["라벤더"]),
 dict(n=17, grp="TP6", subj="미니멀 사선", axis_color="소프트 피치-크림",
   title_en="Minimal diagonal color block layout on cream background with copy space",
   title_ko="크림 배경 위 미니멀 사선 컬러블록 레이아웃, 여백 포함",
   core_en=["diagonal", "stripe", "color block", "minimalist"],
   core_ko=["사선", "스트라이프", "컬러블록"],
   color_en=["peach", "cream"], color_ko=["피치", "크림"]),
 dict(n=18, grp="TP6", subj="미니멀 그리드", axis_color="웜 크림-그레이",
   title_en="Minimal Swiss grid line layout on cream background with copy space",
   title_ko="크림 배경 위 미니멀 스위스 그리드 레이아웃, 여백 포함",
   core_en=["grid", "grid lines", "lines", "minimalist"],
   core_ko=["그리드", "격자", "라인"],
   color_en=["cream", "grey"], color_ko=["크림", "그레이"]),
 dict(n=19, grp="TP6", subj="미니멀 원+사선", axis_color="소프트 라벤더",
   title_en="Minimal circle and diagonal line composition on cream background",
   title_ko="크림 배경 위 미니멀 원과 사선 구성, 여백 포함",
   core_en=["circle", "line", "minimalist", "dot"],
   core_ko=["원", "라인", "동그라미"],
   color_en=["lavender"], color_ko=["라벤더"]),
 dict(n=20, grp="TP6", subj="미니멀 컬러블록", axis_color="피치-옐로-민트",
   title_en="Minimal pastel color block matrix on cream background with copy space",
   title_ko="크림 배경 위 미니멀 파스텔 컬러블록 매트릭스, 여백 포함",
   core_en=["color block", "blocks", "matrix", "minimalist"],
   core_ko=["컬러블록", "블록", "매트릭스"],
   color_en=["peach", "yellow", "mint"], color_ko=["피치", "옐로", "민트"]),
 dict(n=21, grp="TP6", subj="미니멀 라인+도트", axis_color="웜 크림-그레이",
   title_en="Minimal line and dot composition on cream background with copy space",
   title_ko="크림 배경 위 미니멀 라인과 도트 구성, 여백 포함",
   core_en=["line", "dots", "dot", "minimalist"],
   core_ko=["라인", "도트", "점"],
   color_en=["cream", "grey"], color_ko=["크림", "그레이"]),
 dict(n=22, grp="TP6", subj="미니멀 웨이브", axis_color="페일 스카이 블루",
   title_en="Minimal pastel wavy stripe on cream background with copy space",
   title_ko="크림 배경 위 미니멀 파스텔 웨이브 스트라이프, 여백 포함",
   core_en=["wave", "wavy", "curve", "minimalist"],
   core_ko=["웨이브", "물결", "곡선"],
   color_en=["sky blue"], color_ko=["스카이 블루"]),
 dict(n=23, grp="TP6", subj="미니멀 사각그리드", axis_color="핑크-옐로-민트",
   title_en="Minimal pastel square grid on cream background with copy space",
   title_ko="크림 배경 위 미니멀 파스텔 사각형 그리드, 여백 포함",
   core_en=["square", "grid", "blocks", "minimalist"],
   core_ko=["사각형", "그리드", "블록"],
   color_en=["pink", "yellow", "mint"], color_ko=["핑크", "옐로", "민트"]),
 dict(n=24, grp="TP6", subj="미니멀 삼각형", axis_color="소프트 코랄",
   title_en="Minimal pastel triangle composition on cream background with copy space",
   title_ko="크림 배경 위 미니멀 파스텔 삼각형 구성, 여백 포함",
   core_en=["triangle", "shape", "minimalist", "geometric"],
   core_ko=["삼각형", "도형", "미니멀"],
   color_en=["coral"], color_ko=["코랄"]),
]


def merge(*lists, cap=None):
    """여러 리스트를 순서 보존 dedupe(소문자 기준)로 병합. cap 개수로 절단."""
    seen, out = set(), []
    for lst in lists:
        for item in lst:
            key = item.lower().strip()
            if key and key not in seen:
                seen.add(key)
                out.append(item.strip())
    return out[:cap] if cap else out


def build_kawaii():
    rows = []
    for c in KAWAII:
        grp = c["grp"]
        kw_en = merge(c["core_en"], c["color_en"], USECASE_EN,
                      GROUP_EN[grp], UNIVERSAL_EN, cap=28)
        kw_ko = merge(c["core_ko"], c["color_ko"], USECASE_KO,
                      GROUP_KO[grp], UNIVERSAL_KO, cap=24)
        # 제목은 사람이 읽는 자연문 — 'copy space'는 키워드로 이미 잡히므로 제목에선 뺀다
        title_en = c["title_en"].replace(" with copy space", "")
        title_ko = c["title_ko"].replace(", 여백 포함", "")
        rows.append({
            "filename": "miri-kawaii-%02d.png" % c["n"],
            "asset_type": "photo",
            "title_en": title_en,
            "title_ko": title_ko,
            "keywords_en": ", ".join(kw_en),
            "keywords_ko": ", ".join(kw_ko),
            "category": "9. Graphic Resources",
            "batch": "kawaii_24",
            "axis_subject": c["subj"],
            "axis_color": c["axis_color"],
        })
    return rows


# ── 엑소좀40 (Adobe · 네온 바이오텍) ───────────────────────────
EXO_UNIVERSAL_EN = ["exosome", "biotechnology", "science", "3d render", "dark background",
                    "glowing", "neon", "futuristic", "medical", "research", "abstract",
                    "technology", "macro", "scientific", "molecular", "closeup",
                    "microbiology", "healthcare", "blue", "digital"]
EXO_UNIVERSAL_KO = ["엑소좀", "바이오텍", "과학", "3d 렌더", "다크 배경", "발광", "네온",
                    "미래적", "의학", "연구", "추상", "기술", "매크로", "분자", "생물학",
                    "헬스케어", "디지털"]
EXO_GROUP_EN = {
    "A": ["molecule", "molecular structure", "particle", "nanotechnology", "sphere", "cell", "atom"],
    "B": ["cell", "cell membrane", "vesicle", "cellular", "biology", "microorganism", "organism"],
    "C": ["serum", "cosmetics", "skincare", "beauty", "ampoule", "liquid", "droplet", "anti aging"],
    "D": ["skincare", "skin", "beauty", "absorption", "dermatology", "collagen", "regeneration", "cosmetics"],
}
EXO_GROUP_KO = {
    "A": ["분자", "입자", "나노", "구체", "세포"],
    "B": ["세포", "세포막", "베지클", "생물학", "미생물"],
    "C": ["세럼", "화장품", "스킨케어", "뷰티", "앰플", "리퀴드"],
    "D": ["스킨케어", "피부", "뷰티", "흡수", "피부과", "콜라겐"],
}
EXO_COLOR_KO_EXTRA = ["블루", "퍼플", "네온"]


# 프롬프트에서 잘린 제목의 꼬리 군더더기(전치사·관사·형용사)를 제거하고,
# 너무 짧으면 다크 배경 맥락을 붙여 자연스러운 스톡 제목으로 정리한다.
_TITLE_TAIL_BAD = {"tiny", "the", "a", "of", "with", "and", "in", "on", "soft",
                   "gentle", "its", "like", "each", "through", "revealing",
                   "resembling", "filled", "caught", "forming", "studded",
                   "trailing", "spreading", "scattered", "winding", "expanding",
                   "stretching", "different", "small", "large", "off", "from",
                   "several", "together", "larger", "wide"}


def clean_exo_title(t):
    words = t.split()
    while len(words) > 3 and words[-1].lower().strip(",") in _TITLE_TAIL_BAD:
        words.pop()
    t = " ".join(words)
    if len(t) < 45 and "background" not in t.lower():
        t = t + " on dark background"
    return t


def build_exosome():
    data = json.load(open(os.path.join(SRC_DIR, "exosome_40.json"), encoding="utf-8"))
    rows = []
    for c in data:
        grp = c["grp"]
        kw_en = merge(c["core_en"], c["color_en"], EXO_GROUP_EN[grp],
                      EXO_UNIVERSAL_EN, cap=28)
        kw_ko = merge(c["core_ko"], c["color_ko"], EXO_GROUP_KO[grp],
                      EXO_UNIVERSAL_KO, cap=24)
        rows.append({
            "filename": "exosome-%02d.png" % c["n"],
            "asset_type": "photo",
            "title_en": clean_exo_title(c["title_en"]),
            "title_ko": c["title_ko"],
            "keywords_en": ", ".join(kw_en),
            "keywords_ko": ", ".join(kw_ko),
            "category": "9. Graphic Resources",
            "batch": "exosome_40",
            "axis_subject": c["title_ko"].split(" · ")[0],
            "axis_color": "/".join(c["color_ko"]),
        })
    return rows


# ── 베스트셀러36 (MiriCanvas · 한국 라이프스타일) ──────────────
# 용도·무드 중심 공통 풀 (내용이 아니라 쓰임새를 서술 → 전 컷 안전)
BEST_UNIVERSAL_EN = ["korean", "bright", "clean", "copy space", "background",
                     "natural light", "lifestyle", "modern", "no text",
                     "advertising", "promotion", "template", "banner",
                     "commercial", "design", "marketing", "concept", "poster"]
BEST_UNIVERSAL_KO = ["한국", "밝은", "깨끗한", "여백", "배경", "자연광",
                     "라이프스타일", "모던", "텍스트 없음", "광고", "홍보",
                     "템플릿", "배너", "상업", "디자인", "마케팅", "컨셉", "포스터"]
BEST_CAT_EN = {
    "부동산": ["real estate", "apartment", "interior", "home", "housing", "residential", "property", "building"],
    "가족": ["family", "korean family", "happy", "together", "parenting", "love", "children"],
    "비즈니스": ["business", "office", "professional", "meeting", "work", "teamwork", "corporate"],
    "여름과일": ["fruit", "fresh", "summer", "healthy", "food", "delicious", "organic"],
    "가을과일": ["fruit", "fresh", "autumn", "gift", "healthy", "premium", "food"],
    "건강식": ["healthy food", "diet", "fresh", "meal", "nutrition", "vegetable", "wellness"],
    "홈·침구": ["interior", "home", "cozy", "bedroom", "bedding", "minimal", "comfortable"],
}
BEST_CAT_KO = {
    "부동산": ["부동산", "아파트", "인테리어", "주거", "주택", "건물"],
    "가족": ["가족", "행복", "함께", "육아", "사랑", "아이"],
    "비즈니스": ["비즈니스", "사무실", "전문가", "회의", "업무", "팀워크"],
    "여름과일": ["과일", "신선", "여름", "건강", "음식", "유기농"],
    "가을과일": ["과일", "신선", "가을", "선물", "건강", "프리미엄"],
    "건강식": ["건강식", "다이어트", "신선", "식사", "영양", "채소"],
    "홈·침구": ["인테리어", "홈", "아늑한", "침실", "침구", "미니멀"],
}


def build_bestsellers():
    data = json.load(open(os.path.join(SRC_DIR, "bestsellers_36.json"), encoding="utf-8"))
    rows = []
    for c in data:
        cat = c["cat"]
        # 기존 키워드(내용 정확)를 선두로 시드 → 카테고리 풀 → 공통 순 병합
        kw_en = merge(c["seed_en"], BEST_CAT_EN.get(cat, []), BEST_UNIVERSAL_EN, cap=28)
        kw_ko = merge(c["seed_ko"], BEST_CAT_KO.get(cat, []), BEST_UNIVERSAL_KO, cap=24)
        rows.append({
            "filename": "miri-best-%02d.png" % c["n"],
            "asset_type": "photo",
            "title_en": c["title_en"],
            "title_ko": c["title_ko"],
            "keywords_en": ", ".join(kw_en),
            "keywords_ko": ", ".join(kw_ko),
            "category": c["category"],
            "batch": "bestsellers_36",
            "axis_subject": cat,
            "axis_color": "",
        })
    return rows


COLUMNS = ["filename", "asset_type", "title_en", "title_ko",
           "keywords_en", "keywords_ko", "category", "batch",
           "axis_subject", "axis_color"]


def write_csv(batch, rows):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, batch + ".csv")
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    return path


if __name__ == "__main__":
    for batch, builder in [("kawaii_24", build_kawaii),
                           ("exosome_40", build_exosome),
                           ("bestsellers_36", build_bestsellers)]:
        p = write_csv(batch, builder())
        print("wrote", p)
