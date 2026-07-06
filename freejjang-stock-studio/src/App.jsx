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
   FreeJJang STOCK STUDIO — 최종판 (다크 · 3중 두뇌)
   두뇌: Claude(Fable) / GPT(Codex 계열) / Gemini — 자동 폴백
   손:   GPT 이미지 API(기본) / Gemini — 실제 이미지 생성
   파이프라인: 초안 승인(멈춤1) → 순차 생성 → QC(멈춤2) → 제출 팩
   ═══════════════════════════════════════════════════════════ */

const GUARD =
  "Strictly no text, no letters, no numbers, no logos, no watermarks, no brand names, no branded packaging, no copyrighted characters, no unrequested people.";

const ASPECTS = ["1:1", "16:9", "4:3", "3:4", "9:16"];
const OPENAI_SIZE = { "1:1": "1024x1024", "16:9": "1536x1024", "4:3": "1536x1024", "3:4": "1024x1536", "9:16": "1024x1536" };
/* gpt-image 1536×1024 기준 근사 단가 (실제 청구액은 상이할 수 있음) */
const OPENAI_COST = { low: 0.005, medium: 0.041, high: 0.165 };

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
    "believable present-day commercial photograph that could genuinely be shot in a real 2026 facility: real plausible equipment with realistic subtle screen UI (absolutely NO floating holograms, NO laser grids, NO sci-fi projections), natural daylight or realistic practical lighting, true-to-life materials and accurate colors, a few gentle lived-in details that make it credible (a folded towel, an unbranded water bottle, a plant, natural floor wear), slight natural asymmetry and imperfection — strictly NOT neon-drenched, NOT cyberpunk, NOT a sterile empty showroom, NOT over-polished CGI perfection",
  bright: "bright airy minimal commercial look, abundant soft natural daylight, clean neutral palette, realistic true-to-life materials, believable real-world scene",
  lifestyle: "warm inviting lifestyle photography, golden natural light, cozy human warmth in a believable real space, editorial magazine quality",
  cinematic: "cinematic moody lighting with dramatic shadows and rich atmosphere, but still a believable real-world scene with plausible equipment — no sci-fi fantasy elements",
  concept: "futuristic concept aesthetic, neon accent lighting, high-tech atmosphere, stylized commercial render",
};

/* 두뇌(에이전트) 라벨 · 기본 모델 */
const BRAIN_LABELS = { claude: "Claude(Fable)", gpt: "GPT(Codex 계열)", gemini: "Gemini" };
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

/* 응답 텍스트 → JSON 파싱 (세 두뇌 공용) */
function extractJSON(text, who) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error(`${who} 응답에서 JSON을 찾지 못했습니다.`);
  return JSON.parse(clean.slice(s, e + 1));
}

/* ── 두뇌 A: Claude (내장 · 키 불필요) ── */
async function askClaude(system, user, imageBlock) {
  const content = imageBlock
    ? [{ type: "image", source: { type: "base64", media_type: imageBlock.mime, data: imageBlock.data } }, { type: "text", text: user }]
    : user;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1400, system, messages: [{ role: "user", content }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Claude: ${data.error.message || "요청 실패"}`);
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return extractJSON(text, "Claude");
}

/* ── 두뇌 B: GPT (OpenAI 키 · Codex 계열) ── */
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

/* ── 두뇌 C: Gemini (Google AI 스튜디오 키) ── */
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
  return [
    slot.subject,
    `Focal placement: ${slot.focal_placement || "center"}`,
    comp, camera,
    `Lighting: ${slot.lighting || "soft natural light with realistic shadows"}`,
    atmosphere,
    toneLine,
    peopleLine,
    `Palette: ${slot.palette || "bright commercial tones"}`,
    slot.kind === "illustration" ? "professional stock illustration" : "8K photorealistic professional stock photograph, crisp detail",
    GUARD,
  ].filter(Boolean).join(". ");
}

export default function App() {
  /* ── 두뇌(에이전트) 설정 ── */
  const [brain, setBrain] = useState("claude"); // claude | gpt | gemini
  const [autoFallback, setAutoFallback] = useState(true);
  const [gptModel, setGptModel] = useState(GPT_MODEL_DEFAULT);
  const [geminiModel, setGeminiModel] = useState(GEMINI_MODEL_DEFAULT);

  /* ── 이미지 엔진 설정 ── */
  const [provider, setProvider] = useState("openai"); // openai | gemini (손)
  const [quality, setQuality] = useState("medium");
  const [aspect, setAspect] = useState("16:9");
  const [showSettings, setShowSettings] = useState(true);

  /* ── API 키 (서비스별 분리 · 두뇌와 이미지 엔진 공유) ── */
  const [openaiKey, setOpenaiKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");

  const [tab, setTab] = useState("pipeline"); // pipeline | basic | analysis

  /* ── 파이프라인 상태 ── */
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [maxNew, setMaxNew] = useState(""); // 생성 상한 (하드캡, 선택)
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
        if (s.brain) setBrain(s.brain);
        if (s.provider) setProvider(s.provider);
        if (s.quality) setQuality(s.quality);
        if (s.aspect) setAspect(s.aspect);
        if (s.gptModel) setGptModel(s.gptModel);
        if (s.geminiModel) setGeminiModel(s.geminiModel);
        if (typeof s.autoFallback === "boolean") setAutoFallback(s.autoFallback);
        if (s.refTone) setRefTone(s.refTone);
        if (s.refPeople) setRefPeople(s.refPeople);
      }
    } catch { /* 손상된 저장값 무시 */ }
    settingsLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!settingsLoaded.current) return;
    try {
      localStorage.setItem("freejjang_settings", JSON.stringify({
        openaiKey, googleKey, brain, provider, quality, aspect, gptModel, geminiModel, autoFallback, refTone, refPeople,
      }));
    } catch { /* 저장 불가 환경 무시 */ }
  }, [openaiKey, googleKey, brain, provider, quality, aspect, gptModel, geminiModel, autoFallback, refTone, refPeople]);

  /* ── Start Fresh: 파이프라인만 초기화 (키·설정은 유지) ── */
  const startFresh = () => {
    if (slots.length > 0 && !window.confirm("새로 시작할까요? 현재 슬롯·이미지·로그가 모두 지워집니다. (API 키와 설정은 유지)")) return;
    cancelRef.current = true;
    setTopic(""); setSlots([]); setQcRejects({}); setQcReason("");
    setPhase("idle"); setProg(null); setAutoQcProg(null); setAutoQcBusy(false);
    setMaxNew(""); setLog([]); setNotice(null);
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
  const generateImage = async (finalPrompt) => {
    const key = imageKey();
    if (!key) throw new Error(`${provider === "gemini" ? "Google" : "OpenAI"} 이미지 API 키를 먼저 연결하세요 (상단 설정).`);
    return provider === "gemini"
      ? await genGemini(key, finalPrompt, aspect)
      : await genOpenAI(key, finalPrompt, aspect, quality);
  };

  /* ═══ 두뇌 라우터 — 선택 두뇌 먼저 → 키 등록된 유료(GPT/Gemini) → Claude 최후 ═══ */
  const brainUsable = (b) => (b === "claude" ? true : b === "gpt" ? !!openaiKey.trim() : !!googleKey.trim());
  const buildBrainOrder = () => {
    const order = [];
    const push = (b) => { if (b && !order.includes(b)) order.push(b); };
    push(brain); // 1. 선택 두뇌 (사용자 의도 존중)
    if (autoFallback) {
      if (openaiKey.trim()) push("gpt");   // 2. 키 등록된 유료 두뇌 먼저
      if (googleKey.trim()) push("gemini");
      push("claude");                       // 3. Claude는 맨 마지막 안전망
    }
    return order.filter(brainUsable);
  };
  const callBrain = (b, system, user, imageBlock) => {
    if (b === "gpt") return askGPT(openaiKey.trim(), gptModel.trim(), system, user, imageBlock);
    if (b === "gemini") return askGemini(googleKey.trim(), geminiModel.trim(), system, user, imageBlock);
    return askClaude(system, user, imageBlock);
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

  /* ═══ 1단계: 초안 기획 (정확 장수 · 조합 반복 금지) ═══ */
  const draftSlots = async () => {
    if (!topic.trim() || phase === "drafting") return;
    cancelRef.current = false;
    setPhase("drafting");
    setSlots([]); setQcRejects({});
    addLog(`[초안] "${topic}" — 정확히 ${count}행, 모드=${mode}, 두뇌=${brainName}`);
    const made = [];
    while (made.length < count && !cancelRef.current) {
      const n = Math.min(2, count - made.length);
      setProg({ done: made.length, total: count, stage: `${brainName} 초안 작성` });
      try {
        const combos = made.slice(-4).map((s) => `${s.subject}|${s.camera}|${s.palette}`).join(" / ") || "none";
        const r = await askBrain(
          `You draft professional stock image slots. Respond ONLY compact JSON:
{"items":[{"slug":"en-hyphen","kind":"photo","subject":"1 sentence main subject+scene","focal_placement":"e.g. center-left","copy_space":"short","camera":"lens/angle/depth (photo) or medium/edges (illustration)","lighting":"direction+texture","palette":"colors","title":"EN stock title 6-12 words, descriptive and searchable","title_kr":"KR title","keywords":"EXACTLY 35 EN keywords, comma-separated, SEO-ordered","keywords_kr":"25 KR single-noun keywords comma-sep (write 가을,풍경 never 가을풍경)","category":11}]}
RULES: kind is "photo" or "illustration" by topic. Never repeat a subject+camera+lighting+palette combo within the set. No contradictory lens/angle/lighting mixes. Exclude text, logos, brands, copyrighted characters, unrequested people. Cultural items (flags, food, rituals, object counts) must be factually correct. Mode "wallpaper": copy_space = a 40-60% low-density area opposite the subject. Mode "commercial": medium or wide framing with environmental context and comfortable breathing room — the subject fills about 50-70% of the frame (NEVER edge-to-edge, NOT a tight close-up), keep roughly 25-35% clean uncluttered negative space for versatility, rule-of-thirds/leading-line, subject fully in frame and not cropped. Set "copy_space" to name where that calm area sits (e.g. "upper-left clean area").
KEYWORDS (Adobe SEO, critical): "keywords" must be EXACTLY 35 English keywords, comma-separated, NO duplicates, ordered by buyer importance (Adobe weights the first ~10 most). Order groups: (1) main subject nouns, (2) specific descriptors/materials/actions, (3) concept/theme/season/emotion, (4) color and lighting, (5) composition/orientation (copy space, background, close-up, minimal), (6) use-case (banner, wallpaper, marketing, web design). Use single words or natural 2-word phrases, all lowercase, only real buyer search terms that literally describe what is visible. No text/number/logo/brand words. "keywords_kr" follows the same SEO ordering in Korean single nouns.
CATEGORY: pick the ONE best Adobe Stock category id from this exact list: ${ADOBE_CAT_LIST}. Choose by the dominant visible subject (e.g. scenery→11, dish/ingredient→7, festival/tradition/ritual→15, person-focused lifestyle→12 or 13, plant/flower→14, drink→4, tech/device→19). If kind is "illustration"/vector/background and nothing fits more strongly, use 8. Return category as the integer id only.`,
          `Topic: "${topic}". Mode: ${mode}. Generate exactly ${n} slots. Combos already used (avoid): ${combos}${refinementLine()}`
        );
        for (const item of r.items || []) {
          if (made.length >= count) break;
          made.push({
            ...item,
            index: pad2(made.length + 1),
            status: "pending", regenCount: 0, dataUrl: "", rejectReason: "", angle: refAngle, finalPrompt: "",
            slug: cleanName(item.slug, 24) || `slot-${made.length + 1}`,
          });
        }
        setSlots([...made]);
        addLog(`[초안] ${made.length}/${count}행 완료`);
      } catch (err) {
        addLog(`[오류] 초안 실패: ${err.message} — 3초 후 재시도`);
        await new Promise((r2) => setTimeout(r2, 3000));
      }
    }
    setProg(null);
    if (cancelRef.current) { setPhase("idle"); addLog("[초안] 사용자 중단"); return; }
    setPhase("review");
    addLog(`[멈춤 1] 초안 ${made.length}행 검토 대기 — 승인 시 생성 시작`);
  };

  /* ═══ 2단계: 승인 후 missing-only 순차 생성 ═══ */
  const runGeneration = async () => {
    if (phase === "generating") return;
    if (!imageKey()) { setNotice("이미지 API 키가 필요합니다."); return; }
    cancelRef.current = false;
    setPhase("generating");
    const targets = slots.filter((s) => s.status === "pending" || s.status === "failed" || s.status === "rejected");
    const cap = parseInt(maxNew) > 0 ? parseInt(maxNew) : Infinity;
    addLog(`[생성] 미완료 ${targets.length}슬롯 (상한 ${cap === Infinity ? "없음" : cap + "장"}) · ${provider === "openai" ? `GPT ${quality}` : "Gemini"}`);
    let newMade = 0;
    for (const t of targets) {
      if (cancelRef.current) break;
      if (newMade >= cap) { addLog(`[상한] ${cap}장 하드캡 도달 — 중단`); break; }
      setProg({ done: newMade, total: Math.min(targets.length, cap), stage: `슬롯 ${t.index} 생성 중` });
      setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "generating" } : s)));
      try {
        const fp = buildSlotPrompt(t, mode, refTone, refPeople);
        const dataUrl = await generateImage(fp);
        newMade += 1;
        setSlots((p) => p.map((s) => (s.index === t.index
          ? { ...s, status: "success", dataUrl, finalPrompt: fp, rejectReason: "", regenCount: s.regenCount + 1 } : s)));
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
      ? { ...s, status: "rejected", dataUrl: "", rejectReason: s.autoFlag || qcReason || "visual defect" } : s));
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
      `kind: ${s.kind || ""}`,
      `focal_placement: ${s.focal_placement || ""}`,
      `copy_space: ${s.copy_space || ""}`,
      `camera: ${s.camera || ""}`,
      `lighting: ${s.lighting || ""}`,
      `palette: ${s.palette || ""}`,
      `category: ${s.category} (${ADOBE_CATEGORIES[s.category] || "?"})`,
      `keywords_en: ${normKeywords(s.keywords, ADOBE_MAX_KEYWORDS)}`,
      `keywords_kr: ${normKeywords(s.keywords_kr, 25)}`,
    ].join("\n")).join("\n\n────────────────────────────\n\n");
  };
  const exportPromptsFull = () => {
    const rows = slots.filter((s) => s.subject);
    if (!rows.length) { setNotice("내보낼 슬롯이 없습니다."); return; }
    saveBlob(new Blob([buildPromptsFullText(rows)], { type: "text/plain;charset=utf-8" }), `${cleanName(topic, 20) || "freejjang"}-prompts-full.txt`);
    addLog(`[백업] 프롬프트 TXT(전체) 저장 완료 — ${rows.length}슬롯`);
  };

  /* ═══ 제출 팩 — ZIP 하나로 묶어 저장 (이미지 + Adobe CSV + 미캔 XLSX + 프롬프트 백업) ═══ */
  const exportSubmitPack = async () => {
    const ok = slots.filter((s) => s.status === "success" && s.dataUrl);
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
      keywords: normKeywords(s.keywords_kr, 25),
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

  /* ── 슬롯 단건 재생성 (편집한 구도/앵글 즉시 반영) ── */
  const regenSlot = async (t) => {
    if (!imageKey()) { setNotice("이미지 API 키가 필요합니다."); return; }
    if (phase === "generating") return;
    setSlots((p) => p.map((s) => (s.index === t.index ? { ...s, status: "generating" } : s)));
    addLog(`[재생성 ${t.index}] ${CAMERA_ANGLES[t.angle]?.label || "자동"} · 시작`);
    try {
      const fp = buildSlotPrompt(t, mode, refTone, refPeople);
      const dataUrl = await generateImage(fp);
      setSlots((p) => p.map((s) => (s.index === t.index
        ? { ...s, status: "success", dataUrl, finalPrompt: fp, rejectReason: "", autoFlag: "", regenCount: s.regenCount + 1 } : s)));
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

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200" style={{ fontFamily: "'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif" }}>

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
                  <option value="claude">Claude Fable · 키 불필요 (기본)</option>
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">장수 (1행=1장)</label>
                    <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                      disabled={phase !== "idle" && phase !== "done"}
                      className={`${fieldCls} w-full disabled:opacity-60`}>
                      {[3, 6, 9, 12, 15, 20].map((n) => <option key={n} value={n}>{n}장 정확히</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">생성 상한 (선택)</label>
                    <input value={maxNew} onChange={(e) => setMaxNew(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="예: 20"
                      className={`${fieldCls} w-full font-mono`} />
                  </div>
                </div>
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

              {/* 실행 로그 */}
              <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                <div className="text-xs font-mono text-neutral-500 uppercase mb-2 flex justify-between">
                  <span>실행 로그</span>
                  <span className={phase === "drafting" || phase === "generating" ? "text-violet-400" : "text-neutral-600"}>
                    {phase === "idle" ? "대기" : phase === "review" ? "멈춤 1 · 검토" : phase === "qc" ? "멈춤 2 · QC" : phase === "done" ? "완료" : "가동 중"}
                  </span>
                </div>
                <div className="h-48 overflow-y-auto font-mono text-xs space-y-1">
                  {log.length === 0
                    ? <div className="text-neutral-600 italic">로그 없음</div>
                    : log.map((l, i) => (
                        <div key={i} className={l.includes("[오류]") || l.includes("[실패") ? "text-red-400" : l.includes("[성공") || l.includes("완료") ? "text-emerald-400" : l.includes("[멈춤") ? "text-violet-300" : l.includes("[두뇌 폴백]") ? "text-amber-300" : "text-neutral-400"}>{l}</div>
                      ))}
                </div>
              </section>
            </aside>

            {/* 메인 워크스페이스 */}
            <main className="xl:col-span-3 space-y-4">

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
                          <ClipboardCheck className="w-4 h-4" /> 멈춤 1 · 초안 검토
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
                        <Play className="w-4 h-4" /> 승인 · 순차 생성 시작
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
                        <p className="text-xs text-emerald-300/80 mt-0.5">제출 팩이 저장되었습니다. 필요 시 다시 내려받을 수 있어요.</p>
                      </div>
                      <button onClick={exportSubmitPack}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                        <Download className="w-4 h-4" /> 제출 팩 다시 저장
                      </button>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                            <p className="text-xs text-neutral-500 font-mono truncate" title={`Adobe cat ${s.category} · 키워드 ${normKeywords(s.keywords, ADOBE_MAX_KEYWORDS).split(", ").filter(Boolean).length}개`}>{s.kind} · {s.focal_placement} · {ADOBE_CATEGORIES[s.category] || `cat ${s.category}`}{s.keywords ? ` · kw ${normKeywords(s.keywords, ADOBE_MAX_KEYWORDS).split(", ").filter(Boolean).length}` : ""}{s.regenCount > 1 ? ` · 재생성 ${s.regenCount - 1}회` : ""}</p>
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
