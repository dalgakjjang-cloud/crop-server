#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""어도비 스톡용 이미지 업스케일 — 폴더 안 이미지를 한 번에 키운다.

GPT·미드저니로 뽑은 그림은 보통 100만 화소(1024x1024)라 어도비 최소선(400만 화소)에
못 미친다. 이 도구는 폴더 안 모든 이미지를 고품질(Lanczos)로 키워, 어도비가 받아주는
크기·JPEG 품질로 `upscaled/` 폴더에 새로 저장한다. 원본은 절대 건드리지 않는다.

어도비 스톡 기준(2026):
  · 최소 400만 화소(4MP) 이상  · 최대 1억 화소(100MP)  · JPEG 45MB 이하
  이 도구는 넉넉히 목표 450만 화소로 키우고, 이미 큰 그림은 그대로 둔다.

사용법 (셋 중 아무거나):
  1) 이미지 폴더 안에 이 파일과 '어도비업스케일.bat'을 복사 → bat 더블클릭
  2) PowerShell에서:  python upscale_adobe.py "C:\\경로\\이미지폴더"
  3) 폴더 지정 없이 실행하면 스크립트가 있는 폴더의 이미지를 처리

필요한 것: 파이썬 + Pillow (bat이 자동 설치. 수동은  python -m pip install pillow )
"""
import math
import os
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Pillow(이미지 라이브러리)가 없습니다.")
    print("PowerShell에 이걸 붙여넣어 설치하세요:  python -m pip install pillow")
    sys.exit(1)

# ---- 어도비 기준값 (필요하면 여기만 고친다) ----
TARGET_MP = 4_500_000      # 목표 화소 — 어도비 최소(4MP) + 여유
ADOBE_MIN_MP = 4_000_000   # 어도비 하드 최소
MAX_SIDE = 12000           # 한 변 최대(과확대 방지)
JPEG_QUALITY = 95          # 어도비 권장 고품질
DPI = 300                  # 인쇄용 메타데이터(선택)
EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff")


def target_size(w, h):
    """목표 화소에 맞는 새 크기. 이미 충분히 크면 (w,h) 그대로."""
    mp = w * h
    if mp >= TARGET_MP:
        return w, h, 1.0
    scale = math.sqrt(TARGET_MP / mp)
    nw, nh = round(w * scale), round(h * scale)
    # 한 변 상한 안전장치
    longest = max(nw, nh)
    if longest > MAX_SIDE:
        s2 = MAX_SIDE / longest
        nw, nh = round(nw * s2), round(nh * s2)
    return nw, nh, scale


def flatten_to_rgb(img):
    """투명(PNG/알파)이면 흰 배경에 합성해 JPEG로 저장 가능하게."""
    img = ImageOps.exif_transpose(img)  # 회전 정보 반영
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        return bg
    return img.convert("RGB")


def process_folder(folder):
    if not os.path.isdir(folder):
        print("폴더를 찾을 수 없습니다: %s" % folder)
        return

    files = [f for f in sorted(os.listdir(folder))
             if f.lower().endswith(EXTS) and not f.startswith(".")]
    if not files:
        print("이 폴더에 이미지가 없습니다: %s" % folder)
        print("(지원 형식: JPG, PNG, WEBP, BMP, TIF)")
        return

    out_dir = os.path.join(folder, "upscaled")
    os.makedirs(out_dir, exist_ok=True)

    print("=" * 56)
    print("어도비 업스케일 시작 — 대상 %d장" % len(files))
    print("폴더: %s" % folder)
    print("=" * 56)

    done, skipped, failed = 0, 0, 0
    for i, name in enumerate(files, 1):
        src = os.path.join(folder, name)
        try:
            with Image.open(src) as im:
                w, h = im.size
                nw, nh, scale = target_size(w, h)
                img = flatten_to_rgb(im)
                if (nw, nh) != (w, h):
                    img = img.resize((nw, nh), Image.LANCZOS)

            base = os.path.splitext(name)[0]
            dst = os.path.join(out_dir, base + ".jpg")
            img.save(dst, "JPEG", quality=JPEG_QUALITY,
                     subsampling=0, dpi=(DPI, DPI), optimize=True)

            out_mp = nw * nh
            ok = "OK" if out_mp >= ADOBE_MIN_MP else "⚠작음"
            note = "그대로(이미 충분)" if scale <= 1.0 else ("%.2f배" % scale)
            print("  [%2d/%d] %-28s %d×%d → %d×%d  %.1fMP  %s  %s"
                  % (i, len(files), name[:28], w, h, nw, nh,
                     out_mp / 1_000_000, ok, note))
            done += 1
            if scale <= 1.0:
                skipped += 1
        except Exception as e:
            print("  [%2d/%d] %-28s  실패: %s" % (i, len(files), name[:28], e))
            failed += 1

    print("=" * 56)
    print("완료: %d장 저장 · %d장은 이미 충분 · %d장 실패"
          % (done, skipped, failed))
    print("결과 폴더: %s" % out_dir)
    print("→ 이 upscaled 폴더의 JPG를 어도비에 올리면 됩니다. (원본은 그대로)")


def main():
    if len(sys.argv) > 1:
        folder = sys.argv[1]
    else:
        folder = os.path.dirname(os.path.abspath(__file__))
        print("(폴더를 지정하지 않아 스크립트가 있는 폴더를 처리합니다)")
    process_folder(folder)


if __name__ == "__main__":
    main()
