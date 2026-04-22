# Quazar Roadmap — Project Map

> AI/MCP 세션이 빠르게 컨텍스트를 파악하기 위한 프로젝트 지도 (2026-04-22)

---

## 1. Domain Context

**목적:** Notion + 사내 맞춤 커스텀 로드맵/작업 관리 툴  
**사용자:** 5개 팀 (감정/개발/AI/기획/지원)  
**배포:** roadmap.ai-quazar.uk

**핵심 특성:**
- `board_type`으로 팀별 뷰 분리 (같은 DB, 필터만 다름)
- 이중 아이템: 칸반 카드(`page_type=null`) + 문서 페이지(`page_type='page'`)
- 비로그인 공개 읽기 (`isReadOnly=true` → 편집 UI 숨김)
- Ollama 로컬 AI 요약 (없으면 503)
- GitHub App/OAuth 연동: 레포 대시보드 + 아이템 기준 이슈 생성
- Docker self-host Supabase 운영 (Cloud Supabase 덤프/복원 스크립트 포함)
- 한국어 우선 UI

---

## 2. Architecture

```
Browser (React 19, Vite 8, :5173)
  ├── App → 인증 + 릴리즈 노트
  └── AppLayout → Sidebar + KanbanBoard
       ├── KanbanBoard (뷰 오케스트레이터: board/timeline/people)
       │    ├── BoardSection → ProjectColumn → KanbanCard
       │    ├── TimelineView, PeopleBoard
       │    ├── ItemDetailPanel → Editor (CodeMirror Markdown live preview)
       │    └── FilterBar, SearchModal, PresenceAvatars
       └── useKanbanData/usePresence → kanbanAPI (Supabase)

Express (:3001)
  ├── POST /upload/:itemId (multer → uploads/)
  ├── POST /api/summarize (Ollama 프록시)
  └── /api/github/*, /api/notifications/* (GitHub/알림 서버 경로)

Supabase self-host (Docker)
  ├── Kong/API (:8000)
  ├── Studio (:3000)
  └── Postgres (:5432, 외부 공개 금지)

Google Chat Bot (:3002) → 웹훅 → Ollama NLU → Supabase
```

**상태 흐름:** 이동/정렬 = dispatch 선반영 → API, 일반 CRUD = API → dispatch  
**URL 상태:** `?view=board&item=<uuid>&fullscreen=1&filter=status:done&sort=title:asc`

---

## 3. Tech Stack

| 기술 | 이유 |
|------|------|
| React 19 | Concurrent features |
| Vite 8 | HMR, Tailwind v4 플러그인 |
| Tailwind v4 | Utility-first, dark: 다크모드 |
| CodeMirror 6 | Markdown source + live preview 상세내용 편집 |
| @dnd-kit | 접근성 고려 DnD |
| Self-host Supabase | PostgreSQL + Realtime |
| Ollama | 로컬 LLM (qwen2.5:14b) |

---

## 4. Data Model

```sql
sections       -- 칸반 컬럼 시각적 그룹 (board_type, order_index, timeline_order_index)
projects       -- 칸반 컬럼 Project (section_id, is_completed, pre_completion_*)
items          -- 카드 또는 페이지
  ├── project_id, parent_item_id (중첩), page_type, status, priority
  ├── assignees[], teams[], tags[], related_items[]
  ├── ai_summary (jsonb), files (jsonb), start/end_date
  └── created_by (auth.users.id)
comments       -- 댓글 (item_id, user_id, content)
profiles       -- 사용자 프로필 (name, department)
roadmap_projects -- 전사 로드맵 전용 프로젝트 테이블
roadmap_items    -- 전사 로드맵 전용 아이템/문서 테이블
personal_memos   -- 개인 메모 전용 저장소
team_requests    -- 개발팀 요청 문서
item_github_issues, github_repository_settings -- GitHub 이슈/레포 티켓 설정
```

**핵심 필드:**
- `page_type`: null/'task' = 칸반 카드, 'page' = 문서 (사이드바 전용)
- `assignees`: profiles.name 직접 저장, 미매칭 시 'name:{값}'
- `is_completed`: true → 보드 하단 완료 영역 분리
- `ai_summary`: { summary, blocks: [{ id, summary }], generatedAt }
- `roadmap_items`/`roadmap_projects`: 전사 로드맵 뷰 전용, 팀 보드 관계 검색 후보에서는 제외
- `item_github_issues`: 아이템과 GitHub 이슈 연결 정보, 이미 연결된 이슈는 상세 속성 박스에 표시

상세 데이터 모델은 이 섹션과 `src/api/kanbanAPI.js`를 기준으로 유지한다.

---

## 5. Business Rules

- **board_type:** 'main'(전사) / '개발팀'|'AI팀'|'지원팀' → KanbanBoard view prop 필터
- **page_type:** null/'task' = 보드 렌더, 'page' = 사이드바만 표시
- **order_index:** 이동 시 배열 전체 재계산 (0부터 연속)
- **완료 프로젝트:** pre_completion_section_id/order_index에 복귀 위치 저장
- **related_items:** 양방향 목표 (현재 단방향 + 하위 페이지 생성 시만 양방향)
- **연관 업무 검색:** 팀 보드 아이템/팀 문서/개인 메모만 신규 연결 후보로 사용하고 전사 로드맵 테이블은 제외
- **GitHub 이슈 생성:** 상세 제목 아래 보조 액션 → 모달에서 레포 선택 → 이슈 생성, 기존 연결 이슈가 있으면 속성 박스에만 표시
- **Sidebar:** main 보드 제외, parent_item_id/project_id/order_index 함께 갱신

상세 비즈니스 규칙은 이 섹션과 관련 API/컴포넌트 JSDoc을 기준으로 유지한다.

---

## 6. Key Flows

**상태 관리 (useKanbanData):**
- 이동/정렬: `dispatch(MOVE_ITEM)` → `kanbanAPI.moveItem()`
- 일반 CRUD: `kanbanAPI.updateItem()` → `dispatch(UPDATE_ITEM)`
- Realtime 구독: items/projects/comments 채널 → dispatch

**Presence:**
- board-presence 채널, userId/name/itemId/editingField 추적
- 비로그인 건너뜀, 접속자 상단 PresenceAvatars 표시

**DnD:**
- activeId prefix (section-{id}/project/item) → 타입 판별 → 이동 메서드

**Sidebar 페이지 트리 이동:**
- 중앙 = 자식, 상단/하단 = 형제, 프로젝트 위 = 루트

**AI 요약:**
- Editor HTML → Ollama → { summary, blocks } → items.ai_summary
- [N] 클릭 → #ai-block-N 스크롤

**GitHub 이슈 생성:**
- ItemDetailPanel에서 GitHub 액션 버튼 클릭 → 생성 모달
- 연결 상태/App 설치 상태 확인 → 레포 드롭다운 선택 → Express `/api/github/issues`
- 생성 성공 시 `item_github_issues` 링크 추가, 기존 이슈는 속성 박스 GitHub 행에 표시

상세 플로우는 이 섹션과 `src/hooks/useKanbanData.js`, `src/components/KanbanBoard.jsx`를 기준으로 유지한다.

---

## 7. Component Map

```
components/
  ├── AppLayout, KanbanBoard (뷰 오케스트레이터)
  ├── BoardSection, ProjectColumn, KanbanCard
  ├── ItemDetailPanel, ItemDescriptionSection
  ├── FilterBar, SearchModal, TimelineView, PeopleBoard
  ├── Sidebar, SidebarTree, ReleaseNotesModal
  └── editor/ (CodeMirror Markdown Editor, toolbar, live preview utils)

hooks/
  ├── useKanbanData (전체 상태)
  ├── useAuth, usePresence, useUrlState
  ├── usePeopleData, usePageTree, useFilterState
  └── useLayoutState

api/
  ├── kanbanAPI (Supabase CRUD)
  ├── fileAPI (Express)
  └── summarizeAPI

lib/
  ├── constants, releaseNotes, supabase, boardNavigation
```

**핵심 Props:**
- `isReadOnly`, `onShowToast`, `onShowConfirm`, `onShowPrompt`
- `onOpenDetail`, `onUpdateItem`, `onCompletePhase`

---

## 8. Conventions

- **Import/Export 단일 기준:** 공용 모듈(`src/lib/*`, `src/api/*`)은 named export를 기본으로 사용하고, default export는 React 컴포넌트 파일에서만 사용
- **배럴 파일 금지:** `index.js` 재-export(배럴)로 우회 import하지 않고, 실제 파일 경로를 직접 import
- **import 경로 고정:** 같은 파일을 서로 다른 경로(alias/relative 혼용)로 import하지 않기 (항상 한 방식만 사용)
- **export 이름 안정성:** export 이름 변경 시 참조 파일을 전역 검색(`rg`)으로 일괄 수정 후 커밋
- **상수 접근 규칙:** 단일 현재값(`CURRENT_*`)을 별도 export로 중복 제공하지 않고, 원본 배열/객체(`RELEASE_NOTES[0]`)에서 파생해 사용
- **모듈 계약 변경 절차:** `import ... from` 오류 방지를 위해 (1) export 변경 → (2) 참조부 동시 수정 → (3) build 확인을 한 세트로 처리
- **default vs named 혼동 방지:** `export default` 파일는 중괄호 없이 import, named export는 반드시 중괄호로 import

- **stopProp 패턴:** DnD 충돌 방지 → `onPointerDown={stopProp}`
- **Portal 메뉴:** 드래그 컨텍스트 위 → body fixed 포털
- **isReadOnly:** disabled 대신 렌더링 제거 (`{!isReadOnly && ...}`)
- **Optimistic Update:** 이동/정렬은 dispatch 먼저, 일반은 API 후
- **localStorage:** 섹션 접힘, 완료 펼침, 사이드바 상태, 릴리즈 ID
- **다크모드:** dark: prefix 필수, bg-bg-base, text-text-primary
- **배열 필드:** text[] → string[], 빈 값 = [] (null 아님)

---

## 9. Dev Guide

**실행:** `yarn dev:all` (프론트 5173 + Express 3001)
**환경변수:** VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
**파일 경로:** uploads/{itemId}/ → public/uploads/{itemId}/
**Supabase self-host:** `yarn supabase:selfhost:setup`, `yarn supabase:selfhost:up`, `yarn supabase:restore`
**Cloud dump:** `SUPABASE_CLOUD_DB_URL` 설정 후 `yarn supabase:export`
**운영 노출:** Postgres 포트는 외부 공개 금지, Supabase API(Kong)와 앱/API만 HTTPS 도메인 연결
**Google Chat Bot:** .env (SUPABASE_URL, SERVICE_KEY, OLLAMA_URL), ngrok/Cloudflare Tunnel 외부 노출

---

## 10. Roadmap

- **Phase 6:** @멘션 + Google Chat 알림 (Express /api/notify)
- **Phase 7:** 커스텀 속성 시스템 (item_properties, item_property_values)

로드맵은 이 섹션과 릴리즈 노트(`src/lib/releaseNotes.js`)를 기준으로 유지한다.

---

## 11. Documentation System

**3-레이어 구조:**

1. **AGENTS.md (청사진):** 프로젝트 전체 맥락 (11개 고정 섹션)
2. **폴더 README.md (진입점):** 왜/책임/주요 파일/패턴
3. **JSDoc (코드 설명):** @fileoverview, @description (복잡한 로직만)

**업데이트 트리거:**
- 컴포넌트 추가 → Section 7 + 폴더 README + @fileoverview
- DB 변경 → Section 4 + API @param
- 비즈니스 규칙 → Section 5 + @description

문서 작성 규칙은 이 섹션의 3-레이어 구조를 기준으로 유지한다.
