# CLAUDE.md — 이 저장소에서 일할 때 지킬 것

## 🗣️ 소통 방식 (가장 중요 · 항상 지킬 것)

사용자에게 설명할 때는 **천천히, 한 단계씩, 쉬운 말로** 한다.

1. **한 번에 한 단계씩** — 길게 몰아서 말고 "이거 하고 → 다음 이거" 순서로 끊어서.
2. **어려운 말은 바로 풀어서** — 전문용어를 쓰면 옆에 쉬운 설명을 붙인다. (예: "배포 = 인터넷에 올리기")
3. **어디를 눌러야 하는지 콕 집어서** — "Ctrl + F 누르세요", "저장은 Ctrl + S"처럼 실제 동작으로.
4. **막히면 더 잘게** — 한 단계가 어려우면 그 부분만 더 작게 쪼개서 다시 설명한다.
5. 사용자는 개발 전문가가 아니라고 가정한다. 명령어·코드를 줄 때는 **그대로 복붙할 수 있게** 완성형으로 준다.

> 이 약속은 사용자가 직접 요청한 것이다 (2026-07-23). 앞으로 모든 답변에 적용한다.

---

## 📦 프로젝트 한눈에

이 저장소(`dalgakjjang-cloud/crop-server`)는 여러 제작 도구가 함께 사는 곳이다.

- **양산공장 (FreeJJang Stock Studio)** — AI 스톡 이미지 제작 스튜디오.
  - 코드: `freejjang-stock-studio/src/App.jsx` (단일 파일, React 18 + Vite 5 + Tailwind)
  - 배포: GitHub Pages → `https://dalgakjjang-cloud.github.io/crop-server/`
  - 빌드: `cd freejjang-stock-studio && npm run build` (결과는 `dist/`, CI가 자동 배포)
- **제작 스위트 허브** — 모든 형제 도구를 한 곳에서 여는 포털.
  - 코드: `freejjang-stock-studio/public/hub.html` (정적 HTML, Vite가 `dist/` 루트로 복사)
  - 배포: `https://dalgakjjang-cloud.github.io/crop-server/hub.html`
- **SEO 키워드 거버넌스** — 스톡 메타데이터 정본·검사기.
  - `freejjang-stock-studio/seo/` (규칙: `keyword-governance.md`, 검사: `python3 seo/seo-check.py`)
- **프롬프트 세트** — `freejjang-stock-studio/prompts/` (엔진별 4종). **기존 프롬프트 파일은 지우지 않는다. 새 프롬프트는 새 파일로 추가한다.**

### 형제 도구들 (다른 곳에 배포됨)
| 도구 | 주소 |
|---|---|
| 🎨 로고공방 | `https://dalgakjjang-cloud.github.io/logo-gongbang/` (repo: logo-gongbang) |
| 🖼 벡터 아뜰리에 (Free.Atelier, 움짤 포함) | `https://free-atelier.pages.dev` (repo 없음 · 로컬 폴더 → wrangler 배포) |
| ✂️ 자동크롭 | `https://autocrop-tool.hopot13.workers.dev/` (Cloudflare Workers) |

이 도구들은 서로 헤더 바로가기 + 허브로 연결돼 있다.

---

## 🔧 작업 규칙

- 커밋/푸시는 사용자가 요청할 때 한다. 지정 브랜치는 작업 시작 시 안내된 것을 따른다.
- 정적 사이트(로고공방 등)는 `main`에 올라가야 실제 링크가 살아난다.
- 프롬프트 파일 삭제 금지 (위 참고).
