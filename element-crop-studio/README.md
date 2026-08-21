# 미리캔버스 요소 크롭 스튜디오

어떤 이미지든 **배경 제거 → 타이트 크롭 → 규격 리사이즈 → 300 DPI → 업로드 패키지**까지
한 번에 처리하는 **단일 파일 웹앱**입니다. 서버가 필요 없고, 모든 처리가 브라우저 안에서만
일어나므로 이미지는 어디에도 업로드되지 않습니다.

> 저장소 루트의 Python 크롭 서버(`server.py`)를 서버 없이 브라우저에서 돌아가도록 다시 구현한
> 클라이언트 전용 버전입니다. `SKILL.md`의 미리캔버스 요소 파이프라인 규격을 그대로 반영합니다.

## 사용법

`element-crop-studio/index.html` 파일을 브라우저로 열기만 하면 됩니다. (더블클릭 또는 드래그)

로컬 서버로 띄우고 싶다면:

```bash
cd element-crop-studio
npx http-server .      # 또는 python3 -m http.server
```

## 처리 파이프라인

1. **배경 제거** — 가장자리와 연결된 배경색만 flood-fill 로 제거해 오브젝트 내부의 같은 색은 보존
   - `자동` : 가장자리 색을 키로 추정 (기본)
   - `흰 배경` : 흰색/밝은 배경 전용
   - `크로마` : 초록/마젠타 크로마키 (despill 포함)
   - `투명유지` : 이미 투명한 PNG — 크롭·리사이즈만
2. **경계 다듬기** — 알파 최소필터로 크로마 프린지 축소 (0~3px)
3. **타이트 크롭** — 알파 바운딩박스 기준. 필요하면 **수동 크롭** 영역 지정 가능
4. **규격 리사이즈** — 긴 축 4096px(기본), 최대 축 9800px clamp, Lanczos 계열 고품질 스케일
5. **금지색 세척** — 불투명 `#FFFFFF` → `#FAF8F4`, `#353840` → `#363941`
6. **300 DPI PNG** — PNG `pHYs` 청크를 직접 삽입 (메타데이터만 바꾸는 게 아니라 실제 픽셀도 4096px)

## 업로드 패키지 (ZIP)

계정 ID와 등록일(YYMMDD)을 입력하면 미리캔버스 규격 ZIP을 생성합니다.

```
miricanvas_upload_YYMMDD_accountid.zip
├── PNG/
│   └── uni_YYMMDD_accountid_NN.png      # 300 DPI, 투명, 타이트 크롭
└── CSV/
    ├── miricanvas_metadata.csv          # fileName,uniqueId,elementName,keywords,status,licenseType (UTF-8 BOM)
    └── filename_mapping.csv             # 원본 → 최종 파일명 매핑
```

- 계정 ID는 `@도메인`을 제외한 값만 허용하며 `sample`·`test` 등 placeholder 는 거부됩니다.
- 각 요소마다 한글 제목(≤100자)과 키워드(쉼표 구분, ≤25개 중복 제거)를 입력합니다.

## 검증 게이트 (실시간 배지)

| 게이트 | 통과 조건 |
|---|---|
| 투명 | 투명 픽셀 존재 (알파 채널) |
| 단축≥700 | 짧은 축 ≥ 700px |
| 긴축≥4096 | 긴 축 ≥ 4096px |
| ≤9800px | 최대 축 ≤ 9800px |
| 300DPI | 300 DPI 메타데이터 |
| ≤50MB | 파일 크기 ≤ 50MB |
| 금지색 | 불투명 `#FFFFFF`·`#353840` 없음 |
| ⚠ 원본<2048 | 원본이 작아 업스케일됨 (경고) |

## 기술

순수 HTML/CSS/JS 단일 파일. 외부 의존성 없음.
Canvas 2D · CRC32 · PNG `pHYs` 삽입 · store 방식 ZIP 인코더 · CSV(BOM) 를 직접 구현.
