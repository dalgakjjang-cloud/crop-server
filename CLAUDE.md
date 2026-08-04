# CLAUDE.md — 이 저장소에서 일할 때 지킬 것

## 🗣️ 소통 방식 (가장 중요 · 항상 지킬 것)

사용자에게 설명할 때는 **천천히, 한 단계씩, 쉬운 말로** 한다.

1. **한 번에 한 단계씩** — 길게 몰아서 말고 "이거 하고 → 다음 이거" 순서로 끊어서.
2. **어려운 말은 바로 풀어서** — 전문용어를 쓰면 옆에 쉬운 설명을 붙인다. (예: "배포 = 인터넷에 올리기")
3. **어디를 눌러야 하는지 콕 집어서** — "Ctrl + F 누르세요", "저장은 Ctrl + S"처럼 실제 동작으로.
4. **막히면 더 잘게** — 한 단계가 어려우면 그 부분만 더 작게 쪼개서 다시 설명한다.
5. 사용자는 개발 전문가가 아니라고 가정한다. 명령어·코드를 줄 때는 **그대로 복붙할 수 있게** 완성형으로 준다.
6. **명령어를 줄 때는 "어디에 치는지(여는 법)"까지** 알려준다.
   - 예: **PowerShell**은 해당 폴더 안에서 **Shift + 마우스 우클릭 → "여기에 PowerShell 창 열기"**.
   - 명령창을 그냥 "명령창에 치세요"로 끝내지 말고, 그 창을 여는 동작부터 짚어준다.

> 이 약속은 사용자가 직접 요청한 것이다 (2026-07-23). 앞으로 모든 답변에 적용한다.

---

## 🔗 한 형제 원칙 (잊지 말 것)

**양산공장 · 아뜰리에 · 로고공방 · 자동크롭은 항상 한 형제(한 세트)다.**

- 따로 떨어진 남의 프로젝트로 취급하지 않는다. 하나를 건드리면 형제들과의 연결(허브·헤더 바로가기·양방향 링크)을 늘 함께 생각한다.
- 새 도구가 생기면 기본적으로 이 형제 세트에 편입시키고, 허브(`hub.html`)와 헤더 바로가기에 연결한다.
- 특히 **양산공장 ↔ 아뜰리에**는 제작 흐름상 짝이다 (스튜디오에서 만든 요소 → 아뜰리에에서 배경 제거·벡터화·움짤). 늘 서로 오갈 수 있어야 한다.

> 사용자 요청 (2026-07-23): "양산공장이나 아뜰리에나 항상 같은 형제라는 걸 잊지마."

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
- **미드저니 배치 (MJ Batch)** — 프롬프트 txt를 미드저니에 자동 입력해 대량 생성하는 **로컬 파이썬 도구**.
  - 코드: `midjourney-batch/` (`mj_batch.py`) · 웹앱 아님(내 컴퓨터에서 실행) · 허브에는 "로컬 도구"로 표시, GitHub 폴더로 링크.

### 형제 도구들 (다른 곳에 배포됨)
| 도구 | 주소 |
|---|---|
| 🎨 로고공방 | `https://dalgakjjang-cloud.github.io/logo-gongbang/` (repo: logo-gongbang) |
| 🖼 벡터 아뜰리에 (Free.Atelier, 움짤 포함) | `https://free-atelier.pages.dev` (repo 없음 · 로컬 폴더 → wrangler 배포) |
| ✂️ 자동크롭 | `https://autocrop-tool.hopot13.workers.dev/` (Cloudflare Workers) |
| 📤 캔바 자동업로드 (Canva Bulk Converter) | `https://canva-bulk-converter.pages.dev/` (Cloudflare Pages · 사이트 비밀번호 있음 · 캔바 자동 대량 업로드 후 편집) |

이 도구들은 서로 헤더 바로가기 + 허브로 연결돼 있다.

---

## 🔧 작업 규칙

- 커밋/푸시는 사용자가 요청할 때 한다. 지정 브랜치는 작업 시작 시 안내된 것을 따른다.
- 정적 사이트(로고공방 등)는 `main`에 올라가야 실제 링크가 살아난다.
- 프롬프트 파일 삭제 금지 (위 참고).
- **미드저니 프롬프트는 V8.2 기준** — `--raw`(구 `--style raw`) + `--v 8.2`. (2026-07-24 V8.2 기본화 반영, 2026-07-27 전 MJ 파일 마이그레이션)
