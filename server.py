"""
AI 크롭 서버 - Python Flask
Clipdrop API로 배경 제거 후 Python PIL로 크롭 처리
"""
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image
import numpy as np
import requests
import io
import os
import zipfile
import tempfile
import math

app = Flask(__name__)
CORS(app)

MIN_PX = 2500
MAX_PX = 9800
MAX_FILE_BYTES = 50 * 1024 * 1024  # 50MB


def remove_background_ai(image_bytes, filename, api_key):
    """Clipdrop API로 배경 제거"""
    files = {'image_file': (filename, io.BytesIO(image_bytes), 'image/png')}
    headers = {'x-api-key': api_key}
    resp = requests.post(
        'https://clipdrop-api.co/remove-background/v1',
        headers=headers,
        files=files,
        timeout=30
    )
    remaining = resp.headers.get('x-remaining-credits')
    if resp.status_code == 402:
        raise ValueError('크레딧이 부족합니다. clipdrop.co에서 충전해주세요.')
    if resp.status_code in (401, 403):
        raise ValueError(f'API 키가 올바르지 않습니다. (status: {resp.status_code})')
    if resp.status_code == 400:
        raise ValueError(f'잘못된 요청: {resp.text[:200]}')
    if not resp.ok:
        raise ValueError(f'API 오류 {resp.status_code}: {resp.text[:200]}')
    return resp.content, remaining


def crop_by_alpha(img_rgba):
    """RGBA 이미지에서 알파채널 기반 크롭 영역 계산 및 크롭"""
    data = np.array(img_rgba)
    alpha = data[:, :, 3]
    mask = alpha > 10
    if not np.any(mask):
        return img_rgba  # 크롭 영역 없으면 원본 반환
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    y0, y1 = np.where(rows)[0][[0, -1]]
    x0, x1 = np.where(cols)[0][[0, -1]]
    cropped = img_rgba.crop((x0, y0, x1 + 1, y1 + 1))
    return cropped


def auto_fit_size(img):
    """짧은 변 2500px ~ 긴 변 9800px 범위로 자동 크기 조정"""
    w, h = img.size
    min_side = min(w, h)
    max_side = max(w, h)
    scale = 1.0
    if min_side < MIN_PX:
        scale = MIN_PX / min_side
    elif max_side > MAX_PX:
        scale = MAX_PX / max_side
    if abs(scale - 1.0) < 0.001:
        return img
    new_w = round(w * scale)
    new_h = round(h * scale)
    return img.resize((new_w, new_h), Image.LANCZOS)


def upscale_300dpi(img):
    """72dpi → 300dpi 업스케일 (×4.167)"""
    sc = 300 / 72
    new_w = round(img.width * sc)
    new_h = round(img.height * sc)
    return img.resize((new_w, new_h), Image.LANCZOS)


def ensure_size_limit(img_bytes):
    """50MB 이하 보장"""
    if len(img_bytes) <= MAX_FILE_BYTES:
        return img_bytes
    # 크기 초과 시 스케일 다운
    img = Image.open(io.BytesIO(img_bytes))
    scale = math.sqrt(MAX_FILE_BYTES / len(img_bytes)) * 0.95
    new_w = round(img.width * scale)
    new_h = round(img.height * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


@app.route('/process', methods=['POST'])
def process():
    """이미지 처리 엔드포인트"""
    api_key = request.form.get('api_key', '').strip()
    mode = request.form.get('mode', 'ai')  # ai, png, white
    use_dpi = request.form.get('dpi', 'false').lower() == 'true'
    use_autofit = request.form.get('autofit', 'true').lower() == 'true'
    threshold = int(request.form.get('threshold', '30'))
    files = request.files.getlist('images')

    if not files:
        return jsonify({'error': '파일이 없습니다'}), 400

    results = []
    remaining_credits = None

    for f in files:
        fname = f.filename
        try:
            img_bytes = f.read()

            if mode == 'ai':
                if not api_key:
                    raise ValueError('API 키를 입력해주세요')
                # Clipdrop API로 배경 제거
                result_bytes, remaining_credits = remove_background_ai(img_bytes, fname, api_key)
                img = Image.open(io.BytesIO(result_bytes)).convert('RGBA')
                # 알파채널 기반 크롭
                img = crop_by_alpha(img)

            elif mode == 'png':
                # 투명배경 PNG 크롭
                img = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
                img = crop_by_alpha(img)

            elif mode == 'white':
                # 흰색배경 제거 후 크롭
                img = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
                data = np.array(img)
                # 흰색 픽셀 (RGB 모두 255-threshold 이상) 투명 처리 (BFS 없이 간단 방식)
                r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
                white_mask = (r >= (255 - threshold)) & (g >= (255 - threshold)) & (b >= (255 - threshold))
                data[:,:,3][white_mask] = 0
                img = Image.fromarray(data, 'RGBA')
                img = crop_by_alpha(img)

            # 300dpi 업스케일
            if use_dpi:
                img = upscale_300dpi(img)

            # 자동 크기 맞춤
            if use_autofit:
                img = auto_fit_size(img)

            # PNG로 저장
            buf = io.BytesIO()
            img.save(buf, format='PNG', optimize=True)
            out_bytes = ensure_size_limit(buf.getvalue())

            results.append({
                'name': 'cropped_' + os.path.splitext(fname)[0] + '.png',
                'data': out_bytes,
                'size': f'{img.width}x{img.height}',
                'file_size': len(out_bytes),
                'status': 'ok'
            })

        except Exception as e:
            results.append({
                'name': fname,
                'data': None,
                'error': str(e),
                'status': 'error'
            })

    # ZIP으로 묶어서 반환
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for r in results:
            if r['status'] == 'ok':
                zf.writestr(r['name'], r['data'])

    zip_buf.seek(0)

    # 결과 요약 헤더
    ok_count = sum(1 for r in results if r['status'] == 'ok')
    fail_count = len(results) - ok_count
    errors = [f"{r['name']}: {r['error']}" for r in results if r['status'] == 'error']
    sizes = [f"{r['name']}: {r['size']} ({r['file_size']//1024}KB)" for r in results if r['status'] == 'ok']

    response = send_file(
        zip_buf,
        mimetype='application/zip',
        as_attachment=True,
        download_name='cropped_results.zip'
    )
    response.headers['X-Ok-Count'] = str(ok_count)
    response.headers['X-Fail-Count'] = str(fail_count)
    response.headers['X-Errors'] = ' | '.join(errors) if errors else ''
    response.headers['X-Sizes'] = ' | '.join(sizes) if sizes else ''
    if remaining_credits:
        response.headers['X-Remaining-Credits'] = remaining_credits
    return response


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
