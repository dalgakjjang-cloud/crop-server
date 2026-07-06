# FreeJJang STOCK STUDIO

스톡 이미지 제작 파이프라인 웹앱입니다. **진회색 다크 UI**로 동작하며, 두뇌(에이전트)가 초안·13블록 분석·메타데이터를 담당하고,
손(GPT 이미지 API 기본 / Gemini)이 실제 이미지를 생성합니다.

파이프라인: **초안 승인(멈춤1) → 순차 생성 → QC(멈춤2) → 제출 팩(Adobe CSV + 미리캔버스 XLSX)**

## 3중 두뇌 · 자동 폴백

두뇌는 **Claude Fable(기본·키 불필요) / GPT(Codex 계열) / Gemini** 중에서 선택합니다.
"자동 폴백"이 켜져 있으면 선택 두뇌가 실패(한도 초과 등)할 때 다른 두뇌로 자동 전환합니다.

- 폴백 우선순위: **① 선택 두뇌 → ② 키가 등록된 유료 두뇌(GPT·Gemini) → ③ Claude(맨 마지막 안전망)**
- 유료 API 잔여 크레딧을 먼저 소진하고 Claude 사용량은 최후로 남깁니다.
- 이미지 엔진은 자동 전환하지 않습니다(폴백은 두뇌에만 적용).

## 프롬프트 TXT 백업

이미지 생성이 실패해도 프롬프트를 잃지 않도록, 초안 생성 시점부터 두 형식으로 내보낼 수 있습니다.

- **프롬프트만 TXT** — 슬롯별 최종 이미지 프롬프트 한 줄 (Midjourney/Firefly/SD 등 이식용)
- **전체 필드 TXT** — 최종 프롬프트 + 구성 필드 + 한/영 키워드 + 카테고리 + 상태 (세션 복원·백업용)

## Adobe 메타데이터

- Adobe CSV 키워드는 **SEO 중요도 순 최대 35개**로 정규화(중복 제거)됩니다.
- 카테고리는 Adobe Stock 공식 **21개** 중 지배 피사체 기준으로 자동 선정됩니다.

> 이 프론트엔드는 저장소 루트의 Python 크롭 서버(`server.py`)와는 독립적인 별도 앱입니다.

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
