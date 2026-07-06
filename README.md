# FreeJJang STOCK STUDIO

스톡 이미지 제작 파이프라인 웹앱입니다. 두뇌(Claude/Fable)가 초안·13블록 분석·메타데이터를 담당하고,
손(GPT 이미지 API 기본 / Gemini)이 실제 이미지를 생성합니다.

파이프라인: **초안 승인(멈춤1) → 순차 생성 → QC(멈춤2) → 제출 팩(Adobe CSV + 미리캔버스 XLSX)**

> 이 프론트엔드는 저장소 루트의 Python 크롭 서버(`server.py`)와는 독립적인 별도 앱입니다.

## 🆕 미리캔버스 요소 크롭 스튜디오 (`element-crop-studio/`)

어떤 이미지든 **배경 제거 → 타이트 크롭 → 규격 리사이즈 → 300 DPI → 업로드 패키지(PNG+CSV ZIP)** 까지
브라우저에서 바로 처리하는 **서버 불필요 단일 파일 웹앱**입니다.
`element-crop-studio/index.html` 을 열기만 하면 됩니다. 자세한 내용은 [element-crop-studio/README.md](element-crop-studio/README.md) 참고.

## 개발 실행

```bash
cd freejjang-stock-studio
npm install
npm run dev      # http://localhost:5173
```

## 빌드 / 미리보기

```bash
npm run build    # dist/ 생성
npm run preview
```

## API 키

앱 상단 설정에서 이미지 엔진 키를 입력합니다. 키는 브라우저 메모리에만 유지되며 어디에도 저장·전송되지 않습니다(새로고침 시 재입력).

- **GPT (기본)**: OpenAI API Key (`sk-…`) — `gpt-image-1`
- **Gemini**: Google AI Studio API Key (`AIzaSy…`) — `gemini-2.5-flash-image`

Claude(Fable) 호출은 브라우저에서 직접 `api.anthropic.com`으로 요청하므로,
CORS/키가 필요한 환경에서는 별도 프록시가 필요할 수 있습니다.

## 기술 스택

React 18 · Vite 5 · Tailwind CSS 3 · lucide-react · SheetJS(xlsx)
