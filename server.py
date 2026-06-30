import os
import io
import time
import zipfile
import numpy as np
from PIL import Image, ImageFilter
from flask import Flask, request, send_file, jsonify
from collections import deque
from flask_cors import CORS

app = Flask(__name__)
CORS(app, expose_headers=['X-Remaining-Credits', 'X-Sizes'])

# 기본 설정
MAX_FILE_SIZE_MB = 50
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def remove_white_background_bfs(img, threshold=10):
    """
    개선된 BFS(Flood Fill) 배경 제거:
    1. RGB 평균값과 개별 채널을 모두 고려하여 더 정밀하게 배경 판정.
    2. threshold 값을 보정하여 낮은 값(10)에서도 실질적인 배경 제거 효과 제공.
    """
    img_rgba = img.convert('RGBA')
    data = np.array(img_rgba, dtype=np.uint8)
    h, w = data.shape[:2]

    # threshold 보정: 사용자가 입력한 10이 너무 약하지 않도록 매핑
    adjusted_threshold = int(threshold * 1.2) 
    limit = max(0, 255 - adjusted_threshold)

    r, g, b = data[:, :, 0].astype(np.int16), data[:, :, 1].astype(np.int16), data[:, :, 2].astype(np.int16)
    
    # 배경 판정 로직 개선: 평균값과 개별 채널 편차를 모두 고려
    avg_rgb = (r + g + b) / 3
    is_bright = (avg_rgb >= limit) | ((r >= limit-5) & (g >= limit-5) & (b >= limit-5))

    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    # 가장자리 씨앗 추가
    for x in range(w):
        if is_bright[0, x] and not visited[0, x]:
            visited[0, x] = True
            queue.append((0, x))
        if is_bright[h - 1, x] and not visited[h - 1, x]:
            visited[h - 1, x] = True
            queue.append((h - 1, x))
    for y in range(h):
        if is_bright[y, 0] and not visited[y, 0]:
            visited[y, 0] = True
            queue.append((y, 0))
        if is_bright[y, w - 1] and not visited[y, w - 1]:
            visited[y, w - 1] = True
            queue.append((y, w - 1))

    dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        y, x = queue.popleft()
        for dy, dx in dirs:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bright[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    # 배경 투명 처리
    data[visited, 3] = 0
    return Image.fromarray(data, 'RGBA')

def apply_edge_antialiasing(img_rgba, radius=1.5):
    """
    알파 채널에 가우시안 블러를 적용하여 경계선을 부드럽게 처리.
    """
    if img_rgba.mode != 'RGBA':
        img_rgba = img_rgba.convert('RGBA')
    r, g, b, a = img_rgba.split()
    a_blurred = a.filter(ImageFilter.GaussianBlur(radius=radius))
    a_arr = np.array(a)
    a_blurred_arr = np.array(a_blurred)
    a_final_arr = np.where(a_arr == 0, 0, a_blurred_arr)
    a_final = Image.fromarray(a_final_arr.astype(np.uint8))
    return Image.merge('RGBA', (r, g, b, a_final))

def crop_by_alpha(img_rgba):
    bbox = img_rgba.getbbox()
    if not bbox: return img_rgba
    return img_rgba.crop(bbox)

def auto_fit_size(img_rgba, min_px=2500, max_px=9800):
    w, h = img_rgba.size
    short_side = min(w, h)
    if short_side < min_px:
        scale = min_px / short_side
        img_rgba = img_rgba.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    w, h = img_rgba.size
    if max(w, h) > max_px:
        scale = max_px / max(w, h)
        img_rgba = img_rgba.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img_rgba

@app.route('/health', methods=['GET'])
def health(): return jsonify({"status": "ok", "time": time.time()})

@app.route('/process', methods=['POST'])
def process():
    if 'images' not in request.files: return jsonify({"error": "No images provided"}), 400
    files = request.files.getlist('images')
    mode = request.form.get('mode', 'white')
    dpi_mode = request.form.get('dpi', 'false') == 'true'
    autofit = request.form.get('autofit', 'true') == 'true'
    threshold = int(request.form.get('threshold', 10))
    output_zip = io.BytesIO()
    sizes_info = []
    with zipfile.ZipFile(output_zip, 'w') as zf:
        for f in files:
            if not allowed_file(f.filename): continue
            img = Image.open(f.stream)
            if mode == 'white':
                img = remove_white_background_bfs(img, threshold)
                img = apply_edge_antialiasing(img)
            img = crop_by_alpha(img)
            if autofit: img = auto_fit_size(img)
            img_io = io.BytesIO()
            img.save(img_io, format='PNG', dpi=(300, 300) if dpi_mode else None)
            img_io.seek(0)
            zf.writestr(f"cropped_{os.path.splitext(f.filename)[0]}.png", img_io.read())
            sizes_info.append(f"{img.size[0]}x{img.size[1]}")
    output_zip.seek(0)
    resp = send_file(output_zip, mimetype='application/zip', as_attachment=True, download_name='results.zip')
    resp.headers['X-Remaining-Credits'] = 'Unlimited'
    resp.headers['X-Sizes'] = ", ".join(sizes_info)
    return resp

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
