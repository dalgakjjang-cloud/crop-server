import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles, Download, Trash2, RefreshCw, Copy, Check, Cpu, AlertTriangle,
  FileSpreadsheet, Wand2, X, Play, Square, Image as ImageIcon, ScanSearch,
  Layers, Key, Settings2, CornerDownLeft, FileText, ClipboardCheck,
  ShieldAlert, CircleDollarSign, ChevronRight, Ban, FolderOpen
} from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";

/* ═══════════════════════════════════════════════════════════
   FreeJJang STOCK STUDIO — 최종판 (다크 · 2중 두뇌)
   두뇌: GPT(Codex 계열) / Gemini — 자동 폴백
   손:   GPT 이미지 API(기본) / Gemini — 실제 이미지 생성
   파이프라인: 초안 승인(멈춤1) → 순차 생성 → QC(멈춤2) → 제출 팩
   ═══════════════════════════════════════════════════════════ */

const GUARD =
  "Strictly no text, no letters, no numbers, no logos, no watermarks, no brand names, no branded packaging, no copyrighted characters, no unrequested people.";

const ASPECTS = ["1:1", "16:9", "4:3", "3:4", "9:16"];
const OPENAI_SIZE = { "1:1": "1024x1024", "16:9": "1536x1024", "4:3": "1536x1024", "3:4": "1024x1536", "9:16": "1024x1536" };
/* gpt-image 1536×1024 기준 근사 단가 (실제 청구액은 상이할 수 있음) */
const OPENAI_COST = { low: 0.005, medium: 0.041, high: 0.165 };
const GEMINI_IMG_COST = 0.039; // gemini-2.5-flash-image 1장 근사 단가
/* 일시적(재시도 가능) 오류 패턴 — 요금/키 오류는 제외 */
const TRANSIENT_RE = /429|rate.?limit|overloaded|timeout|temporarily|unavailable|failed to fetch|network|internal|50[023]/i;

const WALLPAPER_RE = /배경화면|월페이퍼|wallpaper|배너|banner|카피\s*스페이스|copy\s*space/i;

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
  wide: { label: "Wide (와이드)", phrase: "wide establishing shot, 24mm lens, generous environmental context and abundant negative space" },
  angle_45: { label: "Angle 45 (사선 45도)", phrase: "45-degree three-quarter angle shot, natural depth and dimensionality" },
  over_shoulder: { label: "Over Shoulder (어깨 너머)", phrase: "over-the-shoulder shot, natural candid framing looking past the subject" },
  closeup: { label: "Closeup (클로즈업)", phrase: "close-up shot, sharp focus on key details, elegant shallow depth of field, f/2.8" },
  macro: { label: "Macro (초근접 접사)", phrase: "ultra-close extreme macro lens photography, f/1.8 shallow depth of field, hyper-detailed texture close-up" },
};

/* 지능형 분위기 필터 — 실내/사무 주제 감지 시 중립 화이트밸런스(노란끼 배제) 적용 */
const INDOOR_RE = /office|desk|workspace|indoor|meeting|remote\s*work|home\s*office|studio|사무실|재택|실내|회의|책상|워크스페이스|홈\s*오피스|스튜디오|작업실/i;
const NIGHT_RE = /night|evening|dusk|midnight|sunset|밤|저녁|야간|새벽|노을|야경|일몰/i;
/* 생성 시점마다 Math.random()으로 진짜 무작위 선택되는 밝은 실내 광원 풀 */
const BRIGHT_NEUTRAL_STYLES = [
  "bright professional workspace, color-accurate neutral white balance, no excessive warm or yellow filters",
  "clean daylight-balanced lighting, airy natural window light, true-to-life neutral colors, transparent atmosphere",
  "crisp bright interior, neutral 5500K daylight white balance, clean white office lighting, no heavy color cast",
  "fresh luminous workspace, soft diffused daylight, accurate whites and neutral grays, modern clean look",
];
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
  none: "Strictly NO people, no persons, no humans, no faces, no hands, no body parts, no silhouettes of people, no mannequins, no crowd — clean empty space and equipment only",
  few: "Include at most 1-2 people, quiet single-person focus, no crowd, no spectators",
  small: "Include at most 3 people as a small group, NO large audience, NO bleachers, NO crowd",
};

/* 톤(판매 미학) — 2026 베스트셀러 조사 기반: 믿을 수 있는 실사가 팔린다.
   네온 SF 판타지(AI티)도, 무균실 미니멀(AI티)도 아닌 "진짜 찍은 듯한" 상업 사진이 기본값 */
const REEDO_TONE = {
  realism: "판매 리얼 (베스트셀러·기본)",
  bright: "밝은 미니멀",
  lifestyle: "라이프스타일 온기",
  cinematic: "시네마틱 무드",
  concept: "미래 컨셉 (네온)",
};
const TONE_PHRASE = {
  realism:
    "believable present-day commercial photograph that could genuinely be shot in a real 2026 setting: plausible real objects with realistic materials and true-to-life accurate color, natural daylight or realistic practical lighting, natural depth of field, slight organic asymmetry and gentle lived-in imperfection so it never looks templated — absolutely NO floating holograms, NO laser grids, NO sci-fi projections, NOT neon-drenched, NOT cyberpunk, NOT a sterile empty showroom, NOT over-polished CGI perfection. Render exactly the specific supporting props described for THIS scene and nothing generic — do NOT default to a water bottle or a potted plant unless this scene explicitly calls for it",
  bright: "bright airy minimal commercial look, abundant soft natural daylight, clean neutral palette, realistic true-to-life materials, believable real-world scene",
  lifestyle: "warm inviting lifestyle photography, golden natural light, cozy human warmth in a believable real space, editorial magazine quality",
  cinematic: "cinematic moody lighting with dramatic shadows and rich atmosphere, but still a believable real-world scene with plausible equipment — no sci-fi fantasy elements",
  concept: "futuristic concept aesthetic, neon accent lighting, high-tech atmosphere, stylized commercial render",
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

/* ── 두뇌 B: Gemini (Google AI 스튜디오 키) ── */
async function askGemini(key, model, system, user, imageBlock) {
  if (!key) throw new Error("Gemini: Google API 키가 없습니다.");
  const parts = imageBlock
    ? [{ text: user }, { inlineData: { mimeType: imageBlock.mime, data: imageBlock.data } }]
    : [{ text: user }];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model || GEMINI_MODEL_DEFAULT}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`Gemini: ${data.error.message}`);
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join("\n");
  return extractJSON(text, "Gemini");
}

/* ── 이미지 생성 (사용자 키 · 메모리에만 유지) ── */
async function genGemini(key, prompt, aspect) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(key)}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { imageConfig: { aspectRatio: aspect } } }) }
  );
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
/* 이코노미 2패스 마감: 승인된 low 드래프트를 참조 이미지로 넣어 같은 구도를 고품질로 리렌더
   (gpt-image는 시드 고정이 없어 그냥 재생성하면 다른 그림이 나옴 → 편집 API로 구도 유지) */
async function genOpenAIRefine(key, prompt, refDataUrl, aspect, quality) {
  const blob = await (await fetch(refDataUrl)).blob();
  const fd = new FormData();
  fd.append("model", "gpt-image-1");
  fd.append("image", blob, "draft.png");
  fd.append("prompt", `Re-render this exact scene at maximum fidelity for stock delivery: keep the SAME composition, subject placement, props, palette and lighting as the reference; increase sharpness, texture detail and photographic realism; remove small artifacts. ${prompt}`);
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
const FINAL_QUALITY = "medium"; // 이코노미 2패스 마감 품질

/* 슬롯 필드 → 최종 이미지 프롬프트 (전문 판매 프롬프트 규칙) */
function buildSlotPrompt(slot, mode, tone = "realism", people = "auto") {
  const anglePick = CAMERA_ANGLES[slot.angle]?.phrase || "";
  const isTight = slot.angle === "closeup" || slot.angle === "macro";
  /* 클로즈업/매크로를 명시 선택한 경우엔 여백 규칙을 완화 (사용자 의도 존중) */
  const comp = mode === "wallpaper"
    ? `40-60% low-density clean copy space opposite the subject (${slot.copy_space || "clean margin"})`
    : isTight
      ? `intentional detail composition, subject sharply focused with soft fall-off background (${slot.copy_space || "soft blurred margin"})`
      : `spacious commercial framing with generous breathing room: the main subject occupies AT MOST 60% of the frame, surrounded by clean uncluttered negative space (${slot.copy_space || "~30-40% calm low-detail area suitable for text overlay"}), visible environmental context around the subject, subject fully within frame and never touching or cropped by the edges, rule-of-thirds — strictly NOT a tight edge-to-edge close-up, NOT filling the whole frame`;
  const camera = slot.kind === "illustration"
    ? `Rendering: ${slot.camera || "clean vector-like edges, consistent medium"}`
    : `Camera: ${[anglePick, slot.camera].filter(Boolean).join(", ") || "one coherent lens, natural depth of field"}`;
  /* 지능형 분위기: 실내/사무 주제 + 밤 아님 → 중립 화이트밸런스 (매 생성마다 무작위 풀에서 선택) */
  const themeText = `${slot.subject || ""} ${slot.title || ""} ${slot.keywords || ""}`;
  const atmosphere = slot.kind !== "illustration" && INDOOR_RE.test(themeText) && !NIGHT_RE.test(themeText)
    ? pickRandom(BRIGHT_NEUTRAL_STYLES)
    : "";
  const toneLine = slot.kind !== "illustration" ? TONE_PHRASE[tone] || TONE_PHRASE.realism : "";
  const peopleLine = PEOPLE_FINAL[people] || "";
  const propsLine = slot.props ? `Scene-specific supporting props (render exactly these, no generic filler): ${slot.props}` : "";
  /* 재생성 피드백 루프: 직전 거절 사유를 교정 지시로 주입 → 같은 실수 반복 차단 */
  const fixLine = slot.qcNote
    ? `CRITICAL CORRECTION — the previous render of this exact slot was REJECTED for this reason: "${slot.qcNote}". Fix that specific problem this time; do NOT repeat it`
    : slot.regenCount > 0
      ? "This is a re-render requested by the user: produce a NOTICEABLY different composition, styling and prop arrangement from the previous attempt — do not repeat the same look"
      : "";
  return [
    slot.subject,
    fixLine,
    propsLine,
    `Focal placement: ${slot.focal_placement || "center"}`,
    comp, camera,
    `Lighting: ${slot.lighting || "soft natural light with realistic shadows"}`,
    atmosphere,
    toneLine,
    peopleLine,
    `Palette: ${slot.palette || "bright commercial tones"}`,
    slot.kind !== "illustration" ? "Physically plausible staging: every object rests naturally on a realistic surface — cups and drinks on a table, tray, desk or ledge, never directly on a sofa, bed or fabric; nothing floating or oddly placed" : "",
    slot.kind === "illustration" ? "professional stock illustration" : "8K photorealistic professional stock photograph, crisp detail",
    GUARD,
  ].filter(Boolean).join(". ");
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
  const [ecoTwoPass, setEcoTwoPass] = useState(true); // 이코노미 2패스: low 초안 → 승인분만 medium 마감 (GPT 엔진 전용)
  const [aspect, setAspect] = useState("16:9");
  const [showSettings, setShowSettings] = useState(true);

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
  /* ── REEDO식 구조화 구성 (선택 안함이면 무시) ── */
  const [refStyle, setRefStyle] = useState("");
  const [refRegion, setRefRegion] = useState("");
  const [refBg, setRefBg] = useState("");
  const [refPeople, setRefPeople] = useState("none"); // 기본: 인물 없음 (모델 릴리즈 회피)
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
        if (s.aspect) setAspect(s.aspect);
        if (s.gptModel) setGptModel(s.gptModel);
        if (s.geminiModel) setGeminiModel(s.geminiModel);
        if (typeof s.autoFallback === "boolean") setAutoFallback(s.autoFallback);
        if (s.refTone) setRefTone(s.refTone);
        if (s.refPeople) setRefPeople(s.refPeople);
        if (s.priKw) setPriKw(s.priKw);
        if (s.handlingTip) setHandlingTip(s.handlingTip);
      }
    } catch { /* 손상된 저장값 무시 */ }
    settingsLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!settingsLoaded.current) return;
    try {
      localStorage.setItem("freejjang_settings", JSON.stringify({
        openaiKey, googleKey, brain, provider, quality, aspect, gptModel, geminiModel, autoFallback, refTone, refPeople, priKw, handlingTip, ecoTwoPass,
      }));
    } catch { /* 저장 불가 환경 무시 */ }
  }, [openaiKey, googleKey, brain, provider, quality, aspect, gptModel, geminiModel, autoFallback, refTone, refPeople, priKw, handlingTip, ecoTwoPass]);

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
    if (modeAuto) setMode(WALLPAPER_RE.test(v) ? "wallpaper" : "commercial");
  };

  /* REEDO식 구조화 구성 → 초안 브레인에 주입할 제약 문장 (선택된 것만) */
  const refinementLine = () => {
    const parts = [];
    if (TONE_PHRASE[refTone]) parts.push(`Selling aesthetic (CRITICAL, every subject/lighting/palette must follow this): ${TONE_PHRASE[refTone]}`);
    if (REEDO_STYLE_PHRASE[refStyle]) parts.push(`Style: ${REEDO_STYLE_PHRASE[refStyle]}`);
    if (REEDO_REGION_PHRASE[refRegion]) parts.push(`Market: ${REEDO_REGION_PHRASE[refRegion]}`);
    if (REEDO_BG_PHRASE[refBg]) parts.push(`Background: ${REEDO_BG_PHRASE[refBg]}`);
    if (REEDO_PEOPLE_PHRASE[refPeople]) parts.push(`People: ${REEDO_PEOPLE_PHRASE[refPeople]}`);
    if (CAMERA_ANGLES[refAngle]?.phrase) parts.push(`Camera baseline: ${CAMERA_ANGLES[refAngle].phrase}`);
    return parts.length ? `\nApply these refinements to EVERY slot: ${parts.join("; ")}.` : "";
  };

  const estCost = () => {
    if (provider !== "openai") return null;
    const n = slots.filter((s) => s.status !== "success").length || count;
    return (n * (OPENAI_COST[quality] || 0.041)).toFixed(2);
  };

  /* ── 이미지 엔진 키 (provider별) ── */
  const imageKey = () => (provider === "gemini" ? googleKey : openaiKey).trim();
  /* 일시 오류(429/네트워크/서버 혼잡)는 3초→6초 대기 후 자동 재시도, 성공 시 세션 비용 집계.
     qualityOverride: 이코노미 2패스에서 초안을 low로 강제할 때 사용 */
  const generateImage = async (finalPrompt, qualityOverride) => {
    const key = imageKey();
    if (!key) throw new Error(`${provider === "gemini" ? "Google" : "OpenAI"} 이미지 API 키를 먼저 연결하세요 (상단 설정).`);
    const q = qualityOverride || quality;
    let lastErr;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const out = provider === "gemini"
          ? await genGemini(key, finalPrompt, aspect)
          : await genOpenAI(key, finalPrompt, aspect, q);
        const unit = provider === "gemini" ? GEMINI_IMG_COST : (OPENAI_COST[q] || 0.041);
        setSpent((p) => ({ img: p.img + 1, cost: p.cost + unit }));
        return out;
      } catch (err) {
        lastErr = err;
        if (attempt < 2 && TRANSIENT_RE.test(err.message)) {
          const wait = 3000 * (attempt + 1);
          addLog(`[재시도 ${attempt + 1}/2] 일시 오류 감지 — ${wait / 1000}초 후 자동 재시도: ${err.message}`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw err;
      }
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
          `You design a maximally DIVERSE professional stock image set — each image must be clearly a SEPARATE asset to a buyer (no near-duplicates; marketplaces reject similar images). Respond ONLY compact JSON:
{"concepts":[{"scene":"1 short sentence: main subject doing what, where","location":"the place — must be unique in the set","action":"primary action","angle":"camera angle/framing","time":"time of day + light"}]}
HARD DIVERSITY RULES: return EXACTLY the requested number of concepts. Every "location" must be DIFFERENT — never two concepts in the same place. No primary action repeated more than twice. Vary camera angle/framing and time/light across the set. When people are allowed, vary person treatment across concepts (hands-only close work / over-shoulder / partial figure from behind / no person at all). PHYSICAL PLAUSIBILITY: stage objects only where they realistically belong — cups and drinks on a table, tray, desk or ledge, NEVER directly on a sofa, bed or fabric. If user notes suggest scene ideas, distribute DIFFERENT ideas to DIFFERENT concepts — never apply the same idea to every concept.`,
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
RULES: one item per assigned concept, in the given order — KEEP each concept's location, action, angle and time exactly (they guarantee set diversity; do not merge or swap them). kind is "photo" or "illustration" by topic. No contradictory lens/angle/lighting mixes. Exclude text, logos, brands, copyrighted characters, unrequested people. Cultural items must be factually correct. PHYSICAL PLAUSIBILITY: every object rests on a realistic surface — cups/drinks on a table, tray, desk or ledge, NEVER directly on a sofa, bed or fabric; nothing floating or oddly placed. SELLABILITY: usable beats pretty — prefer hands + device + partial person over posed full faces; keep backgrounds clean enough for ads and banners. Mode "wallpaper": copy_space = a 40-60% low-density area opposite the subject. Mode "commercial": medium or wide framing, subject fills about 50-70% of frame (never edge-to-edge), roughly 25-35% clean negative space, rule-of-thirds, subject fully in frame.
KEYWORDS (Adobe SEO, critical): EXACTLY 35 EN keywords, no duplicates, ordered by buyer importance (first ~10 weigh most): (1) main subject nouns, (2) descriptors/materials/actions, (3) concept/season/emotion, (4) color/lighting, (5) composition (copy space, background), (6) use-case (banner, marketing, web design). All lowercase, only terms literally describing what is visible. "keywords_kr" same ordering in Korean single nouns.
CATEGORY: pick ONE best Adobe Stock category id: ${ADOBE_CAT_LIST}. Illustration/vector fallback: 8. Integer id only.
PROPS & VARIETY: props must be SPECIFIC to each scene and DIFFERENT from every other slot in the whole set (set list provided) — never reuse generic filler across slots; tableware must match the dish culture; keep the copy-space area uncluttered; believable and unbranded.`;
    const expandPair = async (pairIdx) => {
      const pair = pairIdx.map((i) => concepts[i]);
      for (let attempt = 0; attempt < 3 && !cancelRef.current && !timeUp(); attempt++) {
        try {
          const r = await askBrain(
            detailSystem,
            `Topic: "${topic}". Mode: ${mode}. Whole-set overview (make THIS pair's props/palette clearly distinct from all): ${setSummary}
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

  /* ═══ 2단계: 순차 생성 (초안 직후 자동 · 또는 재생성 시 수동) ═══ */
  const runGeneration = async (slotList) => {
    if (phase === "generating") return;
    if (!imageKey()) { setNotice("이미지 API 키가 필요합니다."); return; }
    cancelRef.current = false;
    setPhase("generating");
    const source = Array.isArray(slotList) ? slotList : slots;
    const targets = source.filter((s) => s.status === "pending" || s.status === "failed" || s.status === "rejected");
    /* 시간 예산: 초안 시작 시 세팅된 마감(deadlineRef)까지. 재생성 등 마감이 지났으면 시간제한 없이 진행 */
    const hasDeadline = deadlineRef.current !== Infinity && Date.now() < deadlineRef.current;
    const timeUp = () => hasDeadline && Date.now() > deadlineRef.current;
    const ecoOn = ecoTwoPass && provider === "openai";
    const draftQ = ecoOn ? "low" : undefined;
    addLog(`[생성] 미완료 ${targets.length}슬롯${hasDeadline ? ` · 최대 ${Math.ceil((deadlineRef.current - Date.now()) / 60000)}분 남음` : ""} · ${provider === "openai" ? (ecoOn ? `GPT low 초안 (승인 후 ${FINAL_QUALITY} 마감)` : `GPT ${quality}`) : "Gemini"}`);
    let newMade = 0;
    for (const t of targets) {
      if (cancelRef.current) break;
      if (timeUp()) { addLog(`[시간 상한] 예산 초과 — ${newMade}장 생성 후 중단 (나머지는 '미완료·수정 슬롯 생성'으로 이어서)`); break; }
      setProg({ done: newMade, total: targets.length, stage: `슬롯 ${t.index} 생성 중` });
      setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "generating" } : s)));
      try {
        if (t.qcNote) addLog(`[교정 ${t.index}] 이전 거절 사유 반영: ${t.qcNote}`);
        const fp = buildSlotPrompt(t, mode, refTone, refPeople);
        const dataUrl = await generateImage(fp, draftQ);
        newMade += 1;
        setSlots((p) => p.map((s) => (s.index === t.index
          ? { ...s, status: "success", dataUrl, finalPrompt: fp, rejectReason: "", qcNote: "", finalized: false, regenCount: s.regenCount + 1 } : s)));
        addLog(`[성공 ${t.index}] ${t.title_kr || t.title}`);
      } catch (err) {
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
Reject (pass=false) if ANY of these appear: (1) visible text, letters, numbers, or writing of any kind, (2) logos, brands, watermarks, branded packaging, (3) distorted objects, anatomy (hands/faces), or architecture, (4) cultural inaccuracy (wrong flag, wrong food form, wrong ritual objects/counts), (5) clearly off-topic vs the stated topic, (6) composition violating the stated mode — wallpaper mode needs a 40-60% clean low-density copy area; commercial mode needs a natural full composition without huge empty margins. Be strict on text and distortion; be lenient on subjective style taste. File count being correct is irrelevant — judge the pixels only.`,
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
      `# FreeJJang 프롬프트 (간편) — 주제: ${topic || "(미지정)"} · 모드: ${mode} · 종횡비: ${aspect}\n` +
      `# 각 줄의 프롬프트에는 노텍스트 GUARD 규칙이 이미 포함되어 있습니다.\n` +
      `# Midjourney / Firefly / Stable Diffusion 등 다른 AI에 그대로 붙여넣어 쓰세요.\n\n`;
    const body = rows.map((s) => `[${s.index}] ${s.title_kr || s.title || ""}\n${s.finalPrompt || buildSlotPrompt(s, mode, refTone, refPeople)}`).join("\n\n");
    saveBlob(new Blob([head + body], { type: "text/plain;charset=utf-8" }), `${cleanName(topic, 20) || "freejjang"}-prompts-min.txt`);
    addLog(`[백업] 프롬프트 TXT(간편) 저장 완료 — ${rows.length}슬롯`);
  };
  const buildPromptsFullText = (rows) => {
    const head =
      `# FreeJJang 프롬프트 (전체 필드 · 백업) — 주제: ${topic || "(미지정)"} · 모드: ${mode} · 종횡비: ${aspect} · 요청 ${count}장\n` +
      `# 최종 프롬프트 + 구성 필드 + 한/영 키워드 + 카테고리 + 상태. 세션 복원·타 시스템 재생성용.\n\n`;
    return head + rows.map((s) => [
      `[${s.index}] ${s.title_kr || ""} / ${s.title || ""}`,
      `status: ${s.status}`,
      `final_prompt: ${s.finalPrompt || buildSlotPrompt(s, mode, refTone, refPeople)}`,
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

  /* ═══ 이코노미 2패스 마감 — 승인된 low 드래프트만 편집 API로 medium 리렌더 (구도 유지) ═══ */
  const finalizeSlots = async (list) => {
    const targets = list.filter((s) => s.status === "success" && s.dataUrl && !s.finalized);
    if (targets.length === 0) return list;
    cancelRef.current = false;
    setPhase("generating");
    addLog(`[마감] 이코노미 2패스 — 승인 ${targets.length}장을 ${FINAL_QUALITY}로 리렌더 (구도 유지)`);
    let out = [...list];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (cancelRef.current) { addLog(`[마감 중단] 나머지는 드래프트 화질로 저장됩니다`); break; }
      setProg({ done: i, total: targets.length, stage: `슬롯 ${t.index} 마감 리렌더 (${FINAL_QUALITY})` });
      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          const hi = await genOpenAIRefine(openaiKey.trim(), t.finalPrompt || "", t.dataUrl, aspect, FINAL_QUALITY);
          setSpent((p) => ({ img: p.img + 1, cost: p.cost + (OPENAI_COST[FINAL_QUALITY] || 0.041) }));
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
    /* 이미지 전체 → images/ 폴더 */
    for (const s of ok) {
      zip.file(`images/${s.index}-${cleanName(topic, 15)}-${s.slug}.png`, dataUrlToU8(s.dataUrl));
    }
    /* Adobe CSV */
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Filename", "Title", "Keywords", "Category", "Releases", "is_ai_generated"];
    const rows = ok.map((s) =>
      [`${s.index}-${cleanName(topic, 15)}-${s.slug}_adobe.jpg`, s.title, normKeywords(s.keywords, ADOBE_MAX_KEYWORDS), s.category, "", "Yes"].map(esc).join(","));
    zip.file(`${base}-adobe-metadata.csv`, "﻿" + [header.map(esc).join(","), ...rows].join("\r\n"));
    /* MiriCanvas XLSX */
    const miriRows = ok.map((s) => ({
      fileName: `${s.index}-${cleanName(topic, 15)}-${s.slug}_miri`,
      elementName: [(s.title_kr || "").substring(0, 8), s.title].filter(Boolean).join(" "),
      keywords: normKeywords(s.keywords_kr, MIRI_MAX_KEYWORDS),
      tier: "Premium", contentType: "Photo",
    }));
    const ws = XLSX.utils.json_to_sheet(miriRows, { header: ["fileName", "elementName", "keywords", "tier", "contentType"] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    zip.file(`${base}-miricanvas.xlsx`, XLSX.write(wb, { bookType: "xlsx", type: "array" }));
    /* 프롬프트 전체 백업도 동봉 */
    zip.file(`${base}-prompts-full.txt`, buildPromptsFullText(ok));
    /* ZIP 저장 (선택 폴더 or 기본 다운로드) */
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    await saveBlob(blob, `${base}-submit-pack.zip`);
    addLog(`[제출 팩] ZIP 저장 완료 — 이미지 ${ok.length}장 + Adobe CSV + 미캔 XLSX + 프롬프트 TXT (요청 ${count}장 대비 ${ok.length === count ? "정확 일치 ✓" : "불일치 ⚠"})`);
    setNotice(`제출 팩 ZIP 저장 완료: 이미지 ${ok.length}장 · Adobe CSV · 미캔 XLSX · 프롬프트 백업${saveDir ? ` → "${saveDir.name}" 폴더` : ""}${ok.length !== count ? ` — 요청 ${count}장과 다릅니다. 미완료 슬롯을 확인하세요.` : ""}`);
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
    setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "generating" } : s)));
    addLog(`[재생성 ${t.index}] ${CAMERA_ANGLES[t.angle]?.label || "자동"} · 시작`);
    try {
      /* 거절/플래그 사유가 있으면 교정 지시로 주입 (같은 실수 반복 차단) */
      const note = t.qcNote || t.autoFlag || "";
      if (note) addLog(`[교정 ${t.index}] 이전 거절 사유 반영: ${note}`);
      const fp = buildSlotPrompt({ ...t, qcNote: note }, mode, refTone, refPeople);
      const dataUrl = await generateImage(fp, ecoTwoPass && provider === "openai" ? "low" : undefined);
      setSlots((p) => p.map((s) => (s.index === t.index
        ? { ...s, status: "success", dataUrl, finalPrompt: fp, rejectReason: "", qcNote: "", autoFlag: "", finalized: false, regenCount: s.regenCount + 1 } : s)));
      setQcRejects((p) => { const n = { ...p }; delete n[t.index]; return n; });
      addLog(`[재생성 ${t.index}] 완료`);
    } catch (err) {
      setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "failed", rejectReason: err.message } : s)));
      addLog(`[재생성 실패 ${t.index}] ${err.message}`);
    }
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
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition ${
        tab === id ? "border-violet-500 text-violet-300 bg-neutral-800" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  /* 공용 다크 입력/셀렉트 클래스 */
  const fieldCls = "text-sm px-3 py-2 bg-neutral-950 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-violet-500";
  /* 승인 대기 시 주의를 끄는 글로우 펄스 (buildSlotPrompt 무관, UI 전용) */
  const attnPulse = { animation: "attnGlow 1.4s ease-in-out infinite" };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200" style={{ fontFamily: "'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif" }}>
      <style>{`@keyframes attnGlow{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.6)}50%{box-shadow:0 0 0 9px rgba(139,92,246,0)}}`}</style>

      {/* ═══ 헤더 ═══ */}
      <header className="bg-neutral-800 border-b border-neutral-700 px-5 pt-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-700 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-neutral-100">
                  FreeJJang <span className="text-neutral-500 font-normal">STOCK STUDIO</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-violet-500/10 text-violet-300 border border-violet-500/30 rounded ml-2">
                    두뇌 {brainName} · 손 {provider === "openai" ? "GPT" : "Gemini"}
                  </span>
                </h1>
                <p className="text-xs text-neutral-500">초안 승인 → 순차 생성 → QC → 제출 팩 · 멈춤은 딱 두 곳</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={startFresh}
                title="슬롯·이미지·로그를 비우고 새 프로젝트 시작 (API 키·설정은 유지)"
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition">
                <RefreshCw className="w-3.5 h-3.5" /> Start Fresh
              </button>
              <button onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded border transition ${
                  imageKey() ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-300"}`}>
                <Key className="w-3.5 h-3.5" /> {imageKey() ? "이미지 엔진 연결됨" : "이미지 API 키 필요"} <Settings2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="pb-4 flex flex-wrap items-end gap-3">
              {/* 두뇌 선택 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">두뇌 (에이전트)</label>
                <select value={brain} onChange={(e) => setBrain(e.target.value)} className={fieldCls}>
                  <option value="gpt">GPT (Codex 계열) · OpenAI 키</option>
                  <option value="gemini">Gemini · 구글 키</option>
                </select>
              </div>
              {brain === "gpt" && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">GPT 모델명</label>
                  <input list="gptModels" value={gptModel} onChange={(e) => setGptModel(e.target.value)} placeholder={GPT_MODEL_DEFAULT}
                    className={`${fieldCls} font-mono w-44`} />
                  <datalist id="gptModels">{GPT_MODEL_PRESETS.map((m) => <option key={m} value={m} />)}</datalist>
                </div>
              )}
              {brain === "gemini" && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">Gemini 모델명</label>
                  <input list="geminiModels" value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} placeholder={GEMINI_MODEL_DEFAULT}
                    className={`${fieldCls} font-mono w-48`} />
                  <datalist id="geminiModels">{GEMINI_MODEL_PRESETS.map((m) => <option key={m} value={m} />)}</datalist>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-300 pb-2 cursor-pointer select-none">
                <input type="checkbox" checked={autoFallback} onChange={(e) => setAutoFallback(e.target.checked)}
                  className="w-4 h-4 accent-violet-500" />
                한도 초과·실패 시 자동 폴백 (키 등록된 GPT·Gemini 우선, Claude는 맨 마지막)
              </label>

              <div className="w-full border-t border-neutral-700/60" />

              {/* 이미지 엔진 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">이미지 엔진 (손)</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className={fieldCls}>
                  <option value="openai">GPT (gpt-image · 기본)</option>
                  <option value="gemini">Gemini (2.5-flash-image)</option>
                </select>
              </div>
              {provider === "openai" && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">이코노미 2패스</label>
                  <button onClick={() => setEcoTwoPass(!ecoTwoPass)}
                    title="초안은 low로 싸고 빠르게 → QC 승인분만 medium으로 구도 유지 리렌더 (반려가 많을수록 절약)"
                    className={`${fieldCls} font-bold ${ecoTwoPass ? "text-emerald-300 border-emerald-500/50" : "text-neutral-500"}`}>
                    {ecoTwoPass ? "ON · low 초안 → medium 마감" : "OFF · 1패스 생성"}
                  </button>
                </div>
              )}
              {provider === "openai" && !ecoTwoPass && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">품질 (기본 medium)</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value)} className={fieldCls}>
                    <option value="low">low — 초안/최저비 명시 시</option>
                    <option value="medium">medium — 기본</option>
                    <option value="high">high — 명시 요청 시</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">종횡비</label>
                <select value={aspect} onChange={(e) => setAspect(e.target.value)} className={`${fieldCls} font-mono`}>
                  {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* 키 2칸 분리 */}
              <div className="flex-1 min-w-52">
                <label className="block text-xs font-semibold text-neutral-400 mb-1">OpenAI API Key (GPT 두뇌 + gpt-image)</label>
                <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-…"
                  className={`${fieldCls} font-mono w-full`} />
              </div>
              <div className="flex-1 min-w-52">
                <label className="block text-xs font-semibold text-neutral-400 mb-1">Google AI Studio Key (Gemini 두뇌 + 이미지)</label>
                <input type="password" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} placeholder="AIzaSy…"
                  className={`${fieldCls} font-mono w-full`} />
              </div>
              <div className="max-w-xs pb-1">
                <p className="text-xs text-neutral-500 leading-relaxed">
                  키는 <b className="text-neutral-400">이 브라우저에만 자동 저장</b>되어 다음에 재입력이 필요 없습니다 (서버 전송 없음). 공용 PC에서는 사용 후 아래 버튼으로 지우세요.
                </p>
                <button onClick={clearSavedKeys}
                  className="mt-1 text-xs text-rose-300/80 hover:text-rose-300 underline underline-offset-2">
                  저장된 키 삭제
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

      <div className="max-w-7xl mx-auto p-5">

        {/* ═══════════ 파이프라인 탭 ═══════════ */}
        {tab === "pipeline" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            <aside className="xl:col-span-1 space-y-4">
              {/* 설정 */}
              <section className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-3">
                <h2 className="text-sm font-bold text-neutral-100">1 · 주제와 정확 장수</h2>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">주제</label>
                  <input value={topic} onChange={(e) => onTopicChange(e.target.value)}
                    disabled={phase === "drafting" || phase === "generating"}
                    placeholder="예: 9월 가을 신학기 계절 배경화면"
                    className={`${fieldCls} w-full disabled:opacity-60`} />
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
                  <textarea value={handlingTip} onChange={(e) => setHandlingTip(e.target.value.slice(0, 500))}
                    disabled={phase === "drafting" || phase === "generating"}
                    rows={2} maxLength={500}
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
                      상업 사진
                    </button>
                    <button onClick={() => { setMode("wallpaper"); setModeAuto(false); }}
                      className={`flex-1 text-xs font-bold py-2 rounded border transition ${mode === "wallpaper" ? "bg-violet-600 text-white border-violet-600" : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-neutral-200"}`}>
                      배경화면 (여백 40-60%)
                    </button>
                  </div>
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
                          {slots.length}행 · 모드 {mode === "wallpaper" ? "배경화면(여백 40-60%)" : "상업 사진"} · 엔진 {provider === "openai" ? `GPT ${quality}` : "Gemini"} · 종횡비 {aspect}
                          {successCount > 0 && ` · 유효 ${successCount}장 유지, 미완료만 생성`}
                        </p>
                        {provider === "openai" && (
                          <p className="text-xs text-violet-400/80 mt-0.5 flex items-center gap-1">
                            <CircleDollarSign className="w-3.5 h-3.5" /> 예상 약 ${estCost()} ({quality} 기준 근사치 — 실제 청구액은 다를 수 있음)
                          </p>
                        )}
                      </div>
                      <button onClick={runGeneration} disabled={!imageKey()}
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
                        className="bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5 transition">
                        <Download className="w-3.5 h-3.5" /> 프롬프트만 TXT
                      </button>
                      <button onClick={exportPromptsFull}
                        className="bg-neutral-950 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5 transition">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> 전체 필드 TXT
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
                                {rejected && (
                                  <div className="absolute inset-0 bg-red-600/50 flex flex-col items-center justify-center text-white text-xs font-bold">
                                    <Ban className="w-6 h-6 mb-1" /> 거절 표시됨
                                  </div>
                                )}
                              </>
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
                              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 leading-relaxed">
                                자동 검수: {s.autoFlag}
                              </p>
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
                      <button onClick={runGeneration} disabled={!imageKey()}
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
                      <button onClick={submitQC} disabled={autoQcBusy}
                        style={!autoQcBusy ? attnPulse : undefined}
                        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                        <Check className="w-4 h-4" />
                        {Object.values(qcRejects).some(Boolean)
                          ? `거절 ${Object.values(qcRejects).filter(Boolean).length}건 격리·재생성`
                          : "전량 승인 · 제출 팩 저장"}
                      </button>
                    </>
                  )}

                  {phase === "done" && (
                    <>
                      <p className="text-xs text-emerald-300 leading-relaxed">제작 완료 — 유효 {successCount}장.</p>
                      <button onClick={exportSubmitPack}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                        <Download className="w-4 h-4" /> 저장 및 다운로드 (ZIP)
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

      {/* 이미지 확대 프리뷰 */}
      {previewSlot && (
        <div onClick={() => setPreviewSlot(null)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 cursor-zoom-out">
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={previewSlot.dataUrl} alt={previewSlot.title} className="w-full rounded-lg" />
            <div className="text-center mt-2">
              <p className="text-sm font-bold text-white">{previewSlot.index} · {previewSlot.title_kr || previewSlot.title}</p>
              <button onClick={() => setPreviewSlot(null)} className="mt-2 text-xs text-white bg-neutral-800 border border-neutral-600 px-3 py-1.5 rounded">닫기</button>
            </div>
          </div>
        </div>
      )}

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
