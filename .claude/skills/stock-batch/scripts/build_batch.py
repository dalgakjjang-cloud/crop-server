#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""배치 스펙 JSON 하나 → 프롬프트 4종 + SEO 메타데이터 CSV + signals 행.

사람이 하는 창작(주제·색·앵글 정하기)은 스펙 JSON에 담고,
거기서 파생되는 기계적 변환(엔진별 문법, 키워드 티어 병합, 라벨 1:1 맞추기)은 전부 여기서 한다.

사용법:
    python3 build_batch.py <spec.json>              # 전부 생성
    python3 build_batch.py <spec.json> --dry-run    # 미리보기(파일 안 씀)
    python3 build_batch.py <spec.json> --only prompts,metadata,signals

스펙 형식은 references/spec-format.md 참고.
"""
import argparse
import csv
import io
import json
import os
import sys

# ---------------------------------------------------------------- 저장소 경로
HERE = os.path.dirname(os.path.abspath(__file__))


def find_repo_root(start):
    """freejjang-stock-studio/ 가 보이는 조상 디렉터리를 저장소 루트로 본다."""
    d = start
    for _ in range(8):
        if os.path.isdir(os.path.join(d, "freejjang-stock-studio")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    raise SystemExit("저장소 루트를 찾지 못했습니다 (freejjang-stock-studio/ 없음).")


ROOT = find_repo_root(HERE)
STUDIO = os.path.join(ROOT, "freejjang-stock-studio")
PROMPTS_DIR = os.path.join(STUDIO, "prompts")
METADATA_DIR = os.path.join(STUDIO, "seo", "metadata")
SIGNALS_CSV = os.path.join(ROOT, "signals", "signals.csv")

# 프롬프트 폴더는 목적 플랫폼별로 나뉘어 있다 — 어도비에 낼 것 / 미캔에만 낼 것 /
# 배치 안에서 컷마다 목적지가 섞이는 것. 배치 스펙에 명시하지 않으면 platform 값에서
# 추정하고, 어느 쪽인지 애매하면 공통/ 으로 안전하게 떨어뜨린다.
PROMPT_DEST = {"adobe": "adobe", "miri": "miri", "공통": "공통", "common": "공통"}


def prompt_subdir(spec):
    """스펙의 prompt_dest 를 최우선으로 보고, 없으면 platform 값으로 추정한다."""
    dest = spec.get("prompt_dest")
    if dest:
        return PROMPT_DEST.get(dest, dest)
    platform = (spec.get("platform") or "").strip()
    if platform == "미캔전용":
        return "miri"
    if platform == "어도비+미캔":
        return "adobe"
    return "공통"

# ------------------------------------------------------- 우리 시그니처 기본값
# 배치가 달라도 잘 안 변하는 값들. 스펙에서 덮어쓸 수 있다.
DEFAULTS = {
    "mj_flags": "--raw --s 200 --v 8.2",
    "mj_negative": (
        "text, letters, words, numbers, logo, watermark, brand, signature, "
        "shallow depth of field, soft focus, motion blur, dark, moody"
    ),
    "genspark_negative": "No text, logo, watermark, or blur — sharp throughout.",
    "sharp_mj": "tack-sharp front-to-back, deep depth of field, everything in focus",
    "sharp_gpt": "tack-sharp with everything in focus",
    "sharp_genspark": "everything sharp and in focus",
    "surface_tail": "plain unlettered unbranded surface, one continuous scene",
    "keywords_en_cap": 28,
    "keywords_ko_cap": 24,
    "asset_type": "photo",
    "category": "9. Graphic Resources",
    "platform": "어도비+미캔",
}

METADATA_COLUMNS = [
    "filename", "asset_type", "title_en", "title_ko",
    "keywords_en", "keywords_ko", "category", "batch",
    "axis_subject", "axis_color",
]

SIGNALS_COLUMNS = [
    "배치", "컷라벨", "형태", "주제축", "색축", "플랫폼", "제출일",
    "어도비승인", "어도비거절사유", "미캔승인",
    "DL30_어도비", "DL90_어도비", "DL30_미캔", "DL90_미캔", "비고",
]

SHAPE_TYPES = {"배경형", "제품형", "인물형", "설명형"}


def opt(spec, key):
    """스펙 값 > 기본값 순으로 고른다."""
    return spec.get(key, DEFAULTS.get(key))


# ------------------------------------------------------------------ 팔레트
def render_palette(cut, style):
    """팔레트 절을 엔진 문법에 맞게 만든다.

    MJ/GenSpark 는 `palette soft pink hex FFC1D8 and warm cream hex FFF5EA`,
    GPT 는 `palette: soft pink #FFC1D8 and warm cream #FFF5EA` 형태를 쓴다.
    색 이름과 HEX를 스펙에 따로 담아두면 두 표기를 자동으로 맞출 수 있다.
    """
    items = cut.get("palette", [])
    if not items:
        return ""
    if style == "gpt":
        parts = ["%s #%s" % (p["name"], p["hex"].upper()) for p in items]
        head = "palette: "
    else:
        parts = ["%s hex %s" % (p["name"], p["hex"].upper()) for p in items]
        head = "palette "
    text = head + " and ".join(parts)
    tail = cut.get("palette_tail")
    if tail:
        text += " " + tail
    return text


def camera_for_gpt(camera):
    """GPT 파일은 카메라 표기가 짧다: `45-degree hero shot` → `45° hero`."""
    c = camera.replace("45-degree", "45°")
    if c.endswith(" shot"):
        c = c[: -len(" shot")]
    return c


def clauses(cut, spec, style):
    """한 컷의 프롬프트를 절 단위로 조립한다. 순서가 곧 우리 프롬프트 문법이다."""
    out = [cut["subject"]]
    if cut.get("detail"):
        out.append(cut["detail"])

    if style == "gpt":
        out.append("camera: " + camera_for_gpt(cut["camera"]))
        out.append("lighting: " + cut["lighting"])
    else:
        out.append(cut["camera"])
        out.append(cut["lighting"])

    palette = render_palette(cut, style)
    if palette:
        out.append(palette)

    if cut.get("copy_space"):
        out.append(cut["copy_space"])

    out.append(opt(spec, "sharp_gpt") if style == "gpt"
               else opt(spec, "sharp_mj") if style == "mj"
               else opt(spec, "sharp_genspark"))

    out.append(opt(spec, "surface_tail"))
    out.append(cut["style"] + " styling")
    return ", ".join(x for x in out if x)


def render_cut(cut, spec, style):
    """엔진별 최종 한 줄. 세 엔진의 차이는 전부 여기서 흡수된다."""
    body = clauses(cut, spec, style)
    if style == "mj":
        return "%s %s --no %s" % (body, opt(spec, "mj_flags"), opt(spec, "mj_negative"))
    if style == "gpt":
        return body
    # genspark: 문장을 대문자로 시작하고 네거티브를 자연어로 붙인다
    body = body[0].upper() + body[1:] if body else body
    return "%s. %s" % (body, opt(spec, "genspark_negative"))


# ------------------------------------------------------------- 프롬프트 파일
def divider(title):
    return "# %s\n# %s\n# %s" % ("═" * 42, title, "═" * 42)


def section_of(cut, spec):
    """컷이 속한 섹션 제목. 섹션은 grp(그룹 코드)로 묶인다."""
    for sec in spec.get("sections", []):
        if cut["grp"] in sec["groups"]:
            return sec["title"]
    return None


def build_prompt_file(spec, style, header_lines):
    """헤더 → 섹션 구분선 → 컷 순서로 프롬프트 파일 본문을 만든다."""
    lines = list(header_lines) + [""]
    current = None
    for cut in spec["cuts"]:
        sec = section_of(cut, spec)
        if sec and sec != current:
            lines.append(divider(sec))
            lines.append("")
            current = sec
        label = "%s-%02d" % (spec["prefix"], cut["n"])
        text = render_cut(cut, spec, style)
        if style == "gpt":
            lines.append("--- %02d %s ---" % (cut["n"], cut["label_ko"]))
            lines.append(text)
        else:
            lines.append("%s) %s" % (label, text))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def build_clean_file(spec):
    """clean 파일은 헤더·구분선·라벨·빈 줄을 모두 걷어낸 순수 1줄/컷."""
    return "\n".join(render_cut(c, spec, "genspark") for c in spec["cuts"]) + "\n"


def headers(spec):
    """엔진별 헤더 주석. 스펙의 header_note 를 첫 줄 설명으로 쓴다."""
    note = spec.get("header_note", spec["batch"])
    rule = "# " + "─" * 57
    mj = [
        "# %s (MJ용)" % note,
        "# %s (전 컷 공통)" % opt(spec, "mj_flags"),
        "# 한글 텍스트는 렌더하지 않음 — 여백 확보만, 사용자가 미캔에서 자기 문구 얹기",
        "# HEX 팔레트 명시 → 색감 정확도 향상",
    ]
    gpt = [
        "# %s (GPT용)" % note,
        rule,
        "# 미캔 시그니처 유지: 밝은 톤 + 넉넉한 텍스트 여백 + 배경까지 선명",
        "# 사용자가 자기 한글 문구를 얹기 좋게 → 중앙 또는 여백 텍스트 자리 확보",
        "# HEX 팔레트 명시 → 색감 정확도 향상",
        rule,
    ]
    gs = [
        "# %s — GenSpark(젠스파크) 자동배치용" % note,
        rule,
        "# 사용법: GenSpark AI Image Generator / Super Agent 배치 입력창에 붙여넣기",
        "#   · MJ 파라미터(--raw / --v / --no) 전부 제거, 자연어만 사용",
        '#   · 네거티브는 문장 끝 자연어 ("%s")' % opt(spec, "genspark_negative"),
        "#   · 비율: 미캔 카드형 4:5 또는 정사각 1:1 권장",
        "#   · 모델 추천: Flux / GPT-image 계열",
        "#   · 한 줄(라벨 블록) = 한 장. 라벨 %s-NN 은 GPT/MJ 버전과 1:1 매칭" % spec["prefix"],
        "# HEX 팔레트 명시 → 색감 정확도 향상",
        rule,
    ]
    return {"MJ": mj, "GPT": gpt, "GenSpark": gs}


def write_prompts(spec, dry_run):
    hs = headers(spec)
    base = "miricanvas_%s_%d" % (spec["slug"], len(spec["cuts"]))
    files = {
        base + "_MJ.txt": build_prompt_file(spec, "mj", hs["MJ"]),
        base + "_GPT.txt": build_prompt_file(spec, "gpt", hs["GPT"]),
        base + "_GenSpark.txt": build_prompt_file(spec, "genspark", hs["GenSpark"]),
        base + "_GenSpark_clean.txt": build_clean_file(spec),
    }
    subdir = prompt_subdir(spec)
    dest_dir = os.path.join(PROMPTS_DIR, subdir)
    if not dry_run:
        os.makedirs(dest_dir, exist_ok=True)
    written = []
    for name, body in files.items():
        path = os.path.join(dest_dir, name)
        if os.path.exists(path):
            raise SystemExit(
                "이미 있는 프롬프트 파일입니다: %s\n"
                "프롬프트 파일은 덮어쓰지 않는 것이 이 저장소 규칙입니다. "
                "새 배치라면 slug 또는 컷 수를 바꾸세요." % path
            )
        if not dry_run:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(body)
        written.append(path)
    return written


# ------------------------------------------------------------ 메타데이터 CSV
def merge(*lists, **kw):
    """순서를 보존하며 소문자 기준으로 중복을 제거해 합친다.

    합치는 순서가 곧 keyword-governance.md 의 3티어 모델이다:
    앞에 넣은 리스트일수록 어도비 검색 가중치가 큰 자리를 차지한다.
    """
    cap = kw.get("cap")
    seen, out = set(), []
    for lst in lists:
        for item in lst or []:
            key = item.lower().strip()
            if key and key not in seen:
                seen.add(key)
                out.append(item.strip())
    return out[:cap] if cap else out


def metadata_rows(spec):
    pools = spec.get("pools", {})
    ext = "mp4" if opt(spec, "asset_type") == "video" else "png"
    rows = []
    for cut in spec["cuts"]:
        grp = cut["grp"]
        kw_en = merge(
            cut.get("core_en"), cut.get("color_en"),
            pools.get("usecase_en"), pools.get("group_en", {}).get(grp),
            pools.get("universal_en"),
            cap=opt(spec, "keywords_en_cap"),
        )
        kw_ko = merge(
            cut.get("core_ko"), cut.get("color_ko"),
            pools.get("usecase_ko"), pools.get("group_ko", {}).get(grp),
            pools.get("universal_ko"),
            cap=opt(spec, "keywords_ko_cap"),
        )
        rows.append({
            "filename": "%s-%02d.%s" % (spec["prefix"], cut["n"], ext),
            "asset_type": opt(spec, "asset_type"),
            "title_en": cut["title_en"],
            "title_ko": cut["title_ko"],
            "keywords_en": ", ".join(kw_en),
            "keywords_ko": ", ".join(kw_ko),
            "category": cut.get("category", opt(spec, "category")),
            "batch": spec["batch"],
            "axis_subject": cut["axis_subject"],
            "axis_color": cut.get("axis_color", ""),
        })
    return rows


def write_metadata(spec, rows, dry_run):
    path = os.path.join(METADATA_DIR, spec["batch"] + ".csv")
    if not dry_run:
        os.makedirs(METADATA_DIR, exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=METADATA_COLUMNS)
            w.writeheader()
            w.writerows(rows)
    return path


# --------------------------------------------------------------- signals 행
def signals_rows(spec):
    """컷당 한 행. 성과 칸(제출일 이후)은 비워두고 나중에 사람이 채운다."""
    batch_id = spec.get("signals_batch", spec["batch"].replace("_", "-"))
    rows = []
    for cut in spec["cuts"]:
        row = {c: "" for c in SIGNALS_COLUMNS}
        row["배치"] = batch_id
        row["컷라벨"] = "%s-%02d" % (spec["prefix"], cut["n"])
        row["형태"] = cut["shape"]
        row["주제축"] = cut["axis_subject"]
        row["색축"] = cut.get("axis_color", "")
        row["플랫폼"] = cut.get("platform", opt(spec, "platform"))
        rows.append(row)
    return rows


def append_signals(rows, dry_run):
    """기존 signals.csv 에 이어붙인다. 헤더와 BOM은 건드리지 않는다."""
    if dry_run:
        return SIGNALS_CSV
    if not os.path.exists(SIGNALS_CSV):
        raise SystemExit("signals.csv 가 없습니다: %s" % SIGNALS_CSV)
    with open(SIGNALS_CSV, "r", encoding="utf-8-sig", newline="") as f:
        existing = f.read()
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=SIGNALS_COLUMNS, lineterminator="\n")
    w.writerows(rows)
    sep = "" if existing.endswith("\n") else "\n"
    with open(SIGNALS_CSV, "a", encoding="utf-8", newline="") as f:
        f.write(sep + buf.getvalue())
    return SIGNALS_CSV


# ------------------------------------------------------------------- 검증
REQUIRED_CUT_FIELDS = [
    "n", "grp", "shape", "axis_subject",
    "title_en", "title_ko", "label_ko",
    "subject", "camera", "lighting", "style",
]


def validate(spec):
    """생성 전에 스펙을 검사한다. 여기서 걸러야 seo-check 까지 안 가고 끝난다."""
    errors = []
    for key in ("batch", "slug", "prefix", "cuts"):
        if not spec.get(key):
            errors.append("스펙에 '%s' 가 없습니다." % key)
    if errors:
        return errors

    seen_n = set()
    for i, cut in enumerate(spec["cuts"]):
        where = "컷 %s" % cut.get("n", "#%d" % (i + 1))
        for field in REQUIRED_CUT_FIELDS:
            if not cut.get(field):
                errors.append("%s: '%s' 가 비어 있습니다." % (where, field))
        if cut.get("shape") and cut["shape"] not in SHAPE_TYPES:
            errors.append("%s: 형태는 %s 중 하나여야 합니다 (지금: %s)."
                          % (where, "/".join(sorted(SHAPE_TYPES)), cut["shape"]))
        n = cut.get("n")
        if n in seen_n:
            errors.append("%s: 컷 번호가 중복입니다." % where)
        seen_n.add(n)

        # 어도비 하한을 스펙 단계에서 미리 잡는다 — 나중에 seo-check 에서
        # 또 걸리면 프롬프트까지 다시 만들어야 해서 비싸다.
        pools = spec.get("pools", {})
        kw_en = merge(cut.get("core_en"), cut.get("color_en"),
                      pools.get("usecase_en"),
                      pools.get("group_en", {}).get(cut.get("grp")),
                      pools.get("universal_en"))
        if len(kw_en) < 25:
            errors.append("%s: 영문 키워드가 %d개뿐입니다 (어도비 최소 25). "
                          "core_en/color_en 을 늘리거나 pools 를 보강하세요."
                          % (where, len(kw_en)))
        kw_ko = merge(cut.get("core_ko"), cut.get("color_ko"),
                      pools.get("usecase_ko"),
                      pools.get("group_ko", {}).get(cut.get("grp")),
                      pools.get("universal_ko"))
        if len(kw_ko) < 15:
            errors.append("%s: 한글 키워드가 %d개뿐입니다 (최소 15)." % (where, len(kw_ko)))

    count = len(spec["cuts"])
    expected = spec.get("count")
    if expected and expected != count:
        errors.append("count=%s 인데 실제 컷은 %d개입니다." % (expected, count))
    return errors


# -------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description="배치 스펙 → 프롬프트·메타데이터·signals 생성")
    ap.add_argument("spec", help="배치 스펙 JSON 경로")
    ap.add_argument("--dry-run", action="store_true", help="파일을 쓰지 않고 미리보기")
    ap.add_argument("--only", default="prompts,metadata,signals",
                    help="생성할 산출물 (쉼표 구분)")
    args = ap.parse_args()

    with open(args.spec, "r", encoding="utf-8") as f:
        spec = json.load(f)

    errors = validate(spec)
    if errors:
        print("스펙 검사 실패 — 아래를 고치고 다시 실행하세요:\n")
        for e in errors:
            print("  ✗ " + e)
        sys.exit(1)

    only = {s.strip() for s in args.only.split(",")}
    tag = " (dry-run)" if args.dry_run else ""
    print("배치: %s · %d컷%s\n" % (spec["batch"], len(spec["cuts"]), tag))

    if "prompts" in only:
        for p in write_prompts(spec, args.dry_run):
            print("  프롬프트  %s" % os.path.relpath(p, ROOT))

    rows = metadata_rows(spec)
    if "metadata" in only:
        p = write_metadata(spec, rows, args.dry_run)
        print("  메타데이터 %s (%d행)" % (os.path.relpath(p, ROOT), len(rows)))
        lo_en = min(len(r["keywords_en"].split(", ")) for r in rows)
        lo_ko = min(len(r["keywords_ko"].split(", ")) for r in rows)
        print("             영문 키워드 최소 %d개 · 한글 최소 %d개" % (lo_en, lo_ko))

    if "signals" in only:
        srows = signals_rows(spec)
        p = append_signals(srows, args.dry_run)
        print("  signals   %s (+%d행)" % (os.path.relpath(p, ROOT), len(srows)))

    print("\n다음: python3 freejjang-stock-studio/seo/seo-check.py %s" % spec["batch"])


if __name__ == "__main__":
    main()
