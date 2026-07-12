import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles, Download, Trash2, RefreshCw, Copy, Check, Cpu, AlertTriangle,
  FileSpreadsheet, Wand2, X, Play, Square, Image as ImageIcon, ScanSearch,
  Layers, Key, Settings2, CornerDownLeft, FileText, ClipboardCheck,
  ShieldAlert, CircleDollarSign, ChevronRight, Ban, FolderOpen, Sun, Moon
} from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import Pica from "pica";

/* ═══════════════════════════════════════════════════════════
   FreeJJang STOCK STUDIO — 최종판 (다크 · 2중 두뇌)
   두뇌: GPT(Codex 계열) / Gemini — 자동 폴백
   손:   GPT 이미지 API(기본) / Gemini — 실제 이미지 생성
   파이프라인: 초안 승인(멈춤1) → 순차 생성 → QC(멈춤2) → 제출 팩
   ═══════════════════════════════════════════════════════════ */

/* 항상 배제 (텍스트·로고·저작권·군중) — 상업용/배경화면 모두 공통.
   gpt-image가 박스·간판·벽에 엉터리 글자를 그리는 경향이 강해 억제를 명시적으로 강화 */
const GUARD = "absolutely NO text, letters, words, numbers, captions, labels, printed writing or logos anywhere — on any surface, box, package, wall, sign, object, uniform, cap, badge or clothing (all packaging, boxes, uniforms and caps must be completely plain and blank); no watermarks, no brand names, no copyrighted characters, no crowd";
/* 노텍스트 선두 잠금 — 이미지 모델은 앞 토큰에 가중치를 두므로 GUARD(후미)와 별도로 프롬프트 앞에도 박는다.
   특히 한국 배경(교회·카페 등)에서 모델이 자발적으로 그려넣는 한글 서예·벽 액자·현수막·표어를 문자 단위로 명시 차단 */
const NO_TEXT_LOCK = "zero written characters of ANY language or script anywhere in the image — no Korean Hangul, no English letters, no Chinese or Japanese characters, no numbers, no calligraphy: walls are plain and bare with no framed verses, hanging banners, posters, scrolls or wall lettering; every book, cover, spine and leather surface is completely blank with no embossed, engraved or printed title; screens, signs and labels are blank or purely pictorial";

/* 분할 컷 절대 금지 — 한 이미지를 둘 이상의 패널로 나누는 것(딥틱·콜라주·비교샷·그리드)은 전면 차단.
   비교 전후 샷을 명시적으로 요청한 경우가 아니면 어떤 장르에서도 허용하지 않는다 */
const SINGLE_FRAME_GUARD = "ONE single continuous photograph of ONE single moment and ONE single scene filling the entire frame — absolutely never a split-screen, diptych, triptych, collage, grid of sub-images, side-by-side panels, or before-and-after comparison layout";

/* 상업용(non-wallpaper) 전용 배제 — 역광·보케·산만한 배경 (어도비 판매 킬러) · 짧게 */
const COMMERCIAL_GUARD = "clean uncluttered background, even lighting, no backlit, no silhouette, no lens flare, no bokeh, no blurry background, no neon glow, no glowing sci-fi circuits or holograms, no dark moody tech scene, no noise, no film grain, no banding";

/* 신앙·워십 장르: 골든아워 역광·십자가 실루엣이 오히려 판매 포인트 (미캔 베스트셀러) → backlit 금지 예외 */
const FAITH_RE = /church|worship|choir|cross|crucifix|prayer|praying|bible|gospel|christian|faith|congregation|hymn|sanctuary|교회|예배|성가대|찬양|십자가|기도|성경|기독교|신앙|찬송|성도|예수|주님/i;
const FAITH_GUARD = "clean reverent composition, warm golden-hour or soft sanctuary light welcome, gentle cross silhouette acceptable, no clutter";

/* 감성 배경(미캔형) — 텍스트 얹을 배경. 골든아워·빛내림·역광 환영 + 어두운 텍스트 여백 */
const EMOTIONAL_ATMOS = "warm golden-hour glow or soft dramatic sky with gentle light rays beaming through clouds, serene inspirational mood, soft backlight and subtle lens flare welcome";
const EMOTIONAL_GUARD = "simple clean composition with a calm low-detail area reserved for text overlay, no busy clutter";

/* 미캔 라이프스타일 시그니처 — 부동산·가족·저널링·솔로 데일리·골프 등 밝은 홈 미학 */
const MIRI_LIFESTYLE_RE = /부동산|아파트|인테리어|모델하우스|임장|매매|이사|입주|열쇠|전세|월세|realestate|real\s*estate|apartment|interior|home|저널|일기|다이어리|독서|공부|힐링|명상|재활용|분리수거|보드게임|가족|일상|라이프스타일|골프|퍼팅|스마트폰|모닝|출근|커피\s*한잔|햇살|창가/i;
const MIRI_LIFESTYLE_STYLING = "authentic bright airy Korean home aesthetic: warm-neutral palette (cream, soft beige, warm wood), natural Korean people with genuine relaxed smiles (never stiff stock poses), soft window daylight, one gentle plant, tack-sharp subject with gently blurred background, wide 16:9-style framing";
const MIRI_LIFESTYLE_GUARD = "bright and appetizing with soft natural window light, subject tack-sharp, gently blurred background welcome, generous low-detail area reserved for Korean text overlay, no dark or moody underexposure, no crowd";

/* 어도비 헬스케어 — 글로벌 스톡 톱셀러 (의료·환자 케어·연구·웰니스) */
const HEALTHCARE_RE = /의사|의료|병원|간호|간호사|환자|진료|처방|약사|약국|치료|재활|물리치료|건강\s*검진|헬스케어|의학|웰니스|정신건강|상담|심리치료|healthcare|hospital|clinic|doctor|\bnurse\b|patient|medical|medicine|therapy|wellness|mental\s*health|pharmacist|pharmacy/i;
/* 한국 명시 주제 감지 — 어도비 글로벌 다양성 규칙을 이때만 억제 */
const KOREAN_EXPLICIT_RE = /한국|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|전라|경상|제주|한국인|korean|seoul|busan/i;
const HEALTHCARE_STYLING = "professional healthcare stock photography for Adobe Stock: authentic diverse medical professionals interacting warmly with a patient, tack-sharp clinical detail, modern hospital or clinic setting with pale blue-white palette, natural but flattering lighting, hopeful reassuring mood — never sterile-cold, never sensationalized";
const HEALTHCARE_GUARD = "clean modern medical setting, honest editorial realism, no fake plastic AI smiles, no branded logos on scrubs or devices, no identifying patient records visible, no unsafe or gory imagery, no crowd";

/* 검증된 판매 공식 — 두뇌(추천·초안)가 주제에 맞을 때 이 구도로 기울이도록 참고 주입 */
const BESTSELLER_REFERENCE = `PROVEN BESTSELLER FORMULAS — when the topic fits one of these, lean into its exact winning composition:
- Faith / worship (top seller on Korean MiriCanvas): church interior, a choir singing, a cross silhouetted against a golden-hour or sunset sky, praying hands, an open bible beside candles, a worship band — reverent warm mood; here golden-hour backlight and a gentle silhouette ARE desirable (do NOT flatten them).
- Business growth / finance (top seller on BOTH Adobe Stock & MiriCanvas): stacked gold coins with an upward arrow, a glowing arrow rising through a blue data grid, an ascending stock candlestick chart on a screen — clean, professional, blue-and-gold palette, conveying growth and success.
- Real estate / modern Korean apartment (huge MiriCanvas seller): a bright modern minimalist Korean apartment interior with floor-to-ceiling windows and a city skyline view, a young Korean couple touring an empty living room with a realtor pointing at features, a hand receiving keys, an empty freshly-painted room with warm wooden floor and one plant, an architect's model apartment on a desk — bright airy palette, warm wood + white + soft beige, generous negative space for text overlay.
- Korean family lifestyle everyday moments (MiriCanvas core): a Korean family (2-3 generations) laughing around a low living-room table playing a board game, parents and a small child sorting recyclables in a bright utility room, a warm dinner scene around a Korean home table — natural genuine smiles (never stiff stock poses), soft window daylight, wooden furniture, one calm plant, clean uncluttered background.
- Solo daily-life moments (highly reusable MiriCanvas base): a woman journaling in a spiral notebook on a wooden table with an open book, ceramic coffee cup and a small plant lit by warm window light; a young Korean man smiling at a smartphone in a bright home office; hands holding a coffee cup — quiet mindful mood, shallow depth of field, subject to one side, wide 45-60% low-detail area for Korean text overlay.
- Golf lifestyle (bright MiriCanvas leisure seller): golfer lining up a putt with tight focus on hands and club, a couple walking a fairway with a golf cart, a lesson swing at a green driving range — bright daylight, crisp green turf, blue sky, no crowd.
- Healthcare (major Adobe Stock global seller): a warm interaction between a doctor and a patient in a modern clinic (doctor listening, gentle stethoscope moment), a nurse reassuring an elderly patient, a diverse care team reviewing a tablet chart, a laboratory researcher at a microscope, a therapist in a bright counseling office — modern clean facility, pale blue/white/warm wood palette, honest editorial realism, hopeful reassuring mood; diverse global casting (mixed ethnicities) unless the topic explicitly names Korea, then Korean casting.
- Practical Korean home-life packages (sells on BOTH MiriCanvas AND Adobe Stock): themed sets of related useful lifestyle moments — travel packing (folding clothes into a suitcase on a white bed), pet-travel prep (packing a pet carrier while the dog waits), meal-prep (portioning banchan into glass containers on a bright kitchen counter, storing prepped meals in a fridge drawer), home organization (drawer sorting, closet folding, decluttering), receiving-delivery moments (accepting a chilled box at the apartment door). The helper is NOT limited to a woman — freely vary who is doing the task across the set: a Korean woman, a Korean man, a couple sharing the chore, a parent with a child pitching in, or the whole family helping together (dad packing, mom folding, kid carrying) — men and family members helping are strongly encouraged and sell just as well. Signature: bright airy white/beige Korean home, casual home wardrobe in warm neutrals, warm-neutral palette, natural hands-on action, tack-sharp product/prop hero, gentle window daylight. These package well because buyers use the whole set on a single blog/newsletter/marketing sequence.
- Product-on-white isolation / PIW (proven Adobe BULK seller — thousands of approvals): a single product or themed arrangement shot on a seamless pure white background — chocolate cake from every angle (50+ variations), seasonal party supplies (Valentine hearts & chocolates, July 4th BBQ & flags, Christmas ornaments, Pride rainbow items, summer beach gear), food items, lifestyle objects. Even soft wrap-around studio lighting from all sides, no harsh shadows, product fills 60-80% of frame, tack-sharp front-to-back, true-to-life colors and texture. This style sells in VOLUME — batches of 30-100 variations of the same product/theme at different angles, with slightly different arrangements, different garnishes, different accessories. Each image in the batch must have a CLEARLY DIFFERENT composition (different angle, different arrangement, different crop, different garnish or accessory variation) to avoid Adobe similarity rejection. No people, pure object hero shots. Also works for MiriCanvas as clean cutout assets.
- Trending Korean desserts (viral social-media sellers on BOTH Adobe & MiriCanvas): butter tteok (버터떡) with golden crispy exterior and soft chewy rice cross-section, chewy thick cookie (두쫀쿠) with gooey molten chocolate center pull-apart shot, modernized yakgwa (약과) with honey-sesame glaze, crookie (크루키) croissant-cookie hybrid with cream oozing, cream croissant, twisted donut (꽈배기) — impeccable cross-section hero shot or dramatic texture close-up, rich golden-brown indulgent detail, trendy minimalist plating. These sell on Instagram-appeal alone.
- International brunch spread (strong Adobe global seller): culture-specific breakfast dishes — American pancakes with bacon, English full breakfast, French croissant & jam, Japanese morning set, Middle Eastern shakshuka, Mexican huevos rancheros, Korean doenjang-jjigae with banchan — each with authentic tableware from that cuisine, bright morning-cafe styling. One country per image, never mix cuisines.
- Premium steak & grill (Adobe premium food category): thick-cut medium-rare steak with visible pink cross-section and juice beads, char-grilled marks, cast iron or wooden board, melting herb butter, rosemary garnish, warm steakhouse lighting with slight smoke wisps.
- Cafe seasonal drinks (trendy Adobe + MiriCanvas lifestyle): strawberry latte gradient layers, matcha ade, taro frappé, einspänner with whipped cream cap, dirty espresso drip — glass hero with beautiful color layers visible, condensation droplets, fresh fruit garnish, bright airy cafe counter.
- Meal-prep / dosirak lunchbox (proven bright-white seller on Adobe + MiriCanvas): DIVIDED containers with separate compartments — steamed rice in its own compartment, each side dish in its own well, portions never mixed (they must survive transport); clear glass meal-prep boxes or stainless dosirak trays shot overhead or 45° on a PURE WHITE counter with an airy white background, vibrant food colors popping against the white-dominant frame, crisp high-key daylight; Subway-style fresh prep sets (wrapped sandwiches, salad bowls, fruit cups, overnight oats in stacked clear containers) sell equally well — bright, fresh, organized, never dark or moody, hands optional (with or without both sell).
- Japanese-Korean cute cafe comfort food (PROVEN Adobe APPROVED — 20+ batch approvals): cozy kawaii-styled comfort dishes — tempura udon, omurice with heart ketchup, takoyaki with mayo drizzle, tonkatsu/cheese katsu on pastel plates, brownies with berries, Korean egg rolls (gyeranmari), baguette sandwiches in paper trays, açaí/fruit granola bowls, onigiri, taro latte with bear cookies. CRITICAL STYLING: gingham check fabric background (pink or blue gingham), pastel ceramics (pink/mint/cream plates), cute props (heart shapes, animal cookies, small flowers), warm soft lighting, overhead or 45° angle, Instagram-cafe kawaii aesthetic. This is NOT white-background or dark-moody — it is specifically the cozy gingham-and-pastels look that got batch approved.
UNIVERSAL MIRICANVAS SIGNATURE for the lifestyle categories above: bright airy, warm-neutral palette (cream/beige/soft wood), authentic Korean people with genuine natural smiles (never stiff Western stock look), soft window daylight, one gentle plant, tack-sharp subject with gently blurred background, and a clean low-detail area (~45-55% of frame) reserved for Korean text overlay.
UNIVERSAL ADOBE STOCK SIGNATURE for the Adobe-first categories (healthcare, business, etc.): globally diverse casting (mix of ethnicities, ages, genders) UNLESS the topic explicitly names Korea/Korean cities — then Korean casting; strong subject-focused composition (rule of thirds, subject fills 50-70% of frame); editorial realism; less need for wide text-overlay areas; cinematic or moody lighting is welcome when the topic calls for it.`;

const ASPECTS = ["1:1", "16:9", "4:3", "3:4", "9:16"];
const OPENAI_SIZE = { "1:1": "1024x1024", "16:9": "1536x1024", "4:3": "1536x1024", "3:4": "1024x1536", "9:16": "1024x1536" };
/* gpt-image 1536×1024 기준 근사 단가 (실제 청구액은 상이할 수 있음) */
const OPENAI_COST = { low: 0.005, medium: 0.041, high: 0.165 };
const GEMINI_IMG_COST = 0.039; // gemini-2.5-flash-image 1장 근사 단가
/* 일시적(재시도 가능) 오류 패턴 — 요금/키 오류는 제외 */
const TRANSIENT_RE = /429|rate.?limit|overloaded|timeout|temporarily|unavailable|failed to fetch|network|internal|50[023]/i;

const WALLPAPER_RE = /배경화면|월페이퍼|wallpaper|배너|banner|카피\s*스페이스|copy\s*space/i;
/* 감성 배경 자동 감지 — 절기·예배·감성 문구 (미캔 텍스트 배경 수요) */
const EMOTIONAL_RE = /추수감사|감사절|thanksgiving|예배|찬양|워십|worship|말씀|성경\s*구절|묵상|은혜|축복|빛내림|감성\s*배경|성탄|크리스마스|부활절|간증|주일|찬송|새해\s*인사|명절\s*인사/i;

const ANALYSIS_BLOCKS = ["주제","스타일","구도","조명","색감","외형","의상","포즈/표정","소품/오브젝트","배경","카메라","분위기","여백/카피스페이스"];

/* Adobe Stock 공식 콘텐츠 카테고리 (1-21) — 초안 선정·CSV·카드 표시 공용 */
const ADOBE_CATEGORIES = {
  1: "Animals", 2: "Buildings and Architecture", 3: "Business", 4: "Drinks",
  5: "The Environment", 6: "States of Mind", 7: "Food", 8: "Graphic Resources",
  9: "Hobbies and Leisure", 10: "Industry", 11: "Landscapes", 12: "Lifestyle",
  13: "People", 14: "Plants and Flowers", 15: "Culture and Religion", 16: "Science",
  17: "Social Issues", 18: "Sports", 19: "Technology", 20: "Transport", 21: "Travel",
};
const ADOBE_CAT_LIST = Object.entries(ADOBE_CATEGORIES).map(([id, name]) => `${id} ${name}`).join(", ");
const ADOBE_MAX_KEYWORDS = 35; // Adobe SEO 키워드 상한

/* 정밀 카메라 구도 프리셋 — 선택 시 하이퍼리얼 카메라 묘사 문장으로 변환되어 프롬프트에 주입 */
const CAMERA_ANGLES = {
  auto: { label: "자동 (초안 카메라 그대로)", phrase: "" },
  eye_level: { label: "Eye Level (정면)", phrase: "eye-level straight-on shot, balanced calm perspective, 50mm lens, orderly composition" },
  low_angle: { label: "Low Angle (올려다보기)", phrase: "dynamic low-angle shot, looking slightly upward, powerful perspective, majestic presence" },
  high_angle: { label: "High Angle (내려다보기)", phrase: "clean high-angle shot looking down, comprehensive organized top-down view" },
  top_down: { label: "Top-Down (탑다운/항공뷰)", phrase: "straight-down 90-degree top-down flat lay, bird's-eye aerial view shot directly overhead, neatly arranged composition with balanced negative space, everything evenly in focus" },
  wide: { label: "Wide (와이드)", phrase: "wide establishing shot, 24mm lens, generous environmental context and abundant negative space" },
  angle_45: { label: "Angle 45 (사선 45도)", phrase: "45-degree three-quarter angle shot, natural depth and dimensionality" },
  over_shoulder: { label: "Over Shoulder (어깨 너머)", phrase: "over-the-shoulder shot, natural candid framing looking past the subject" },
  closeup: { label: "Closeup (클로즈업)", phrase: "close-up shot, tack-sharp focus across the entire key subject at f/4, gentle natural background separation, no soft-focus haze" },
  macro: { label: "Macro (초근접 접사)", phrase: "extreme macro photography with focus-stacked front-to-back sharpness on the whole subject, hyper-detailed crisp texture, clean smooth background falloff" },
};

/* 지능형 분위기 필터 — 실내/사무 주제 감지 시 중립 화이트밸런스(노란끼 배제) 적용 */
const INDOOR_RE = /office|desk|workspace|indoor|meeting|remote\s*work|home\s*office|studio|사무실|재택|실내|회의|책상|워크스페이스|홈\s*오피스|스튜디오|작업실/i;
const NIGHT_RE = /night|evening|dusk|midnight|sunset|밤|저녁|야간|새벽|노을|야경|일몰/i;
/* 어두운·안개 라이팅이 판매 포인트인 니치 (풍경·여행·자연·홀리데이 야경). 이 외 상업 슬롯은 밝게 강제 */
const MOODY_ALLOWED_RE = /풍경|여행|자연|산|바다|호수|숲|사막|폭포|일출|일몰|노을|안개|눈보라|은하수|밤하늘|야경|크리스마스\s*이브|landscape|travel|scenery|mountain|ocean|forest|desert|waterfall|sunrise|sunset|fog|mist|aurora|milkyway|night\s*sky/i;
/* 밝기 강제 문구 — 상업 슬롯에 강하게 주입해 어두운 언더익스포저·안개 우연 발생 차단 */
const BRIGHT_ENFORCEMENT = "brightly lit high-key commercial photography with plenty of ambient light, cheerful daytime feel, clean well-exposed image (never dim, never underexposed, never foggy or misty unless the topic is explicitly landscape/travel/nature)";

/* REEDO식 구조화 구성 — 드롭다운 선택이 초안 프롬프트 제약으로 조립됨 (선택 안함이면 무시) */
const REEDO_STYLE = {
  "": "선택 안함", photo: "실사 사진", "3d": "3D 렌더", watercolor: "수채화",
  vector: "벡터/일러스트", minimal: "미니멀", flatlay: "플랫레이", isometric: "아이소메트릭",
};
const REEDO_STYLE_PHRASE = {
  photo: "photorealistic photography", "3d": "clean 3D render", watercolor: "soft watercolor illustration",
  vector: "flat vector illustration", minimal: "minimal clean aesthetic", flatlay: "top-down flat lay composition",
  isometric: "isometric illustration",
};
const REEDO_REGION = {
  "": "선택 안함", us: "미국", kr: "한국", eu: "유럽", jp: "일본", global: "글로벌",
};
const REEDO_REGION_PHRASE = {
  us: "styled for the US market, American aesthetic", kr: "styled for the Korean market, Korean aesthetic",
  eu: "European aesthetic", jp: "Japanese aesthetic", global: "universal global-market aesthetic",
};
const REEDO_BG = {
  "": "선택 안함", white: "흰 배경", daylight: "자연광 실내", office: "사무실",
  outdoor: "야외/자연", studio: "스튜디오", solid: "단색 배경", bokeh: "보케 흐림",
};
const REEDO_BG_PHRASE = {
  white: "clean seamless white background", daylight: "bright naturally-lit interior",
  office: "modern office setting", outdoor: "natural outdoor environment",
  studio: "professional studio setting", solid: "clean solid color backdrop", bokeh: "soft bokeh blurred background",
};
/* 음식 장르 셀렉터 — 음식 주제일 때 장르별 스타일링 주입 (선택 안함이면 무시) */
const REEDO_FOOD = {
  "": "선택 안함", jpkr_cafe: "일본·한국 카페 컴포트 (어도비 승인)",
  brunch: "브런치/카페", world_brunch: "나라별 브런치",
  dessert: "디저트/베이커리", trending: "트렌딩 디저트 (버터떡·두쫀쿠·약과)",
  cafe_drink: "카페 신메뉴/시즌 드링크", korean: "한식/집밥", steak: "스테이크/그릴",
  beverage: "음료/커피", finedining: "파인다이닝/플레이팅", healthy: "건강식/샐러드",
  street: "분식/길거리", homecook: "홈쿠킹/재료", flatlay: "푸드 플랫레이(탑뷰)",
  piw: "흰배경 제품컷 (푸드)", mealprep: "밀프랩/도시락 (칸막이 용기)",
};
const REEDO_FOOD_PHRASE = {
  jpkr_cafe: "Japanese-Korean cute cafe comfort food photography (ADOBE APPROVED FORMULA) — proven seller dishes: tempura udon (golden shrimp tempura on top of steaming udon noodles in a ceramic bowl), omurice (fluffy omelette over rice with heart-shaped ketchup or demi-glace), takoyaki (octopus balls with mayo drizzle and bonito flakes on a boat plate), tonkatsu/cheese katsu (deep-fried cutlet with melting cheese pull, on a pink or pastel plate), brownies with fresh berries and cream, egg roll/tamagoyaki (Korean gyeranmari, golden layered), baguette sandwiches in paper containers, açaí/fruit granola bowls with fresh berries and banana slices, onigiri (rice balls with nori), taro/ube latte with cute bear-shaped cookies — STYLING IS KEY: gingham check fabric backgrounds (pink gingham OR blue gingham), pastel-colored plates and ceramics (pink, mint, cream), cute decorative props (heart-shaped elements, animal-shaped cookies, small flowers), warm soft natural lighting, overhead or 45-degree angle, cozy Instagram-cafe kawaii aesthetic, food fills 70-85% of frame with fabric/plate as styling context, NEVER on plain white or dark moody backgrounds",
  brunch: "fresh brunch cafe food photography — avocado toast / eggs / greens vibe on a modern cafe table, appetizing natural styling",
  world_brunch: "international brunch spread photography — culture-specific breakfast and brunch dishes from around the world: American (fluffy pancakes, crispy bacon, eggs, hash browns), English full breakfast (baked beans, toast, sausage, fried eggs, grilled tomato), French (butter croissant, jam, café au lait on marble surface), Japanese morning set (steamed rice, miso soup, grilled salmon, pickled vegetables), Middle Eastern (shakshuka in cast iron, hummus, warm pita, labneh), Mexican (huevos rancheros, chilaquiles, fresh salsa, avocado), Korean (doenjang-jjigae, banchan array, steamed rice) — each scene uses authentic tableware and garnishes specific to that cuisine, bright natural morning-cafe styling, one country per image",
  dessert: "dessert & bakery photography — cakes, pastries, macarons, tarts, éclairs, cream puffs, coffee, cozy patisserie styling with soft warm light",
  trending: "Korean trending viral dessert photography — hyped social-media-ready treats: butter tteok (버터떡) with golden crispy exterior and soft chewy glutinous rice interior visible in cross-section, chewy thick cookie (두쫀쿠) with gooey molten chocolate center in a dramatic pull-apart or cross-section hero shot, modernized yakgwa (약과) with glossy honey-sesame glaze dripping, crookie (크루키) hybrid croissant-cookie with cream oozing, cream croissant with overflowing custard filling, twisted Korean donut (꽈배기) with sugar coating, injeolmi latte with soybean powder dusting — impeccable cross-section or dramatic texture close-up, rich indulgent golden-brown detail, trendy minimalist plating on warm neutral or marble surface",
  cafe_drink: "trendy cafe seasonal new-menu drink photography — specialty beverages: strawberry latte with pink-to-white gradient layers, matcha ade with vivid green and ice, taro frappé with purple swirl, fresh fruit smoothie with visible berry layers, sparkling citrus lemonade with bubbles and mint, einspänner with thick whipped cream cap, dirty espresso with dripping cream shot, ube latte, butterfly pea flower tea color-changing, dalgona coffee, cold brew float — the glass or cup as hero with beautiful layered colors visible through clear glass, fresh fruit garnish, condensation droplets on the glass, bright airy cafe counter or marble surface styling",
  korean: "authentic Korean home-food photography — correct Korean tableware (ceramic/stainless banchan bowls), steaming rice and side dishes",
  steak: "premium steak and grill photography — thick-cut steak as hero with medium-rare pink cross-section clearly visible showing juice beads, perfect char-grilled grill marks on the crust, presented on cast iron skillet or rustic wooden board, melting herb butter pat, fresh rosemary sprig garnish, side of roasted vegetables or golden fries, rich warm steakhouse-amber lighting with slight smoke wisps rising, extreme close-up showing seared crust texture and juicy interior",
  beverage: "beverage & coffee photography — the drink as hero with condensation or gentle steam, clean cafe-counter styling",
  finedining: "fine-dining plated photography — elegant minimal plating on a large plate, upscale restaurant styling",
  healthy: "healthy & salad photography — vibrant crisp fresh vegetables, clean bright wellness styling",
  street: "Korean street & snack food photography — tteokbokki, gimbap, hotteok, casual vivid appetizing styling",
  homecook: "home-cooking ingredients & prep — fresh raw ingredients on a rustic wooden board, natural cooking-in-progress feel",
  flatlay: "top-down food flat lay — neatly arranged dishes and props shot straight down, balanced negative space",
  piw: "food product isolation on seamless pure white background — the dessert, dish, or beverage as a clean commercial product hero shot, even shadow-free wrap-around studio lighting, product fills 60-80% of frame with pure white surroundings, tack-sharp front-to-back, no table surface or environment visible, premium e-commerce catalog aesthetic",
  mealprep: "meal-prep & Korean dosirak lunchbox photography — food packed in DIVIDED containers with separate compartments (clear glass meal-prep boxes with snap lids, stainless dosirak trays with dividers): steamed rice in its OWN compartment, each side dish neatly in its OWN separate well, portions never touching or mixing (contents must survive being carried around); Subway-style fresh prep equally welcome — neatly wrapped sandwiches, wraps, salad bowls, fruit cups, overnight oats in stacked clear containers; BRIGHT WHITE-DOMINANT styling: pure white counter and airy white background, vibrant fresh food colors popping against white, crisp high-key daylight, neatly organized parallel rows, fresh premium-deli appeal",
};
/* 음식 자동 감지 + 공통 식욕 자극 스타일링 (장르 미선택이어도 음식이면 자동 적용) */
const FOOD_RE = /food|dish|meal|cuisine|dessert|bakery|brunch|coffee|drink|beverage|snack|breakfast|lunch|dinner|steak|grill|burger|pasta|pizza|sushi|ramen|taco|waffle|pancake|pie|pastry|cookie|macaron|croissant|donut|chocolate|cheese|yogurt|smoothie|latte|espresso|bento|sandwich|tempura|udon|omurice|takoyaki|tonkatsu|katsu|onigiri|acai|granola|brownie|tamagoyaki|음식|요리|음료|커피|디저트|베이커리|브런치|한식|간식|분식|샐러드|빵|케이크|반찬|밥|국|찌개|면|과일|채소|떡|버터떡|쿠키|두쫀쿠|약과|마카롱|크로와상|도넛|와플|스테이크|그릴|라떼|스무디|아이스크림|초콜릿|치즈|파이|타르트|도시락|밀프랩|밀프렙|런치박스|샌드위치|우동|텐푸라|오므라이스|타코야키|돈까스|카츠|주먹밥|오니기리|아사이|그래놀라|브라우니|계란말이/i;
/* 일본·한국 카페 컴포트 자동 감지 — 깅엄+파스텔 스타일링 */
const JPKR_CAFE_RE = /우동|텐푸라|오므라이스|타코야키|돈까스|카츠|주먹밥|오니기리|계란말이|아사이|그래놀라|udon|tempura|omurice|takoyaki|tonkatsu|katsu|onigiri|tamagoyaki|acai\s*bowl|깅엄|gingham|카와이|kawaii/i;
/* 밀프랩·도시락 자동 감지 — 장르 미선택이어도 칸막이 용기 + 화이트 스타일링 강제 */
const MEALPREP_RE = /도시락|밀프랩|밀프렙|런치박스|dosirak|meal\s*prep|bento|lunch\s*box/i;
/* 밝고 초근접 실사 인스타 느낌이 음식 판매의 기본 — 어두운 무드샷은 안 팔린다 */
const FOOD_STYLING = "bright airy well-lit food photography, extreme close-up macro with the dish as hero filling almost the whole frame, mouth-watering Instagram appeal, fresh realistic textures you can almost taste, vibrant true-to-life color, tasteful garnish, visible steam on hot dishes and condensation on cold drinks, soft shallow depth of field, clean surface";
/* 탑뷰 전용 스타일링 — 접사·얕은심도 표현을 뺀 변형(탑뷰는 전 영역 초점·용기 전체 노출이 원칙) */
const FOOD_STYLING_TOPVIEW = "bright airy well-lit food photography, mouth-watering Instagram appeal, fresh realistic textures you can almost taste, vibrant true-to-life color, tasteful garnish, visible steam on hot dishes and condensation on cold drinks, clean surface";
/* 음식 전용 가드 — 상업 가드의 보케·얕은심도 금지를 뒤집는다(음식은 배경 흐림이 판매 포인트) */
const FOOD_GUARD = "bright and appetizing with soft natural light, the dish tack-sharp in tight close-up, gently blurred background welcome, no dark or moody underexposure, no dull flat color, no plastic gloss, no fake sheen, no cluttered background, no crowd";
/* 상업 음식 조명 시그니처 — 표준 세트업을 코드화: 뒤쪽 45도 주광(back-side light)으로 음식이 빛나고 질감·김이 살고,
   앞쪽 흰 반사판으로 그림자를 정리, 측면 레이킹광으로 표면 질감, 배경은 음식보다 단순·약간 깊게 두어 음식이 먼저 읽히게.
   ※ 전부 긍정문으로 서술(미드저니가 부정어를 유인어로 읽는 사고 방지) ※ 흰배경 제품컷(PIW)은 균일 무영 광이 정답이라 제외 */
const FOOD_LIGHT = "lit with a soft key light from behind at about a 45-degree back-side position so the food glows and its texture, sheen and any rising steam catch the light, a white bounce card in front opening up the shadows to keep clean bright detail, a gentle raking side light across the surface bringing out appetizing texture, and the background kept simpler and a touch deeper in tone than the dish so the food cleanly separates and reads first, with the edges of the food staying bright and well defined, one unified light direction across the whole scene";
/* 요리 형태별 최적 카메라 앵글 — 상업 음식 사진 표준을 코드화. 평평/구성형 → 탑뷰, 액체/높은잔·국물 → 아이레벨,
   높이/층 → 45도, 그 외 → 45도(둘 다 보여야 하는 음식의 무난값). 사용자가 앵글을 직접 고르면 존중(자동일 때만 적용). */
const FOOD_TOPVIEW_RE = /샐러드|밀프랩|밀프렙|도시락|런치박스|플랫레이|한상|한정식|밥상|반찬|그래놀라|아사이|포케|비빔|피자|salad|meal[\s-]*prep|bento|lunch[\s-]*box|dosirak|flat[\s-]*lay|granola|acai|poke\b|bibim|pizza|platter|charcuterie|spread|grain\s*bowl|buddha\s*bowl/i;
/* 주의: JS의 \b는 한글 주위에서 동작하지 않아 '국' 단독은 한국·중국을 오탐 → 국물·찌개·탕류는 복합어로만 매칭 */
const FOOD_EYELEVEL_RE = /음료|커피|라떼|스무디|에이드|레모네이드|주스|국물|찌개|전골|설렁탕|곰탕|육개장|스프|수프|라면|쌀국수|칵테일|와인|맥주|beverage|drink|coffee|latte|cappuccino|smoothie|milkshake|\bade\b|lemonade|juice|\btea\b|soup|broth|stew|ramen|\bpho\b|noodle\s*soup|einspanner|frappe|cocktail|\bwine\b|\bbeer\b/i;
const FOOD_ANGLE45_RE = /버거|햄버거|샌드위치|파스타|케이크|스테이크|오므라이스|리조또|리조토|팬케이크|와플|크로와상|디저트|타르트|파이|마카롱|토스트|파르페|도넛|꽈배기|브라우니|burger|sandwich|pasta|cake|steak|omurice|risotto|pancake|waffle|croissant|dessert|tart|\bpie\b|macaron|toast|parfait|donut|brownie|hotdog/i;
function pickFoodAnglePhrase(themeAll) {
  if (FOOD_TOPVIEW_RE.test(themeAll)) return "shot straight down as a 90-degree top-down flat lay so every component reads at a glance, evenly focused with balanced negative space";
  if (FOOD_EYELEVEL_RE.test(themeAll)) return "shot at eye level straight-on so the height of the glass or bowl and the layers, steam or broth depth are fully visible";
  if (FOOD_ANGLE45_RE.test(themeAll)) return "shot at a 45-degree three-quarter angle so both the height and layers and the top surface are visible with natural depth";
  return "shot at a natural 45-degree three-quarter angle for versatile depth and dimensionality";
}
/* 음식 단독 주제 풀프레임 전달 규칙 — 어도비는 크롭을 구매자 몫으로 두므로, 전달 이미지에는 음식과 모든
   접시·그릇·트레이·뚜껑·포장 용기가 가장자리 짤림 0으로 온전히 들어와야 한다.
   전 앵글(탑뷰·45도·아이레벨) 공통으로 적용. 긍정문으로 서술(미드저니 부정어 유인 방지). */
const FOOD_FULLFRAME = "the food is the sole subject and must be shown COMPLETE and uncropped: the entire dish together with every plate, bowl, tray, lid, wrapper and packaging container is kept whole and fully inside the frame, with a comfortable safe margin of clean space on all four sides so the subject stays well clear of every edge (Adobe buyers do their own cropping, so the delivered shot must contain the whole food and its full packaging intact)";
/* 탑뷰 전용 — 짤림 방지 + 전 영역 딥DOF(블러·얕은심도 불가). 45도·아이레벨은 배경 얕은심도 허용 */
const FOOD_TOPVIEW_FULLFRAME = `${FOOD_FULLFRAME}; the whole subject is rendered tack-sharp and fully in focus from corner to corner with deep front-to-back depth of field, every part of the food and its container crisply detailed and evenly sharp`;
/* 디지털 업무(POS·태블릿·재고·온라인) 자동 감지 — 카페/식당/가게가 '배경'일 뿐 주인공은 디지털 업무인 장면.
   이게 잡히면 음식 접사·라이프스타일 흐림·헬스케어 오분류를 억제하고 '선명한 상업 업무샷'으로 강제한다. */
const WORK_TECH_RE = /\bPOS\b|키오스크|kiosk|태블릿|tablet|노트북|laptop|바코드|barcode|스캐너|스캔|scanner|재고|inventory|대시보드|dashboard|스마트폰|smartphone|\bmobile\b|online\s*(?:order|listing|stock|booking|sale)|온라인\s*(?:주문|판매|예약|재고)|디지털\s*전환|스마트\s*(?:업무|스토어|워크|오더|가게)|결제|payment|예약\s*(?:관리|시스템|잡|확인)|appointment|주문\s*(?:관리|접수|확인|큐|queue)/i;
/* 디지털 업무 시그니처 — 기기·화면·손은 선명, 작업공간과 배경까지 또렷(깊은 심도), 밝은 상업 톤. 과한 아웃포커싱 차단 */
const WORK_TECH_STYLING = "the digital device and the work itself are the clear hero — screen, hands and product tack-sharp; deep depth of field with the whole workspace and background clearly in focus and readable (no heavy background blur, no strong bokeh); bright clean modern commercial business photography";
/* 테크 하드웨어(반도체·칩·서버·로봇 등) 자동 감지 — 어도비 대량 거절 패턴인 '다크 네온 SF 렌더' 차단.
   이 장르 승인 공식 = 밝은 클린룸/랩 or 심리스 배경의 프리미엄 제품컷 (발광·홀로그램·어두운 방 금지) */
const TECH_PRODUCT_RE = /반도체|웨이퍼|팹|파운드리|칩셋|마이크로칩|프로세서|회로|기판|퀀텀|양자|슈퍼컴|데이터\s*센터|서버|배터리|이차전지|로봇|드론|인공지능|반도체\s*장비|semiconductor|wafer|foundry|microchip|chipset|processor|\bCPU\b|\bGPU\b|circuit|\bPCB\b|motherboard|quantum|supercomputer|data\s*center|server\s*(?:room|rack|farm)|\bbattery\b|robotics|\brobots?\b|\bdrones?\b|artificial\s*intelligence|machine\s*learning|\bfusion\b|reactor/i;
/* 테크 제품컷 시그니처 — 실물 하드웨어를 프리미엄 B2B 제품 사진처럼: 밝은 배경·균일광·실물 재질·발광 없음 (부정문 없이 서술해 MJ 안전) */
const TECH_PRODUCT_STYLING = "real physical hardware as the hero, staged like premium commercial product photography: bright seamless light backdrop or bright clean modern lab, even soft studio-grade lighting, true-to-life materials (matte silicon, brushed aluminum, realistic fiberglass board), calm powered-down surfaces, tack-sharp front-to-back, bright well-exposed clean image";
/* 깨끗한 상업 배경 강제 — 미드저니가 배경을 날릴 거리가 없게, 미니멀·고급·선명한 세트처럼.
   ('스튜디오'라는 단어는 쓰지 않되 스튜디오처럼 깨끗·미니멀. 창밖 거리·차·조명 보케·산만한 진열 금지) */
const CLEAN_STUDIO_BG = "background is a clean, minimal, high-end interior kept simple, tidy and uncluttered with plenty of calm empty space, rendered fully sharp and in focus front-to-back like a crisp commercial set; NO window view onto an outdoor street, NO passing traffic or pedestrians, NO glowing out-of-focus city lights or bokeh light spots, NO busy cluttered shelves, hanging signage or crowd behind the subject — the setting stays premium, simple and distraction-free";
/* 흰배경 제품격리 (Product-on-White, PIW) — 어도비 대량 승인 공식: 시즌/테마별 오브젝트를 심리스 화이트 위에 격리 촬영.
   초콜릿 케이크 50컷, 발렌타인 소품 1600+컷, 7월4일 BBQ·불꽃놀이 소품 등 대량 배치에 최적.
   인물 없는 순수 오브젝트 중심 — 어도비 + 미캔 + e-commerce 동시 소화 */
const PIW_RE = /제품\s*컷|제품\s*격리|흰\s*배경|화이트\s*배경|심리스|오브젝트\s*격리|정물|product\s*(?:isolation|shot|on[\s-]*white|cutout)|white\s*background|seamless\s*(?:white|background)|still[\s-]*life|e[\s-]*commerce|studio\s*product/i;
const PIW_STYLING = "clean product isolation photography on a seamless pure white background: the product or arrangement as hero filling 60-80% of frame, shot from a natural slightly elevated angle or straight-on eye level, even soft wrap-around studio lighting from all sides eliminating harsh shadows, crisp tack-sharp focus across the entire product front-to-back, true-to-life color and realistic surface texture, premium commercial catalog aesthetic";
const PIW_GUARD = "seamless pure white background only, even shadow-free wrap-around studio lighting, every product surface tack-sharp, no background scenery or environment, no floor line or horizon visible, no props outside the core arrangement, no people, no text";
/* 인물 등장 조건 4단계 (People Selector) */
const REEDO_PEOPLE = {
  auto: "선택 안함 (AI 자율)",
  none: "인물 없음 (순수 공간/장비)",
  few: "없거나 1~2명 (소수 집중)",
  small: "최대 3명 (소규모 단체)",
};
/* 초안 브레인 주입용 (auto는 제약 없음 → 빈 문자열이라 refinementLine에서 스킵) */
const REEDO_PEOPLE_PHRASE = {
  auto: "",
  none: "absolutely NO people, no faces, no hands, no body parts, no mannequins, no reflections of humans — render pure space or equipment layout only, no model release needed",
  few: "at most 1-2 people, calm solitary or single-person focused workout mood, never a crowd",
  small: "a small group of at most 3 people (an intimate club vibe or a quiet one-on-one PT session), strictly NO large audience, NO bleachers of spectators, NO crowd",
};
/* 최종 이미지 프롬프트 주입용 — 부정 키워드까지 강하게 (auto는 미적용) */
const PEOPLE_FINAL = {
  none: "no people, clean space only",
  few: "1-2 people only, no crowd",
  small: "small group of max 3 people, no crowd",
};

/* 손 등장 셀렉터 — 음식·제품샷에서 손 포함 여부를 사용자가 직접 선택 (손이 꼭 들어가야 하는 건 아님) */
const REEDO_HANDS = {
  auto: "선택 안함 (AI 자율)",
  with: "손 포함 (핸즈온)",
  without: "손 없음 (순수 스타일링)",
};
/* 초안 브레인 주입용 */
const REEDO_HANDS_PHRASE = {
  auto: "",
  with: "most scenes include natural human hands interacting with the subject (packing, holding, arranging, pouring) — hands only, no face required",
  without: "absolutely NO hands, fingers, arms or any human presence in any scene — pure unattended styled still shots only",
};
/* 최종 이미지 프롬프트 주입용 (without은 MJ 안전을 위해 부정문 없이 서술) */
const HANDS_FINAL = {
  with: "natural hands interacting with the subject, hands only",
  without: "unattended styled still-life shot, the subject alone",
};

/* 톤(판매 미학) — 2026 베스트셀러 조사 기반: 믿을 수 있는 실사가 팔린다.
   네온 SF 판타지(AI티)도, 무균실 미니멀(AI티)도 아닌 "진짜 찍은 듯한" 상업 사진이 기본값 */
const REEDO_TONE = {
  realism: "판매 리얼 (베스트셀러·기본)",
  bright: "밝은 미니멀",
  lifestyle: "라이프스타일 온기",
  cinematic: "시네마틱 무드",
  concept: "미래 컨셉 (밝은 클린테크)",
};
/* concept 톤 주의: 기존 '네온 SF 렌더'는 어도비가 노이즈·소프트포커스·아티팩트로 대량 거절
   → 밝은 클린테크 컨셉(잘 팔리는 B2B 미래 이미지)으로 구조 변경 */
const TONE_PHRASE = {
  realism: "believable real-world commercial photo, natural lighting, realistic materials and true color — no sci-fi, no neon, no CGI perfection",
  bright: "bright airy minimal look, soft daylight, clean neutral palette",
  lifestyle: "warm lifestyle photo, natural golden light, cozy real space",
  cinematic: "cinematic moody lighting, rich atmosphere, still a believable real scene",
  concept: "clean bright futuristic concept look, high-tech atmosphere in a bright well-lit environment, subtle cool accent tones, believable realistic materials",
};

/* 두뇌(에이전트) 라벨 · 기본 모델
   Claude API는 CORS로 브라우저 직접 호출 불가 → GPT/Gemini만 지원 */
const BRAIN_LABELS = { gpt: "GPT(Codex 계열)", gemini: "Gemini" };
const GPT_MODEL_DEFAULT = "gpt-5-mini";
const GEMINI_MODEL_DEFAULT = "gemini-3.1-flash";
/* 선택 가능한 모델 프리셋 (직접 입력도 가능) */
const GPT_MODEL_PRESETS = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4o"];
const GEMINI_MODEL_PRESETS = ["gemini-3.1-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro", "gemini-2.5-flash", "gemini-2.5-pro"];

const pad2 = (n) => String(n).padStart(2, "0");
const cleanName = (s, n) => (s || "").toLowerCase().replace(/[^가-힣A-Za-z0-9-]/g, "").substring(0, n);

/* SEO 키워드 정규화: 앞순서(중요도) 유지 · 공백정리 · 대소문자 무시 중복 제거 · 상한 컷 */
const normKeywords = (raw, max) => {
  const seen = new Set();
  return String(raw || "")
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter((k) => {
      if (!k) return false;
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max)
    .join(", ");
};

/* 키워드 미달 시 제목·주제·소품에서 자동 보충 — Adobe(EN 35개)·미캔(KR 25개) 공용 */
const KW_STOP_EN = new Set(["the","a","an","of","and","with","in","on","for","at","to","by","is","are","its","from","into","over"]);
const KW_STOP_KR = new Set(["그","이","저","것","수","등","및","의","에","를","을","은","는","로","와","과","도","가"]);
const MIRI_MAX_KEYWORDS = 25;

const padKeywordsEN = (item, max) => {
  const base = normKeywords(item.keywords, max);
  const list = base ? base.split(", ") : [];
  if (list.length >= max) return base;
  const seen = new Set(list.map((k) => k.toLowerCase()));
  const pool = `${item.title || ""} ${item.subject || ""} ${item.props || ""} ${item.lighting || ""} ${item.palette || ""}`
    .toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 3 && !KW_STOP_EN.has(w) && !seen.has(w));
  for (const w of pool) {
    if (list.length >= max) break;
    list.push(w); seen.add(w);
  }
  return list.join(", ");
};
const padKeywordsKR = (item, max) => {
  const base = normKeywords(item.keywords_kr, max);
  const list = base ? base.split(", ") : [];
  if (list.length >= max) return base;
  const seen = new Set(list);
  const pool = `${item.title_kr || ""} ${item.subject || ""} ${item.props || ""}`
    .replace(/[^가-힣\s]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 2 && !KW_STOP_KR.has(w) && !seen.has(w));
  for (const w of pool) {
    if (list.length >= max) break;
    list.push(w); seen.add(w);
  }
  return list.join(", ");
};

/* 응답 텍스트 → JSON 파싱 (세 두뇌 공용) */
function extractJSON(text, who) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error(`${who} 응답에서 JSON을 찾지 못했습니다.`);
  return JSON.parse(clean.slice(s, e + 1));
}

/* ── 두뇌 A: GPT (OpenAI 키 · Codex 계열) ── */
async function askGPT(key, model, system, user, imageBlock) {
  if (!key) throw new Error("GPT: OpenAI API 키가 없습니다.");
  const userContent = imageBlock
    ? [{ type: "text", text: user }, { type: "image_url", image_url: { url: `data:${imageBlock.mime};base64,${imageBlock.data}` } }]
    : [{ type: "text", text: user }];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model || GPT_MODEL_DEFAULT,
      messages: [{ role: "system", content: system }, { role: "user", content: userContent }],
      response_format: { type: "json_object" },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`GPT: ${data.error.message}`);
  const text = data.choices?.[0]?.message?.content || "";
  return extractJSON(text, "GPT");
}

/* ── 두뇌 B: Gemini (Google AI 스튜디오 키) ──
   2026-06 이후 구글은 URL `?key=` 방식 대신 `x-goog-api-key` 헤더 방식을 표준으로 강제한다.
   신규 AQ 키는 URL 쿼리 방식이 종종 401/403을 뱉으므로 헤더 방식으로 통일. */
const geminiHeaders = (key) => ({
  "Content-Type": "application/json",
  "x-goog-api-key": key,
});
const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model || GEMINI_MODEL_DEFAULT}:generateContent`;

async function askGemini(key, model, system, user, imageBlock) {
  if (!key) throw new Error("Gemini: Google API 키가 없습니다.");
  const parts = imageBlock
    ? [{ text: user }, { inlineData: { mimeType: imageBlock.mime, data: imageBlock.data } }]
    : [{ text: user }];
  const res = await fetch(geminiUrl(model), {
    method: "POST",
    headers: geminiHeaders(key),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Gemini: ${data.error.message}`);
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join("\n");
  return extractJSON(text, "Gemini");
}

/* ── Gemini + 구글 검색 그라운딩: 오늘의 추천용 (실시간 트렌드·뉴스 반영) ── */
async function askGeminiGrounded(key, model, system, user) {
  if (!key) throw new Error("Gemini(검색): Google API 키가 없습니다.");
  const res = await fetch(geminiUrl(model), {
    method: "POST",
    headers: geminiHeaders(key),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      tools: [{ google_search: {} }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Gemini(검색): ${data.error.message}`);
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join("\n");
  return extractJSON(text, "Gemini(검색)");
}

/* ── 이미지 생성 (사용자 키 · 메모리에만 유지) ── */
async function genGemini(key, prompt, aspect) {
  if (!key) throw new Error("Gemini: Google API 키가 없습니다.");
  const res = await fetch(geminiUrl("gemini-2.5-flash-image"), {
    method: "POST",
    headers: geminiHeaders(key),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: aspect } },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Gemini: ${data.error.message}`);
  const part = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
  if (!part) throw new Error("Gemini가 이미지 데이터를 반환하지 않았습니다.");
  return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
}
async function genOpenAI(key, prompt, aspect, quality) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: OPENAI_SIZE[aspect] || "1536x1024", quality: quality || "medium" }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI가 이미지 데이터를 반환하지 않았습니다.");
  return `data:image/png;base64,${b64}`;
}
/* ── 해상도 유틸: 어도비 최소 4MP — 저해상도 감지 + ZIP 저장 시 자동 업스케일(Lanczos+샤픈) ── */
const ADOBE_MIN_MP = 4e6;
const picaInst = new Pica();
const loadImgEl = (dataUrl) => new Promise((resolve, reject) => {
  const i = new Image();
  i.onload = () => resolve(i);
  i.onerror = () => reject(new Error("이미지 로드 실패"));
  i.src = dataUrl;
});
const getDims = async (dataUrl) => {
  const i = await loadImgEl(dataUrl);
  return { w: i.width, h: i.height };
};
/* 4MP 미만이면 Lanczos 리샘플 + 언샤프 마스크로 4MP 이상 JPEG 생성 (어도비 바로 업로드용) */
async function upscaleForAdobe(dataUrl) {
  const img = await loadImgEl(dataUrl);
  const mp = img.width * img.height;
  if (mp >= ADOBE_MIN_MP) {
    const c0 = document.createElement("canvas");
    c0.width = img.width; c0.height = img.height;
    c0.getContext("2d").drawImage(img, 0, 0);
    return { jpeg: c0.toDataURL("image/jpeg", 0.92), w: img.width, h: img.height, factor: 1 };
  }
  const factor = Math.min(3, Math.ceil(Math.sqrt((ADOBE_MIN_MP * 1.08) / mp) * 100) / 100);
  const src = document.createElement("canvas");
  src.width = img.width; src.height = img.height;
  src.getContext("2d").drawImage(img, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = Math.round(img.width * factor);
  dst.height = Math.round(img.height * factor);
  await picaInst.resize(src, dst, { unsharpAmount: 55, unsharpRadius: 0.6, unsharpThreshold: 2 });
  return { jpeg: dst.toDataURL("image/jpeg", 0.92), w: dst.width, h: dst.height, factor };
}

/* ── 무료 엔진 C: Pollinations (Flux · 가입/키 불필요 · 과금 없음) ──
   무료(익명) 티어는 긴 변을 ~1024px로 제한한다. 이보다 큰 값을 요청하면 작게 생성한 뒤
   요청 크기로 강제로 늘려(가로 stretch) 채우므로, 긴 변=1024로 맞춘 정확 비율만 사용한다. */
const POLLI_SIZE = { "1:1": [1024, 1024], "16:9": [1024, 576], "4:3": [1024, 768], "3:4": [768, 1024], "9:16": [576, 1024] };
async function genPollinations(prompt, aspect) {
  const [w, h] = POLLI_SIZE[aspect] || [1024, 576];
  const seed = Math.floor(Math.random() * 1e9); // 같은 프롬프트도 매번 새 이미지
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations: HTTP ${res.status}${res.status === 429 ? " (무료 속도 제한 — 잠시 후 자동 재시도)" : ""}`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Pollinations가 이미지를 반환하지 않았습니다.");
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Pollinations 이미지 변환 실패"));
    fr.readAsDataURL(blob);
  });
}

/* 이코노미 2패스 마감: 승인된 low 드래프트를 참조 이미지로 넣어 같은 구도를 고품질로 리렌더
   (gpt-image는 시드 고정이 없어 그냥 재생성하면 다른 그림이 나옴 → 편집 API로 구도 유지) */
async function genOpenAIRefine(key, prompt, refDataUrl, aspect, quality) {
  const blob = await (await fetch(refDataUrl)).blob();
  const fd = new FormData();
  fd.append("model", "gpt-image-1");
  fd.append("image", blob, "draft.png");
  fd.append("prompt", `Re-render this exact scene at maximum fidelity for stock delivery: keep the SAME composition, subject placement, props, palette and lighting as the reference; make the whole main subject tack-sharp, correct any exposure issues (recover highlight/shadow detail), eliminate noise, banding, halos and AI-plastic textures; crisp natural micro-texture, no filter or vignette look. ${prompt}`);
  fd.append("size", OPENAI_SIZE[aspect] || "1536x1024");
  fd.append("quality", quality || "medium");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd,
  });
  const data = await res.json();
  if (data.error) throw new Error(`OpenAI(마감): ${data.error.message}`);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 마감 리렌더가 이미지를 반환하지 않았습니다.");
  return `data:image/png;base64,${b64}`;
}

/* 슬롯 필드 → 최종 이미지 프롬프트 (짧고 핵심적인 판매 프롬프트) */
function buildSlotPrompt(slot, mode, tone = "realism", people = "auto", koreanCast = false, hands = "auto") {
  const isIllust = slot.kind === "illustration";
  const anglePick = CAMERA_ANGLES[slot.angle]?.phrase || "";
  const isTight = slot.angle === "closeup" || slot.angle === "macro";
  /* 사용자가 앵글을 지정하지 않았을 때(자동)만 요리 형태별 최적 앵글을 유도해 넣는다 (지정 시 사용자 의도 존중) */
  const foodAuto = !slot.angle || slot.angle === "auto";
  const isEmotional = mode === "emotional";
  const themeAll = `${slot.subject || ""} ${slot.title || ""} ${slot.keywords || ""} ${slot.props || ""}`;
  /* 디지털 업무(POS·태블릿·재고·온라인)가 주인공이면 음식/라이프스타일/헬스케어 오분류를 억제하고 선명한 상업 업무샷으로 */
  const isWorkTech = !isIllust && WORK_TECH_RE.test(themeAll);
  /* 테크 하드웨어(반도체·칩·서버·로봇) 제품컷 강제는 '상업 모드'에서만 — 배경화면·감성 모드의 테크는
     네온·어둠·글로우가 오히려 판매 미학(승인됨)이라 밝은 제품컷으로 뭉개지 않는다.
     (어도비 거절은 '선명해야 할 상업 제품/인물컷'이 소프트할 때 나지, 분위기용 배경화면에선 안 남) */
  const isTechProduct = !isIllust && mode !== "wallpaper" && !isEmotional && TECH_PRODUCT_RE.test(themeAll);
  /* 흰배경 제품격리 (PIW) — 심리스 화이트 위 오브젝트 격리 촬영. 음식·라이프스타일보다 우선 (food close-up 구도 대신 PIW 구도) */
  const isPIW = !isIllust && !isWorkTech && PIW_RE.test(themeAll);
  /* 음식은 밝은 초근접 실사 인스타 느낌이 기본 — PIW가 잡히면 PIW 스타일 우선 (디지털 업무 장면도 제외) */
  const isFood = !isIllust && !isWorkTech && !isPIW && FOOD_RE.test(themeAll);
  /* 일본·한국 카페 컴포트 — 깅엄 체크 + 파스텔 접시 카와이 스타일링. 어도비 배치 승인 검증 완료 */
  const isJpkrCafe = !isIllust && !isPIW && JPKR_CAFE_RE.test(themeAll);
  /* 밀프랩·도시락 — 칸막이 용기(밥·반찬 분리) + 화이트 하이키 스타일링 강제. 음식 접사 구도보다 우선 */
  const isMealprep = !isIllust && !isPIW && MEALPREP_RE.test(themeAll);
  /* 미캔 라이프스타일 — 부동산·가족·솔로 데일리·골프 등 밝은 홈 미학 (감성·음식·PIW·디지털업무 아닐 때만) */
  const isMiriLifestyle = !isIllust && !isEmotional && !isFood && !isPIW && !isWorkTech && MIRI_LIFESTYLE_RE.test(themeAll);
  /* 어도비 헬스케어 — 글로벌 다양성 상업 구도 (감성·음식·PIW·미캔라이프·디지털업무 아닐 때) */
  const isHealthcare = !isIllust && !isEmotional && !isFood && !isPIW && !isMiriLifestyle && !isWorkTech && HEALTHCARE_RE.test(themeAll);
  /* 한국 명시 시 어도비 글로벌 다양성 규칙 억제 (Korean 캐스팅 유지)
     — 슬롯 영어 텍스트에 Korean이 없어도, 주제/지역이 한국이면(koreanCast) 강제 */
  const isKoreanExplicit = koreanCast || KOREAN_EXPLICIT_RE.test(themeAll);
  /* 음식(밀프랩 포함)이 탑뷰로 잡히는 경우 — 피사체·포장 용기 전체가 짤리지 않고 프레임 안에, 전 영역 탁샤프(블러 불가).
     jpkr_cafe(어도비 승인 소프트-소품 공식)는 건드리지 않도록 제외 */
  const isFoodTopview = (isFood || isMealprep) && !isPIW && !isJpkrCafe &&
    (slot.angle === "top_down" || (foodAuto && FOOD_TOPVIEW_RE.test(themeAll)));
  /* 음식 전 앵글 풀프레임 — 탑뷰뿐 아니라 45도·아이레벨에서도 포장 용기까지 짤림 0 (클로즈업/매크로 제외) */
  const isFoodAny = (isFood || isMealprep) && !isPIW && !isJpkrCafe && !isTight;
  /* 클로즈업/매크로를 명시 선택한 경우엔 여백 규칙을 완화 (사용자 의도 존중) */
  const comp = mode === "wallpaper"
    ? `40-60% clean copy space opposite the subject (${slot.copy_space || "clean margin"})`
    : isEmotional
      ? `wide emotional background for text overlay: subject off to one side, 45-60% low-detail copy space with a calm darker zone where Korean text will be placed (${slot.copy_space || "open sky or soft area"})`
      : isPIW
        ? "product or arrangement hero on seamless pure white background, filling 60-80% of frame, slightly elevated 30-degree angle or straight-on eye level, centered composition with pure white negative space"
        : isJpkrCafe
          ? "cute cafe comfort food as hero filling 70-85% of frame on a gingham check fabric background (pink or blue gingham), pastel ceramic plate, overhead or 45-degree angle, warm cozy kawaii cafe aesthetic, food sharply focused with fabric and props as soft context"
          : isMealprep
          ? "neatly organized divided meal-prep containers as hero on a bright white counter, shot overhead or at a 45-degree angle, tidy parallel arrangement, everything crisply in focus, airy white-dominant frame"
          : isFood
            ? (isTight ? "extreme close-up macro food shot, the dish fills almost the entire frame, tight appetizing crop, shallow depth of field with the food tack-sharp"
              : isFoodTopview
                ? ["appetizing top-down food photography, the whole dish and its container fully composed within the frame with clean margin on every side", foodAuto ? pickFoodAnglePhrase(themeAll) : "", "everything evenly sharp and fully in focus"].filter(Boolean).join(", ")
                : ["appetizing food photography, the dish as hero filling most of the frame", foodAuto ? pickFoodAnglePhrase(themeAll) : "", "natural appealing crop, shallow depth of field with the food tack-sharp"].filter(Boolean).join(", "))
          : isMiriLifestyle
            ? `subject placed to one side of the frame, 45-55% low-detail clean area on the opposite side reserved for Korean text overlay (${slot.copy_space || "soft wall or window light area"}), gentle background blur, natural relaxed pose`
            : isTight
              ? "tight detail shot, subject sharply focused"
              : `subject fills 50-70% of frame with ~30% clean copy space (${slot.copy_space || "for text overlay"}), rule-of-thirds, subject fully in frame`;
  const camera = [anglePick, slot.camera].filter(Boolean).join(", ")
    || (isIllust ? "clean vector edges" : "natural depth of field");
  /* 감성 모드는 골든아워·빛내림 · 그 외 실내/사무 주제(밤 아님)는 중립 화이트밸런스 */
  const themeText = `${slot.subject || ""} ${slot.title || ""} ${slot.keywords || ""}`;
  const atmosphere = isEmotional
    ? EMOTIONAL_ATMOS
    : !isIllust && INDOOR_RE.test(themeText) && !NIGHT_RE.test(themeText)
      ? "neutral daylight white balance, no yellow cast"
      : "";
  /* 밝기 강제: 감성/무디풍경/시네마틱 톤/밤·일몰 명시 아닐 때만 적용 (상업 슬롯 기본 판매 규칙) */
  const moodyOk = isEmotional || tone === "cinematic" || MOODY_ALLOWED_RE.test(themeText) || NIGHT_RE.test(themeText);
  const brightLine = !isIllust && !moodyOk ? BRIGHT_ENFORCEMENT : "";
  const toneLine = isIllust ? "" : TONE_PHRASE[tone] || TONE_PHRASE.realism;
  const peopleLine = PEOPLE_FINAL[people] || "";
  /* 손 포함/미포함 사용자 선택 — auto면 초안(두뇌)이 정한 대로 둔다 */
  const handsLine = HANDS_FINAL[hands] || "";
  /* 한국 주제/지역이면 인물을 반드시 한국인으로 캐스팅 (인물 없음 모드는 제외) */
  const koreanCastLine = !isIllust && isKoreanExplicit && people !== "none"
    ? "all people shown are authentically Korean with natural East Asian Korean facial features, hair and styling (NOT Western or Caucasian, NOT Southeast Asian)"
    : "";
  const propsLine = slot.props ? `props: ${slot.props}` : "";
  /* 재생성 피드백 루프: 직전 거절 사유를 교정 지시로 주입 → 같은 실수 반복 차단 */
  const fixLine = slot.qcNote
    ? `FIX (was rejected): ${slot.qcNote}`
    : slot.regenCount > 0
      ? "clearly different composition from before"
      : "";
  const quality = isIllust
    ? "professional stock illustration"
    : "professional stock photo, tack-sharp focus, even exposure, clean and noise-free, natural texture, no plastic AI look";
  /* 신앙·워십 장르면 backlit 금지 대신 골든아워 역광·십자가 실루엣을 허용 (판매 포인트) */
  const isFaith = !isIllust && FAITH_RE.test(themeText);
  /* 순수 상업(디지털 업무 포함) — 감성/신앙/음식/PIW/미캔라이프/헬스케어/배경화면이 아닌 슬롯.
     이때 배경을 깨끗·미니멀·선명하게 강제해서 미드저니의 과한 배경 아웃포커싱을 차단 */
  const isCleanCommercial = !isIllust && mode !== "wallpaper" && !isEmotional && !isFaith && !isFood && !isPIW && !isMiriLifestyle && !isHealthcare;
  return [
    slot.subject,
    fixLine,
    NO_TEXT_LOCK,
    propsLine,
    comp,
    `camera: ${camera}`,
    `lighting: ${slot.lighting || "soft natural light"}`,
    atmosphere,
    brightLine,
    toneLine,
    peopleLine,
    handsLine,
    koreanCastLine,
    `palette: ${slot.palette || "bright commercial tones"}`,
    !isIllust ? "objects rest naturally on real surfaces, nothing floating" : "",
    /* 흰배경 제품격리 시그니처 — 심리스 화이트·균일광·탁샤프·카탈로그 미학 */
    isPIW ? PIW_STYLING : "",
    /* 일본·한국 카페 컴포트 시그니처 — 깅엄+파스텔 카와이 스타일링 (어도비 승인 검증) */
    isJpkrCafe ? REEDO_FOOD_PHRASE.jpkr_cafe : "",
    /* 밀프랩·도시락 시그니처 — 칸막이 분리·화이트 하이키 (음식 접사 스타일링 대신) */
    isMealprep && !isJpkrCafe ? REEDO_FOOD_PHRASE.mealprep : "",
    /* 음식이면 밝은 초근접 실사 인스타 스타일링 + 상업 음식 조명 세트업(뒤쪽 45도 주광·반사판·배경 분리)을 직접 주입.
       탑뷰면 접사·얕은심도 표현을 뺀 변형 사용(포장 용기 전체 노출·전 영역 초점 원칙과 충돌 방지) */
    isFood && !isMealprep && !isJpkrCafe ? `${isFoodTopview ? FOOD_STYLING_TOPVIEW : FOOD_STYLING}. ${FOOD_LIGHT}` : "",
    /* 음식 단독 — 전 앵글 포장 용기 짤림 0. 탑뷰는 추가로 전 영역 딥DOF(블러 불가) */
    isFoodTopview ? FOOD_TOPVIEW_FULLFRAME : isFoodAny ? FOOD_FULLFRAME : "",
    /* 미캔 라이프스타일 시그니처 — 부동산·가족·솔로 데일리 등 밝은 홈 미학 */
    isMiriLifestyle ? MIRI_LIFESTYLE_STYLING : "",
    /* 어도비 헬스케어 시그니처 — 글로벌 다양성(한국 명시면 한국인 캐스팅) */
    isHealthcare ? (isKoreanExplicit ? HEALTHCARE_STYLING.replace("authentic diverse medical professionals", "authentic Korean medical professionals") : HEALTHCARE_STYLING) : "",
    /* 디지털 업무 시그니처 — 기기·화면·배경 모두 선명(과한 아웃포커싱 차단) */
    isWorkTech ? WORK_TECH_STYLING : "",
    /* 테크 하드웨어 시그니처 — 밝은 제품컷/클린룸 강제 (다크네온 SF = 어도비 노이즈·소프트포커스 거절) */
    isTechProduct ? TECH_PRODUCT_STYLING : "",
    /* 순수 상업 배경 강제 — 창밖 거리·보케 조명 없이 미니멀·고급·선명한 배경 */
    isCleanCommercial ? CLEAN_STUDIO_BG : "",
    quality,
    /* 분할 컷 절대 금지 — 전 장르 공통 (비교샷 명시 요청이 아니면 한 이미지는 한 장면) */
    SINGLE_FRAME_GUARD,
    GUARD,
    /* 배경화면=제외 · PIW=흰배경격리 · 감성=텍스트여백 · 신앙=골든아워 · 음식=밝은근접 · 미캔라이프=밝은홈 · 헬스케어=클리닉리얼 · 그 외=상업 배제 */
    mode === "wallpaper" ? "" : isPIW ? PIW_GUARD : isEmotional ? EMOTIONAL_GUARD : isFaith ? FAITH_GUARD : isFood ? FOOD_GUARD : isMiriLifestyle ? MIRI_LIFESTYLE_GUARD : isHealthcare ? HEALTHCARE_GUARD : COMMERCIAL_GUARD,
  ].filter(Boolean).join(". ");
}

/* ── Midjourney 형식 변환 (수동 내보내기용) ──
   핵심 원리: 미드저니는 긍정 프롬프트 속 부정문("NO street view", "NOT Western")을 이해하지 못하고
   오히려 그 단어(window·street·Western)를 유인어로 읽어 그려버린다 → 역광·창밖거리·서양인 사고의 원인.
   그래서 MJ 내보내기에서는 (1) 긍정문 안의 모든 부정 표현을 제거하거나 '원하는 것만 말하는' 문장으로 치환,
   (2) 창문/샵프론트 조명 연출을 정면광으로 치환(역광·실루엣의 실제 원인 제거),
   (3) 금지어는 --no 파라미터로만 전달, (4) 한국인 캐스팅은 맨 앞으로(미드저니는 앞 토큰에 가중치). */
const MJ_NEG_BASE = "text, letters, numbers, logo, watermark, brand name, signature, korean text, hangul, chinese characters, japanese characters, calligraphy, wall lettering, framed verse, hanging banner, embossed title, book cover text, deformed hands, extra fingers, distorted anatomy, plastic AI look, oversmoothed skin, split screen, diptych, collage, grid layout, multiple panels, side-by-side comparison";
const MJ_NEG_COMMERCIAL = "backlit, backlight, silhouette, lens flare, bokeh, blurry background, out of focus background, cluttered background, crowd, window, glass storefront, street view, traffic, pedestrians, city lights, neon sign, signage";
/* 어도비 기술 거절 3대장(노이즈·소프트포커스·아티팩트) 원천 차단 — 발광/글로우는 소프트포커스 판정, 어두운 배경은 노이즈·밴딩 온상 */
const MJ_NEG_QUALITY = "noise, film grain, banding, chroma noise, glow, bloom, halo, soft focus, hazy";
const MJ_NEG_NEON = "neon, hologram, sci-fi glow, glowing circuits, dark room, cinematic dark lighting";
const MJ_NEG_PIW = "background scenery, floor line, horizon, environment, table cloth, harsh shadow, gradient background, surface texture";
/* CLEAN_STUDIO_BG의 MJ 안전판 — 부정문 없이 원하는 배경만 서술 */
const MJ_CLEAN_BG = "backdrop is a simple tidy plain interior wall of a premium minimal space with calm empty space directly behind the subject, everything sharp and in focus front-to-back like a crisp commercial set, distraction-free";
const MJ_FRONT_LIGHT = "subject evenly lit from the front-side, key light from the camera side, bright open illumination on the subject, ";
/* 부정문 → 긍정문 치환 테이블 (모든 MJ 내보내기에 공통 적용) */
const MJ_POSITIVE_FIXES = [
  [SINGLE_FRAME_GUARD, "one single continuous unified scene filling the entire frame edge-to-edge"],
  [CLEAN_STUDIO_BG, MJ_CLEAN_BG],
  [BRIGHT_ENFORCEMENT, "bright high-key well-exposed commercial photography, plenty of ambient light, cheerful daytime feel"],
  [" (NOT Western or Caucasian, NOT Southeast Asian)", ""],
  [" (no heavy background blur, no strong bokeh)", ""],
  [" — no sci-fi, no neon, no CGI perfection", ""],
  ["small group of max 3 people, no crowd", "one to three people"],
  ["1-2 people only, no crowd", "one or two people"],
  ["no people, clean space only", "empty unattended still-life space"],
  [", nothing floating", ""],
  [", no yellow cast", ""],
  [", no plastic AI look", ""],
  [" (never stiff stock poses)", ""],
  [" — never sterile-cold, never sensationalized", ""],
];
/* 창문·샵프론트 조명 연출 → 정면광 치환 (역광·실루엣의 근본 원인 제거, 상업 슬롯 전용) */
const MJ_WINDOW_FIXES = [
  [/by the window/gi, "at the counter"],
  [/(?:soft\s+)?windows?\s+(?:day)?light/gi, "soft directional daylight"],
  [/(?:through|from)\s+(?:an?\s+|the\s+)?(?:\w+\s+){0,2}windows?/gi, "from a soft off-camera light source"],
  [/from\s+(?:the\s+)?shopfront\s+(left|right)/gi, "from the $1 side"],
  [/from\s+(?:the\s+)?shopfront/gi, "from the front"],
  [/\b(?:shopfront|storefront)\b/gi, "front counter"],
  [/\bwindows?\b/gi, "soft off-camera light source"],
  [/\bbusy street\b/gi, "tidy surroundings"],
];
function toMidjourney(slot, mode, tone, people, aspect, hands = "auto") {
  let pos = slot.finalPrompt || buildSlotPrompt(slot, mode, tone, people, false, hands);
  /* NO_TEXT_LOCK도 반드시 제거 — 미드저니는 "no Hangul/calligraphy" 속 명사를 유인어로 읽고 오히려 그린다 (--no 네거티브로만 전달) */
  pos = pos.replace(COMMERCIAL_GUARD, "").replace(EMOTIONAL_GUARD, "").replace(FAITH_GUARD, "").replace(FOOD_GUARD, "").replace(PIW_GUARD, "").replace(MIRI_LIFESTYLE_GUARD, "").replace(HEALTHCARE_GUARD, "").replace(GUARD, "").replace(NO_TEXT_LOCK, "")
    .replace(/\.\s*\.\s*/g, ". ").replace(/[.\s]+$/g, "").trim();
  /* 부정문 소독 — 미드저니가 부정 단어를 유인어로 읽는 사고 차단 */
  for (const [from, to] of MJ_POSITIVE_FIXES) pos = pos.split(from).join(to);
  const themeText = `${slot.subject || ""} ${slot.title || ""} ${slot.keywords || ""} ${slot.props || ""}`;
  /* 디지털 업무(POS·태블릿·재고·온라인)가 주인공이면 음식/라이프스타일 예외를 무시하고 선명 강제 */
  const isWorkTech = WORK_TECH_RE.test(themeText);
  /* 흰배경 제품격리 — PIW는 별도 네거티브 체계 (창문·역광 치환 불필요) */
  const isPIW = PIW_RE.test(themeText);
  /* 역광·보케 배제 = 순수 상업 + 디지털 업무 슬롯 (PIW는 자체 처리). 신앙(역광)·음식·미캔라이프(얕은 심도)는 판매 포인트라 제외하되, 디지털 업무면 선명 우선 */
  const commercialNeg = !isPIW && mode === "commercial" && (isWorkTech || (!FAITH_RE.test(themeText) && !FOOD_RE.test(themeText) && !MIRI_LIFESTYLE_RE.test(themeText)));
  if (commercialNeg) {
    for (const [re, to] of MJ_WINDOW_FIXES) pos = pos.replace(re, to);
    pos = pos.replace("lighting: ", `lighting: ${MJ_FRONT_LIGHT}`);
  }
  /* 한국인 캐스팅은 앞 토큰 가중치를 받도록 프롬프트 선두로 복제 */
  if (pos.includes("authentically Korean")) pos = `Korean East Asian people, ${pos}`;
  let neg;
  if (isPIW) {
    neg = `${MJ_NEG_BASE}, ${MJ_NEG_PIW}, ${MJ_NEG_QUALITY}`;
  } else {
    neg = commercialNeg ? `${MJ_NEG_BASE}, ${MJ_NEG_COMMERCIAL}, ${MJ_NEG_QUALITY}` : MJ_NEG_BASE;
    if (commercialNeg && tone !== "concept") neg += `, ${MJ_NEG_NEON}`;
  }
  if (people === "none") neg += ", people, person, human figure";
  /* 손 없음 선택 시 --no로 손까지 차단 (긍정 프롬프트는 부정문 없이 유지) */
  if (hands === "without") neg += ", hands, fingers, arms";
  /* 음식 포장 용기 짤림을 --no로 차단 (전 앵글). 탑뷰는 추가로 블러·얕은심도도 차단. jpkr는 소프트-소품 공식이라 제외 */
  const isFoodMJ = !isPIW && FOOD_RE.test(themeText) && !JPKR_CAFE_RE.test(themeText);
  const foodTopviewMJ = isFoodMJ &&
    (slot.angle === "top_down" || ((!slot.angle || slot.angle === "auto") && FOOD_TOPVIEW_RE.test(themeText)));
  if (foodTopviewMJ) neg += ", cropped, cut off at the edge, out of frame, partial dish, tight crop, blur, blurred background, bokeh, shallow depth of field, out of focus";
  else if (isFoodMJ) neg += ", cropped, cut off at the edge, out of frame, partial dish, partial container";
  const style = slot.kind === "illustration" ? "" : " --style raw";
  return `${pos} --ar ${aspect || "16:9"}${style} --no ${neg}`;
}

/* ── Midjourney 배치 파이프라인용 (mj_batch.py) ── */
const MJ_TONE_WORD = {
  realism: "photorealistic commercial stock photo",
  bright: "bright airy minimal commercial photo",
  lifestyle: "warm lifestyle editorial photo, golden natural light",
  cinematic: "cinematic moody commercial photo, dramatic lighting",
  concept: "clean bright futuristic concept photo, subtle cool accent tones",
};
function buildMidjourneyPrompt(slot, { aspect = "16:9", tone = "realism", people = "none" } = {}) {
  const isIllust = slot.kind === "illustration";
  const banPeople = people === "none";
  const themeText = `${slot.subject || ""} ${slot.title || ""} ${slot.keywords || ""} ${slot.props || ""}`;
  const isPIW = PIW_RE.test(themeText);
  const isFood = !isIllust && !isPIW && FOOD_RE.test(themeText);
  const isJpkrCafe = !isIllust && !isPIW && JPKR_CAFE_RE.test(themeText);
  const foodAuto = !slot.angle || slot.angle === "auto";
  const isFoodMJ = isFood && !isJpkrCafe;
  const foodTopviewMJ = isFoodMJ &&
    (slot.angle === "top_down" || (foodAuto && FOOD_TOPVIEW_RE.test(themeText)));
  const anglePhrase = CAMERA_ANGLES[slot.angle]?.phrase || slot.camera || "";
  const lead = isIllust
    ? "professional stock illustration, clean vector-like medium"
    : (MJ_TONE_WORD[tone] || MJ_TONE_WORD.realism);
  const core = [
    lead,
    slot.subject,
    slot.props ? `featuring ${slot.props}` : "",
    anglePhrase,
    isFoodMJ ? FOOD_LIGHT : slot.lighting,
    slot.palette,
    foodTopviewMJ
      ? "the whole dish and all containers fully inside the frame with clean margin on every side, everything evenly sharp with deep depth of field"
      : isFoodMJ
        ? "the whole dish and all containers fully inside the frame with clean margin on every side"
        : "",
    slot.copy_space ? `clean negative space (${slot.copy_space})` : "clean negative space for text overlay",
    isIllust ? "" : "tack-sharp, natural true-to-life color, no plastic AI look",
  ].filter(Boolean).join(", ");
  let neg = `text, letters, numbers, logo, watermark, signature, korean text, hangul, calligraphy, wall lettering, framed verse, hanging banner, book cover text, split screen, diptych, collage, grid layout${banPeople ? ", people" : ""}`;
  if (foodTopviewMJ) neg += ", cropped, cut off at the edge, out of frame, partial dish, tight crop, blur, blurred background, bokeh, shallow depth of field, out of focus";
  else if (isFoodMJ) neg += ", cropped, cut off at the edge, out of frame, partial dish, partial container";
  const params = [];
  if (!isIllust) params.push("--style raw");
  params.push(`--no ${neg}`);
  params.push(`--ar ${aspect}`);
  return `${core} ${params.join(" ")}`.replace(/\s+/g, " ").trim();
}

export default function App() {
  /* ── 두뇌(에이전트) 설정 ── */
  const [brain, setBrain] = useState("gpt"); // gpt | gemini
  const [autoFallback, setAutoFallback] = useState(true);
  const [gptModel, setGptModel] = useState(GPT_MODEL_DEFAULT);
  const [geminiModel, setGeminiModel] = useState(GEMINI_MODEL_DEFAULT);

  /* ── 이미지 엔진 설정 ── */
  const [provider, setProvider] = useState("openai"); // openai | gemini (손)
  const [quality, setQuality] = useState("medium");
  const [ecoTwoPass, setEcoTwoPass] = useState(true); // 이코노미 2패스: low 초안 → 승인분만 고품질 마감 (GPT 엔진 전용)
  const [finalQuality, setFinalQuality] = useState("medium"); // 2패스 마감 품질: medium | high
  const [aspect, setAspect] = useState("16:9");
  const [showSettings, setShowSettings] = useState(true);

  /* ── 테마 (다크/라이트) ── */
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("freejjang_theme") || "dark"; } catch { return "dark"; }
  });
  useEffect(() => { try { localStorage.setItem("freejjang_theme", theme); } catch {} }, [theme]);

  /* ── API 키 (서비스별 분리 · 두뇌와 이미지 엔진 공유) ── */
  const [openaiKey, setOpenaiKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");

  const [tab, setTab] = useState("pipeline"); // pipeline | basic | analysis

  /* ── 파이프라인 상태 ── */
  const [topic, setTopic] = useState("");
  const [priKw, setPriKw] = useState("");         // 우선 키워드 (선택 — 초안 키워드 앞줄에 반영)
  const [handlingTip, setHandlingTip] = useState(""); // 구도·소품·인물 처리 팁 (선택 — 모든 슬롯에 적용)
  const [count, setCount] = useState(5);      // 목표 장수 (프리셋 3/5/10/15 또는 직접 입력)
  const [maxMin, setMaxMin] = useState("");   // 최대 시간(분) — 초안+생성 전체 벽시계 예산 (선택, 우선순위)
  const deadlineRef = useRef(Infinity);       // maxMin으로 계산된 마감 시각(ms). 초안 시작 시 설정
  const [mode, setMode] = useState("commercial"); // commercial | wallpaper
  const [modeAuto, setModeAuto] = useState(true);
  const [packageMode, setPackageMode] = useState(false); // 패키지 모드 — 세팅/인물/팔레트 응집, 순간만 다르게
  /* ── REEDO식 구조화 구성 (선택 안함이면 무시) ── */
  const [refStyle, setRefStyle] = useState("");
  const [refRegion, setRefRegion] = useState("");
  const [refBg, setRefBg] = useState("");
  const [refFood, setRefFood] = useState(""); // 음식 장르 (선택 안함이면 무시)
  const [refPeople, setRefPeople] = useState("none"); // 기본: 인물 없음 (모델 릴리즈 회피)
  const [refHands, setRefHands] = useState("auto");   // 손 포함/미포함 (auto=AI 자율 — 손이 꼭 들어가야 하는 건 아님)
  const [refAngle, setRefAngle] = useState("auto");   // 초안 전체 기본 카메라 앵글
  const [refTone, setRefTone] = useState("realism");  // 기본: 판매 리얼 (베스트셀러 미학)
  const [saveDir, setSaveDir] = useState(null);        // 저장 폴더 핸들 (File System Access API)
  const settingsLoaded = useRef(false);

  /* ── 설정·키 자동 저장 (이 브라우저 localStorage에만 · 서버 전송 없음) ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("freejjang_settings");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.openaiKey) setOpenaiKey(s.openaiKey);
        if (s.googleKey) setGoogleKey(s.googleKey);
        if (s.brain && BRAIN_LABELS[s.brain]) setBrain(s.brain);
        else if (s.brain === "claude") setBrain(s.googleKey && !s.openaiKey ? "gemini" : "gpt");
        if (s.provider) setProvider(s.provider);
        if (s.quality) setQuality(s.quality);
        if (typeof s.ecoTwoPass === "boolean") setEcoTwoPass(s.ecoTwoPass);
        if (s.finalQuality === "medium" || s.finalQuality === "high") setFinalQuality(s.finalQuality);
        if (s.aspect) setAspect(s.aspect);
        if (s.gptModel) setGptModel(s.gptModel);
        if (s.geminiModel) setGeminiModel(s.geminiModel);
        if (typeof s.autoFallback === "boolean") setAutoFallback(s.autoFallback);
        if (s.refTone) setRefTone(s.refTone);
        if (s.refPeople) setRefPeople(s.refPeople);
      }
      /* 작업 필드(주제·우선 키워드·팁)도 복원 — 에러·새로고침 후 "제목만 남고 키워드가 사라지는" 문제 방지.
         비우고 싶으면 Start Fresh를 쓰면 됨 */
      const w = JSON.parse(localStorage.getItem("freejjang_workfields") || "{}");
      if (w.topic) onTopicChange(w.topic);
      if (w.priKw) setPriKw(w.priKw);
      if (w.handlingTip) setHandlingTip(w.handlingTip);
    } catch { /* 손상된 저장값 무시 */ }
    settingsLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!settingsLoaded.current) return;
    try { localStorage.setItem("freejjang_workfields", JSON.stringify({ topic, priKw, handlingTip })); } catch { /* 저장 불가 무시 */ }
  }, [topic, priKw, handlingTip]);
  useEffect(() => {
    if (!settingsLoaded.current) return;
    try {
      localStorage.setItem("freejjang_settings", JSON.stringify({
        openaiKey, googleKey, brain, provider, quality, aspect, gptModel, geminiModel, autoFallback, refTone, refPeople, ecoTwoPass, finalQuality,
      }));
    } catch { /* 저장 불가 환경 무시 */ }
  }, [openaiKey, googleKey, brain, provider, quality, aspect, gptModel, geminiModel, autoFallback, refTone, refPeople, ecoTwoPass, finalQuality]);

  /* ── Start Fresh: 파이프라인만 초기화 (키·설정은 유지) ── */
  const startFresh = () => {
    if (slots.length > 0 && !window.confirm("새로 시작할까요? 현재 슬롯·이미지·로그가 모두 지워집니다. (API 키와 설정은 유지)")) return;
    cancelRef.current = true;
    setTopic(""); setPriKw(""); setHandlingTip(""); setSlots([]); setQcRejects({}); setQcReason("");
    setPhase("idle"); setProg(null); setAutoQcProg(null); setAutoQcBusy(false);
    setMaxMin(""); setLog([]); setNotice(null); deadlineRef.current = Infinity;
    setModeAuto(true); setMode("commercial");
  };
  const clearSavedKeys = () => {
    setOpenaiKey(""); setGoogleKey("");
    try { localStorage.removeItem("freejjang_settings"); } catch {}
    setNotice("저장된 API 키를 삭제했습니다.");
  };
  const [phase, setPhase] = useState("idle"); // idle | drafting | review | generating | qc | done
  const [slots, setSlots] = useState([]);
  const [prog, setProg] = useState(null);
  const [qcRejects, setQcRejects] = useState({}); // {index: true}
  const [qcReason, setQcReason] = useState("");
  const [autoQcBusy, setAutoQcBusy] = useState(false);
  const [autoQcProg, setAutoQcProg] = useState(null);
  const [dailyBusy, setDailyBusy] = useState(false);
  const lastRecoRef = useRef(""); // 직전 추천 주제 (재클릭 시 다른 각도 보장)
  const lastRecoDetailRef = useRef(null); // 직전 추천의 시장/판매적기 (이력 기록용)
  /* 주제 선정 이력 — 판매시기 겹침 방지용. localStorage에서 동기 로드 */
  const [recoHistory, setRecoHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("freejjang_reco_history")) || []; } catch { return []; }
  });
  const [histOpen, setHistOpen] = useState(false);
  useEffect(() => {
    try { localStorage.setItem("freejjang_reco_history", JSON.stringify(recoHistory)); } catch { /* 저장 불가 무시 */ }
  }, [recoHistory]);
  /* 직전 추천 3개(온전한 내용) — 에러로 버린 추천을 API 호출 없이 다시 불러와 재시도(토큰 절약)용 */
  const [recentRecos, setRecentRecos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("freejjang_recent_recos")) || []; } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem("freejjang_recent_recos", JSON.stringify(recentRecos)); } catch { /* 저장 불가 무시 */ }
  }, [recentRecos]);
  const cancelRef = useRef(false);

  /* ── 기본 생성 / 분석 / 공용 ── */
  const [freePrompt, setFreePrompt] = useState("");
  const [isGen, setIsGen] = useState(false);
  const [freeGallery, setFreeGallery] = useState([]);
  const [selectedFree, setSelectedFree] = useState(null);
  const [anaImage, setAnaImage] = useState(null);
  const [anaExtra, setAnaExtra] = useState("");
  const [anaResult, setAnaResult] = useState(null);
  const [anaBusy, setAnaBusy] = useState(false);
  const [previewSlot, setPreviewSlot] = useState(null);
  const [log, setLog] = useState([]);
  const [notice, setNotice] = useState(null);
  const [spent, setSpent] = useState({ img: 0, cost: 0 }); // 세션 누적 (실제 생성 성공만 집계)
  const [copied, setCopied] = useState(false);
  const anaFileRef = useRef(null);

  const addLog = (m) => setLog((p) => [...p.slice(-80), `${new Date().toLocaleTimeString()} ${m}`]);

  const brainName = BRAIN_LABELS[brain];

  const onTopicChange = (v) => {
    setTopic(v);
    if (modeAuto) setMode(EMOTIONAL_RE.test(v) ? "emotional" : WALLPAPER_RE.test(v) ? "wallpaper" : "commercial");
  };

  /* 한국인 캐스팅 강제 여부: 지역을 '한국'으로 골랐거나, 지역 미선택인데 주제/키워드에 한국이 명시되면 자동 강제.
     지역을 미국·유럽·일본 등으로 명시하면 그 의도를 존중해 강제하지 않는다 */
  const wantKoreanCast = () =>
    refRegion === "kr" || (refRegion === "" && KOREAN_EXPLICIT_RE.test(`${topic} ${priKw}`));

  /* REEDO식 구조화 구성 → 초안 브레인에 주입할 제약 문장 (선택된 것만) */
  const refinementLine = () => {
    const parts = [];
    if (TONE_PHRASE[refTone]) parts.push(`Selling aesthetic (CRITICAL, every subject/lighting/palette must follow this): ${TONE_PHRASE[refTone]}`);
    if (REEDO_STYLE_PHRASE[refStyle]) parts.push(`Style: ${REEDO_STYLE_PHRASE[refStyle]}`);
    if (REEDO_REGION_PHRASE[refRegion]) parts.push(`Market: ${REEDO_REGION_PHRASE[refRegion]}`);
    /* 지역 미선택이지만 주제가 한국이면, 두뇌가 모든 장면을 한국인 인물로 설계하도록 명시 */
    else if (wantKoreanCast()) parts.push(`Casting (CRITICAL): every scene featuring people must depict authentically Korean people with natural East Asian Korean features — never Western/Caucasian models. Korean setting and styling.`);
    if (REEDO_BG_PHRASE[refBg]) parts.push(`Background: ${REEDO_BG_PHRASE[refBg]}`);
    if (REEDO_FOOD_PHRASE[refFood]) parts.push(`Food genre: ${REEDO_FOOD_PHRASE[refFood]}`);
    /* 밀프랩·도시락 자동 감지 — 장르 미선택이어도 칸막이 용기 + 화이트 하이키 스타일 강제 */
    else if (MEALPREP_RE.test(`${topic} ${priKw}`)) parts.push(`Food genre: ${REEDO_FOOD_PHRASE.mealprep}`);
    /* PIW 음식 장르면 PIW 스타일 주입 (FOOD_STYLING의 extreme close-up과 충돌 방지) */
    if (refFood === "piw") parts.push(`Product isolation style: ${PIW_STYLING}`);
    /* 발전: PIW·밀프랩이 아닌 음식 장르를 골랐거나 주제/키워드가 음식이면 식욕 자극 스타일링 자동 주입
       (밀프랩은 접사 대신 화이트 정돈 스타일이 우선이라 제외) */
    else if ((refFood || FOOD_RE.test(`${topic} ${priKw}`)) && refFood !== "mealprep" && !MEALPREP_RE.test(`${topic} ${priKw}`)) parts.push(`Food photography quality: ${FOOD_STYLING}`);
    if (REEDO_PEOPLE_PHRASE[refPeople]) parts.push(`People: ${REEDO_PEOPLE_PHRASE[refPeople]}`);
    if (REEDO_HANDS_PHRASE[refHands]) parts.push(`Hands: ${REEDO_HANDS_PHRASE[refHands]}`);
    if (CAMERA_ANGLES[refAngle]?.phrase) parts.push(`Camera baseline: ${CAMERA_ANGLES[refAngle].phrase}`);
    return parts.length ? `\nApply these refinements to EVERY slot: ${parts.join("; ")}.` : "";
  };

  const estCost = () => {
    if (provider !== "openai") return null;
    const n = slots.filter((s) => s.status !== "success").length || count;
    return (n * (OPENAI_COST[quality] || 0.041)).toFixed(2);
  };

  /* ── 이미지 엔진 키 (provider별 · Pollinations는 키 불필요) ── */
  const imageKey = () => (provider === "pollinations" ? "free" : (provider === "gemini" ? googleKey : openaiKey).trim());
  const IMG_LABEL = { openai: "GPT", gemini: "Gemini", pollinations: "Pollinations(무료)" };
  const engineUsedRef = useRef(""); // 마지막 생성에 실제 사용된 엔진 (폴백 추적)
  /* 엔진 1개 호출 (재시도 없음) */
  const genWithEngine = (eng, prompt, q) => {
    if (eng === "pollinations") return genPollinations(prompt, aspect);
    if (eng === "gemini") return genGemini(googleKey.trim(), prompt, aspect);
    return genOpenAI(openaiKey.trim(), prompt, aspect, q);
  };
  /* 3중 안전망: 선택 엔진 → (Gemini 키 있으면) Gemini → Pollinations(무료·무제한).
     의도치 않은 과금 방지를 위해 사용자가 선택하지 않은 OpenAI로는 절대 자동 폴백하지 않는다.
     엔진마다 일시 오류(429/네트워크)는 3초→6초 재시도, 그래도 실패면 다음 엔진으로.
     qualityOverride: 이코노미 2패스에서 초안을 low로 강제할 때 사용 */
  const generateImage = async (finalPrompt, qualityOverride) => {
    if (!imageKey()) throw new Error(`${provider === "gemini" ? "Google" : "OpenAI"} 이미지 API 키를 먼저 연결하세요 (상단 설정).`);
    const q = qualityOverride || quality;
    const order = [provider];
    if (provider !== "gemini" && googleKey.trim()) order.push("gemini");
    if (provider !== "pollinations") order.push("pollinations");
    let lastErr;
    for (let e = 0; e < order.length; e++) {
      const eng = order[e];
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const out = await genWithEngine(eng, finalPrompt, q);
          const unit = eng === "pollinations" ? 0 : eng === "gemini" ? GEMINI_IMG_COST : (OPENAI_COST[q] || 0.041);
          setSpent((p) => ({ img: p.img + 1, cost: p.cost + unit }));
          engineUsedRef.current = eng;
          if (e > 0) addLog(`[엔진 폴백] ${IMG_LABEL[order[0]]} 실패 → ${IMG_LABEL[eng]}로 생성 완료`);
          return out;
        } catch (err) {
          lastErr = err;
          if (attempt < 2 && TRANSIENT_RE.test(err.message)) {
            const wait = 3000 * (attempt + 1);
            addLog(`[재시도 ${attempt + 1}/2] ${IMG_LABEL[eng]} 일시 오류 — ${wait / 1000}초 후 재시도: ${err.message}`);
            await new Promise((r) => setTimeout(r, wait));
            continue;
          }
          break; // 이 엔진 포기 → 다음 엔진
        }
      }
      if (e < order.length - 1) addLog(`[엔진 오류] ${IMG_LABEL[eng]}: ${lastErr.message} — ${IMG_LABEL[order[e + 1]]}(으)로 폴백`);
    }
    throw lastErr;
  };

  /* ═══ 두뇌 라우터 — 선택 두뇌 먼저 → 키 등록된 다른 두뇌로 폴백 ═══ */
  const brainUsable = (b) => (b === "gpt" ? !!openaiKey.trim() : b === "gemini" ? !!googleKey.trim() : false);
  const buildBrainOrder = () => {
    const order = [];
    const push = (b) => { if (b && !order.includes(b)) order.push(b); };
    push(brain);
    if (autoFallback) {
      if (openaiKey.trim()) push("gpt");
      if (googleKey.trim()) push("gemini");
    }
    return order.filter(brainUsable);
  };
  const callBrain = (b, system, user, imageBlock) => {
    if (b === "gemini") return askGemini(googleKey.trim(), geminiModel.trim(), system, user, imageBlock);
    return askGPT(openaiKey.trim(), gptModel.trim(), system, user, imageBlock);
  };
  const askBrain = async (system, user, imageBlock) => {
    const order = buildBrainOrder();
    if (order.length === 0) throw new Error("사용 가능한 두뇌가 없습니다 — 두뇌를 선택하거나 해당 API 키를 입력하세요.");
    let lastErr;
    for (let i = 0; i < order.length; i++) {
      const b = order[i];
      try {
        const out = await callBrain(b, system, user, imageBlock);
        if (i > 0) addLog(`[두뇌 폴백] ${BRAIN_LABELS[order[0]]} 실패 → ${BRAIN_LABELS[b]}로 처리 완료`);
        return out;
      } catch (err) {
        lastErr = err;
        addLog(`[두뇌 오류] ${BRAIN_LABELS[b]}: ${err.message}${autoFallback && i < order.length - 1 ? " — 다음 두뇌로 폴백" : ""}`);
        if (!autoFallback) break;
      }
    }
    throw lastErr || new Error("모든 두뇌 시도 실패");
  };

  /* ═══ 1단계: 초안 기획 — (A) 장면 매트릭스 1콜로 세트 다양성 확정 → (B) 병렬 상세화 ═══
     유사도 탈락 방지: 장소·행동·앵글·시간대를 세트 단위에서 먼저 서로 다르게 설계한다.
     우선 키워드는 "메타데이터 우선순위"로만 쓰고 장면 내용을 강제하지 않는다 (전 슬롯 동일 사물 등장 방지). */
  const draftSlots = async () => {
    if (!topic.trim() || phase === "drafting") return;
    cancelRef.current = false;
    setPhase("drafting");
    setSlots([]); setQcRejects({});
    /* 주제 선정 이력에 기록 (판매시기 겹침 방지) — 같은 주제는 중복 기록 안 함 */
    const nowD = new Date();
    const todayStr = `${nowD.getFullYear()}-${pad2(nowD.getMonth() + 1)}-${pad2(nowD.getDate())}`;
    setRecoHistory((p) => {
      const t = topic.trim();
      if (p.some((h) => h.t === t)) return p;
      const d = lastRecoDetailRef.current;
      const fromReco = d && d.topic === t;
      return [{ t, d: todayStr, w: fromReco ? d.window : "", m: fromReco ? d.market : "" }, ...p].slice(0, 40);
    });
    /* 최대 시간(분) 예산 — 설정 시 초안+생성 전체의 벽시계 마감. 마감 도달 시 그 시점까지 만든 것으로 마무리 */
    const mins = parseFloat(maxMin);
    deadlineRef.current = mins > 0 ? Date.now() + mins * 60000 : Infinity;
    const timeUp = () => Date.now() > deadlineRef.current;
    addLog(`[초안] "${topic}" — 목표 ${count}행${mins > 0 ? ` · 최대 ${mins}분` : ""} · 1단계 장면 설계 → 2단계 병렬 상세화 · 두뇌=${brainName}`);

    /* ── (A) 장면 매트릭스: 한 번의 호출로 세트 전체의 서로 다른 장면을 설계 ── */
    setProg({ done: 0, total: count, stage: `${brainName} 장면 설계 (다양성 확정)` });
    let concepts = [];
    for (let attempt = 0; attempt < 3 && concepts.length < count && !cancelRef.current && !timeUp(); attempt++) {
      try {
        const m = await askBrain(
          packageMode
            ? `You design a COHESIVE professional stock image PACKAGE — the set is used together on one blog/marketing sequence, so buyers want a shared look with varied moments (like a themed lifestyle set: travel packing / pet-travel prep / meal-prep / home organization). Respond ONLY compact JSON:
{"concepts":[{"scene":"1 short sentence: main subject doing what, where","location":"the place — MAY repeat across concepts (that's the point)","action":"primary action — must be DIFFERENT per concept","angle":"camera angle/framing","time":"time of day + light — must be SAME across concepts (unified look)"}]}
SINGLE FRAME RULE (absolute): every concept is ONE continuous scene captured in ONE single frame — NEVER a split-screen, diptych, collage, grid or before/after comparison layout. SOFT COHESION RULES: return EXACTLY the requested number of concepts. The whole set shares one aesthetic mood — the SAME setting style register (e.g. bright airy Korean home), the SAME palette family (warm neutrals: cream / beige / soft wood), the SAME lighting register (soft window daylight, bright airy — not moody, not cinematic), and the same overall wardrobe register when a person appears (casual home/lifestyle wear in warm neutrals). What VARIES per concept: the specific moment/action, the specific hero prop, the framing/angle, AND who is doing it — freely rotate the helper across the set (a Korean woman, a Korean man, a couple sharing the task, a parent and child, or the whole family helping together); different actors and different exact outfits are fine as long as the shared aesthetic register holds — do NOT force an identical actor, a single gender, or identical clothes. Men and family members helping are encouraged. No two concepts have the same primary action. PHYSICAL PLAUSIBILITY: stage objects only where they realistically belong — cups and drinks on a table, tray, desk or ledge, NEVER directly on a sofa, bed or fabric. NO TEXT-BEARING SCENES (critical — text in the image is auto-rejected): never design a scene whose subject involves readable written content — no presentation slides with titles, no lecturers pointing at worded screens, no documents/handouts/newspapers, no books with visible covers, no signs/labels/menus/whiteboards with writing; use imagery-only equivalents.
${BESTSELLER_REFERENCE}
Treat this topic as a "practical Korean home-life package" if it fits — that formula is exactly what package mode is best at.`
            : `You design a maximally DIVERSE professional stock image set — each image must be clearly a SEPARATE asset to a buyer (no near-duplicates; marketplaces reject similar images). Respond ONLY compact JSON:
{"concepts":[{"scene":"1 short sentence: main subject doing what, where","location":"the place — must be unique in the set","action":"primary action","angle":"camera angle/framing","time":"time of day + light"}]}
SINGLE FRAME RULE (absolute): every concept is ONE continuous scene captured in ONE single frame — NEVER a split-screen, diptych, collage, grid or before/after comparison layout. HARD DIVERSITY RULES: return EXACTLY the requested number of concepts. Every "location" must be DIFFERENT — never two concepts in the same place. No primary action repeated more than twice. Vary camera angle/framing and time/light across the set. When people are allowed, vary person treatment across concepts (hands-only close work / over-shoulder / partial figure from behind / no person at all). PRODUCT-ON-WHITE (PIW) MODE: when the topic or background mentions white background, 흰배경, 제품컷, product isolation, seamless white, e-commerce, or still life — set "location" to "seamless pure white studio background" for ALL concepts, "time" to "even wrap-around studio lighting, no shadows" for ALL concepts, and vary only the product arrangement, angle and props. Each concept must show a CLEARLY DIFFERENT angle/arrangement/garnish/accessory to avoid Adobe similarity rejection (e.g. straight-on → 45° elevated → top-down → close-up detail → with garnish → without garnish → full product → sliced cross-section). No people in PIW mode. FOOD DIVERSITY: for food topics, vary the camera approach across concepts — do NOT default every concept to "extreme close-up macro"; instead mix overhead flat-lay, 45° hero angle, side-on cross-section, hands pulling/cutting/pouring, and full-plate establishing shots. Hands are OPTIONAL, not mandatory — include several concepts with no hands at all (pure styled shots). FOOD CAMERA ANGLE BY DISH (assign the angle that suits each dish's shape, not a random one — this is how commercial food shooters choose): flat or composed dishes (salad, meal-prep, dosirak, pizza, grain/açaí bowls, banchan spreads, flat lays) → 90° top-down so every component reads, everything evenly sharp edge-to-edge with deep depth of field; tall or layered dishes (burger, sandwich, pasta, cake, omurice, risotto, pancakes, dessert plates, steak) → 45° three-quarter so height and top surface both show; drinks and liquids with height (coffee, latte, smoothie, ade, soup, broth, stew, ramen) → eye-level straight-on so the glass height, layers, steam or broth depth show; when a dish shows both height and top → 45°. FOOD FULL-FRAME RULE (ALL angles — top-down, 45°, eye-level): when food is the sole subject, the ENTIRE dish and ALL of its plates, bowls, packaging, containers and lids must be kept FULLY inside the frame with clean margin on every side — nothing cropped or cut off at any edge (Adobe buyers do their own cropping, so deliver the complete uncropped food + packaging). For top-down shots additionally: everything must be evenly tack-sharp with deep depth of field, no shallow-DOF blur anywhere. FOOD LIGHTING (one unified direction across the whole set): key light from BEHIND the food at roughly 45° (back-side light) so it glows and steam/texture/sheen catch the light, a white reflector in front lifting the shadows, a gentle side light raking for surface texture, and the background kept simpler and a touch deeper in tone than the dish so the food separates and reads first; keep props minimal and the background simple. (Exception: product-on-white PIW shots use even shadow-free wrap-around light, NOT back-side light.) FOOD BRIGHTNESS: default food surfaces to a bright white or light-marble counter with an airy white-dominant frame and crisp high-key daylight — never dark wood, dark backdrops or dim warm-brown moody grading (unless the genre is explicitly steakhouse/rustic). LUNCHBOX/MEAL-PREP REALISM (도시락·밀프랩 topics): always stage DIVIDED containers with separate compartments — rice in its own compartment, each side dish in its own well, portions never touching or mixing (contents must survive being carried); Subway-style fresh prep (wrapped sandwiches, salad bowls, fruit cups, stacked clear containers) is equally welcome. JAPANESE-KOREAN CAFE COMFORT (우동·오므라이스·타코야키·돈까스·주먹밥·계란말이·아사이볼 topics — Adobe batch-approved formula): ALWAYS style on a gingham check fabric background (pink gingham OR blue gingham), use pastel-colored plates and ceramics (pink, mint, cream), add cute kawaii props (heart-shaped ketchup, animal-shaped cookies, small flowers, decorative picks), warm soft natural lighting, overhead or 45° angle — this is specifically the cozy gingham-and-pastels look, NEVER plain white background or dark moody for these dishes. For trending Korean desserts (butter tteok, chewy cookie, yakgwa, crookie), cross-section hero shots and texture close-ups sell best. For international brunch, one country per concept with authentic tableware. For steak, show the medium-rare cross-section. For cafe drinks, show the layered colors through clear glass. CLEAN SETTINGS (commercial/business/product topics): make each distinct "location" a clean, minimal, high-end interior or a simple tidy setting — the background must stay uncluttered and premium; do NOT place the subject in front of a window facing a busy street, passing traffic, glowing city lights or a crowded shop/café exterior, and do NOT pack the backdrop with cluttered shelves or signage. The subject is always FRONT-LIT: "time" light comes from the camera side or a 45° off-camera side — never stage a window or bright light source behind the subject (backlit silhouettes fail QC), so the backdrop behind the subject is a plain clean interior wall. DARK-NEON BAN (commercial mode only, NOT wallpaper): in commercial product/people shots avoid a dark room lit by glowing neon circuits or sci-fi effects (Adobe rejects those for noise + soft focus on shots that must be sharp), and tech/semiconductor/AI topics get BRIGHT clean locations with real physical hardware. For wallpaper/background assets, atmospheric neon and dark ambient tech are an approved desired aesthetic — do not flatten them. (Only topics explicitly about travel/landscape/outdoor/street-life keep their real environment.) PHYSICAL PLAUSIBILITY: stage objects only where they realistically belong — cups and drinks on a table, tray, desk or ledge, NEVER directly on a sofa, bed or fabric. NO TEXT-BEARING SCENES (critical — text in the image is auto-rejected): never design a scene whose subject involves readable written content — no presentation slides with titles, no lecturers pointing at worded screens, no documents/handouts/newspapers, no books with visible covers, no signs/labels/menus/whiteboards with writing; use imagery-only equivalents (wordless abstract visuals on screens, blank paper, shape-only charts). If user notes suggest scene ideas, distribute DIFFERENT ideas to DIFFERENT concepts — never apply the same idea to every concept.
${BESTSELLER_REFERENCE}
If the topic matches one of these formulas, make several concepts embody its winning composition (for faith topics, golden-hour cross silhouettes and warm sanctuary scenes are wanted, not to be avoided).`,
          `Topic: "${topic}". Mode: ${mode}. Design exactly ${count} distinct scene concepts.${refinementLine()}${handlingTip.trim() ? `\nUser handling notes (apply thoughtfully WITHOUT reducing diversity): ${handlingTip.trim()}` : ""}${priKw.trim() ? `\nBuyer search terms for context (use as inspiration for DIFFERENT scenes — do NOT put every term into every scene): ${priKw.trim()}` : ""}`
        );
        concepts = (m.concepts || []).filter((c) => c && c.scene).slice(0, count);
        if (concepts.length < count) addLog(`[장면 설계] ${concepts.length}/${count}개 — 부족분 재시도`);
      } catch (err) {
        addLog(`[오류] 장면 설계 실패: ${err.message} — 3초 후 재시도`);
        await new Promise((r2) => setTimeout(r2, 3000));
      }
    }
    if (cancelRef.current) { setPhase("idle"); setProg(null); addLog("[초안] 사용자 중단"); return; }
    if (concepts.length === 0) { setPhase("idle"); setProg(null); setNotice("장면 설계에 실패했습니다. 두뇌 키를 확인하고 다시 시도하세요."); return; }
    const setSummary = concepts.map((c, i) => `${i + 1}. ${c.location} — ${c.action}`).join(" / ");
    addLog(`[장면 설계] ${concepts.length}개 확정: ${setSummary.slice(0, 160)}…`);

    /* ── (B) 병렬 상세화: 확정된 장면을 2개씩 묶어 동시 3콜로 확장 (속도 ↑) ── */
    const made = new Array(concepts.length).fill(null);
    let doneCnt = 0;
    const detailSystem = `You expand assigned scene concepts into professional stock image slots. Respond ONLY compact JSON:
{"items":[{"slug":"en-hyphen","kind":"photo","subject":"1 sentence main subject+scene","props":"2-4 SPECIFIC supporting props/styling unique to THIS scene, comma-sep","focal_placement":"e.g. center-left","copy_space":"short","camera":"lens/angle/depth (photo) or medium/edges (illustration)","lighting":"direction+texture","palette":"colors","title":"EN stock title 6-12 words, descriptive and searchable","title_kr":"KR title","keywords":"EXACTLY 35 EN keywords, comma-separated, SEO-ordered","keywords_kr":"EXACTLY 25 KR single-noun keywords comma-sep (write 가을,풍경 never 가을풍경), same SEO ordering as EN","category":11}]}
RULES: one item per assigned concept, in the given order — KEEP each concept's location, action, angle and time exactly (they guarantee set diversity; do not merge or swap them). kind is "photo" or "illustration" by topic. No contradictory lens/angle/lighting mixes. SINGLE FRAME (absolute): every image is ONE continuous scene in ONE single frame — never write a subject or camera field that implies a split-screen, diptych, collage, grid, two-panel or before/after comparison composition. Exclude text, logos, brands, copyrighted characters, unrequested people. NO TEXT-BEARING ELEMENTS anywhere in subject or props (text in the image is auto-rejected): no slides/screens with words, no documents, handouts, printed pages, book covers, signs, labels, menus or writing of any kind — replace with wordless equivalents (abstract graphics, blank surfaces, shape-only charts). This includes NON-ENGLISH scripts: Korean interiors (churches, cafés, shops, homes) must NEVER include Korean Hangul calligraphy, framed scripture/verses, hanging banners, wall lettering or hymn boards — describe such walls explicitly as plain and bare; Bibles and books are always closed with a completely plain unmarked cover (never write "with title" or a brand). All output field values must be ENGLISH ONLY (except title_kr and keywords_kr) — never copy Korean words from the topic or user notes into subject/props/camera/lighting. Cultural items must be factually correct. PHYSICAL PLAUSIBILITY: every object rests on a realistic surface — cups/drinks on a table, tray, desk or ledge, NEVER directly on a sofa, bed or fabric; nothing floating or oddly placed. SELLABILITY: usable beats pretty — prefer hands + device + partial person over posed full faces; keep backgrounds clean enough for ads and banners. Mode "wallpaper": copy_space = a 40-60% low-density area opposite the subject, with subtle real surface texture (never a featureless void). Mode "emotional" (Korean MiriCanvas worship/seasonal text-overlay background): design a warm inspirational background — golden-hour or soft dramatic sky, gentle light rays through clouds, subjects like a cross, wheat field, autumn harvest bounty, open sky, praying hands; copy_space = a 45-60% low-detail area with a calm darker zone reserved for Korean text; here golden-hour backlight and gentle silhouette are DESIRED (do NOT flatten, do NOT force even frontal lighting); "keywords_kr" must include Korean emotional/worship/seasonal search terms (예배, 감사, 은혜, 배경, 감성 등). Mode "commercial": medium or wide framing, subject clearly DOMINATES at 50-70% of frame (never edge-to-edge, never a small subject lost in emptiness), 25-35% clean negative space with a HARD CAP of 40% empty area, rule-of-thirds, subject fully in frame; "lighting" must describe correct even exposure (detail kept in highlights and shadows) and "camera" must keep the whole main subject tack-sharp (f/4-f/5.6, no heavy shallow-DOF blur). CLEAN BACKGROUND (commercial default, critical for Midjourney which over-blurs busy scenes): design the setting as a clean, minimal, high-end interior or a simple tidy backdrop that stays SHARP and in focus — the "location" and background must NOT be a window facing a busy outdoor street, NOT passing traffic or a crowded café/shop exterior, NOT glowing bokeh city lights, NOT cluttered packed shelves behind the subject. Keep the space premium, uncluttered and distraction-free so nothing in the background needs to be blurred away. (Exceptions: topics explicitly about travel/landscape/outdoor/street-life may keep their real environment.) FRONT-LIT RULE (commercial default, prevents rejected backlit shots): "lighting" must light the subject from the FRONT or FRONT-SIDE — key light from the camera side or a 45° side. NEVER stage a window, glass storefront or any bright light source BEHIND the subject (that creates backlit silhouettes which fail QC). If daylight is used, it comes from an off-camera side source that is NOT visible in the frame; the wall directly behind the subject is always a simple clean interior wall. Do NOT write "window light", "by the window" or "shopfront light" in "lighting" — write "soft directional daylight from the left/right, off-camera" instead. DARK-NEON BAN (applies to commercial mode ONLY — NOT wallpaper/emotional/background assets): in COMMERCIAL product & people shots, NEVER design a scene as a dark room lit mainly by glowing neon circuits, holograms or sci-fi light effects — there the glowing edges read as soft focus and dark backgrounds carry noise/banding at Adobe's 100% zoom review. BUT for wallpaper/emotional/abstract-background assets this does NOT apply: atmospheric neon, dark ambient tech, glowing data waves and cosmic scenes are a DESIRED wallpaper aesthetic (Adobe approves these as backgrounds) — keep them when the mode is wallpaper. The REAL technical killer is not neon itself but (a) extreme close-ups where dense repetitive circuitry/chip pins fill the frame (AI garbles fine traces → artifact reject) and (b) softness/glow on a subject that is SUPPOSED to be tack-sharp. TECH HARDWARE RULE (semiconductor/chip/server/robot/AI topics, commercial mode): stage REAL physical hardware in a BRIGHT clean environment — bright cleanroom, white modern lab, or a seamless product-shot backdrop — with even studio-grade lighting, like premium B2B product photography. Avoid extreme close-ups where dense repetitive circuitry fills the whole frame; prefer the hardware at medium distance, held or handled by a person, or staged as a clean single-hero product shot. (For wallpaper mode, an atmospheric wide tech scene with subtle glow is fine.)
KEYWORDS (Adobe SEO, critical): EXACTLY 35 EN keywords, no duplicates, ordered by buyer importance (first ~10 weigh most): (1) main subject nouns, (2) descriptors/materials/actions, (3) concept/season/emotion, (4) color/lighting, (5) composition (copy space, background), (6) use-case (banner, marketing, web design). All lowercase, only terms literally describing what is visible. "keywords_kr" same ordering in Korean single nouns.
CATEGORY: pick ONE best Adobe Stock category id: ${ADOBE_CAT_LIST}. Illustration/vector fallback: 8. Integer id only.
PROPS & VARIETY: props must be SPECIFIC to each scene and DIFFERENT from every other slot in the whole set (set list provided) — never reuse generic filler across slots; tableware must match the dish culture; keep the copy-space area uncluttered; believable and unbranded.
BRIGHTNESS RULE (Adobe Stock + MiriCanvas commercial default): the "lighting" and "time" fields must describe BRIGHT well-lit daytime scenarios (bright natural window light, soft ambient daylight, high-key studio lighting) for the vast majority of slots. NEVER default to "early morning fog", "evening dusk", "misty dawn", "dim ambient", "moody underexposure" — those are NICHE looks that only sell for topics explicitly about: landscape, travel, nature (mountain/ocean/forest/desert), sunrise/sunset scenery, holiday-evening (Christmas eve etc.), cinematic tone, or worship/emotional backgrounds. If the topic is not one of those niches, dim/foggy/dusk lighting is a REJECTED aesthetic — pick bright daytime instead.
PRODUCT-ON-WHITE (PIW) RULE (when topic/background mentions white background, product isolation, 흰배경, 제품컷, seamless white, still life, e-commerce): design a clean product-isolation shot on seamless PURE WHITE background — the product or small themed arrangement fills 60-80% of frame, shot from a slightly elevated 30° angle or straight-on eye level, "lighting" = even soft wrap-around studio lighting from all sides eliminating all harsh shadows, "camera" = tack-sharp f/8-f/11 across the entire product. NO floor line, NO horizon, NO environment or surface texture visible — just the product floating on infinite white. This is the Adobe BULK approval formula (chocolate cakes 50+ cuts, Valentine's items 1600+ cuts, July 4th BBQ/flag sets). Each variation must have a CLEARLY DIFFERENT composition — different angle, different arrangement, different garnish/accessory — to avoid Adobe similarity rejection.
FOOD DIVERSITY RULE (when topic is food): match the food genre to its best composition — trending Korean desserts (butter tteok 버터떡, chewy cookie 두쫀쿠, yakgwa 약과, crookie) want cross-section hero or texture close-up; international brunch wants one-country-per-image with authentic tableware; steak wants medium-rare cross-section with char marks and juice beads; cafe drinks want glass-hero with visible layered colors and condensation. Never default every food slot to the same extreme close-up — vary between overhead flat-lay, 45° hero angle, side-on cross-section, and hands-interacting depending on the dish. Hands are OPTIONAL — several slots should be pure styled shots with no hands. FOOD CAMERA ANGLE BY DISH: set each slot's "camera"/"angle" to fit the dish shape — flat or composed dishes (salad, meal-prep, dosirak, pizza, grain/açaí bowls, banchan spreads) → 90° top-down flat lay, everything evenly sharp with deep depth of field; tall or layered dishes (burger, sandwich, pasta, cake, omurice, risotto, pancakes, dessert plates, steak) → 45° three-quarter; drinks and liquids with height (coffee, latte, smoothie, ade, soup, broth, stew, ramen) → eye-level straight-on; default → 45°. FOOD FULL-FRAME RULE (ALL angles — top-down, 45°, eye-level): when food is the sole subject, the "subject"/"camera" must keep the WHOLE dish and ALL of its plates, bowls, packaging, containers and lids fully within the frame with clean margin on every side — nothing cropped or cut off at any edge (Adobe buyers do their own cropping, so deliver the complete uncropped food + packaging). For top-down shots additionally: everything evenly tack-sharp with deep depth of field, no shallow-DOF blur anywhere. FOOD LIGHTING RULE: write "lighting" as a back-side key light at ~45° behind the food (so it glows and steam/texture read) with a white reflector in front lifting shadows and a gentle side light for texture, background kept simpler and slightly deeper in tone than the dish for separation, one unified light direction; keep props minimal and background simple. (Exception: PIW product-on-white slots use even shadow-free wrap-around light instead.) FOOD BRIGHTNESS RULE: food "lighting" and "palette" default to bright white-dominant styling — pure white or light-marble counter, airy high-key daylight, vibrant fresh food colors popping against white; NEVER dim warm-brown moody grading, dark wood or dark backdrops unless the genre is explicitly steakhouse/rustic. JAPANESE-KOREAN CAFE COMFORT RULE (우동·오므라이스·타코야키·돈까스·주먹밥·계란말이·아사이볼 topics — Adobe batch-approved formula): ALWAYS style on a gingham check fabric background (pink gingham OR blue gingham), use pastel ceramic plates (pink, mint, cream), add cute kawaii props (heart ketchup, animal cookies, small flowers, decorative picks), warm soft natural lighting — this is specifically the cozy gingham-and-pastels look that got Adobe batch approved; NEVER plain white background or dark moody for these dishes; this OVERRIDES the default white-dominant food brightness rule for these specific dishes. LUNCHBOX/MEAL-PREP RULE (도시락·밀프랩·bento topics): the container is always a DIVIDED one with separate compartments — steamed rice in its OWN compartment, each side dish in its OWN well, portions never touching or mixing (contents must survive transport; loose rice piled together with side dishes in one open tray is WRONG and unsellable); clear glass meal-prep boxes with snap lids or stainless dosirak trays with dividers; Subway-style fresh prep (wrapped sandwich, salad bowl, fruit cup, overnight oats in stacked clear containers) equally welcome.`;
    const expandPair = async (pairIdx) => {
      const pair = pairIdx.map((i) => concepts[i]);
      for (let attempt = 0; attempt < 3 && !cancelRef.current && !timeUp(); attempt++) {
        try {
          const r = await askBrain(
            detailSystem,
            `Topic: "${topic}". Mode: ${mode}.${packageMode ? " PACKAGE MODE ON — this pair shares the SET-WIDE aesthetic register (same palette family, same soft daylight, same setting style, casual home wardrobe register) but different actors and different exact outfits are FINE, and the helper may be a woman, a man, a couple, or a family member — do NOT lock to a single person or gender. Do NOT push differentiation on palette/lighting/mood." : ""} Whole-set overview (${packageMode ? "keep THIS pair visually cohesive with the whole set — only the action/prop varies" : "make THIS pair's props/palette clearly distinct from all"}): ${setSummary}
Expand EXACTLY these ${pair.length} assigned concepts, one item each, in order:
${pair.map((c, j) => `${j + 1}. scene: ${c.scene} | location: ${c.location} | action: ${c.action} | angle: ${c.angle} | time: ${c.time}`).join("\n")}${refinementLine()}${handlingTip.trim() ? `\nUser handling notes — apply to these slots: ${handlingTip.trim()}` : ""}${priKw.trim() ? `\nPRIORITY KEYWORDS (metadata ordering only — for each slot, place the ones that are LITERALLY VISIBLE in that slot near the FRONT of "keywords"; NEVER add ones not visible, NEVER alter the scene to include them): ${priKw.trim()}` : ""}`
          );
          (r.items || []).slice(0, pair.length).forEach((item, j) => {
            made[pairIdx[j]] = {
              ...item,
              status: "pending", regenCount: 0, dataUrl: "", rejectReason: "", qcNote: "", angle: refAngle, finalPrompt: "",
              keywords: padKeywordsEN(item, ADOBE_MAX_KEYWORDS),
              keywords_kr: padKeywordsKR(item, MIRI_MAX_KEYWORDS),
              slug: cleanName(item.slug, 24) || `slot-${pairIdx[j] + 1}`,
            };
          });
          doneCnt += pair.length;
          setProg({ done: Math.min(doneCnt, concepts.length), total: concepts.length, stage: `${brainName} 상세 기획 (병렬)` });
          setSlots(made.filter(Boolean).map((s, i) => ({ ...s, index: pad2(i + 1) })));
          return;
        } catch (err) {
          addLog(`[오류] 상세화 실패(슬롯 ${pairIdx.map((i) => i + 1).join(",")}): ${err.message} — 재시도 ${attempt + 1}/3`);
          await new Promise((r2) => setTimeout(r2, 2500));
        }
      }
    };
    const pairs = [];
    for (let i = 0; i < concepts.length; i += 2) pairs.push([i, i + 1].filter((x) => x < concepts.length));
    const queue = [...pairs];
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length > 0 && !cancelRef.current && !timeUp()) await expandPair(queue.shift());
    }));

    setProg(null);
    if (cancelRef.current) { setPhase("idle"); addLog("[초안] 사용자 중단"); return; }
    if (timeUp()) addLog(`[시간 상한] ${mins}분 초과 — 완성된 초안까지만 진행합니다`);
    const ok = made.filter(Boolean);
    const indexed = ok.map((s, i) => ({ ...s, index: pad2(i + 1) }));
    setSlots(indexed);
    addLog(`[초안 완료] ${ok.length}행${ok.length < concepts.length ? ` (${concepts.length - ok.length}행 미완)` : ""}`);
    if (ok.length === 0) { setPhase("idle"); setNotice("시간 내 초안을 만들지 못했습니다. 최대 시간을 늘리거나 장수를 줄이세요."); return; }
    /* 검토 멈춤 없이 곧바로 순차 생성 (생성 후 수정) — 키 없으면 검토 단계에서 대기 */
    if (imageKey()) {
      runGeneration(indexed);
    } else {
      setPhase("review");
      setNotice("이미지 API 키가 없어 초안에서 멈췄습니다. 상단 설정에서 키를 입력한 뒤 승인하세요.");
      addLog(`[멈춤 1] 이미지 키 없음 — 키 입력 후 승인 시 생성`);
    }
  };

  /* ═══ 오늘의 추천 — 날짜 기준 판매 리드타임(4~8주) 계산 + 베스트셀러/틈새/이슈 랜덤 로테이션.
     주제칸에 이미 주제가 있으면(시드 모드) 그 주제 '안에서' 베스트셀러·틈새 각도를 검토해 구체화한다.
     항상 트렌드 소품 팔레트(8-12개, 톤앤매너 큐레이션)까지 함께 조사해 팁에 채운다.
     구글 키가 있으면 구글 검색 그라운딩으로 실시간 트렌드·뉴스까지 반영, 실패 시 두뇌 지식으로 폴백 ═══ */
  const recommendToday = async () => {
    if (dailyBusy || phase === "drafting" || phase === "generating") return;
    setDailyBusy(true);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const seed = Math.floor(Math.random() * 100000);
    const seedTopic = topic.trim();
    addLog(seedTopic
      ? `[오늘의 추천] "${seedTopic}" 주제 기반 — 이 주제 안의 베스트셀러·틈새 각도와 트렌드 소품 조사 중…`
      : `[오늘의 추천] ${dateStr} 기준 — 판매 리드타임 4~8주 반영해 주제 선정 중…`);
    const marketRule = seedTopic
      ? `SEED-TOPIC MODE: the user already chose the topic domain "${seedTopic}". Do NOT switch to an unrelated topic. Act as a market analyst WITHIN that domain: survey its current bestseller angles AND its undersupplied niches (sub-genres, seasonal twists, newly trending variants actually selling right now), weigh demand vs competition, then propose the single strongest SPECIFIC production angle inside the domain. "topic_kr" must clearly remain within "${seedTopic}" but sharpened into that winning angle (e.g. "브런치" → a specific trending brunch sub-genre). Set "market" to whichever the chosen angle is (top or niche).`
      : `Rotate the market type pseudo-randomly using the seed — top(베스트셀러 수요) ~40%, niche(수요 대비 공급 부족한 틈새: e.g. 시니어 디지털 라이프, 지속가능 포장, 재택 재활운동, 소상공인 디지털 전환) ~40%, news/issue ~20%.`;
    const sys = `You are a top stock-image market strategist for Adobe Stock (global) and MiriCanvas (Korea). Given today's date, propose exactly ONE production topic optimized to SELL within the next 2 months — stock buyers purchase visuals 4-8 weeks before they need them, so target upcoming seasons, holidays, campaigns and business cycles, or a timely news/issue angle (economy, AI, climate, health, lifestyle shifts). Respond ONLY compact JSON:
{"topic_kr":"프리짱 주제 입력용 한국어 주제 (10-20자, 명확한 촬영 소재)","market":"top|niche|news","priority_keywords":"10-14 lowercase EN buyer search terms, comma-separated, SEO order (most-searched first)","trend_props_kr":"트렌드 소품 팔레트 8-12개, 쉼표 구분 (한국어)","handling_tip_kr":"구도·인물 처리 팁 1-2문장 (한국어)","rationale_kr":"왜 지금 이 주제인지 + 수요 근거 1-2문장 (한국어)","sell_window":"판매 적기 e.g. 9월 초~10월 말"}
RULES: ${marketRule} The topic must be shootable as AI stock images: NO celebrities, NO brands, NO text-heavy scenes, prefer scenes not requiring identifiable faces. Never repeat the avoided topic. Seed: ${seed}.
TREND PROPS (critical, "trend_props_kr"): research which props & styling items are CURRENTLY selling well in this topic's genre and curate 8-12 of them into ONE coherent tone-and-manner palette that matches the proposed angle. Each item must be specific (material/color/shape — e.g. "유광 세라믹 딤플 접시", "스테인리스 프렌치프레스", "체크 패턴 왁스페이퍼"). HARD BAN on tired default filler: 린넨 천, 머그컵, 커피/커피잔, 화분/식물 같은 뻔한 조합은 금지 — 지금 트렌드에 맞는 신선한 대안을 고를 것. The palette is distributed across a whole image set, so include a MIX of surface/base items, hero-adjacent props, and small accent pieces that all share the same aesthetic register.
${BESTSELLER_REFERENCE}
When you pick a "top" bestseller topic, strongly consider one of the two proven formulas above (faith/worship for the Korean market, or business-growth/finance for both markets) — they are reliable sellers.`;
    const histLines = recoHistory.slice(0, 20).map((h) => `- ${h.d} | ${h.t}${h.w ? ` | 판매적기 ${h.w}` : ""}`).join("\n");
    const user = `Today: ${dateStr}. Avoid repeating this previous recommendation: "${lastRecoRef.current || "none"}". Markets: global Adobe Stock + Korean MiriCanvas.${histLines ? `\nALREADY-PRODUCED TOPICS (with sell windows). HARD RULE: never propose the same or clearly similar subject as any entry whose sell window overlaps your new sell window — a DIFFERENT subject in the same window is fine:\n${histLines}` : ""}\nGive ONE recommendation now.`;
    try {
      let r = null;
      if (googleKey.trim()) {
        try {
          r = await askGeminiGrounded(googleKey.trim(), geminiModel.trim(), sys, `${user}\nFirst, search the web for current stock photography trends, seasonal demand and this week's notable commerce/news topics${seedTopic ? `, plus which "${seedTopic}" sub-genres and styling props are trending right now` : ", plus which styling props are trending for the genre you pick"}, then decide.`);
          addLog(`[오늘의 추천] 구글 실시간 검색 반영 완료`);
        } catch (e) { addLog(`[오늘의 추천] 실시간 검색 불가(${e.message}) — 두뇌 지식으로 진행`); }
      }
      if (!r) r = await askBrain(sys, user);
      if (!r.topic_kr) throw new Error("추천 응답이 비어 있습니다.");
      const props = String(r.trend_props_kr || "").trim();
      const tipBase = String(r.handling_tip_kr || "").slice(0, 400);
      const reco = {
        t: String(r.topic_kr).trim(),
        kw: normKeywords(r.priority_keywords, 14),
        tip: props
          ? `${tipBase}${tipBase ? "\n" : ""}트렌드 소품 팔레트(장면마다 2-4개씩 서로 다르게 분배, 전 장면 동일 소품 반복 금지): ${props}`.slice(0, 900)
          : tipBase,
        r: String(r.rationale_kr || "").slice(0, 500),
        w: r.sell_window || "",
        m: r.market || "",
      };
      onTopicChange(reco.t);
      setPriKw(reco.kw);
      setHandlingTip(reco.tip);
      lastRecoRef.current = reco.t;
      lastRecoDetailRef.current = { topic: reco.t, market: reco.m, window: reco.w };
      /* 직전 3개만 보관(중복 주제는 최신으로 갱신) */
      setRecentRecos((p) => [reco, ...p.filter((x) => x.t !== reco.t)].slice(0, 3));
      const label = r.market === "niche" ? "틈새시장" : r.market === "news" ? "이슈·뉴스" : "베스트셀러";
      addLog(`[오늘의 추천] (${label}${seedTopic ? ` · "${seedTopic}" 기반` : ""}) ${r.topic_kr} — 판매 적기: ${r.sell_window || "향후 2개월"}${props ? ` · 트렌드 소품 ${props.split(",").length}종` : ""}`);
      setNotice(`🎯 오늘의 추천 (${label}${seedTopic ? ` · "${seedTopic}" 안에서 선정` : ""}): "${r.topic_kr}" — ${r.rationale_kr || ""} 판매 적기: ${r.sell_window || "향후 2개월"}. 주제·우선 키워드·트렌드 소품 팔레트·팁이 자동으로 채워졌습니다. 마음에 들면 '초안 기획', 다른 각도를 원하면 추천을 한 번 더 누르세요.`);
    } catch (err) {
      addLog(`[오류] 오늘의 추천 실패: ${err.message}`);
      setNotice(`오늘의 추천 실패: ${err.message}`);
    }
    setDailyBusy(false);
  };

  /* 직전 추천 다시 불러오기 — 저장된 추천을 API 호출 없이 폼에 되채움(토큰 절약).
     에러로 버린 직전 추천을 구도·소품만 바꿔 재시도할 때 사용 */
  const applyReco = (reco) => {
    if (phase === "drafting" || phase === "generating") return;
    onTopicChange(reco.t);
    setPriKw(reco.kw || "");
    setHandlingTip(reco.tip || "");
    lastRecoRef.current = reco.t;
    lastRecoDetailRef.current = { topic: reco.t, market: reco.m, window: reco.w };
    const label = reco.m === "niche" ? "틈새시장" : reco.m === "news" ? "이슈·뉴스" : "베스트셀러";
    addLog(`[다시 불러옴] (${label}) ${reco.t} — 추천 API 미사용(토큰 절약)`);
    setNotice(`↩️ 다시 불러옴 (${label}): "${reco.t}" — ${reco.r || ""} 판매 적기: ${reco.w || "향후 2개월"}. 구도·소품을 바꿔 '초안 기획'을 눌러 재시도하세요. (추천 API 미사용 · 토큰 절약)`);
  };

  /* 실패 슬롯 자동 복구: 두뇌가 장면을 규정(무텍스트·세이프티)에 맞게 다시 씀 — 장소·행동은 유지해 세트 다양성 보존 */
  const repairSlot = async (t, errMsg) => {
    const r = await askBrain(
      `You repair a stock-image slot whose image generation keeps FAILING. Respond ONLY compact JSON: {"subject":"...","props":"...","camera":"...","lighting":"..."}
Rewrite the scene so it: (1) contains ZERO readable written content — no presentation slides with titles, no documents/handouts/papers with print, no books with visible covers, no signs, labels, whiteboards with writing, no screens showing words; replace them with imagery-only equivalents (abstract wordless graphics, blank surfaces, charts made of pure shapes), (2) avoids anything an image-API safety filter could block, (3) KEEPS the same location, primary action and mood so the set stays diverse. Keep all field styles consistent with professional stock photography.`,
      `Failing slot — subject: "${t.subject}" | props: "${t.props || ""}" | camera: "${t.camera || ""}" | lighting: "${t.lighting || ""}". Generation error message: "${errMsg}".`
    );
    const out = {};
    for (const k of ["subject", "props", "camera", "lighting"]) if (typeof r[k] === "string" && r[k].trim()) out[k] = r[k].trim();
    if (!out.subject) throw new Error("복구 응답에 subject가 없습니다.");
    return out;
  };

  /* ═══ 2단계: 순차 생성 (초안 직후 자동 · 수동 버튼은 force=시간 무시) ═══ */
  const runGeneration = async (slotList, force = false) => {
    if (phase === "generating") return;
    if (!imageKey()) { setNotice("이미지 API 키가 필요합니다."); return; }
    cancelRef.current = false;
    setPhase("generating");
    const source = Array.isArray(slotList) ? slotList : slots;
    const targets = source.filter((s) => s.status === "pending" || s.status === "failed" || s.status === "rejected");
    /* 시간 예산: 초안 시작 시 세팅된 마감(deadlineRef)까지. force(수동 버튼)면 시간 예산 무시하고 강제 실행 */
    const hasDeadline = !force && deadlineRef.current !== Infinity && Date.now() < deadlineRef.current;
    const timeUp = () => hasDeadline && Date.now() > deadlineRef.current;
    const ecoOn = ecoTwoPass && provider === "openai";
    const draftQ = ecoOn ? "low" : undefined;
    addLog(`[생성] 미완료 ${targets.length}슬롯${force ? " · 강제 실행 (시간 무시)" : hasDeadline ? ` · 최대 ${Math.ceil((deadlineRef.current - Date.now()) / 60000)}분 남음` : ""} · ${provider === "openai" ? (ecoOn ? `GPT low 초안 (승인 후 ${finalQuality} 마감)` : `GPT ${quality}`) : provider === "pollinations" ? "Pollinations 무료 (Flux)" : "Gemini"}`);
    let newMade = 0;
    const markSuccess = async (idx, dataUrl, fp) => {
      newMade += 1;
      const eng = engineUsedRef.current;
      const px = await getDims(dataUrl).catch(() => null);
      setSlots((p) => p.map((s) => (s.index === idx
        ? { ...s, status: "success", dataUrl, finalPrompt: fp, rejectReason: "", qcNote: "", finalized: false, engine: eng, px, regenCount: s.regenCount + 1 } : s)));
    };
    for (const t of targets) {
      if (cancelRef.current) break;
      if (timeUp()) { addLog(`[시간 상한] 예산 초과 — ${newMade}장 생성 후 중단 ('미완료·수정 슬롯 생성' 버튼은 시간 무시하고 강제 실행됩니다)`); break; }
      setProg({ done: newMade, total: targets.length, stage: `슬롯 ${t.index} 생성 중` });
      /* 프롬프트를 먼저 확정해 슬롯에 깔아둔다 — 생성되는 동안 카드에서 프롬프트 확인 가능 */
      const fp = buildSlotPrompt(t, mode, refTone, refPeople, wantKoreanCast(), refHands);
      setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "generating", finalPrompt: fp } : s)));
      try {
        if (t.qcNote) addLog(`[교정 ${t.index}] 이전 거절 사유 반영: ${t.qcNote}`);
        const dataUrl = await generateImage(fp, draftQ);
        await markSuccess(t.index, dataUrl, fp);
        addLog(`[성공 ${t.index}] ${t.title_kr || t.title}`);
      } catch (err) {
        /* 자동 복구: 일시 오류가 아닌 실패(콘텐츠 충돌 등)는 두뇌가 장면을 규정에 맞게 고쳐 쓴 뒤 즉시 1회 재시도 */
        if (!TRANSIENT_RE.test(err.message) && !t.repaired) {
          addLog(`[복구 ${t.index}] 실패 원인 분석·장면 자동 수정 — ${err.message}`);
          try {
            const fix = await repairSlot(t, err.message);
            const t2 = { ...t, ...fix, repaired: true };
            const fp2 = buildSlotPrompt(t2, mode, refTone, refPeople, wantKoreanCast(), refHands);
            setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, ...fix, repaired: true, finalPrompt: fp2 } : s)));
            const dataUrl2 = await generateImage(fp2, draftQ);
            await markSuccess(t.index, dataUrl2, fp2);
            addLog(`[복구 성공 ${t.index}] 장면 수정 후 생성 완료`);
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          } catch (err2) {
            setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "failed", rejectReason: `복구 후에도 실패: ${err2.message}`, repaired: true } : s)));
            addLog(`[복구 실패 ${t.index}] ${err2.message} — 카드에서 SUBJECT를 직접 수정 후 재생성하세요`);
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
        }
        setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "failed", rejectReason: err.message } : s)));
        addLog(`[실패 ${t.index}] ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    setProg(null);
    setSlots((cur) => {
      const missing = cur.filter((s) => s.status !== "success").map((s) => s.index);
      if (missing.length > 0) {
        addLog(`[미완료] 슬롯 ${missing.join(", ")} — 같은 엔진으로 재생성만 진행하세요 (이미지 엔진 자동 전환 없음)`);
        setPhase("review");
      } else {
        addLog(`[멈춤 2] 전 슬롯 성공 — 콘택트시트 QC에서 이상 번호만 표시하세요`);
        setPhase("qc");
      }
      return cur;
    });
  };

  /* ═══ 3단계: QC — 거절 격리 후 해당 슬롯만 재생성 ═══ */
  const submitQC = async () => {
    const rejected = Object.keys(qcRejects).filter((k) => qcRejects[k]);
    if (rejected.length === 0) {
      setPhase("done");
      addLog(`[QC 승인] 전량 통과 — 제출 팩 내보내기 가능`);
      exportSubmitPack(); // Adobe 다음 미캔 자동 실행 (다시 묻지 않음)
      return;
    }
    setSlots((p) => p.map((s) => rejected.includes(s.index)
      ? { ...s, status: "rejected", dataUrl: "", rejectReason: s.autoFlag || qcReason || "visual defect", qcNote: s.autoFlag || qcReason || "" } : s));
    setQcRejects({}); setQcReason("");
    addLog(`[격리] 슬롯 ${rejected.join(", ")} — 해당 슬롯만 재생성 (사유는 슬롯별 기록)`);
    setPhase("review");
  };

  /* ═══ 자동 검수 — 텍스트/왜곡/문화오류/주제이탈/구도 위반 자동 플래그 ═══ */
  /* dataUrl → 검수용 축소 JPEG base64 (전송량·비용 절감) */
  const shrinkForVision = (dataUrl) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 768;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.src = dataUrl;
  });

  const runAutoQC = async () => {
    if (autoQcBusy) return;
    const targets = slots.filter((s) => s.status === "success" && s.dataUrl);
    if (targets.length === 0) return;
    setAutoQcBusy(true);
    addLog(`[자동 검수] ${brainName} Vision — ${targets.length}장 검사 시작`);
    let flagged = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setAutoQcProg({ done: i, total: targets.length });
      try {
        const b64 = await shrinkForVision(t.dataUrl);
        const r = await askBrain(
          `You are a strict stock-photo QC inspector. Respond ONLY JSON:
{"pass":true|false,"issues":["short tags"],"reason":"one short Korean sentence explaining the main problem (empty if pass)"}
Reject (pass=false) if ANY of these appear: (1) visible text, letters, numbers, or writing of any kind IN ANY LANGUAGE OR SCRIPT — including Korean Hangul, Chinese and Japanese characters, decorative calligraphy, wall-hung verses, banners, and embossed/engraved lettering on book covers or leather (this is the #1 stock rejection: inspect walls, frames, banners, book covers and screens closely), (2) logos, brands, watermarks, branded packaging, (3) distorted objects, anatomy (hands/faces), or architecture, (4) cultural inaccuracy (wrong flag, wrong food form, wrong ritual objects/counts), (5) clearly off-topic vs the stated topic, (6) composition violating the stated mode — wallpaper mode needs a 40-60% clean low-density copy area; commercial mode: the subject must clearly dominate (50-70%) and empty area must stay under ~40% — reject if the subject looks small and lost in a vast featureless background, (7) TECHNICAL QUALITY like an Adobe Stock reviewer: reject ONLY when the MAIN SUBJECT (the hero object/person) is itself soft, out of focus or missed focus; or visible noise/grain/banding; or obvious plastic over-smoothed AI skin/texture; or clear AI shape distortion; or over-sharpening halos; or blown-out white highlights or crushed muddy shadows; or a heavy filter/vignette/HDR look. IMPORTANT: a soft, gently blurred or bokeh BACKGROUND is NOT a defect by itself — natural shallow depth-of-field with a tack-sharp subject is normal and DESIRABLE in professional lifestyle and product stock, so do NOT reject for background blur alone, (8) COMMERCIAL-SALES KILLERS (commercial mode only — skip for wallpaper/emotional/faith modes): a busy, cluttered or visually noisy background that competes with the subject; a visible crowd or dense group of unintended people; strong lens flare, sun glare or a harsh blown-out backlight that hides the subject as a silhouette. Natural gentle background bokeh is ACCEPTABLE — reject background blur ONLY when it looks artificial, melted or smeared like an AI artifact (not natural optical bokeh), or when the main subject itself is not sharp. Be strict on text, logos, distortion and a soft main subject; be lenient on natural background blur and subjective style taste. File count being correct is irrelevant — judge the pixels only.`,
          `Topic: "${topic}" · Mode: ${mode} · Slot ${t.index} subject: "${t.subject}"\n이 이미지를 검수해줘.`,
          { mime: "image/jpeg", data: b64 }
        );
        if (r.pass === false) {
          flagged += 1;
          const reason = r.reason || (r.issues || []).join(", ") || "자동 검수 거절";
          setQcRejects((p) => ({ ...p, [t.index]: true }));
          updateSlot(t.index, "autoFlag", reason);
          addLog(`[플래그 ${t.index}] ${reason}`);
        } else {
          updateSlot(t.index, "autoFlag", "");
          addLog(`[통과 ${t.index}]`);
        }
      } catch (err) {
        addLog(`[오류] 슬롯 ${t.index} 검수 실패: ${err.message} — 수동 확인 필요`);
      }
      await new Promise((r2) => setTimeout(r2, 400));
    }
    setAutoQcProg(null);
    setAutoQcBusy(false);
    addLog(`[자동 검수 완료] ${flagged}건 플래그 — 표시만 했으니 최종 판단은 지원님이 하세요`);
    setNotice(flagged > 0
      ? `자동 검수: ${flagged}건 플래그했습니다. 카드에서 사유를 확인하고, 동의하지 않으면 클릭해서 플래그를 해제한 뒤 제출하세요.`
      : "자동 검수: 전량 통과했습니다. 직접 훑어본 뒤 승인하세요.");
  };

  /* ═══ 내보내기 ═══ */
  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── 저장 폴더 선택 (Chrome/Edge · File System Access API) ── */
  const pickSaveDir = async () => {
    if (!window.showDirectoryPicker) {
      setNotice("이 브라우저는 폴더 선택을 지원하지 않습니다 (Chrome/Edge 필요). 기본 다운로드 폴더로 저장됩니다.");
      return;
    }
    try {
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      setSaveDir(dir);
      addLog(`[저장 폴더] "${dir.name}" 선택됨 — 이후 파일은 이 폴더로 바로 저장`);
    } catch { /* 사용자 취소 */ }
  };

  /* 선택 폴더가 있으면 그 폴더에 직접 쓰고, 없으면 기본 다운로드 */
  const saveBlob = async (blob, name) => {
    if (saveDir) {
      try {
        const fh = await saveDir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        addLog(`[저장] ${saveDir.name}/${name}`);
        return;
      } catch (err) {
        addLog(`[저장 오류] 폴더 쓰기 실패(${err.message}) — 기본 다운로드로 대체`);
      }
    }
    download(blob, name);
  };

  const dataUrlToU8 = (dataUrl) => {
    const bin = atob(dataUrl.split(",")[1]);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  };

  /* ── 프롬프트 TXT 백업 (생성 실패 대비 · 다른 AI 이식용) ── */
  const exportPromptsMin = () => {
    const rows = slots.filter((s) => s.subject);
    if (!rows.length) { setNotice("내보낼 슬롯이 없습니다."); return; }
    const head =
      `# FreeJJang 프롬프트 (일반·자연어) — 주제: ${topic || "(미지정)"} · 모드: ${mode} · 종횡비: ${aspect}\n` +
      `# 배제 규칙이 문장에 포함된 자연어 프롬프트입니다.\n` +
      `# GPT gpt-image / Firefly / Stable Diffusion / DALL·E 등에 그대로 붙여넣어 쓰세요.\n` +
      `# (Midjourney는 옆의 'Midjourney용' 버튼을 쓰세요 — --no/--ar 문법으로 변환됩니다)\n\n`;
    const body = rows.map((s) => `[${s.index}] ${s.title_kr || s.title || ""}\n${s.finalPrompt || buildSlotPrompt(s, mode, refTone, refPeople, wantKoreanCast(), refHands)}`).join("\n\n");
    saveBlob(new Blob([head + body], { type: "text/plain;charset=utf-8" }), `${cleanName(topic, 20) || "freejjang"}-prompts-min.txt`);
    addLog(`[백업] 프롬프트 TXT(일반) 저장 완료 — ${rows.length}슬롯`);
  };
  /* ── Midjourney 형식 변환: 자연어 배제문 → --no 플래그, --ar/--style raw 부착 ── */
  const exportPromptsMidjourney = () => {
    const rows = slots.filter((s) => s.subject);
    if (!rows.length) { setNotice("내보낼 슬롯이 없습니다."); return; }
    const head =
      `# FreeJJang 프롬프트 (Midjourney 형식) — 주제: ${topic || "(미지정)"} · 종횡비: ${aspect}\n` +
      `# 배제문을 --no 로, 종횡비를 --ar 로, 사진 슬롯은 --style raw 로 자동 변환했습니다.\n` +
      `# 아래는 순수 영어 프롬프트만 담았습니다 (한 줄 = 슬롯 하나). 그대로 미드저니에 붙여넣으세요.\n\n`;
    const body = rows.map((s) => toMidjourney(s, mode, refTone, refPeople, aspect, refHands)).join("\n\n");
    saveBlob(new Blob([head + body], { type: "text/plain;charset=utf-8" }), `${cleanName(topic, 20) || "freejjang"}-prompts-midjourney.txt`);
    addLog(`[백업] 프롬프트 TXT(Midjourney) 저장 완료 — ${rows.length}슬롯`);
  };
  const buildPromptsFullText = (rows) => {
    const head =
      `# FreeJJang 프롬프트 (전체 필드 · 백업) — 주제: ${topic || "(미지정)"} · 모드: ${mode} · 종횡비: ${aspect} · 요청 ${count}장\n` +
      `# 최종 프롬프트 + 구성 필드 + 한/영 키워드 + 카테고리 + 상태. 세션 복원·타 시스템 재생성용.\n\n`;
    return head + rows.map((s) => [
      `[${s.index}] ${s.title_kr || ""} / ${s.title || ""}`,
      `status: ${s.status}`,
      `final_prompt: ${s.finalPrompt || buildSlotPrompt(s, mode, refTone, refPeople, wantKoreanCast(), refHands)}`,
      `subject: ${s.subject || ""}`,
      `props: ${s.props || ""}`,
      `kind: ${s.kind || ""}`,
      `focal_placement: ${s.focal_placement || ""}`,
      `copy_space: ${s.copy_space || ""}`,
      `camera: ${s.camera || ""}`,
      `lighting: ${s.lighting || ""}`,
      `palette: ${s.palette || ""}`,
      `category: ${s.category} (${ADOBE_CATEGORIES[s.category] || "?"})`,
      `keywords_en: ${normKeywords(s.keywords, ADOBE_MAX_KEYWORDS)}`,
      `keywords_kr: ${normKeywords(s.keywords_kr, MIRI_MAX_KEYWORDS)}`,
    ].join("\n")).join("\n\n────────────────────────────\n\n");
  };
  const exportPromptsFull = () => {
    const rows = slots.filter((s) => s.subject);
    if (!rows.length) { setNotice("내보낼 슬롯이 없습니다."); return; }
    saveBlob(new Blob([buildPromptsFullText(rows)], { type: "text/plain;charset=utf-8" }), `${cleanName(topic, 20) || "freejjang"}-prompts-full.txt`);
    addLog(`[백업] 프롬프트 TXT(전체) 저장 완료 — ${rows.length}슬롯`);
  };

  /* ── Midjourney 배치 TXT — midjourney-batch/mj_batch.py 로 바로 넣는 파이프라인 ── */
  const exportMidjourneyBatch = () => {
    const rows = slots.filter((s) => s.subject);
    if (!rows.length) { setNotice("내보낼 슬롯이 없습니다."); return; }
    const head =
      `# FreeJJang → Midjourney 배치 — 주제: ${topic || "(미지정)"} · 종횡비: ${aspect} · ${rows.length}개\n` +
      `# 사용법: 이 파일을 midjourney-batch/mj_batch.py 에 그대로 넣으세요\n` +
      `#   python mj_batch.py --prompts <이파일>.txt\n` +
      `# 한 줄 = 프롬프트 하나. '#' 줄과 빈 줄은 무시됩니다.\n` +
      `# --ar/--style/--no 파라미터는 이미 포함됨. 버전을 고정하려면 각 줄 끝에 --v 6.1 등을 추가하세요.\n\n`;
    const body = rows.map((s) => buildMidjourneyPrompt(s, { aspect, tone: refTone, people: refPeople })).join("\n");
    saveBlob(new Blob([head + body], { type: "text/plain;charset=utf-8" }), `${cleanName(topic, 20) || "freejjang"}-midjourney.txt`);
    addLog(`[미드저니] 배치 TXT 저장 — ${rows.length}슬롯 (mj_batch.py 파이프라인용)`);
  };

  /* ═══ 이코노미 2패스 마감 — 승인된 low 드래프트만 편집 API로 고품질(medium/high) 리렌더 (구도 유지) ═══ */
  const finalizeSlots = async (list) => {
    const targets = list.filter((s) => s.status === "success" && s.dataUrl && !s.finalized);
    if (targets.length === 0) return list;
    cancelRef.current = false;
    setPhase("generating");
    addLog(`[마감] 이코노미 2패스 — 승인 ${targets.length}장을 ${finalQuality}로 리렌더 (구도 유지)`);
    let out = [...list];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (cancelRef.current) { addLog(`[마감 중단] 나머지는 드래프트 화질로 저장됩니다`); break; }
      setProg({ done: i, total: targets.length, stage: `슬롯 ${t.index} 마감 리렌더 (${finalQuality})` });
      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          const hi = await genOpenAIRefine(openaiKey.trim(), t.finalPrompt || "", t.dataUrl, aspect, finalQuality);
          setSpent((p) => ({ img: p.img + 1, cost: p.cost + (OPENAI_COST[finalQuality] || 0.041) }));
          out = out.map((s) => (s.index === t.index ? { ...s, dataUrl: hi, finalized: true } : s));
          setSlots(out);
          addLog(`[마감 ${t.index}] 완료`);
          break;
        } catch (err) {
          if (attempt === 0 && TRANSIENT_RE.test(err.message)) { await new Promise((r) => setTimeout(r, 4000)); continue; }
          addLog(`[마감 실패 ${t.index}] ${err.message} — 드래프트 화질로 유지`);
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    setProg(null);
    setPhase("done");
    return out;
  };

  /* ── 미캔·어도비 공용 파일명 베이스 (한 곳에서만 만들어 팩 간 어긋남 방지) ── */
  const assetBaseName = (s) => `${s.index}-${cleanName(topic, 15)}-${s.slug}`;
  /* ── 미리캔버스 업로드 XLSX 생성 (통합 팩·미캔 전용 팩 공용 단일 소스) ──
     반환: { buf, rows } — rows[i].fileName 은 확장자 없는 파일명(이미지와 1:1로 대조 가능) */
  const buildMiriXlsx = (ok) => {
    const rows = ok.map((s) => ({
      fileName: `${assetBaseName(s)}_miri`,
      elementName: [(s.title_kr || "").substring(0, 8), s.title].filter(Boolean).join(" "),
      keywords: normKeywords(s.keywords_kr, MIRI_MAX_KEYWORDS),
      tier: "Premium", contentType: "Photo",
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: ["fileName", "elementName", "keywords", "tier", "contentType"], cellFormats: true });
    /* 한글 셀을 명시적으로 텍스트 타입으로 고정 (UTF-16 인코딩 오류 방지) */
    for (let i = 1; i <= rows.length; i++) {
      if (ws[`B${i}`]) ws[`B${i}`].t = "s"; // elementName (한글)
      if (ws[`C${i}`]) ws[`C${i}`].t = "s"; // keywords (한글)
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return { buf: XLSX.write(wb, { bookType: "xlsx", type: "array" }), rows };
  };

  /* ═══ 미리캔버스 전용 제출 팩 — 미캔은 승인율이 높아 어도비 규격을 빼고 미캔 파일만 구성.
     이미지(4MP+ 고해상 JPG) + 미캔 XLSX + 프롬프트 백업. 누락 방지를 위해 이중 체크(이미지↔XLSX 1:1). ═══ */
  const exportMiriPack = async (list) => {
    let src = Array.isArray(list) ? list : slots;
    if (ecoTwoPass && provider === "openai" && src.some((s) => s.status === "success" && s.dataUrl && !s.finalized)) {
      src = await finalizeSlots(src);
    }
    const ok = src.filter((s) => s.status === "success" && s.dataUrl);
    if (ok.length === 0) { setNotice("미리캔버스로 내보낼 성공 이미지가 없습니다."); return; }
    const base = cleanName(topic, 20) || "freejjang";
    addLog(`[미캔 팩] 미리캔버스 전용 ZIP 생성 시작 — 성공 이미지 ${ok.length}장 (어도비 규격 제외)`);
    const zip = new JSZip();
    const imgNames = new Set(); // 실제 ZIP에 담긴 이미지 파일명(확장자 제외) — XLSX와 대조용
    for (let i = 0; i < ok.length; i++) {
      const s = ok[i];
      const nameBase = `${assetBaseName(s)}_miri`;
      setProg({ done: i, total: ok.length, stage: `미캔 슬롯 ${s.index} 고해상 변환` });
      try {
        const up = await upscaleForAdobe(s.dataUrl); // 미캔도 고해상일수록 승인·품질 유리
        zip.file(`images/${nameBase}.jpg`, dataUrlToU8(up.jpeg));
        imgNames.add(nameBase);
        if (up.factor > 1) addLog(`[미캔 업스케일 ${s.index}] ${s.px ? `${s.px.w}×${s.px.h}` : "원본"} → ${up.w}×${up.h}`);
      } catch (e) {
        zip.file(`images/${nameBase}.png`, dataUrlToU8(s.dataUrl));
        imgNames.add(nameBase);
        addLog(`[미캔 업스케일 실패 ${s.index}] 원본 PNG 동봉 — ${e.message}`);
      }
    }
    setProg(null);
    /* 미캔 XLSX (이미지와 동일 소스로 생성) */
    const { buf, rows } = buildMiriXlsx(ok);
    zip.file(`${base}-miricanvas.xlsx`, buf);
    zip.file(`${base}-prompts-full.txt`, buildPromptsFullText(ok));
    /* ── 이중 체크: 이미지 ↔ XLSX ↔ 성공 슬롯이 1:1로 정확히 맞는지 누락 검증 ── */
    const issues = [];
    if (imgNames.size !== ok.length) issues.push(`이미지 ${imgNames.size}장 ≠ 성공 ${ok.length}장`);
    if (rows.length !== ok.length) issues.push(`XLSX 행 ${rows.length} ≠ 성공 ${ok.length}장`);
    const missingImg = rows.filter((r) => !imgNames.has(r.fileName)).map((r) => r.fileName);
    const missingRow = [...imgNames].filter((n) => !rows.some((r) => r.fileName === n));
    if (missingImg.length) issues.push(`XLSX엔 있으나 이미지 없음: ${missingImg.join(", ")}`);
    if (missingRow.length) issues.push(`이미지엔 있으나 XLSX 없음: ${missingRow.join(", ")}`);
    const noKw = rows.filter((r) => !r.keywords.trim()).map((r) => r.fileName);
    if (noKw.length) issues.push(`한글 키워드 비어있음(미캔 검색 노출 불리): ${noKw.join(", ")}`);
    if (issues.length) {
      addLog(`[미캔 팩 ⚠ 검증] ${issues.length}건 — ${issues.join(" · ")}`);
    } else {
      addLog(`[미캔 팩 ✓ 검증] 이미지 ${imgNames.size} = XLSX ${rows.length} = 성공 ${ok.length} — 누락 없음`);
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    await saveBlob(blob, `${base}-miricanvas-pack.zip`);
    addLog(`[미캔 팩] ZIP 저장 완료 — 이미지 ${ok.length}장 + 미캔 XLSX + 프롬프트 TXT`);
    setNotice(
      issues.length
        ? `⚠ 미리캔버스 팩 저장됨 (이미지 ${ok.length}장) — 검증에서 ${issues.length}건 발견: ${issues.join(" · ")}. 실행 로그를 확인하세요.`
        : `✅ 미리캔버스 전용 팩 저장 완료: 이미지 ${ok.length}장 · 미캔 XLSX · 프롬프트 백업${saveDir ? ` → "${saveDir.name}" 폴더` : ""}. 이중 체크 통과(이미지=XLSX=${ok.length}, 누락 없음). 어도비 규격은 제외했습니다.`
    );
  };

  /* ═══ 제출 팩 — ZIP 하나로 묶어 저장 (이미지 + Adobe CSV + 미캔 XLSX + 프롬프트 백업) ═══ */
  const exportSubmitPack = async (list) => {
    let src = Array.isArray(list) ? list : slots;
    /* 이코노미 2패스: 아직 마감 안 된 승인본이 있으면 먼저 고품질 리렌더 */
    if (ecoTwoPass && provider === "openai" && src.some((s) => s.status === "success" && s.dataUrl && !s.finalized)) {
      src = await finalizeSlots(src);
    }
    const ok = src.filter((s) => s.status === "success" && s.dataUrl);
    if (ok.length === 0) { setNotice("성공한 이미지가 없습니다."); return; }
    const base = cleanName(topic, 20) || "freejjang";
    addLog(`[제출 팩] ZIP 생성 중 — 이미지 ${ok.length}장…`);
    const zip = new JSZip();
    /* 이미지: adobe/ = 4MP+ 자동 업스케일 JPEG (CSV 파일명과 일치 → 바로 업로드), miri/ = 원본 PNG */
    addLog(`[제출 팩] 어도비 규격(4MP+) 자동 업스케일 중…`);
    for (let i = 0; i < ok.length; i++) {
      const s = ok[i];
      const name = assetBaseName(s);
      setProg({ done: i, total: ok.length, stage: `슬롯 ${s.index} 업스케일·압축` });
      try {
        const up = await upscaleForAdobe(s.dataUrl);
        zip.file(`images/adobe/${name}_adobe.jpg`, dataUrlToU8(up.jpeg));
        if (up.factor > 1) {
          addLog(`[업스케일 ${s.index}] ${s.px ? `${s.px.w}×${s.px.h}` : "원본"} → ${up.w}×${up.h} (${up.factor}배)`);
          if (s.px && s.px.w * s.px.h < 1e6) addLog(`[주의 ${s.index}] 저해상도 원본의 고배율 업스케일 — 어도비 심사 탈락 위험, GPT 엔진 재생성 권장`);
        }
      } catch (e) {
        zip.file(`images/adobe/${name}_adobe.png`, dataUrlToU8(s.dataUrl));
        addLog(`[업스케일 실패 ${s.index}] 원본 그대로 동봉 — ${e.message}`);
      }
      zip.file(`images/miri/${name}_miri.png`, dataUrlToU8(s.dataUrl));
    }
    setProg(null);
    /* Adobe CSV */
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Filename", "Title", "Keywords", "Category", "Releases", "is_ai_generated"];
    const rows = ok.map((s) =>
      [`${s.index}-${cleanName(topic, 15)}-${s.slug}_adobe.jpg`, s.title, normKeywords(s.keywords, ADOBE_MAX_KEYWORDS), s.category, "", "Yes"].map(esc).join(","));
    zip.file(`${base}-adobe-metadata.csv`, "﻿" + [header.map(esc).join(","), ...rows].join("\r\n"));
    /* MiriCanvas XLSX — 미캔 전용 팩과 동일 소스(buildMiriXlsx)로 생성해 팩 간 어긋남 방지 */
    const { buf } = buildMiriXlsx(ok);
    zip.file(`${base}-miricanvas.xlsx`, buf);
    /* 프롬프트 전체 백업도 동봉 */
    zip.file(`${base}-prompts-full.txt`, buildPromptsFullText(ok));
    /* ZIP 저장 (선택 폴더 or 기본 다운로드) */
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    await saveBlob(blob, `${base}-submit-pack.zip`);
    addLog(`[제출 팩] ZIP 저장 완료 — 이미지 ${ok.length}장 + Adobe CSV + 미캔 XLSX + 프롬프트 TXT (요청 ${count}장 대비 ${ok.length === count ? "정확 일치 ✓" : "불일치 ⚠"})`);
    setNotice(`제출 팩 ZIP 저장 완료: 이미지 ${ok.length}장 · Adobe CSV · 미캔 XLSX · 프롬프트 백업${saveDir ? ` → "${saveDir.name}" 폴더` : ""}${ok.length !== count ? ` — 요청 ${count}장과 다릅니다. 미완료 슬롯을 확인하세요.` : ""} ✅ adobe 폴더의 JPG는 4MP+ 자동 업스케일 완료 — CSV와 파일명이 일치해 바로 업로드 가능합니다. 제출 전 100% 확대로 아티팩트만 한번 훑어보세요.`);
  };

  const updateSlot = (index, field, value) =>
    setSlots((p) => p.map((s) => (s.index === index ? { ...s, [field]: value } : s)));

  /* ── 수정(Fix) 모드: 완료/QC 후에도 다시 편집 단계로 되돌리기 ── */
  const backToEdit = () => {
    setQcRejects({}); setQcReason("");
    setPhase("review");
    addLog(`[수정 모드] 편집 단계로 복귀 — 슬롯별 재생성·삭제 가능`);
    setNotice("수정 모드로 돌아왔습니다. 슬롯을 편집한 뒤 '이 슬롯 재생성'으로 다시 만들거나, 상단 '승인'을 눌러 이어서 진행하세요.");
  };

  /* ── 슬롯 단건 재생성 (편집한 구도/앵글 즉시 반영) ── */
  const regenSlot = async (t) => {
    if (!imageKey()) { setNotice("이미지 API 키가 필요합니다."); return; }
    if (phase === "generating") return;
    /* 거절/플래그 사유가 있으면 교정 지시로 주입 (같은 실수 반복 차단) — 프롬프트를 먼저 깔고 생성 */
    const note = t.qcNote || t.autoFlag || "";
    const fp = buildSlotPrompt({ ...t, qcNote: note }, mode, refTone, refPeople, wantKoreanCast(), refHands);
    setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "generating", finalPrompt: fp, dataUrl: "" } : s)));
    addLog(`[재생성 ${t.index}] ${CAMERA_ANGLES[t.angle]?.label || "자동"} · 시작`);
    try {
      if (note) addLog(`[교정 ${t.index}] 이전 거절 사유 반영: ${note}`);
      const dataUrl = await generateImage(fp, ecoTwoPass && provider === "openai" ? "low" : undefined);
      const eng = engineUsedRef.current;
      const px = await getDims(dataUrl).catch(() => null);
      setSlots((p) => p.map((s) => (s.index === t.index
        ? { ...s, status: "success", dataUrl, finalPrompt: fp, rejectReason: "", qcNote: "", autoFlag: "", finalized: false, engine: eng, px, regenCount: s.regenCount + 1 } : s)));
      setQcRejects((p) => { const n = { ...p }; delete n[t.index]; return n; });
      addLog(`[재생성 ${t.index}] 완료`);
    } catch (err) {
      setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "failed", rejectReason: err.message } : s)));
      addLog(`[재생성 실패 ${t.index}] ${err.message}`);
    }
  };

  /* ═══ 자동 수정 — 검수 거절 슬롯을 두뇌가 장면부터 고쳐 쓰고 곧바로 재생성.
     '재생성'은 교정 지시만 얹지만, 자동 수정은 텍스트/로고를 유발한 장면 요소 자체를 제거한다
     (예: 벽 서예 → 맨 벽, 각인된 성경 커버 → 완전 무지 커버) ═══ */
  const [autoFixBusy, setAutoFixBusy] = useState(false);
  const autoFixSlot = async (t) => {
    if (!imageKey()) { setNotice("이미지 API 키가 필요합니다."); return; }
    if (phase === "generating" || t.status === "generating") return;
    const note = t.autoFlag || t.qcNote || "";
    let fixed = t;
    if (note) {
      addLog(`[자동 수정 ${t.index}] 두뇌가 거절 사유를 반영해 장면 수정 중… (${note})`);
      try {
        const r = await askBrain(
          `You fix a stock-image slot that FAILED automated QC. Respond ONLY compact JSON: {"subject":"...","props":"...","camera":"...","lighting":"..."}
Rewrite the scene fields so the flagged problem is IMPOSSIBLE in the next render — remove or replace the element that caused it: text/lettering in any language (incl. Korean Hangul, calligraphy, wall verses, banners, embossed book covers) → plain bare walls and completely blank unmarked covers/surfaces; logos/brands → plain unbranded generic items; distortion-prone elements (hands doing complex grips, dense repetitive patterns) → simpler poses and surfaces; composition problems → follow the stated correction. KEEP the same location, primary action and mood so the set stays diverse. All fields ENGLISH ONLY, professional stock photography style.`,
          `Slot ${t.index} — subject: "${t.subject}" | props: "${t.props || ""}" | camera: "${t.camera || ""}" | lighting: "${t.lighting || ""}"\nQC rejection reason (Korean): "${note}". Mode: ${mode}.`
        );
        const out = {};
        for (const k of ["subject", "props", "camera", "lighting"]) if (typeof r[k] === "string" && r[k].trim()) out[k] = r[k].trim();
        if (Object.keys(out).length) {
          fixed = { ...t, ...out };
          setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, ...out, repaired: true } : s)));
          addLog(`[자동 수정 ${t.index}] 장면 수정 완료 — 재생성 시작`);
        }
      } catch (err) {
        addLog(`[자동 수정 ${t.index}] 장면 수정 실패(${err.message}) — 교정 지시만으로 재생성`);
      }
    }
    await regenSlot(fixed);
  };
  /* 플래그된 슬롯 전부 자동 수정 (순차 — 레이트리밋·비용 안전) */
  const autoFixFlagged = async () => {
    if (autoFixBusy) return;
    const targets = slots.filter((s) => s.autoFlag && s.status === "success");
    if (!targets.length) { setNotice("자동 수정할 플래그 슬롯이 없습니다. 먼저 자동 검수를 돌리세요."); return; }
    setAutoFixBusy(true);
    addLog(`[자동 수정] 플래그 ${targets.length}건 일괄 수정 시작`);
    for (const t of targets) await autoFixSlot(t);
    setAutoFixBusy(false);
    addLog(`[자동 수정] ${targets.length}건 완료 — 자동 검수를 한 번 더 돌려 확인하세요`);
    setNotice(`자동 수정 ${targets.length}건 완료. 자동 검수를 다시 돌려 통과 여부를 확인하세요.`);
  };

  /* ── 슬롯 삭제 (번호 재정렬) ── */
  const deleteSlot = (index) => {
    setSlots((p) => p.filter((s) => s.index !== index).map((s, i) => ({ ...s, index: pad2(i + 1) })));
    setQcRejects({});
    addLog(`[삭제] 슬롯 ${index} 제거 — 번호 재정렬됨`);
  };

  /* ═══ 기본 생성 (자유 프롬프트) ═══ */
  const handleFreeGen = async (base) => {
    const b = (base ?? freePrompt).trim();
    if (!b || isGen) return;
    setIsGen(true);
    addLog(`[단일] 이미지 요청`);
    try {
      const dataUrl = await generateImage(`${b}. ${GUARD}`);
      const item = { id: Date.now() + "", dataUrl, prompt: b, createdAt: new Date().toISOString() };
      setFreeGallery((p) => [item, ...p]);
      setSelectedFree(item.id);
      addLog(`[단일] 완료`);
    } catch (err) { addLog(`[오류] ${err.message}`); setNotice(err.message); }
    setIsGen(false);
  };

  /* ═══ 이미지 분석 (13블록) ═══ */
  const handleAnaFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setAnaImage({ dataUrl, mime: file.type || "image/png", base64: String(dataUrl).split(",")[1], name: file.name });
      setAnaResult(null);
    };
    reader.readAsDataURL(file);
  };
  const runAnalysis = async () => {
    if (!anaImage || anaBusy) return;
    setAnaBusy(true);
    addLog(`[분석] 13블록 분해 시작 (두뇌 ${brainName})`);
    try {
      const r = await askBrain(
        `You analyze reference images for stock reproduction. Respond ONLY JSON:
{"description":"2-3 sentence Korean summary","blocks":[{"name":"주제","content":"..."} x13 in order: ${ANALYSIS_BLOCKS.join(", ")}],"prompt":"one compact English generation prompt reproducing structure (not identity), include no-text rule"}
Each block content = one short Korean sentence.`,
        `이 이미지를 13개 블록으로 분석하고 생성용 영어 프롬프트를 만들어줘.${anaExtra ? ` 추가 지시: ${anaExtra}` : ""}`,
        { mime: anaImage.mime, data: anaImage.base64 }
      );
      setAnaResult(r);
      addLog(`[분석] 완료`);
    } catch (err) { addLog(`[오류] 분석 실패: ${err.message}`); setNotice(err.message); }
    setAnaBusy(false);
  };

  const statusChip = (s) => {
    const map = {
      pending: "bg-neutral-700 text-neutral-400",
      generating: "bg-amber-500/15 text-amber-300 animate-pulse",
      success: "bg-emerald-500/15 text-emerald-300",
      failed: "bg-red-500/15 text-red-300",
      rejected: "bg-orange-500/15 text-orange-300",
    };
    return <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${map[s.status]}`}>{s.status}</span>;
  };

  const selectedFreeItem = freeGallery.find((g) => g.id === selectedFree);
  const successCount = slots.filter((s) => s.status === "success").length;

  const TabBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition ${
        tab === id ? "border-violet-500 text-violet-300 bg-neutral-800" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  /* 공용 다크 입력/셀렉트 클래스 */
  const fieldCls = "text-xs px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-violet-500";
  /* 승인 대기 시 주의를 끄는 글로우 펄스 (buildSlotPrompt 무관, UI 전용) */
  const attnPulse = { animation: "attnGlow 1.4s ease-in-out infinite" };

  return (
    <div className={`min-h-screen ${theme === "light" ? "light-theme bg-gray-100 text-gray-800" : "bg-neutral-900 text-neutral-200"}`} style={{ fontFamily: "'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif" }}>
      <style>{`@keyframes attnGlow{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.6)}50%{box-shadow:0 0 0 9px rgba(139,92,246,0)}}
.light-theme .bg-neutral-950{background-color:#f9fafb}
.light-theme .bg-neutral-900{background-color:#f3f4f6}
.light-theme .bg-neutral-800{background-color:#fff}
.light-theme .bg-neutral-700{background-color:#e5e7eb}
.light-theme .text-neutral-100{color:#111827}
.light-theme .text-neutral-200{color:#1f2937}
.light-theme .text-neutral-300{color:#374151}
.light-theme .text-neutral-400{color:#6b7280}
.light-theme .text-neutral-500{color:#9ca3af}
.light-theme .text-neutral-600{color:#c9cbd1}
.light-theme .border-neutral-700{border-color:#d1d5db}
.light-theme .border-neutral-800{border-color:#e5e7eb}
.light-theme .border-neutral-600{border-color:#d1d5db}
.light-theme .border-neutral-700\\/60{border-color:rgba(209,213,219,.6)}
.light-theme .bg-neutral-950\\/40{background-color:rgba(249,250,251,.4)}
.light-theme .bg-neutral-950\\/75{background-color:rgba(249,250,251,.75)}
.light-theme .bg-neutral-950\\/90{background-color:rgba(249,250,251,.9)}
.light-theme .hover\\:bg-neutral-700:hover{background-color:#e5e7eb}
.light-theme .hover\\:bg-neutral-800:hover{background-color:#f3f4f6}
.light-theme .hover\\:text-neutral-200:hover{color:#1f2937}
.light-theme .hover\\:text-neutral-300:hover{color:#374151}
.light-theme .hover\\:text-white:hover{color:#111827}
.light-theme .disabled\\:bg-neutral-700:disabled{background-color:#e5e7eb}
.light-theme .disabled\\:text-neutral-500:disabled{color:#9ca3af}
.light-theme .text-violet-300,.light-theme .text-violet-400,.light-theme .text-violet-200{color:#7c3aed}
.light-theme .text-emerald-300,.light-theme .text-emerald-400,.light-theme .text-emerald-200{color:#059669}
.light-theme .text-amber-300,.light-theme .text-amber-200{color:#d97706}
.light-theme .text-red-300,.light-theme .text-red-400{color:#dc2626}
.light-theme .text-sky-300,.light-theme .text-sky-200{color:#0284c7}
.light-theme .text-rose-300{color:#e11d48}
.light-theme .text-indigo-200{color:#4f46e5}
.light-theme .text-orange-300{color:#ea580c}
.light-theme .text-violet-300\\/80{color:#7c3aed}
.light-theme .text-emerald-300\\/80{color:#059669}
.light-theme .text-amber-300\\/80,.light-theme .text-amber-300\\/90{color:#d97706}
.light-theme .text-amber-400\\/80{color:#d97706}
.light-theme .text-rose-300\\/80{color:#e11d48}
.light-theme .hover\\:text-red-400:hover{color:#dc2626}
.light-theme .hover\\:text-rose-300:hover{color:#e11d48}
.light-theme .shadow-xl{box-shadow:0 4px 24px rgba(0,0,0,.08)}
`}</style>

      {/* ═══ 헤더 ═══ */}
      <header className="bg-neutral-800 border-b border-neutral-700 px-4 pt-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-950 border border-neutral-700 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-neutral-100">
                  FreeJJang <span className="text-neutral-500 font-normal">STOCK STUDIO</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-violet-500/10 text-violet-300 border border-violet-500/30 rounded ml-2">
                    두뇌 {brainName} · 손 {provider === "openai" ? "GPT" : provider === "pollinations" ? "Pollinations(무료)" : "Gemini"}
                  </span>
                </h1>
                <p className="text-[10px] text-neutral-500">초안 승인 → 순차 생성 → QC → 제출 팩 · 멈춤은 딱 두 곳</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "밝은 테마로 전환" : "어두운 테마로 전환"}
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:text-neutral-100 transition">
                {theme === "dark" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                {theme === "dark" ? "밝게" : "어둡게"}
              </button>
              <button onClick={startFresh}
                title="슬롯·이미지·로그를 비우고 새 프로젝트 시작 (API 키·설정은 유지)"
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition">
                <RefreshCw className="w-3 h-3" /> Start Fresh
              </button>
              <button onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded border transition ${
                  imageKey() ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-300"}`}>
                <Key className="w-3 h-3" /> {imageKey() ? "엔진 연결됨" : "API 키 필요"} <Settings2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="pb-2 flex flex-wrap items-end gap-2">
              {/* 두뇌 + API 키 */}
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">두뇌</label>
                <select value={brain} onChange={(e) => setBrain(e.target.value)} className={fieldCls}>
                  <option value="gpt">GPT (Codex)</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
              {brain === "gpt" && (
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">GPT 모델</label>
                  <input list="gptModels" value={gptModel} onChange={(e) => setGptModel(e.target.value)} placeholder={GPT_MODEL_DEFAULT}
                    className={`${fieldCls} font-mono w-36`} />
                  <datalist id="gptModels">{GPT_MODEL_PRESETS.map((m) => <option key={m} value={m} />)}</datalist>
                </div>
              )}
              {brain === "gemini" && (
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">Gemini 모델</label>
                  <input list="geminiModels" value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} placeholder={GEMINI_MODEL_DEFAULT}
                    className={`${fieldCls} font-mono w-40`} />
                  <datalist id="geminiModels">{GEMINI_MODEL_PRESETS.map((m) => <option key={m} value={m} />)}</datalist>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">OpenAI Key</label>
                <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-…"
                  className={`${fieldCls} font-mono w-36`} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">Google Key</label>
                <input type="password" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} placeholder="AQ… / AIzaSy…"
                  className={`${fieldCls} font-mono w-40`} />
              </div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-300 pb-1 cursor-pointer select-none">
                <input type="checkbox" checked={autoFallback} onChange={(e) => setAutoFallback(e.target.checked)}
                  className="w-3.5 h-3.5 accent-violet-500" />
                자동 폴백
              </label>

              {/* 이미지 엔진 */}
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">이미지 엔진 (손)</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className={fieldCls}>
                  <option value="openai">GPT (gpt-image · 기본)</option>
                  <option value="gemini">Gemini (2.5-flash-image)</option>
                  <option value="pollinations">Pollinations (무료 · 키 불필요)</option>
                </select>
                {provider === "pollinations" && (
                  <p className="text-[9px] text-amber-300/90 mt-0.5 leading-snug max-w-52">⚠ 저해상도 — 기획·구도 확인용</p>
                )}
              </div>
              {provider === "openai" && (
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">이코노미 2패스</label>
                  <button onClick={() => setEcoTwoPass(!ecoTwoPass)}
                    title="초안은 low로 싸고 빠르게 → QC 승인분만 고품질로 구도 유지 리렌더"
                    className={`${fieldCls} font-bold ${ecoTwoPass ? "text-emerald-300 border-emerald-500/50" : "text-neutral-500"}`}>
                    {ecoTwoPass ? `ON · low → ${finalQuality} 마감` : "OFF · 1패스"}
                  </button>
                </div>
              )}
              {provider === "openai" && ecoTwoPass && (
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">마감 품질</label>
                  <select value={finalQuality} onChange={(e) => setFinalQuality(e.target.value)} className={fieldCls}>
                    <option value="medium">medium (~$0.04/장)</option>
                    <option value="high">high (~$0.17/장)</option>
                  </select>
                </div>
              )}
              {provider === "openai" && !ecoTwoPass && (
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">품질</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value)} className={fieldCls}>
                    <option value="low">low — 최저비</option>
                    <option value="medium">medium — 기본</option>
                    <option value="high">high — 최고</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 mb-0.5">종횡비</label>
                <select value={aspect} onChange={(e) => setAspect(e.target.value)} className={`${fieldCls} font-mono`}>
                  {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="w-full flex items-center gap-3">
                <p className="text-[10px] text-neutral-500">
                  키는 <b className="text-neutral-400">브라우저 저장</b> (서버 전송 없음)
                </p>
                <button onClick={clearSavedKeys}
                  className="text-[10px] text-rose-300/80 hover:text-rose-300 underline underline-offset-2 shrink-0">
                  키 삭제
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <TabBtn id="pipeline" icon={Layers} label="제작 파이프라인" />
            <TabBtn id="basic" icon={Sparkles} label="단일 생성" />
            <TabBtn id="analysis" icon={ScanSearch} label="이미지 분석" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-3">

        {/* ═══════════ 파이프라인 탭 ═══════════ */}
        {tab === "pipeline" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            <aside className="xl:col-span-1 space-y-4">
              {/* 설정 */}
              <section className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-3">
                <h2 className="text-sm font-bold text-neutral-100">1 · 주제와 정확 장수</h2>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-400">주제</label>
                    <button onClick={recommendToday} disabled={dailyBusy || phase === "drafting" || phase === "generating"}
                      title="오늘 날짜 기준 판매 리드타임(4~8주)을 계산해 베스트셀러·틈새시장·이슈 주제를 추천하고 주제·키워드·트렌드 소품 팔레트·팁을 자동으로 채웁니다. 주제칸에 주제를 미리 적어두면(예: 브런치) 그 주제 안에서 잘나가는 각도·틈새를 검토해 구체화합니다. 구글 키가 있으면 실시간 검색 트렌드까지 반영"
                      className="text-xs font-bold px-2 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition">
                      {dailyBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {dailyBusy ? "선정 중…" : "오늘의 추천"}
                    </button>
                  </div>
                  <input value={topic} onChange={(e) => onTopicChange(e.target.value)}
                    disabled={phase === "drafting" || phase === "generating"}
                    placeholder="예: 브런치 — 적고 '오늘의 추천'을 누르면 그 주제 안의 잘나가는 각도·트렌드 소품까지 채워줍니다"
                    className={`${fieldCls} w-full disabled:opacity-60`} />
                  {/* 직전 추천 다시 불러오기 — API 호출 없이 폼만 되채움(토큰 절약). 에러로 버린 추천 재시도용 */}
                  {recentRecos.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-neutral-500 shrink-0" title="추천 API를 다시 호출하지 않고 저장된 직전 추천을 그대로 불러옵니다(토큰 절약)">직전 추천 다시:</span>
                      {recentRecos.map((reco, i) => (
                        <button key={`${reco.t}-${i}`} onClick={() => applyReco(reco)}
                          disabled={phase === "drafting" || phase === "generating"}
                          title={`다시 불러오기 (추천 API 미사용 · 토큰 절약): ${reco.t}${reco.w ? ` · 판매적기 ${reco.w}` : ""}`}
                          className="max-w-[150px] truncate text-[11px] px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition">
                          ↩ {reco.t}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* 주제 선정 이력 (접이식) — 추천이 판매시기 겹침을 피하는 근거 */}
                  {recoHistory.length > 0 && (
                    <div className="mt-1.5 border border-neutral-700/60 rounded bg-neutral-950/40">
                      <button onClick={() => setHistOpen(!histOpen)}
                        className="w-full flex items-center gap-1 px-2 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-300 transition">
                        <ChevronRight className={`w-3 h-3 transition-transform ${histOpen ? "rotate-90" : ""}`} />
                        주제 선정 이력 ({recoHistory.length}) · 추천 시 판매시기 겹침 자동 회피
                      </button>
                      {histOpen && (
                        <div className="px-2 pb-2 space-y-1 max-h-40 overflow-y-auto">
                          {recoHistory.map((h, i) => (
                            <div key={`${h.t}-${i}`} className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-neutral-600 font-mono shrink-0">{h.d}</span>
                              <span className="truncate flex-1 text-neutral-300" title={h.t}>{h.t}</span>
                              {h.w && <span className="text-amber-300/80 shrink-0">{h.w}</span>}
                              <button onClick={() => setRecoHistory((p) => p.filter((_, j) => j !== i))}
                                title="이력에서 제거" className="text-neutral-600 hover:text-red-400 shrink-0"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                          <button onClick={() => window.confirm("주제 선정 이력을 모두 지울까요?") && setRecoHistory([])}
                            className="text-[10px] text-neutral-600 hover:text-red-400 transition">전체 비우기</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">
                    우선 키워드 <span className="text-neutral-600 font-normal">(선택 — 해당 사물이 보이는 슬롯에만 앞배치 · 장면을 강제하지 않음)</span>
                  </label>
                  <input value={priKw} onChange={(e) => setPriKw(e.target.value.slice(0, 400))}
                    disabled={phase === "drafting" || phase === "generating"}
                    placeholder="예: smartphone, scrolling, copy space, lifestyle"
                    className={`${fieldCls} w-full disabled:opacity-60`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">
                    구도·소품·인물 팁 <span className="text-neutral-600 font-normal">(선택 — 전 슬롯 적용하되 장면 다양성은 유지)</span>
                  </label>
                  <textarea value={handlingTip} onChange={(e) => setHandlingTip(e.target.value.slice(0, 900))}
                    disabled={phase === "drafting" || phase === "generating"}
                    rows={2} maxLength={900}
                    placeholder="예: 손+기기 위주, 얼굴 정면 금지 / 배경 깔끔하게 / 소품 최소화"
                    className={`${fieldCls} w-full disabled:opacity-60 resize-y leading-relaxed`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">장수 (1행=1장)</label>
                    <input list="countPresets" type="number" min="1" max="50" value={count}
                      onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      disabled={phase !== "idle" && phase !== "done"}
                      className={`${fieldCls} w-full font-mono disabled:opacity-60`} />
                    <datalist id="countPresets">{[3, 5, 10, 15].map((n) => <option key={n} value={n} />)}</datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">최대 시간(분) <span className="text-neutral-600 font-normal">우선</span></label>
                    <input list="minPresets" type="number" min="1" max="60" value={maxMin}
                      onChange={(e) => setMaxMin(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="예: 10"
                      className={`${fieldCls} w-full font-mono`} />
                    <datalist id="minPresets">{[5, 10, 15].map((n) => <option key={n} value={n} />)}</datalist>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-600 leading-snug -mt-1">
                  최대 시간을 넣으면 그 시간 안에서 만들 수 있는 만큼만 생성하고 멈춥니다(장수보다 우선). 비우면 목표 장수를 모두 채웁니다.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">구도 모드 (요청 문구로 자동 판별)</label>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setMode("commercial"); setModeAuto(false); }}
                      className={`flex-1 text-xs font-bold py-2 rounded border transition ${mode === "commercial" ? "bg-violet-600 text-white border-violet-600" : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-neutral-200"}`}>
                      상업 사진<span className="block text-[10px] font-normal opacity-70">어도비</span>
                    </button>
                    <button onClick={() => { setMode("emotional"); setModeAuto(false); }}
                      title="골든아워·빛내림·역광 감성 배경 + 텍스트 여백 — 미리캔버스 예배·절기 배경용"
                      className={`flex-1 text-xs font-bold py-2 rounded border transition ${mode === "emotional" ? "bg-amber-600 text-white border-amber-600" : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-neutral-200"}`}>
                      감성 배경<span className="block text-[10px] font-normal opacity-70">미캔·골든아워</span>
                    </button>
                    <button onClick={() => { setMode("wallpaper"); setModeAuto(false); }}
                      className={`flex-1 text-xs font-bold py-2 rounded border transition ${mode === "wallpaper" ? "bg-violet-600 text-white border-violet-600" : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-neutral-200"}`}>
                      배경화면<span className="block text-[10px] font-normal opacity-70">여백 40-60%</span>
                    </button>
                  </div>
                  <button onClick={() => setPackageMode((v) => !v)}
                    title="켜면 팔레트·라이팅·세팅 무드를 비슷하게 묶고 액션·소품·인물은 각기 다르게 — 여행팩킹·밀프렙·홈오거나이징 등 라이프 패키지용. 끄면 각 슬롯을 최대한 다르게(기본)."
                    className={`w-full mt-1.5 text-xs font-bold py-2 rounded border transition ${packageMode ? "bg-sky-600 text-white border-sky-600" : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-neutral-200"}`}>
                    📦 패키지 모드 {packageMode ? "ON" : "OFF"}
                    <span className="block text-[10px] font-normal opacity-70">{packageMode ? "비슷한 무드 · 액션·인물은 자유" : "슬롯마다 최대 다양성 (기본)"}</span>
                  </button>
                </div>
                {/* REEDO식 구조화 구성 — 선택 항목이 모든 슬롯 초안에 주입됨 */}
                <div className="pt-1 border-t border-neutral-700">
                  <label className="block text-xs font-semibold text-neutral-400 mb-1.5">구조화 구성 <span className="text-neutral-600">(선택 항목만 반영)</span></label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(() => {
                      const dis = phase === "drafting" || phase === "generating";
                      const sel = `${fieldCls} w-full !px-2 !py-1.5 text-xs disabled:opacity-60`;
                      const opts = (o) => Object.entries(o).map(([k, v]) => <option key={k} value={k}>{v}</option>);
                      return (
                        <>
                          <div className="col-span-2">
                            <span className="block text-[10px] font-mono text-neutral-500 mb-0.5">톤 (판매 미학)</span>
                            <select value={refTone} onChange={(e) => setRefTone(e.target.value)} disabled={dis} className={sel}>{opts(REEDO_TONE)}</select>
                          </div>
                          <div>
                            <span className="block text-[10px] font-mono text-neutral-500 mb-0.5">인물</span>
                            <select value={refPeople} onChange={(e) => setRefPeople(e.target.value)} disabled={dis} className={sel}>{opts(REEDO_PEOPLE)}</select>
                          </div>
                          <div>
                            <span className="block text-[10px] font-mono text-neutral-500 mb-0.5">✋ 손 (핸즈온)</span>
                            <select value={refHands} onChange={(e) => setRefHands(e.target.value)} disabled={dis} className={sel} title="손 포함: 손이 소품을 만지는 핸즈온 연출 · 손 없음: 순수 스타일링 정물 · 선택 안함: AI가 장면별로 자율 결정">{opts(REEDO_HANDS)}</select>
                          </div>
                          <div>
                            <span className="block text-[10px] font-mono text-neutral-500 mb-0.5">스타일</span>
                            <select value={refStyle} onChange={(e) => setRefStyle(e.target.value)} disabled={dis} className={sel}>{opts(REEDO_STYLE)}</select>
                          </div>
                          <div>
                            <span className="block text-[10px] font-mono text-neutral-500 mb-0.5">배경</span>
                            <select value={refBg} onChange={(e) => setRefBg(e.target.value)} disabled={dis} className={sel}>{opts(REEDO_BG)}</select>
                          </div>
                          <div>
                            <span className="block text-[10px] font-mono text-neutral-500 mb-0.5">나라/지역</span>
                            <select value={refRegion} onChange={(e) => setRefRegion(e.target.value)} disabled={dis} className={sel}>{opts(REEDO_REGION)}</select>
                          </div>
                          <div className="col-span-2">
                            <span className="block text-[10px] font-mono text-neutral-500 mb-0.5">🍽 음식 장르 <span className="text-neutral-600">(음식 주제면 자동 스타일링)</span></span>
                            <select value={refFood} onChange={(e) => setRefFood(e.target.value)} disabled={dis} className={sel}>{opts(REEDO_FOOD)}</select>
                          </div>
                          <div className="col-span-2">
                            <span className="block text-[10px] font-mono text-neutral-500 mb-0.5">카메라/구도 (전체 기본)</span>
                            <select value={refAngle} onChange={(e) => setRefAngle(e.target.value)} disabled={dis} className={sel}>
                              {Object.entries(CAMERA_ANGLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <button onClick={draftSlots}
                  disabled={!topic.trim() || phase === "drafting" || phase === "generating"}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                  {phase === "drafting" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {phase === "drafting" ? `${brainName} 초안 작성 중…` : slots.length > 0 ? "초안 다시 만들기" : `${brainName} 초안 기획`}
                </button>

                {/* 플랫폼 바로가기 */}
                <div className="flex gap-1.5 pt-0.5">
                  <a href="https://contributor.stock.adobe.com/" target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-bold text-xs py-2 rounded transition">
                    Adobe Stock 열기
                  </a>
                  <a href="https://www.miricanvas.com/" target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-bold text-xs py-2 rounded transition">
                    미리캔버스
                  </a>
                </div>
              </section>

            </aside>

            {/* 메인 워크스페이스 */}
            <main className="xl:col-span-2 space-y-4">

              {/* 진행 바 */}
              {prog && (
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
                  <div className="flex justify-between text-xs font-mono text-neutral-400 mb-1.5">
                    <span>{prog.stage}</span><span>{prog.done} / {prog.total}</span>
                  </div>
                  <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-violet-500 h-full transition-all" style={{ width: `${(prog.done / prog.total) * 100}%` }} />
                  </div>
                  <button onClick={() => { cancelRef.current = true; }}
                    className="mt-2 text-xs font-bold text-neutral-400 hover:text-red-400 flex items-center gap-1">
                    <Square className="w-3 h-3" /> 중지 요청
                  </button>
                </div>
              )}

              {slots.length === 0 && phase === "idle" ? (
                <section className="bg-neutral-800 border border-dashed border-neutral-700 rounded-lg p-16 text-center">
                  <Layers className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                  <h2 className="text-sm font-bold text-neutral-300">주제를 넣고 {brainName} 초안 기획을 시작하세요</h2>
                  <p className="text-xs text-neutral-500 mt-1">멈춤은 두 곳입니다: ① 초안 승인 ② 최종 QC. 그 사이는 자동으로 흐릅니다.</p>
                </section>
              ) : (
                <>
                  {/* 멈춤 1 — 초안 검토/승인 바 */}
                  {phase === "review" && (
                    <section className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-violet-200 flex items-center gap-1.5">
                          <ClipboardCheck className="w-4 h-4" /> 미완료·수정 슬롯 검토
                        </h3>
                        <p className="text-xs text-violet-300/80 mt-0.5">
                          {slots.length}행 · 모드 {mode === "wallpaper" ? "배경화면(여백 40-60%)" : mode === "emotional" ? "감성 배경(미캔·골든아워)" : "상업 사진"} · 엔진 {provider === "openai" ? `GPT ${quality}` : provider === "pollinations" ? "Pollinations 무료" : "Gemini"} · 종횡비 {aspect}
                          {successCount > 0 && ` · 유효 ${successCount}장 유지, 미완료만 생성`}
                        </p>
                        {provider === "openai" && (
                          <p className="text-xs text-violet-400/80 mt-0.5 flex items-center gap-1">
                            <CircleDollarSign className="w-3.5 h-3.5" /> 예상 약 ${estCost()} ({quality} 기준 근사치 — 실제 청구액은 다를 수 있음)
                          </p>
                        )}
                      </div>
                      <button onClick={() => runGeneration(null, true)} disabled={!imageKey()} title="시간 예산을 무시하고 강제 실행합니다"
                        className="bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                        <Play className="w-4 h-4" /> 미완료·수정 슬롯 생성
                      </button>
                    </section>
                  )}

                  {/* 멈춤 2 — QC 콘택트시트 바 */}
                  {phase === "qc" && (
                    <section className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1 min-w-64">
                        <h3 className="text-sm font-bold text-amber-200 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4" /> 멈춤 2 · 콘택트시트 QC
                        </h3>
                        <p className="text-xs text-amber-300/80 mt-0.5 leading-relaxed">
                          <b>{brainName} 자동 검수</b>를 누르면 텍스트·로고·왜곡·문화 오류·주제 이탈·구도 위반을 슬롯별로 검사해 자동 플래그합니다.
                          플래그는 표시일 뿐이니 카드 클릭으로 해제/추가하며 최종 판단하세요. 거절 없이 승인하면 제출 팩이 바로 저장됩니다.
                        </p>
                        <input value={qcReason} onChange={(e) => setQcReason(e.target.value)}
                          placeholder="거절 사유 (예: off-topic, 텍스트 포함, 왜곡)"
                          className="mt-2 w-full text-xs px-2.5 py-1.5 bg-neutral-950 border border-amber-500/30 rounded text-neutral-100 focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={runAutoQC} disabled={autoQcBusy}
                          className="bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 disabled:opacity-50 text-violet-300 font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                          {autoQcBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                          {autoQcBusy
                            ? `자동 검수 중 ${autoQcProg ? `${autoQcProg.done + 1}/${autoQcProg.total}` : ""}`
                            : `${brainName} 자동 검수`}
                        </button>
                        {slots.some((s) => s.autoFlag && s.status === "success") && (
                          <button onClick={autoFixFlagged} disabled={autoQcBusy || autoFixBusy}
                            title="플래그된 모든 슬롯을 두뇌가 장면부터 고쳐 쓰고 순차 재생성합니다"
                            className="bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 disabled:opacity-50 text-emerald-300 font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                            <RefreshCw className={`w-4 h-4 ${autoFixBusy ? "animate-spin" : ""}`} />
                            {autoFixBusy ? "자동 수정 중…" : `플래그 ${slots.filter((s) => s.autoFlag && s.status === "success").length}건 자동 수정`}
                          </button>
                        )}
                        <button onClick={() => exportMiriPack()} disabled={autoQcBusy}
                          title="미리캔버스 전용 ZIP만 저장 — 승인율 높은 미캔용으로만 구성(어도비 규격 제외). 이미지↔XLSX 누락 이중 체크"
                          className="bg-teal-600/20 hover:bg-teal-500/30 border border-teal-500/50 disabled:opacity-50 text-teal-400 font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                          <Download className="w-4 h-4" /> 미리캔버스만 ZIP
                        </button>
                        <button onClick={submitQC} disabled={autoQcBusy}
                          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                          <Check className="w-4 h-4" />
                          {Object.values(qcRejects).some(Boolean)
                            ? `거절 ${Object.values(qcRejects).filter(Boolean).length}건 격리 후 재생성`
                            : "전량 승인 · 제출 팩 저장"}
                        </button>
                      </div>
                    </section>
                  )}

                  {/* 완료 바 */}
                  {phase === "done" && (
                    <section className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-emerald-200 flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> 제작 완료 — 요청 {count}장 / 유효 {successCount}장 {successCount === count ? "정확 일치" : "(불일치 확인 필요)"}
                        </h3>
                        <p className="text-xs text-emerald-300/80 mt-0.5">제출 팩이 저장되었습니다. 아래에서 다시 저장하거나, 수정 모드로 돌아가 슬롯을 편집·재생성할 수 있습니다.</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={backToEdit}
                          title="수정 모드로 전환: 슬롯 편집·개별 재생성·삭제 가능"
                          className="bg-neutral-950 hover:bg-neutral-800 border border-neutral-600 text-neutral-100 font-bold text-sm py-2.5 px-4 rounded flex items-center gap-2 transition">
                          <Wand2 className="w-4 h-4" /> 수정 (Fix)
                        </button>
                        <button onClick={exportSubmitPack}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                          <Download className="w-4 h-4" /> 저장 및 다운로드
                        </button>
                      </div>
                    </section>
                  )}

                  {/* 프롬프트 백업 툴바 — 초안 생성 순간부터 항상 접근 가능 (생성 실패 대비) */}
                  <section className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span>백업·저장 <span className="text-neutral-500">— 제출 팩은 ZIP 하나로 묶여 저장됩니다</span></span>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-auto">
                      <button onClick={pickSaveDir}
                        title="Chrome/Edge에서 컴퓨터 저장 폴더를 직접 지정 (미지정 시 기본 다운로드 폴더)"
                        className={`font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5 transition border ${
                          saveDir ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-neutral-950 hover:bg-neutral-700 border-neutral-700 text-neutral-200"}`}>
                        <FolderOpen className="w-3.5 h-3.5" /> {saveDir ? `저장 폴더: ${saveDir.name}` : "저장 폴더 선택"}
                      </button>
                      <button onClick={exportPromptsMin}
                        title="배제어가 문장에 포함된 자연어 프롬프트 — GPT gpt-image·Firefly·SD·DALL·E용"
                        className="bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5 transition">
                        <Download className="w-3.5 h-3.5" /> 일반 프롬프트 TXT
                      </button>
                      <button onClick={exportPromptsMidjourney}
                        title="--no 네거티브 · --ar 종횡비 · --style raw 로 변환된 Midjourney 전용 프롬프트"
                        className="bg-neutral-950 hover:bg-neutral-700 border border-sky-700/50 text-sky-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5 transition">
                        <Download className="w-3.5 h-3.5" /> Midjourney용 TXT
                      </button>
                      <button onClick={exportPromptsFull}
                        className="bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5 transition">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> 전체 필드 TXT
                      </button>
                      <button onClick={exportMidjourneyBatch}
                        title="Midjourney 배치 자동화(mj_batch.py)용 TXT — 각 슬롯을 MJ 문법(--ar/--style/--no)으로 변환해 한 줄씩 저장"
                        className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5 transition">
                        <Cpu className="w-3.5 h-3.5" /> 미드저니 배치 TXT
                      </button>
                      <button onClick={() => exportMiriPack()}
                        title="미리캔버스 전용 ZIP — 승인율 높은 미캔용으로만 구성(고해상 이미지 + 미캔 XLSX). 어도비 규격 제외. 이미지↔XLSX 누락 이중 체크"
                        className="bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/50 text-teal-400 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5 transition">
                        <Download className="w-3.5 h-3.5" /> 미리캔버스 전용 ZIP
                      </button>
                    </div>
                  </section>

                  {/* 슬롯 그리드 (초안 테이블 겸 콘택트시트) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {slots.map((s) => {
                      const rejected = !!qcRejects[s.index];
                      return (
                        <div key={s.index}
                          className={`bg-neutral-800 border rounded-lg overflow-hidden transition ${
                            rejected ? "border-red-500/60 ring-2 ring-red-500/20" : "border-neutral-700"}`}>
                          {/* 이미지 / 상태 */}
                          <button
                            onClick={() => {
                              if (phase === "qc" && s.status === "success") setQcRejects((p) => ({ ...p, [s.index]: !p[s.index] }));
                              else if (s.dataUrl) setPreviewSlot(s);
                            }}
                            className="w-full bg-neutral-950 relative flex items-center justify-center" style={{ height: "170px" }}>
                            {s.dataUrl ? (
                              <>
                                <img src={s.dataUrl} alt={s.title} className="w-full h-full object-contain" title="실제 구도 그대로 표시 (잘라내지 않음)" />
                                {/* 해상도 경고: 어도비 4MP 기준 대비 원본 픽셀 상태 표시 */}
                                {s.px && s.px.w * s.px.h < 1e6 && (
                                  <div className="absolute bottom-0 inset-x-0 bg-red-600/85 text-white text-[10px] font-bold text-center py-0.5">
                                    ⚠ 저해상도 {s.px.w}×{s.px.h} — 판매 비권장 (기획 확인용)
                                  </div>
                                )}
                                {s.px && s.px.w * s.px.h >= 1e6 && s.px.w * s.px.h < ADOBE_MIN_MP && (
                                  <div className="absolute bottom-0 inset-x-0 bg-neutral-950/75 text-emerald-300 text-[10px] font-semibold text-center py-0.5">
                                    {s.px.w}×{s.px.h} · 저장 시 자동 업스케일 → 판매 규격(4MP+)
                                  </div>
                                )}
                                {rejected && (
                                  <div className="absolute inset-0 bg-red-600/50 flex flex-col items-center justify-center text-white text-xs font-bold">
                                    <Ban className="w-6 h-6 mb-1" /> 거절 표시됨
                                  </div>
                                )}
                              </>
                            ) : s.status === "generating" && s.finalPrompt ? (
                              /* 이미지가 오기 전에 사용 프롬프트를 먼저 표시 */
                              <div className="w-full h-full p-2 overflow-y-auto text-left">
                                <div className="text-[10px] font-mono text-violet-300 mb-1 flex items-center gap-1 sticky top-0 bg-neutral-950/90">
                                  <RefreshCw className="w-3 h-3 animate-spin shrink-0" /> 생성 중 — 사용 프롬프트
                                </div>
                                <p className="text-[10px] leading-relaxed text-neutral-400 whitespace-pre-wrap break-words">{s.finalPrompt}</p>
                              </div>
                            ) : (
                              <span className="text-xs font-mono text-neutral-500">
                                {s.status === "generating" ? "생성 중…" : s.status === "rejected" ? `격리: ${s.rejectReason}` : s.status === "failed" ? "실패" : "대기 버퍼"}
                              </span>
                            )}
                            <span className="absolute top-1.5 left-1.5 text-xs font-mono font-bold bg-neutral-950/90 text-violet-300 px-1.5 py-0.5 rounded">{s.index}</span>
                          </button>
                          {/* 정보 */}
                          <div className="p-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-neutral-100 truncate flex-1" title={s.title}>{s.title}</h4>
                              {statusChip(s)}
                            </div>
                            {s.title_kr && <p className="text-xs text-sky-300 truncate">{s.title_kr}</p>}
                            <p className="text-xs text-neutral-500 font-mono truncate" title={`Adobe cat ${s.category} · EN ${normKeywords(s.keywords, ADOBE_MAX_KEYWORDS).split(", ").filter(Boolean).length}/35 · KR ${normKeywords(s.keywords_kr, MIRI_MAX_KEYWORDS).split(", ").filter(Boolean).length}/25`}>{s.kind} · {s.focal_placement} · {ADOBE_CATEGORIES[s.category] || `cat ${s.category}`}{s.keywords ? ` · EN${normKeywords(s.keywords, ADOBE_MAX_KEYWORDS).split(", ").filter(Boolean).length}` : ""}{s.keywords_kr ? `/KR${normKeywords(s.keywords_kr, MIRI_MAX_KEYWORDS).split(", ").filter(Boolean).length}` : ""}{s.regenCount > 1 ? ` · 재생성 ${s.regenCount - 1}회` : ""}</p>
                            {s.autoFlag && (phase === "qc" || phase === "review") && (
                              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 leading-relaxed space-y-1">
                                <p>자동 검수: {s.autoFlag}</p>
                                <button onClick={() => autoFixSlot(s)}
                                  disabled={s.status === "generating" || autoFixBusy || !imageKey()}
                                  title="두뇌가 거절 사유를 반영해 장면(피사체·소품)을 고쳐 쓴 뒤 이 슬롯을 자동으로 재생성합니다"
                                  className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 disabled:opacity-40 text-emerald-300 font-bold py-1 rounded flex items-center justify-center gap-1 transition">
                                  <RefreshCw className={`w-3 h-3 ${s.status === "generating" ? "animate-spin" : ""}`} />
                                  {s.status === "generating" ? "수정 생성 중…" : "자동 수정 (장면 고쳐서 재생성)"}
                                </button>
                              </div>
                            )}

                            {/* 구도/앵글 미세조정 — 초안·QC 단계 모두 편집 가능 */}
                            {(phase === "review" || phase === "qc") && (
                              <div className="pt-1.5 border-t border-neutral-700 space-y-1.5">
                                <textarea value={s.subject} rows={2}
                                  onChange={(e) => updateSlot(s.index, "subject", e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-violet-500 resize-none"
                                  placeholder="피사체/장면" />
                                <div>
                                  <label className="block text-[10px] font-mono text-neutral-500 mb-0.5">PROPS (소품 · 슬롯마다 다르게)</label>
                                  <input value={s.props || ""} onChange={(e) => updateSlot(s.index, "props", e.target.value)}
                                    className="w-full text-xs px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-violet-500" placeholder="예: 청자 꽃병, 마른 유칼립투스, 원목 트레이" />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-mono text-neutral-500 mb-0.5">CAMERA ANGLE (카메라 앵글)</label>
                                  <select value={s.angle || "auto"} onChange={(e) => updateSlot(s.index, "angle", e.target.value)}
                                    className="w-full text-xs px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-violet-500">
                                    {Object.entries(CAMERA_ANGLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] font-mono text-neutral-500 mb-0.5">FOCAL PLACEMENT</label>
                                    <input value={s.focal_placement || ""} onChange={(e) => updateSlot(s.index, "focal_placement", e.target.value)}
                                      className="w-full text-xs px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none" placeholder="예: center-right" />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-mono text-neutral-500 mb-0.5">COPY SPACE 영역</label>
                                    <input value={s.copy_space || ""} onChange={(e) => updateSlot(s.index, "copy_space", e.target.value)}
                                      className="w-full text-xs px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none" placeholder="예: top left soft blur" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input value={s.camera || ""} onChange={(e) => updateSlot(s.index, "camera", e.target.value)}
                                    className="text-xs px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none" placeholder="camera 추가 묘사" />
                                  <input value={s.palette || ""} onChange={(e) => updateSlot(s.index, "palette", e.target.value)}
                                    className="text-xs px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none" placeholder="palette" />
                                </div>
                                {/* 슬롯 액션: 재생성 · 삭제 */}
                                <div className="flex gap-1.5 pt-0.5">
                                  <button onClick={() => regenSlot(s)}
                                    disabled={s.status === "generating" || !imageKey()}
                                    title={!imageKey() ? "이미지 API 키가 필요합니다" : "편집한 구도로 이 슬롯만 다시 생성"}
                                    className="flex-1 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/40 disabled:opacity-40 text-violet-300 font-bold text-xs py-1.5 rounded flex items-center justify-center gap-1 transition">
                                    <RefreshCw className={`w-3 h-3 ${s.status === "generating" ? "animate-spin" : ""}`} />
                                    {s.status === "generating" ? "생성 중…" : "이 슬롯 재생성"}
                                  </button>
                                  <button onClick={() => deleteSlot(s.index)}
                                    disabled={s.status === "generating"}
                                    title="이 슬롯을 목록에서 제거"
                                    className="bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 disabled:opacity-40 text-red-300 font-bold text-xs py-1.5 px-2.5 rounded flex items-center justify-center gap-1 transition">
                                    <Trash2 className="w-3 h-3" /> 삭제
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </main>

            {/* ── 오른쪽 고정 레일: 지금 할 일(승인) + 실행 로그 ── */}
            <aside className="xl:col-span-1">
              <div className="xl:sticky xl:top-4 space-y-3">
                {/* 지금 할 일 위젯 */}
                <section className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-2.5">
                  <div className="text-xs font-mono text-neutral-500 uppercase flex items-center justify-between">
                    <span>지금 할 일</span>
                    <span className={phase === "drafting" || phase === "generating" ? "text-violet-400" : phase === "review" || phase === "qc" ? "text-amber-300" : phase === "done" ? "text-emerald-300" : "text-neutral-600"}>
                      {phase === "idle" ? "대기" : phase === "review" ? "수정 대기" : phase === "qc" ? "멈춤 2 · QC" : phase === "done" ? "완료" : phase === "drafting" ? "초안 작성" : "가동 중"}
                    </span>
                  </div>

                  {!imageKey() && (
                    <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 shrink-0" /> 이미지 API 키를 입력하세요 (상단 설정)
                    </div>
                  )}

                  {phase === "idle" && <p className="text-xs text-neutral-500 leading-relaxed">주제·구성을 설정하고 <b className="text-neutral-300">초안 기획</b>을 시작하세요.</p>}
                  {phase === "drafting" && (
                    <div className="text-xs text-violet-300 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {brainName} 초안 작성 중… <span className="text-neutral-500">(완료 즉시 자동 생성)</span></div>
                  )}

                  {phase === "review" && (
                    <>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {slots.some((s) => s.status === "pending") && !slots.some((s) => s.status === "success")
                          ? <>초안 <b className="text-neutral-200">{slots.length}행</b> 준비됨. 이미지 키를 입력하고 생성을 시작하세요.</>
                          : <>미완료·수정 슬롯이 있습니다. 편집 후 아래 버튼으로 이어서 생성하세요.{successCount > 0 && ` (유효 ${successCount}장 유지)`}</>}
                      </p>
                      <button onClick={() => runGeneration(null, true)} disabled={!imageKey()} title="시간 예산을 무시하고 강제 실행합니다"
                        style={imageKey() ? attnPulse : undefined}
                        className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                        <Play className="w-4 h-4" /> 미완료·수정 슬롯 생성
                      </button>
                    </>
                  )}

                  {phase === "generating" && (
                    <>
                      {prog && (
                        <div>
                          <div className="flex justify-between text-xs font-mono text-neutral-400 mb-1"><span className="truncate">{prog.stage}</span><span>{prog.done}/{prog.total}</span></div>
                          <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden"><div className="bg-violet-500 h-full transition-all" style={{ width: `${(prog.done / prog.total) * 100}%` }} /></div>
                        </div>
                      )}
                      <button onClick={() => { cancelRef.current = true; }}
                        className="w-full bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-red-300 font-bold text-xs py-2 rounded flex items-center justify-center gap-1.5">
                        <Square className="w-3 h-3" /> 중지 요청
                      </button>
                    </>
                  )}

                  {phase === "qc" && (
                    <>
                      <p className="text-xs text-neutral-400 leading-relaxed">생성 완료. <b className="text-neutral-200">자동 검수</b> 후 이상 없으면 승인·제출하세요.</p>
                      <button onClick={runAutoQC} disabled={autoQcBusy}
                        className="w-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 disabled:opacity-50 text-violet-300 font-bold text-sm py-2 rounded flex items-center justify-center gap-2 transition">
                        {autoQcBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                        {autoQcBusy ? `검수 중 ${autoQcProg ? `${autoQcProg.done + 1}/${autoQcProg.total}` : ""}` : `${brainName} 자동 검수`}
                      </button>
                      {slots.some((s) => s.autoFlag && s.status === "success") && (
                        <button onClick={autoFixFlagged} disabled={autoQcBusy || autoFixBusy}
                          title="플래그된 모든 슬롯을 두뇌가 장면부터 고쳐 쓰고 순차 재생성합니다"
                          className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 disabled:opacity-50 text-emerald-300 font-bold text-sm py-2 rounded flex items-center justify-center gap-2 transition">
                          <RefreshCw className={`w-4 h-4 ${autoFixBusy ? "animate-spin" : ""}`} />
                          {autoFixBusy ? "자동 수정 중…" : `플래그 ${slots.filter((s) => s.autoFlag && s.status === "success").length}건 자동 수정`}
                        </button>
                      )}
                      <button onClick={() => exportMiriPack()} disabled={autoQcBusy}
                        title="미리캔버스 전용 ZIP만 저장 — 승인율 높은 미캔용으로만 구성(어도비 규격 제외). 이미지↔XLSX 누락 이중 체크"
                        className="w-full bg-teal-600/20 hover:bg-teal-500/30 border border-teal-500/50 disabled:opacity-50 text-teal-400 font-bold text-sm py-2 rounded flex items-center justify-center gap-2 transition">
                        <Download className="w-4 h-4" /> 미리캔버스만 ZIP
                      </button>
                      <button onClick={submitQC} disabled={autoQcBusy}
                        style={!autoQcBusy ? attnPulse : undefined}
                        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                        <Check className="w-4 h-4" />
                        {Object.values(qcRejects).some(Boolean)
                          ? `거절 ${Object.values(qcRejects).filter(Boolean).length}건 격리·재생성`
                          : "전량 승인 · 제출 팩 저장(어도비+미캔)"}
                      </button>
                    </>
                  )}

                  {phase === "done" && (
                    <>
                      <p className="text-xs text-emerald-300 leading-relaxed">제작 완료 — 유효 {successCount}장.</p>
                      <button onClick={exportSubmitPack}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                        <Download className="w-4 h-4" /> 어도비+미캔 통합 ZIP
                      </button>
                      <button onClick={() => exportMiriPack()}
                        title="미리캔버스 전용 ZIP만 저장 — 어도비 규격 제외, 이미지↔XLSX 누락 이중 체크"
                        className="w-full bg-teal-600/20 hover:bg-teal-500/30 border border-teal-500/50 text-teal-400 font-bold text-sm py-2 rounded flex items-center justify-center gap-2 transition">
                        <Download className="w-4 h-4" /> 미리캔버스 전용 ZIP
                      </button>
                      <button onClick={backToEdit}
                        title="수정 모드로 전환: 슬롯 편집·개별 재생성·삭제 가능"
                        className="w-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-neutral-100 font-bold text-xs py-2 rounded flex items-center justify-center gap-1.5 transition">
                        <Wand2 className="w-3.5 h-3.5" /> 수정 (Fix)
                      </button>
                    </>
                  )}

                  {/* 세션 누적 비용 (재생성 포함 실제 생성 성공 건만) */}
                  {spent.img > 0 && (
                    <div className="pt-2 border-t border-neutral-700 text-xs text-neutral-400 flex items-center gap-1.5">
                      <CircleDollarSign className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>세션 누적: 이미지 <b className="text-neutral-200">{spent.img}장</b> ≈ <b className="text-amber-300">${spent.cost.toFixed(2)}</b> <span className="text-neutral-600">(근사치)</span></span>
                    </div>
                  )}
                </section>

                {/* 실행 로그 (오른쪽 고정) */}
                <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                  <div className="text-xs font-mono text-neutral-500 uppercase mb-2 flex justify-between"><span>실행 로그</span><span className="text-neutral-600 normal-case">최신순 ↑</span></div>
                  <div className="h-64 overflow-y-auto font-mono text-xs space-y-1">
                    {log.length === 0
                      ? <div className="text-neutral-600 italic">로그 없음</div>
                      : [...log].reverse().map((l, i) => (
                          <div key={i} className={l.includes("[오류]") || l.includes("[실패") ? "text-red-400" : l.includes("[성공") || l.includes("완료") ? "text-emerald-400" : l.includes("[멈춤") ? "text-violet-300" : l.includes("[두뇌 폴백]") ? "text-amber-300" : "text-neutral-400"}>{l}</div>
                        ))}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        )}

        {/* ═══════════ 단일 생성 탭 ═══════════ */}
        {tab === "basic" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <section className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-3 xl:col-span-1">
              <h2 className="text-sm font-bold text-neutral-100">자유 프롬프트</h2>
              <textarea value={freePrompt} onChange={(e) => setFreePrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleFreeGen(); }}
                rows={8} placeholder="파이프라인 없이 한 장만 빠르게 뽑을 때 사용하세요. 노텍스트 가드는 자동 부착됩니다."
                className="w-full text-sm px-3 py-2 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-violet-500 resize-none" />
              <button onClick={() => handleFreeGen()} disabled={isGen || !freePrompt.trim()}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                {isGen ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGen ? "생성 중…" : "이미지 생성 (Ctrl+Enter)"}
              </button>
            </section>
            <section className="xl:col-span-2">
              {selectedFreeItem ? (
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
                  <div className="bg-neutral-950 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: "300px" }}>
                    <img src={selectedFreeItem.dataUrl} alt="생성 이미지" className="max-w-full max-h-96 object-contain" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    <button onClick={() => {
                        const a = document.createElement("a");
                        a.href = selectedFreeItem.dataUrl; a.download = `freejjang-${selectedFreeItem.id.slice(-5)}.png`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }}
                      className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 다운로드</button>
                    <button onClick={() => { navigator.clipboard.writeText(selectedFreeItem.prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      className="bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} 프롬프트 복사</button>
                    <button onClick={() => { setFreeGallery((p) => p.filter((g) => g.id !== selectedFreeItem.id)); setSelectedFree(null); }}
                      className="bg-red-500/10 text-red-300 border border-red-500/30 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> 삭제</button>
                  </div>
                  {freeGallery.length > 1 && (
                    <div className="grid grid-cols-6 gap-1.5 mt-3">
                      {freeGallery.map((g) => (
                        <button key={g.id} onClick={() => setSelectedFree(g.id)}
                          className={`rounded overflow-hidden border-2 ${selectedFree === g.id ? "border-violet-500" : "border-transparent"}`}>
                          <img src={g.dataUrl} alt="썸네일" className="w-full h-14 object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-neutral-800 border border-dashed border-neutral-700 rounded-lg p-16 text-center">
                  <ImageIcon className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                  <p className="text-xs text-neutral-500">생성된 이미지가 여기에 표시됩니다</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ═══════════ 이미지 분석 탭 ═══════════ */}
        {tab === "analysis" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <section className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-3 xl:col-span-1">
              <div>
                <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                  <span className="text-xs font-mono bg-violet-500/10 text-violet-300 border border-violet-500/30 rounded px-1.5 py-0.5">01</span> 이미지 넣기
                </h2>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">참고 이미지를 넣으면 {brainName}이 13개 블록으로 분해하고 생성용 영어 프롬프트로 바꿉니다. (PNG · JPG · WebP)</p>
              </div>
              <input ref={anaFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleAnaFile(e.target.files[0]); e.target.value = ""; }} />
              <button onClick={() => anaFileRef.current?.click()}
                className="w-full border-2 border-dashed border-neutral-700 hover:border-violet-500 hover:bg-violet-500/5 rounded-lg p-4 transition">
                {anaImage
                  ? <img src={anaImage.dataUrl} alt="분석 대상" className="max-h-56 mx-auto rounded" />
                  : <div className="text-center text-neutral-500 text-xs py-8"><ImageIcon className="w-8 h-8 mx-auto mb-2 text-neutral-600" />이미지 선택</div>}
              </button>
              <input value={anaExtra} onChange={(e) => setAnaExtra(e.target.value)}
                placeholder="추가 지시 (예: 구도와 여백만 분석해줘)"
                className="w-full text-xs px-2.5 py-2 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-violet-500" />
              <button onClick={runAnalysis} disabled={!anaImage || anaBusy}
                className="w-full bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-50 text-violet-300 font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                {anaBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                {anaBusy ? "13블록 분석 중…" : `${brainName}로 분석`}
              </button>
            </section>

            <section className="xl:col-span-2">
              {anaResult ? (
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                      <span className="text-xs font-mono bg-violet-500/10 text-violet-300 border border-violet-500/30 rounded px-1.5 py-0.5">02</span> 분석 결과
                    </h2>
                    <span className="text-xs text-neutral-500 font-mono">13개 블록 완료</span>
                  </div>
                  <p className="text-sm text-neutral-300 bg-neutral-950 border border-neutral-700 rounded p-3 leading-relaxed">{anaResult.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(anaResult.blocks || []).map((b, i) => (
                      <div key={i} className="bg-neutral-950 border border-neutral-700 rounded p-3">
                        <div className="text-xs font-bold text-violet-300 mb-0.5">{b.name}</div>
                        <div className="text-xs text-neutral-400 leading-relaxed">{b.content}</div>
                      </div>
                    ))}
                  </div>
                  <textarea value={anaResult.prompt} rows={4} readOnly
                    className="w-full text-xs font-mono px-3 py-2 bg-neutral-950 border border-neutral-700 text-violet-300 rounded resize-none" />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(anaResult.prompt); setNotice("프롬프트를 복사했습니다."); }}
                      className="bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> 프롬프트 복사</button>
                    <button onClick={() => { setFreePrompt(anaResult.prompt); setTab("basic"); }}
                      className="bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-violet-300 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5">
                      <CornerDownLeft className="w-3.5 h-3.5" /> 작성창에 넣기</button>
                    <button onClick={() => { setFreePrompt(anaResult.prompt); setTab("basic"); handleFreeGen(anaResult.prompt); }}
                      className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> 분석 결과로 생성</button>
                  </div>
                </div>
              ) : (
                <div className="bg-neutral-800 border border-dashed border-neutral-700 rounded-lg p-16 text-center">
                  <ScanSearch className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                  <p className="text-xs text-neutral-500">분석 결과가 여기에 표시됩니다</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* 이미지 확대 프리뷰 + 미드저니 프롬프트 */}
      {previewSlot && (() => {
        const mjPrompt = toMidjourney(previewSlot, mode, refTone, refPeople, aspect, refHands);
        const mjBatch = buildMidjourneyPrompt(previewSlot, { aspect, tone: refTone, people: refPeople });
        return (
          <div onClick={() => setPreviewSlot(null)}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 cursor-zoom-out overflow-y-auto">
            <div className="max-w-3xl w-full my-auto" onClick={(e) => e.stopPropagation()}>
              <img src={previewSlot.dataUrl} alt={previewSlot.title} className="w-full rounded-lg" />
              <div className="text-center mt-2">
                <p className="text-sm font-bold text-white">{previewSlot.index} · {previewSlot.title_kr || previewSlot.title}</p>
              </div>
              <div className="mt-3 space-y-2">
                <div className="bg-neutral-900 border border-sky-700/40 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-sky-400 uppercase">Midjourney 프롬프트</span>
                    <button onClick={() => { navigator.clipboard.writeText(mjPrompt); setNotice("MJ 프롬프트를 복사했습니다."); }}
                      className="text-[10px] text-sky-300 hover:text-sky-100 bg-sky-600/20 hover:bg-sky-600/40 border border-sky-500/30 px-2 py-0.5 rounded flex items-center gap-1 transition">
                      <Copy className="w-3 h-3" /> 복사
                    </button>
                  </div>
                  <p className="text-[10px] leading-relaxed text-neutral-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{mjPrompt}</p>
                </div>
                <div className="bg-neutral-900 border border-indigo-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-indigo-400 uppercase">MJ 배치 (mj_batch.py)</span>
                    <button onClick={() => { navigator.clipboard.writeText(mjBatch); setNotice("MJ 배치 프롬프트를 복사했습니다."); }}
                      className="text-[10px] text-indigo-300 hover:text-indigo-100 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 px-2 py-0.5 rounded flex items-center gap-1 transition">
                      <Copy className="w-3 h-3" /> 복사
                    </button>
                  </div>
                  <p className="text-[10px] leading-relaxed text-neutral-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{mjBatch}</p>
                </div>
              </div>
              <div className="text-center mt-3">
                <button onClick={() => setPreviewSlot(null)} className="text-xs text-white bg-neutral-800 border border-neutral-600 px-3 py-1.5 rounded">닫기</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 토스트 */}
      {notice && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-neutral-950 border border-neutral-700 text-neutral-100 text-xs px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 max-w-md z-50">
          <AlertTriangle className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="leading-relaxed">{notice}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
