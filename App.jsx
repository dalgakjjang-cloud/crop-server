import React, { useState, useRef } from "react";
import {
  Sparkles, Download, Trash2, RefreshCw, Copy, Check, Cpu, AlertTriangle,
  FileSpreadsheet, Wand2, X, Play, Square, Image as ImageIcon, ScanSearch,
  Layers, Key, Settings2, CornerDownLeft, FileText, ClipboardCheck,
  ShieldAlert, CircleDollarSign, ChevronRight, Ban
} from "lucide-react";
import * as XLSX from "xlsx";

/* ═══════════════════════════════════════════════════════════
   FreeJJang STOCK STUDIO — 최종판
   두뇌: Claude(Fable) — 초안 기획 · 13블록 분석 · 메타데이터
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

/* Adobe Stock \uacf5\uc2dd \ucf58\ud150\uce20 \uce74\ud14c\uace0\ub9ac (1-21) \u2014 \ucd08\uc548 \uc120\uc815\u00b7CSV\u00b7\uce74\ub4dc \ud45c\uc2dc \uacf5\uc6a9 */
const ADOBE_CATEGORIES = {
  1: "Animals", 2: "Buildings and Architecture", 3: "Business", 4: "Drinks",
  5: "The Environment", 6: "States of Mind", 7: "Food", 8: "Graphic Resources",
  9: "Hobbies and Leisure", 10: "Industry", 11: "Landscapes", 12: "Lifestyle",
  13: "People", 14: "Plants and Flowers", 15: "Culture and Religion", 16: "Science",
  17: "Social Issues", 18: "Sports", 19: "Technology", 20: "Transport", 21: "Travel",
};
const ADOBE_CAT_LIST = Object.entries(ADOBE_CATEGORIES).map(([id, name]) => `${id} ${name}`).join(", ");
const ADOBE_MAX_KEYWORDS = 35; // Adobe SEO \ud0a4\uc6cc\ub4dc \uc0c1\ud55c

const pad2 = (n) => String(n).padStart(2, "0");
const cleanName = (s, n) => (s || "").toLowerCase().replace(/[^\uac00-\ud7afA-Za-z0-9-]/g, "").substring(0, n);

/* SEO \ud0a4\uc6cc\ub4dc \uc815\uaddc\ud654: \uc55e\uc21c\uc11c(\uc911\uc694\ub3c4) \uc720\uc9c0 \u00b7 \uacf5\ubc31\uc815\ub9ac \u00b7 \ub300\uc18c\ubb38\uc790 \ubb34\uc2dc \uc911\ubcf5 \uc81c\uac70 \u00b7 \uc0c1\ud55c \ucef7 */
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

/* ── Claude (내장 · 키 불필요) ── */
async function askClaude(system, user, imageBlock) {
  const content = imageBlock
    ? [{ type: "image", source: { type: "base64", media_type: imageBlock.mime, data: imageBlock.data } }, { type: "text", text: user }]
    : user;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages: [{ role: "user", content }] }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("Claude 응답에서 JSON을 찾지 못했습니다.");
  return JSON.parse(clean.slice(s, e + 1));
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
function buildSlotPrompt(slot, mode) {
  const comp = mode === "wallpaper"
    ? `40-60% low-density clean copy space opposite the subject (${slot.copy_space || "clean margin"})`
    : `natural full commercial composition, ${slot.copy_space || "spacing only where needed (10-30%)"}, subject not pushed to the edge`;
  const camera = slot.kind === "illustration"
    ? `Rendering: ${slot.camera || "clean vector-like edges, consistent medium"}`
    : `Camera: ${slot.camera || "one coherent lens, natural depth of field"}`;
  return [
    slot.subject,
    `Focal placement: ${slot.focal_placement || "center"}`,
    comp, camera,
    `Lighting: ${slot.lighting || "soft natural light with realistic shadows"}`,
    `Palette: ${slot.palette || "bright commercial tones"}`,
    slot.kind === "illustration" ? "professional stock illustration" : "8K photorealistic professional stock photograph, crisp detail",
    GUARD,
  ].filter(Boolean).join(". ");
}

export default function App() {
  /* 엔진 설정 — GPT API 기본 (Codex 한도 초과 시 API 폴백 구조와 동일 사상) */
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [quality, setQuality] = useState("medium");
  const [aspect, setAspect] = useState("16:9");
  const [showSettings, setShowSettings] = useState(true);

  const [tab, setTab] = useState("pipeline"); // pipeline | basic | analysis

  /* ── 파이프라인 상태 ── */
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [maxNew, setMaxNew] = useState(""); // 생성 상한 (하드캡, 선택)
  const [mode, setMode] = useState("commercial"); // commercial | wallpaper
  const [modeAuto, setModeAuto] = useState(true);
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

  const onTopicChange = (v) => {
    setTopic(v);
    if (modeAuto) setMode(WALLPAPER_RE.test(v) ? "wallpaper" : "commercial");
  };

  const estCost = () => {
    if (provider !== "openai") return null;
    const n = slots.filter((s) => s.status !== "success").length || count;
    return (n * (OPENAI_COST[quality] || 0.041)).toFixed(2);
  };

  const generateImage = async (finalPrompt) => {
    if (!apiKey.trim()) throw new Error("이미지 API 키를 먼저 연결하세요 (상단 설정).");
    return provider === "gemini"
      ? await genGemini(apiKey.trim(), finalPrompt, aspect)
      : await genOpenAI(apiKey.trim(), finalPrompt, aspect, quality);
  };

  /* ═══ 1단계: Fable 초안 기획 (정확 장수 · 조합 반복 금지) ═══ */
  const draftSlots = async () => {
    if (!topic.trim() || phase === "drafting") return;
    cancelRef.current = false;
    setPhase("drafting");
    setSlots([]); setQcRejects({});
    addLog(`[초안] "${topic}" — 정확히 ${count}행, 모드=${mode}`);
    const made = [];
    while (made.length < count && !cancelRef.current) {
      const n = Math.min(2, count - made.length);
      setProg({ done: made.length, total: count, stage: "Fable 초안 작성" });
      try {
        const combos = made.slice(-4).map((s) => `${s.subject}|${s.camera}|${s.palette}`).join(" / ") || "none";
        const r = await askClaude(
          `You draft professional stock image slots. Respond ONLY compact JSON:
{"items":[{"slug":"en-hyphen","kind":"photo","subject":"1 sentence main subject+scene","focal_placement":"e.g. center-left","copy_space":"short","camera":"lens/angle/depth (photo) or medium/edges (illustration)","lighting":"direction+texture","palette":"colors","title":"EN stock title 6-12 words, descriptive and searchable","title_kr":"KR title","keywords":"EXACTLY 35 EN keywords, comma-separated, SEO-ordered","keywords_kr":"25 KR single-noun keywords comma-sep (write 가을,풍경 never 가을풍경)","category":11}]}
RULES: kind is "photo" or "illustration" by topic. Never repeat a subject+camera+lighting+palette combo within the set. No contradictory lens/angle/lighting mixes. Exclude text, logos, brands, copyrighted characters, unrequested people. Cultural items (flags, food, rituals, object counts) must be factually correct. Mode "wallpaper": copy_space = a 40-60% low-density area opposite the subject. Mode "commercial": natural rule-of-thirds/leading-line/central composition, copy_space only 10-30% if needed.
KEYWORDS (Adobe SEO, critical): "keywords" must be EXACTLY 35 English keywords, comma-separated, NO duplicates, ordered by buyer importance (Adobe weights the first ~10 most). Order groups: (1) main subject nouns, (2) specific descriptors/materials/actions, (3) concept/theme/season/emotion, (4) color and lighting, (5) composition/orientation (copy space, background, close-up, minimal), (6) use-case (banner, wallpaper, marketing, web design). Use single words or natural 2-word phrases, all lowercase, only real buyer search terms that literally describe what is visible. No text/number/logo/brand words. "keywords_kr" follows the same SEO ordering in Korean single nouns.
CATEGORY: pick the ONE best Adobe Stock category id from this exact list: ${ADOBE_CAT_LIST}. Choose by the dominant visible subject (e.g. scenery→11, dish/ingredient→7, festival/tradition/ritual→15, person-focused lifestyle→12 or 13, plant/flower→14, drink→4, tech/device→19). If kind is "illustration"/vector/background and nothing fits more strongly, use 8. Return category as the integer id only.`,
          `Topic: "${topic}". Mode: ${mode}. Generate exactly ${n} slots. Combos already used (avoid): ${combos}`
        );
        for (const item of r.items || []) {
          if (made.length >= count) break;
          made.push({
            ...item,
            index: pad2(made.length + 1),
            status: "pending", regenCount: 0, dataUrl: "", rejectReason: "",
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
    if (!apiKey.trim()) { setNotice("이미지 API 키가 필요합니다."); return; }
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
        const dataUrl = await generateImage(buildSlotPrompt(t, mode));
        newMade += 1;
        setSlots((p) => p.map((s) => (s.index === t.index
          ? { ...s, status: "success", dataUrl, rejectReason: "", regenCount: s.regenCount + 1 } : s)));
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
        addLog(`[미완료] 슬롯 ${missing.join(", ")} — 같은 엔진으로 재생성만 진행하세요 (자동 전환 없음)`);
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

  /* ═══ Fable 자동 검수 — 텍스트/왜곡/문화오류/주제이탈/구도 위반 자동 플래그 ═══ */
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
    addLog(`[자동 검수] Fable Vision — ${targets.length}장 검사 시작`);
    let flagged = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setAutoQcProg({ done: i, total: targets.length });
      try {
        const b64 = await shrinkForVision(t.dataUrl);
        const r = await askClaude(
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

  /* ═══ 내보내기 (Adobe CSV → 미캔 XLSX 자동 연속) ═══ */
  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const downloadSlotImage = (s) => {
    const a = document.createElement("a");
    a.href = s.dataUrl;
    a.download = `${s.index}-${cleanName(topic, 15)}-${s.slug}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  const exportSubmitPack = async () => {
    const ok = slots.filter((s) => s.status === "success" && s.dataUrl);
    if (ok.length === 0) { setNotice("성공한 이미지가 없습니다."); return; }
    /* 이미지 전체 */
    for (const s of ok) { downloadSlotImage(s); await new Promise((r) => setTimeout(r, 350)); }
    /* Adobe CSV */
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Filename", "Title", "Keywords", "Category", "Releases", "is_ai_generated"];
    const rows = ok.map((s) =>
      [`${s.index}-${cleanName(topic, 15)}-${s.slug}_adobe.jpg`, s.title, normKeywords(s.keywords, ADOBE_MAX_KEYWORDS), s.category, "", "Yes"].map(esc).join(","));
    download(new Blob(["\uFEFF" + [header.map(esc).join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }),
      `${cleanName(topic, 20)}-adobe-metadata.csv`);
    /* MiriCanvas XLSX — 자동 연속 (되묻지 않음) */
    const miriRows = ok.map((s) => ({
      fileName: `${s.index}-${cleanName(topic, 15)}-${s.slug}_miri`,
      elementName: [(s.title_kr || "").substring(0, 8), s.title].filter(Boolean).join(" "),
      keywords: normKeywords(s.keywords_kr, 25),
      tier: "Premium", contentType: "Photo",
    }));
    const ws = XLSX.utils.json_to_sheet(miriRows, { header: ["fileName", "elementName", "keywords", "tier", "contentType"] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${cleanName(topic, 20)}-miricanvas.xlsx`);
    addLog(`[제출 팩] 이미지 ${ok.length}장 + Adobe CSV + 미캔 XLSX 저장 완료 (요청 ${count}장 대비 ${ok.length === count ? "정확 일치 ✓" : "불일치 ⚠"})`);
    setNotice(`제출 팩 완료: 이미지 ${ok.length}장 · Adobe CSV · 미캔 XLSX${ok.length !== count ? ` — 요청 ${count}장과 다릅니다. 미완료 슬롯을 확인하세요.` : ""}`);
  };

  const updateSlot = (index, field, value) =>
    setSlots((p) => p.map((s) => (s.index === index ? { ...s, [field]: value } : s)));

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
    addLog(`[분석] 13블록 분해 시작`);
    try {
      const r = await askClaude(
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
      pending: "bg-stone-200 text-slate-500",
      generating: "bg-amber-100 text-amber-700 animate-pulse",
      success: "bg-emerald-100 text-emerald-700",
      failed: "bg-red-100 text-red-600",
      rejected: "bg-orange-100 text-orange-600",
    };
    return <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${map[s.status]}`}>{s.status}</span>;
  };

  const selectedFreeItem = freeGallery.find((g) => g.id === selectedFree);
  const successCount = slots.filter((s) => s.status === "success").length;

  const TabBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition ${
        tab === id ? "border-violet-500 text-violet-700 bg-white" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-stone-100 text-slate-800" style={{ fontFamily: "'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif" }}>

      {/* ═══ 헤더 ═══ */}
      <header className="bg-white border-b-2 border-slate-900 px-5 pt-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  FreeJJang <span className="text-slate-400 font-normal">STOCK STUDIO</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-violet-100 text-violet-700 border border-violet-300 rounded ml-2">
                    두뇌 Fable · 손 {provider === "openai" ? "GPT" : "Gemini"}
                  </span>
                </h1>
                <p className="text-xs text-slate-500">초안 승인 → 순차 생성 → QC → 제출 팩 · 멈춤은 딱 두 곳</p>
              </div>
            </div>
            <button onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded border transition ${
                apiKey ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-amber-50 border-amber-300 text-amber-700"}`}>
              <Key className="w-3.5 h-3.5" /> {apiKey ? "이미지 엔진 연결됨" : "이미지 API 키 필요"} <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {showSettings && (
            <div className="pb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">이미지 엔진</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}
                  className="text-sm px-3 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none">
                  <option value="openai">GPT (gpt-image · 기본)</option>
                  <option value="gemini">Gemini (2.5-flash-image)</option>
                </select>
              </div>
              {provider === "openai" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">품질 (기본 medium)</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value)}
                    className="text-sm px-3 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none">
                    <option value="low">low — 초안/최저비 명시 시</option>
                    <option value="medium">medium — 기본</option>
                    <option value="high">high — 명시 요청 시</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">종횡비</label>
                <select value={aspect} onChange={(e) => setAspect(e.target.value)}
                  className="text-sm px-3 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none font-mono">
                  {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-64">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {provider === "openai" ? "OpenAI API Key" : "Google AI Studio API Key"}
                </label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === "openai" ? "sk-…" : "AIzaSy…"}
                  className="w-full text-sm font-mono px-3 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none focus:border-violet-500" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs pb-1">
                키는 화면 메모리에만 유지되며 어디에도 기록·출력되지 않습니다. 새로고침 시 재입력하세요.
              </p>
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
              <section className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm space-y-3">
                <h2 className="text-sm font-bold text-slate-900">1 · 주제와 정확 장수</h2>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">주제</label>
                  <input value={topic} onChange={(e) => onTopicChange(e.target.value)}
                    disabled={phase === "drafting" || phase === "generating"}
                    placeholder="예: 9월 가을 신학기 계절 배경화면"
                    className="w-full text-sm px-3 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none focus:border-violet-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">장수 (1행=1장)</label>
                    <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                      disabled={phase !== "idle" && phase !== "done"}
                      className="w-full text-sm px-2.5 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none">
                      {[3, 6, 9, 12, 15, 20].map((n) => <option key={n} value={n}>{n}장 정확히</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">생성 상한 (선택)</label>
                    <input value={maxNew} onChange={(e) => setMaxNew(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="예: 20" 
                      className="w-full text-sm px-2.5 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">구도 모드 (요청 문구로 자동 판별)</label>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setMode("commercial"); setModeAuto(false); }}
                      className={`flex-1 text-xs font-bold py-2 rounded border transition ${mode === "commercial" ? "bg-slate-900 text-violet-300 border-slate-900" : "bg-stone-50 border-stone-300 text-slate-500"}`}>
                      상업 사진
                    </button>
                    <button onClick={() => { setMode("wallpaper"); setModeAuto(false); }}
                      className={`flex-1 text-xs font-bold py-2 rounded border transition ${mode === "wallpaper" ? "bg-slate-900 text-violet-300 border-slate-900" : "bg-stone-50 border-stone-300 text-slate-500"}`}>
                      배경화면 (여백 40-60%)
                    </button>
                  </div>
                </div>
                <button onClick={draftSlots}
                  disabled={!topic.trim() || phase === "drafting" || phase === "generating"}
                  className="w-full bg-violet-500 hover:bg-violet-400 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                  {phase === "drafting" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {phase === "drafting" ? "Fable 초안 작성 중…" : slots.length > 0 ? "초안 다시 만들기" : "Fable 초안 기획"}
                </button>
              </section>

              {/* 실행 로그 */}
              <section className="bg-slate-900 rounded-lg p-4">
                <div className="text-xs font-mono text-slate-400 uppercase mb-2 flex justify-between">
                  <span>실행 로그</span>
                  <span className={phase === "drafting" || phase === "generating" ? "text-violet-400" : "text-slate-600"}>
                    {phase === "idle" ? "대기" : phase === "review" ? "멈춤 1 · 검토" : phase === "qc" ? "멈춤 2 · QC" : phase === "done" ? "완료" : "가동 중"}
                  </span>
                </div>
                <div className="h-48 overflow-y-auto font-mono text-xs space-y-1">
                  {log.length === 0
                    ? <div className="text-slate-600 italic">로그 없음</div>
                    : log.map((l, i) => (
                        <div key={i} className={l.includes("[오류]") || l.includes("[실패") ? "text-red-400" : l.includes("[성공") || l.includes("완료") ? "text-emerald-400" : l.includes("[멈춤") ? "text-violet-300" : "text-slate-400"}>{l}</div>
                      ))}
                </div>
              </section>
            </aside>

            {/* 메인 워크스페이스 */}
            <main className="xl:col-span-3 space-y-4">

              {/* 진행 바 */}
              {prog && (
                <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between text-xs font-mono text-slate-500 mb-1.5">
                    <span>{prog.stage}</span><span>{prog.done} / {prog.total}</span>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-violet-500 h-full transition-all" style={{ width: `${(prog.done / prog.total) * 100}%` }} />
                  </div>
                  <button onClick={() => { cancelRef.current = true; }}
                    className="mt-2 text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1">
                    <Square className="w-3 h-3" /> 중지 요청
                  </button>
                </div>
              )}

              {slots.length === 0 && phase === "idle" ? (
                <section className="bg-white border border-dashed border-stone-300 rounded-lg p-16 text-center">
                  <Layers className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                  <h2 className="text-sm font-bold text-slate-700">주제를 넣고 Fable 초안 기획을 시작하세요</h2>
                  <p className="text-xs text-slate-400 mt-1">멈춤은 두 곳입니다: ① 초안 승인 ② 최종 QC. 그 사이는 자동으로 흐릅니다.</p>
                </section>
              ) : (
                <>
                  {/* 멈춤 1 — 초안 검토/승인 바 */}
                  {phase === "review" && (
                    <section className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-violet-800 flex items-center gap-1.5">
                          <ClipboardCheck className="w-4 h-4" /> 멈춤 1 · 초안 검토
                        </h3>
                        <p className="text-xs text-violet-600 mt-0.5">
                          {slots.length}행 · 모드 {mode === "wallpaper" ? "배경화면(여백 40-60%)" : "상업 사진"} · 엔진 {provider === "openai" ? `GPT ${quality}` : "Gemini"} · 종횡비 {aspect}
                          {successCount > 0 && ` · 유효 ${successCount}장 유지, 미완료만 생성`}
                        </p>
                        {provider === "openai" && (
                          <p className="text-xs text-violet-500 mt-0.5 flex items-center gap-1">
                            <CircleDollarSign className="w-3.5 h-3.5" /> 예상 약 ${estCost()} ({quality} 기준 근사치 — 실제 청구액은 다를 수 있음)
                          </p>
                        )}
                      </div>
                      <button onClick={runGeneration} disabled={!apiKey.trim()}
                        className="bg-violet-600 hover:bg-violet-500 disabled:bg-stone-300 text-white font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                        <Play className="w-4 h-4" /> 승인 · 순차 생성 시작
                      </button>
                    </section>
                  )}

                  {/* 멈춤 2 — QC 콘택트시트 바 */}
                  {phase === "qc" && (
                    <section className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1 min-w-64">
                        <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4" /> 멈춤 2 · 콘택트시트 QC
                        </h3>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                          <b>Fable 자동 검수</b>를 누르면 텍스트·로고·왜곡·문화 오류·주제 이탈·구도 위반을 슬롯별로 검사해 자동 플래그합니다.
                          플래그는 표시일 뿐이니 카드 클릭으로 해제/추가하며 최종 판단하세요. 거절 없이 승인하면 제출 팩이 바로 저장됩니다.
                        </p>
                        <input value={qcReason} onChange={(e) => setQcReason(e.target.value)}
                          placeholder="거절 사유 (예: off-topic, 텍스트 포함, 왜곡)"
                          className="mt-2 w-full text-xs px-2.5 py-1.5 bg-white border border-amber-300 rounded focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={runAutoQC} disabled={autoQcBusy}
                          className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-violet-300 font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                          {autoQcBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                          {autoQcBusy
                            ? `자동 검수 중 ${autoQcProg ? `${autoQcProg.done + 1}/${autoQcProg.total}` : ""}`
                            : "Fable 자동 검수"}
                        </button>
                        <button onClick={submitQC} disabled={autoQcBusy}
                          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
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
                    <section className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> 제작 완료 — 요청 {count}장 / 유효 {successCount}장 {successCount === count ? "정확 일치" : "(불일치 확인 필요)"}
                        </h3>
                        <p className="text-xs text-emerald-600 mt-0.5">제출 팩이 저장되었습니다. 필요 시 다시 내려받을 수 있어요.</p>
                      </div>
                      <button onClick={exportSubmitPack}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 px-5 rounded flex items-center gap-2 transition">
                        <Download className="w-4 h-4" /> 제출 팩 다시 저장
                      </button>
                    </section>
                  )}

                  {/* 슬롯 그리드 (초안 테이블 겸 콘택트시트) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {slots.map((s) => {
                      const rejected = !!qcRejects[s.index];
                      return (
                        <div key={s.index}
                          className={`bg-white border rounded-lg shadow-sm overflow-hidden transition ${
                            rejected ? "border-red-400 ring-2 ring-red-200" : "border-stone-200"}`}>
                          {/* 이미지 / 상태 */}
                          <button
                            onClick={() => {
                              if (phase === "qc" && s.status === "success") setQcRejects((p) => ({ ...p, [s.index]: !p[s.index] }));
                              else if (s.dataUrl) setPreviewSlot(s);
                            }}
                            className="w-full bg-stone-100 relative flex items-center justify-center" style={{ height: "140px" }}>
                            {s.dataUrl ? (
                              <>
                                <img src={s.dataUrl} alt={s.title} className="w-full h-full object-cover" />
                                {rejected && (
                                  <div className="absolute inset-0 bg-red-500 bg-opacity-40 flex flex-col items-center justify-center text-white text-xs font-bold">
                                    <Ban className="w-6 h-6 mb-1" /> 거절 표시됨
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-xs font-mono text-slate-400">
                                {s.status === "generating" ? "생성 중…" : s.status === "rejected" ? `격리: ${s.rejectReason}` : s.status === "failed" ? "실패" : "대기 버퍼"}
                              </span>
                            )}
                            <span className="absolute top-1.5 left-1.5 text-xs font-mono font-bold bg-slate-900 text-violet-300 px-1.5 py-0.5 rounded">{s.index}</span>
                          </button>
                          {/* 정보 */}
                          <div className="p-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-slate-900 truncate flex-1" title={s.title}>{s.title}</h4>
                              {statusChip(s)}
                            </div>
                            {s.title_kr && <p className="text-xs text-sky-700 truncate">{s.title_kr}</p>}
                            <p className="text-xs text-slate-400 font-mono truncate" title={`Adobe cat ${s.category} · 키워드 ${normKeywords(s.keywords, ADOBE_MAX_KEYWORDS).split(", ").filter(Boolean).length}개`}>{s.kind} · {s.focal_placement} · {ADOBE_CATEGORIES[s.category] || `cat ${s.category}`}{s.keywords ? ` · kw ${normKeywords(s.keywords, ADOBE_MAX_KEYWORDS).split(", ").filter(Boolean).length}` : ""}{s.regenCount > 1 ? ` · 재생성 ${s.regenCount - 1}회` : ""}</p>
                            {s.autoFlag && (phase === "qc" || phase === "review") && (
                              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 leading-relaxed">
                                자동 검수: {s.autoFlag}
                              </p>
                            )}

                            {/* 초안 단계 편집 */}
                            {phase === "review" && (
                              <div className="pt-1.5 border-t border-stone-100 space-y-1.5">
                                <textarea value={s.subject} rows={2}
                                  onChange={(e) => updateSlot(s.index, "subject", e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 bg-stone-50 border border-stone-200 rounded focus:outline-none focus:border-violet-400 resize-none"
                                  placeholder="피사체/장면" />
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input value={s.camera} onChange={(e) => updateSlot(s.index, "camera", e.target.value)}
                                    className="text-xs px-2 py-1 bg-stone-50 border border-stone-200 rounded focus:outline-none" placeholder="camera" />
                                  <input value={s.palette} onChange={(e) => updateSlot(s.index, "palette", e.target.value)}
                                    className="text-xs px-2 py-1 bg-stone-50 border border-stone-200 rounded focus:outline-none" placeholder="palette" />
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
            <section className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm space-y-3 xl:col-span-1">
              <h2 className="text-sm font-bold text-slate-900">자유 프롬프트</h2>
              <textarea value={freePrompt} onChange={(e) => setFreePrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleFreeGen(); }}
                rows={8} placeholder="파이프라인 없이 한 장만 빠르게 뽑을 때 사용하세요. 노텍스트 가드는 자동 부착됩니다."
                className="w-full text-sm px-3 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none focus:border-violet-500 resize-none" />
              <button onClick={() => handleFreeGen()} disabled={isGen || !freePrompt.trim()}
                className="w-full bg-violet-500 hover:bg-violet-400 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                {isGen ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGen ? "생성 중…" : "이미지 생성 (Ctrl+Enter)"}
              </button>
            </section>
            <section className="xl:col-span-2">
              {selectedFreeItem ? (
                <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm">
                  <div className="bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: "300px" }}>
                    <img src={selectedFreeItem.dataUrl} alt="생성 이미지" className="max-w-full max-h-96 object-contain" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    <button onClick={() => {
                        const a = document.createElement("a");
                        a.href = selectedFreeItem.dataUrl; a.download = `freejjang-${selectedFreeItem.id.slice(-5)}.png`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }}
                      className="bg-slate-900 text-white font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> 다운로드</button>
                    <button onClick={() => { navigator.clipboard.writeText(selectedFreeItem.prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      className="bg-stone-200 hover:bg-stone-300 text-slate-800 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} 프롬프트 복사</button>
                    <button onClick={() => { setFreeGallery((p) => p.filter((g) => g.id !== selectedFreeItem.id)); setSelectedFree(null); }}
                      className="bg-red-50 text-red-600 border border-red-200 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> 삭제</button>
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
                <div className="bg-white border border-dashed border-stone-300 rounded-lg p-16 text-center">
                  <ImageIcon className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                  <p className="text-xs text-slate-400">생성된 이미지가 여기에 표시됩니다</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ═══════════ 이미지 분석 탭 ═══════════ */}
        {tab === "analysis" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <section className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm space-y-3 xl:col-span-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="text-xs font-mono bg-violet-100 text-violet-700 border border-violet-300 rounded px-1.5 py-0.5">01</span> 이미지 넣기
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">참고 이미지를 넣으면 Fable이 13개 블록으로 분해하고 생성용 영어 프롬프트로 바꿉니다. (PNG · JPG · WebP)</p>
              </div>
              <input ref={anaFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleAnaFile(e.target.files[0]); e.target.value = ""; }} />
              <button onClick={() => anaFileRef.current?.click()}
                className="w-full border-2 border-dashed border-stone-300 hover:border-violet-400 hover:bg-violet-50 rounded-lg p-4 transition">
                {anaImage
                  ? <img src={anaImage.dataUrl} alt="분석 대상" className="max-h-56 mx-auto rounded" />
                  : <div className="text-center text-slate-400 text-xs py-8"><ImageIcon className="w-8 h-8 mx-auto mb-2 text-stone-300" />이미지 선택</div>}
              </button>
              <input value={anaExtra} onChange={(e) => setAnaExtra(e.target.value)}
                placeholder="추가 지시 (예: 구도와 여백만 분석해줘)"
                className="w-full text-xs px-2.5 py-2 bg-stone-50 border border-stone-300 rounded focus:outline-none focus:border-violet-500" />
              <button onClick={runAnalysis} disabled={!anaImage || anaBusy}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-stone-200 disabled:text-stone-400 text-violet-300 font-bold text-sm py-2.5 rounded flex items-center justify-center gap-2 transition">
                {anaBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                {anaBusy ? "13블록 분석 중…" : "Fable로 분석"}
              </button>
            </section>

            <section className="xl:col-span-2">
              {anaResult ? (
                <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="text-xs font-mono bg-violet-100 text-violet-700 border border-violet-300 rounded px-1.5 py-0.5">02</span> 분석 결과
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">13개 블록 완료</span>
                  </div>
                  <p className="text-sm text-slate-700 bg-stone-50 border border-stone-200 rounded p-3 leading-relaxed">{anaResult.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(anaResult.blocks || []).map((b, i) => (
                      <div key={i} className="bg-stone-50 border border-stone-200 rounded p-3">
                        <div className="text-xs font-bold text-violet-700 mb-0.5">{b.name}</div>
                        <div className="text-xs text-slate-600 leading-relaxed">{b.content}</div>
                      </div>
                    ))}
                  </div>
                  <textarea value={anaResult.prompt} rows={4} readOnly
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-900 text-violet-300 rounded resize-none" />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(anaResult.prompt); setNotice("프롬프트를 복사했습니다."); }}
                      className="bg-stone-200 hover:bg-stone-300 text-slate-800 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> 프롬프트 복사</button>
                    <button onClick={() => { setFreePrompt(anaResult.prompt); setTab("basic"); }}
                      className="bg-slate-900 hover:bg-slate-800 text-violet-300 font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5">
                      <CornerDownLeft className="w-3.5 h-3.5" /> 작성창에 넣기</button>
                    <button onClick={() => { setFreePrompt(anaResult.prompt); setTab("basic"); handleFreeGen(anaResult.prompt); }}
                      className="bg-violet-500 hover:bg-violet-400 text-white font-bold text-xs py-2 px-3 rounded flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> 분석 결과로 생성</button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-dashed border-stone-300 rounded-lg p-16 text-center">
                  <ScanSearch className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                  <p className="text-xs text-slate-400">분석 결과가 여기에 표시됩니다</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* 이미지 확대 프리뷰 */}
      {previewSlot && (
        <div onClick={() => setPreviewSlot(null)}
          className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-6 cursor-zoom-out">
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={previewSlot.dataUrl} alt={previewSlot.title} className="w-full rounded-lg" />
            <div className="text-center mt-2">
              <p className="text-sm font-bold text-white">{previewSlot.index} · {previewSlot.title_kr || previewSlot.title}</p>
              <button onClick={() => setPreviewSlot(null)} className="mt-2 text-xs text-white bg-slate-700 px-3 py-1.5 rounded">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {notice && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 max-w-md z-50">
          <AlertTriangle className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="leading-relaxed">{notice}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
