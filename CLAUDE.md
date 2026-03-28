# Quazar Roadmap — Project Map

> AI/MCP 세션이 최소 탐색으로 최대 컨텍스트를 얻기 위한 현재 상태 지도.
> Phase 1~5 구현 완료 기준 (2026-03-28).

---

## 1. Domain Context

**목적:** Notion 기능 + 회사 맞춤 커스텀을 갖춘 사내 로드맵/작업 관리 툴
**사용자:** 5개 팀 — 감정팀, 개발팀, AI팀, 기획팀, 지원팀
**배포:** roadmap.ai-quazar.uk

**도메인 특수성:**
- 팀별 독립 보드: `board_type` 필드로 팀별 뷰 분리. 같은 DB, 다른 필터
- 이중 아이템 타입: 칸반 카드(`page_type=null`) + 문서 페이지(`page_type='page'`). 페이지는 칸반 보드에 표시 안 됨
- 비로그인 접근: 공개 읽기 허용. `isReadOnly=true`면 모든 편집 UI 숨김
- 로컬 AI: Ollama(qwen2.5:14b)로 항목 요약 + 챗봇. 없으면 503 반환 (정상)
- 한국어 우선: UI 레이블, 에러메시지 전부 한국어

---

## 2. Architecture Overview

```
Browser
  └── React 19 (Vite 8, port 5173)
       ├── App.jsx              ← Supabase auth 분기 (로딩/설정/보드)
       ├── AppLayout.jsx        ← Sidebar + 메인 컨텐츠 레이아웃
       │    ├── Sidebar.jsx     ← 사이드바 (보드 뷰 + 페이지 트리)
       │    └── KanbanBoard.jsx ← 뷰 오케스트레이터 (board/timeline/people)
       │         ├── BoardSection → ProjectColumn → KanbanCard (칸반 뷰)
       │         ├── TimelineView                               (간트 뷰)
       │         ├── PeopleBoard                                (팀원 뷰)
       │         ├── ItemDetailPanel (우측 패널, 리사이즈 가능)
       │         ├── SearchModal (Ctrl+K)
       │         └── FilterBar
       └── useKanbanData ← useReducer + Supabase Realtime 구독
            └── kanbanAPI.js  ← Supabase JS Client 직접 호출

Express (port 3001)
  ├── POST /upload/:itemId     ← multer 파일 저장 (uploads/{itemId}/)
  ├── DELETE /uploads/:itemId/:filename
  └── POST /api/summarize      ← HTML → Ollama → JSON 요약

Google Chat Bot (port 3002)
  └── POST /webhook ← Google Chat 이벤트 → Ollama NLU → Supabase
```

**상태 흐름:**
```
사용자 액션 → dispatch(action) → UI 즉시 반영 (optimistic update)
            → kanbanAPI 호출 → Supabase DB 저장
            → Supabase Realtime → 다른 클라이언트 업데이트
```

**URL 상태:** 뷰/선택 아이템/필터/정렬을 URL 파라미터로 관리 (React Router 미사용)
```
?view=board&item=<uuid>&fullscreen=1&filter=status:done&sort=title:asc
```

---

## 3. Tech Stack

| 기술 | 버전 | 선택 이유 |
|------|------|-----------|
| React | 19.2 | concurrent features, 최신 훅 |
| Vite | 8 | HMR 빠름, Tailwind v4 플러그인 |
| Tailwind CSS | v4 | utility-first, `dark:` prefix로 다크모드 |
| Tiptap | v3 | ProseMirror 기반, 확장 커스텀 용이 |
| @dnd-kit | 6.3 | 접근성 고려한 DnD, SortableContext |
| Supabase | 2.99 | PostgreSQL + Realtime 한 번에 |
| next-themes | - | `html.dark` 클래스 토글 |
| Ollama | - | 로컬 LLM (qwen2.5:14b) |
| Express | 5 | 파일 업로드 서버 + AI 프록시 |

---

## 4. Data Model

```sql
-- 섹션: 칸반 컬럼을 시각적으로 그룹화
sections (
  id          uuid PRIMARY KEY,
  board_type  text,      -- 'main'|'개발팀'|'AI팀'|'지원팀'
  title       text,
  order_index int
)

-- 프로젝트 = 칸반 컬럼 (Phase)
projects (
  id          uuid PRIMARY KEY,
  title       text,
  board_type  text,
  section_id  uuid REFERENCES sections(id),  -- null 허용
  assignees   text[],    -- profiles.name 값 배열
  order_index int,
  created_at  timestamptz
)

-- 아이템 = 칸반 카드 또는 문서 페이지
items (
  id             uuid PRIMARY KEY,
  project_id     uuid REFERENCES projects(id),
  parent_item_id uuid REFERENCES items(id),   -- 중첩 페이지용 자기참조
  title          text,
  content        text,           -- 카드 부제목 (짧은 설명)
  description    text,           -- Tiptap HTML (본문)
  status         text DEFAULT 'none', -- 'none'|'in-progress'|'done'
  priority       smallint DEFAULT 0,  -- 0=없음 1=낮음 2=중간 3=높음
  page_type      text,           -- null/'task'=칸반카드, 'page'=문서페이지
  assignees      text[],
  teams          text[],         -- TEAMS 상수의 name 값
  tags           text[],
  related_items  uuid[],         -- 관계 아이템 ID (양방향 수동 관리)
  ai_summary     jsonb,          -- {summary:string[], blocks:string[], generatedAt:string}
  files          jsonb,          -- [{url, filename, originalName, mimetype, size}]
  start_date     date,
  end_date       date,
  order_index    int,
  created_at     timestamptz
)

-- 댓글
comments (
  id         uuid PRIMARY KEY,
  item_id    uuid REFERENCES items(id),
  user_id    uuid REFERENCES auth.users(id),
  content    text,
  created_at timestamptz
)

-- 사용자 프로필
profiles (
  id         uuid PRIMARY KEY,  -- auth.users.id와 동일
  name       text,
  department text,
  updated_at timestamptz
)
```

---

## 5. Business Rules

**board_type:**
- `'main'` — 전사 공유 메인 보드
- `'개발팀'|'AI팀'|'지원팀'` — 팀별 전용 보드
- KanbanBoard의 현재 view prop으로 필터링. Sidebar에서 전환

**page_type:**
- `null` 또는 `'task'` → 칸반 카드 (칸반 보드에 표시됨)
- `'page'` → 문서 페이지 (칸반 보드에서 필터링, 사이드바 트리에만 표시)
- `useKanbanData`에서 SET_DATA 시 `page_type='page'` 아이템은 phases에서 제거됨

**status:**
- `'none'` → 회색 미지정
- `'in-progress'` → 파란색 진행 중
- `'done'` → 초록색 + 취소선 완료

**order_index:**
- 이동 시 영향받는 배열 전체 재계산 (index 0부터 연속)
- cross-phase move: source/target 두 phase의 items 배열 모두 갱신

**assignees 저장 방식:**
- 정상: `profiles.name` 값 그대로 저장
- 미매칭: `'name:{입력값}'` 접두사 → `getPeopleData`에서 fallback 처리

**related_items:**
- 양방향 수동 저장. A에 B 추가 시 B에도 A 추가 (kanbanAPI에서 처리)
- `parent_item_id` (부모-자식 페이지 계층)와는 별개 개념

**sections:**
- section 삭제 시 속한 projects의 `section_id`만 null로 변경 (projects 삭제 안 함)

---

## 6. Key Flows

### 상태 관리 (useKanbanData)

```javascript
// 모든 상태 변경은 이 패턴을 따름
dispatch({ type: 'UPDATE_ITEM', payload: { phaseId, itemId, updates } }); // UI 즉시 반영
await kanbanAPI.updateItem(phaseId, itemId, updates);  // DB 저장 (비동기)
// API 실패 시 Realtime 구독이 상태 재동기화
```

Reducer 액션: `SET_DATA`, `ADD/UPDATE/DELETE/MOVE_PHASE`, `ADD/UPDATE/DELETE/MOVE_ITEM`,
`ADD/UPDATE/DELETE_COMMENT`, `ADD/UPDATE/DELETE/MOVE_SECTION`, `ADD_CHILD_PAGE`

### Realtime 구독
- **items** 채널: 변경 감지 → `fetchBoardData()` 전체 재조회
- **comments** 채널: INSERT/UPDATE → fetch single + dispatch, DELETE → dispatch만
- **projects** 채널: 변경 감지 → `fetchBoardData()` 전체 재조회

### DnD (KanbanBoard.handleDragEnd)

```javascript
// activeId prefix로 타입 판별
// 'section-{id}' → moveSection()
// phase 타입 → movePhase() + 필요 시 section_id 변경
// item 타입 → moveItem() (cross-phase 지원)
```

### 파일 업로드

```
Editor/FileUploadButton → POST /upload/:itemId (Express multer)
  응답: { url, filename, originalName, mimetype, size }
  → items.files jsonb에 추가 저장
  → 이미지: 에디터에 img 삽입, 문서: 링크로 삽입
```

### AI 요약

```
ItemDetailPanel "요약 생성" → POST /api/summarize (HTML)
  → extractTextBlocks(html): h1~h4, p, li 태그 추출 + 번호 부여
  → Ollama qwen2.5:14b 프롬프트
  → { summary: string[], blocks: string[], generatedAt: ISO }
  → items.ai_summary 저장
  → summary 내 [N] 클릭 → data-id 속성으로 에디터 블록 스크롤
```

---

## 7. Component Map

```
src/
├── App.jsx                    auth 분기: 로딩→SetupProfileForm→AppLayout
├── AppLayout.jsx              Sidebar + children 레이아웃 (useLayoutState 컨텍스트)
│
├── components/
│   ├── KanbanBoard.jsx        뷰 오케스트레이터, DnD 컨텍스트, 전역 모달
│   ├── BoardSection.jsx       섹션 그룹 (접기/펼치기, DnD 재정렬)
│   ├── ProjectColumn.jsx      칸반 컬럼 (Phase). DnD droppable+draggable
│   ├── KanbanCard.jsx         카드 (Item). DnD sortable
│   ├── ItemDetailPanel.jsx    우측 슬라이드 패널 (에디터+댓글+AI요약)
│   ├── FilterBar.jsx          필터/정렬/그룹 UI
│   ├── SearchModal.jsx        Ctrl+K 전역 검색
│   ├── TimelineView.jsx       간트 스타일 타임라인
│   ├── PeopleBoard.jsx        팀원별 업무 현황
│   ├── CommentSection.jsx     댓글 목록
│   ├── Comment.jsx            단일 댓글
│   ├── FileUploadButton.jsx   파일 첨부 UI
│   ├── Sidebar.jsx            좌측 사이드바 (hover mode, open/close)
│   ├── SidebarTree.jsx        재귀 페이지 트리 렌더
│   ├── Auth/
│   │   ├── LoginForm.jsx
│   │   └── SetupProfileForm.jsx
│   ├── UI/
│   │   └── Feedback.jsx       Toast, ConfirmModal, InputModal
│   └── editor/
│       ├── Editor.jsx         Tiptap 에디터 (툴바, 파일업로드, 슬래시커맨드)
│       ├── SlashCommandMenu.jsx  슬래시 커맨드 팝업 UI
│       └── extensions/
│           ├── SlashCommand.js   `/` 커맨드 팔레트 Tiptap 확장
│           ├── ResizableImage.jsx  리사이즈 가능 이미지
│           ├── Callout.jsx        강조 블록 (tip/warning/danger/info)
│           ├── Toggle.jsx         접기/펼치기 블록
│           └── PageLink.jsx       페이지 링크 노드
│
├── hooks/
│   ├── useKanbanData.js       전체 보드 상태 (useReducer + Realtime)
│   ├── useAuth.js             Supabase Auth + 프로필 설정
│   ├── useUrlState.js         URL 파라미터 ↔ 상태 동기화
│   ├── usePeopleData.js       피플 보드 데이터
│   ├── usePageTree.js         계층적 페이지 트리 빌더
│   ├── useFilterState.js      필터/정렬/그룹 상태
│   └── useLayoutState.jsx     사이드바 열림/닫힘 컨텍스트
│
├── api/
│   ├── kanbanAPI.js           Supabase CRUD (전체 보드 데이터)
│   ├── fileAPI.js             파일 업로드/삭제 (Express 서버 호출)
│   └── summarizeAPI.js        AI 요약 API 호출
│
└── lib/
    ├── constants.js           TEAMS, GLOBAL_TAGS, STATUS_MAP, PRIORITY_MAP, PROJECT_TINTS
    └── supabase.js            Supabase 클라이언트 초기화
```

**핵심 Props 계약 (공통 패턴):**

```javascript
isReadOnly         // boolean — 비로그인 시 true, 모든 수정 UI에 적용
onShowToast(msg, type?)        // type: 'success'|'error'
onShowConfirm(title, msg, cb, type?)   // 삭제 등 파괴적 작업 전 호출
onShowPrompt(title, placeholder, cb)   // 이름 입력이 필요할 때
onOpenDetail(item)             // ItemDetailPanel 열기
onUpdateItem(phaseId, itemId, updates) // 아이템 필드 업데이트
```

---

## 8. Conventions

**stopProp 패턴 (DnD 충돌 방지):**

```javascript
const stopProp = (e) => e.stopPropagation();
// DnD 컨텍스트 내 모든 버튼/인풋에 onPointerDown={stopProp}
// 없으면 클릭 이벤트가 drag start로 인식됨
```

**isReadOnly 패턴:**

```javascript
{!isReadOnly && <button onClick={handleDelete}>삭제</button>}
// 비활성화(disabled)가 아닌 렌더링 제거로 처리
```

**Optimistic Update 순서:**

```javascript
dispatch(action);            // 1. UI 즉시 반영
await kanbanAPI.method();    // 2. DB 저장 (실패해도 Realtime이 재동기화)
```

**다크모드 (Tailwind):**

```javascript
// 모든 신규 컴포넌트에 dark: prefix 필수
// 색상 토큰: bg-bg-base, bg-bg-elevated, bg-bg-hover
// 텍스트: text-text-primary, text-text-secondary, text-text-tertiary
// 보더: border-border-subtle
```

**Tiptap InputRules (이미 내장, 추가 불필요):**

```
# → H1,  ## → H2,  ### → H3
- → BulletList,  1. → OrderedList
**text** → Bold,  *text* → Italic
- [ ] → TaskItem
```

**배열 필드 (assignees/teams/tags):**
- Supabase `text[]` 타입, JS에서는 `string[]`
- 빈 값: `[]` (null 아님)

---

## 9. Dev Guide

```bash
yarn dev:all   # 프론트(5173) + Express(3001) 동시 실행 ← 주로 이것 사용
yarn dev       # 프론트만
yarn server    # Express만
yarn build     # 프로덕션 빌드
```

**환경변수 (.env):**

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
```

**파일 업로드 저장 경로:** `server/uploads/{itemId}/{sanitized-filename}`

**Supabase 마이그레이션:** SQL은 Claude가 작성, Supabase 대시보드 SQL Editor에서 직접 실행

**Google Chat Bot:**
- 별도 `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OLLAMA_URL`, `OLLAMA_MODEL`
- ngrok 또는 Cloudflare Tunnel로 외부 노출 필요 (Google이 웹훅 호출)

---

## 10. Roadmap (미구현 Phase)

**Phase 6 — @멘션 + Google Chat 알림**
- 댓글 에디터에서 @이름 입력 → 구글챗 DM 자동 발송
- 필요 패키지: `@tiptap/extension-mention`
- Express `/api/notify` 엔드포인트 추가

**Phase 7 — 커스텀 속성 시스템**
- 팀별 자체 필드 정의 (노션 DB 속성 스타일)
- 신규 테이블 필요: `item_properties`, `item_property_values`
