# Quazar Roadmap — Project Map

> AI/MCP 세션이 최소 탐색으로 최대 컨텍스트를 얻기 위한 현재 상태 지도.
> 현재 코드베이스 기준 최신화 (2026-04-02).

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
       ├── App.jsx                       ← Supabase auth 분기 + 현재 릴리즈 노트 자동 노출
       ├── lib/releaseNotes.js           ← 릴리즈 노트 데이터 단일 소스
       ├── ReleaseNotesModal.jsx         ← 버전 기반 업데이트 내역 모달
       └── components/AppLayout.jsx      ← Sidebar + 메인 컨텐츠 레이아웃
            ├── Sidebar.jsx              ← 사이드바 (보드 뷰 + 페이지 트리 + 페이지 DnD)
            └── KanbanBoard.jsx          ← 뷰 오케스트레이터 (board/timeline/people)
                 ├── BoardSection → ProjectColumn → KanbanCard (칸반 뷰)
                 ├── AssigneePicker                           (담당자 선택 + 직접입력 공용 UI)
                 ├── TimelineView                               (간트 뷰)
                 ├── PeopleBoard                                (팀원 뷰)
                 ├── ItemDetailPanel → ItemDescriptionSection   (우측 패널 본문/AI 요약)
                 ├── SearchModal                                (Ctrl+K)
                 ├── FilterBar
                 └── editor/Editor.jsx                          (Tiptap 본문 편집기)
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
사용자 액션 → 이동/정렬 계열은 dispatch(action) 선반영
            → 일반 CRUD는 kanbanAPI 호출 후 dispatch
            → Supabase DB 저장
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
  order_index int,
  timeline_order_index int   -- 타임라인 뷰 전용 정렬
)

-- 프로젝트 = 칸반 컬럼 (Phase)
projects (
  id          uuid PRIMARY KEY,
  title       text,
  board_type  text,
  section_id  uuid REFERENCES sections(id),  -- null 허용
  is_completed boolean DEFAULT false,        -- 완료 프로젝트 아카이브용
  pre_completion_section_id uuid REFERENCES sections(id), -- 완료 전 원래 섹션
  pre_completion_order_index int,            -- 완료 전 원래 순서
  description text,      -- 프로젝트 개요/설명 (가상 페이지용)
  assignees   text[],    -- profiles.name 값 배열
  order_index int,
  timeline_order_index int,                  -- 타임라인 뷰 전용 정렬
  created_at  timestamptz
)

-- 아이템 = 칸반 카드 또는 문서 페이지
items (
  id             uuid PRIMARY KEY,
  project_id     uuid REFERENCES projects(id),
  parent_item_id uuid REFERENCES items(id),   -- 중첩 페이지용 자기참조
  created_by     uuid REFERENCES auth.users(id), -- 아이템 생성자
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
  timeline_order_index int,                  -- 타임라인 뷰 전용 정렬
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
- `useKanbanData` 상태에는 그대로 로드되며, `KanbanBoard` 렌더 단계에서만 보드 카드 목록에서 필터링됨
- `usePageTree`는 `page_type='page'`만 모아 사이드바 트리로 재구성

**완료 프로젝트:**
- `projects.is_completed=true`면 메인 보드 하단 "완료된 프로젝트" 영역으로 분리 렌더
- 완료 처리 시 `pre_completion_section_id`, `pre_completion_order_index`에 원래 위치 저장
- 복귀 시 저장된 위치로 `section_id`, `order_index` 복원

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
- 편집 UI는 추천 유저 선택 + 직접 입력을 함께 지원하지만, 저장 포맷은 계속 `string[]` 유지

**related_items:**
- 양방향 연결을 목표로 하지만, 현재 공통 `updateItem()`은 단방향 업데이트이고 하위 페이지 생성 플로우에서만 양방향 보정 로직이 명시적으로 들어감
- `parent_item_id` (부모-자식 페이지 계층)와는 별개 개념

**created_by / 작성자 표시:**
- 아이템 생성 시 로그인한 사용자의 `auth.users.id`를 `items.created_by`에 저장
- 보드 조회 시 `profiles`를 매핑해 `creator_profile` 표시용 필드를 조립
- 작성자 정보가 없는 기존 아이템은 카드/상세 패널에서 작성자 영역을 숨기거나 안내 문구만 표시

**sections:**
- section 삭제 시 속한 projects의 `section_id`만 null로 변경 (projects 삭제 안 함)

**Sidebar 페이지 트리:**
- 현재 `Sidebar`는 `board_type !== 'main'` 보드의 페이지 트리만 렌더
- 사이드바에서 페이지를 드래그하면 `parent_item_id`, `project_id`, `order_index`가 함께 갱신되어 중첩/이동 가능

**상세 설명 기본 모드:**
- `ItemDescriptionSection`은 읽기 전용일 때 항상 `preview`
- 편집 가능 상태에서는 `description`에 내용이 있으면 `preview`, 비어 있으면 `live`로 시작

---

## 6. Key Flows

### 상태 관리 (useKanbanData)

```javascript
// 이동/정렬 계열
dispatch({ type: 'MOVE_ITEM', payload: { sourcePhaseId, targetPhaseId, itemId, targetIndex } });
await kanbanAPI.moveItem(sourcePhaseId, targetPhaseId, itemId, targetIndex);

// 일반 수정 계열
const updated = await kanbanAPI.updateItem(phaseId, itemId, updates);
dispatch({ type: 'UPDATE_ITEM', payload: { phaseId, itemId, updates: updated } });
```

Reducer 액션: `SET_DATA`, `ADD/UPDATE/DELETE/MOVE_PHASE`, `ADD/UPDATE/DELETE/MOVE_ITEM`,
`ADD/UPDATE/DELETE_COMMENT`, `ADD/UPDATE/DELETE/MOVE_SECTION`, `ADD_CHILD_PAGE`

### 아이템 생성 + 작성자

```javascript
await kanbanAPI.addItem(phaseId, title, content, user.id);
// getBoardData()에서 created_by -> creator_profile.name 표시용 필드 조립
```

### Realtime 구독
- **items** 채널: 변경 감지 → `fetchBoardData()` 전체 재조회
- **comments** 채널: INSERT/UPDATE → fetch single + dispatch, DELETE → dispatch만
- **projects** 채널: 변경 감지 → `fetchBoardData()` 전체 재조회
- **sections**는 별도 Realtime 구독이 없음. 현재 클라이언트의 로컬 dispatch 또는 이후 전체 재조회로 반영됨

### DnD (KanbanBoard.handleDragEnd)

```javascript
// activeId prefix로 타입 판별
// 'section-{id}' → moveSection()
// phase 타입 → movePhase() + 필요 시 section_id 변경
// item 타입 → moveItem() (cross-phase 지원)
```

### Sidebar 페이지 트리 이동

```javascript
// Sidebar DnD는 칸반 보드와 별도 컨텍스트
// 중앙 드롭 → targetParentId = overItem.id (자식으로 편입)
// 상단/하단 드롭 → 같은 parent_item_id 레벨에서 형제 순서 변경
// 프로젝트 위 드롭 → 해당 프로젝트 루트(parent_item_id=null)로 이동
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
  → summary 내 [N] 클릭 → `#ai-block-N` DOM id로 본문 블록 스크롤
```

---

## 7. Component Map

```
src/
├── App.jsx                    auth 분기: 로딩→SetupProfileForm→KanbanBoard
│
├── components/
│   ├── AppLayout.jsx          Sidebar + children 레이아웃 (useLayoutState 컨텍스트)
│   ├── AssigneePicker.jsx     담당자 선택 + 직접입력 공용 편집 UI
│   ├── KanbanBoard.jsx        뷰 오케스트레이터, DnD 컨텍스트, 전역 모달
│   ├── BoardSection.jsx       섹션 그룹 (접기/펼치기, DnD 재정렬)
│   ├── ProjectColumn.jsx      칸반 컬럼 (Phase). 완료 프로젝트 토글 포함
│   ├── KanbanCard.jsx         카드 (Item). DnD sortable
│   ├── ItemDetailPanel.jsx    우측 슬라이드 패널 (에디터+댓글+AI요약+관계아이템)
│   ├── ItemDescriptionSection.jsx  상세 설명 전용 섹션 (라이브/원문/미리보기, AI 요약)
│   ├── itemDescriptionMode.js 초기 descriptionMode 결정 규칙
│   ├── projectColumnMenu.js   프로젝트 컬럼 메뉴 포털 위치 계산/표면 규칙
│   ├── FilterBar.jsx          필터/정렬/그룹 UI
│   ├── SearchModal.jsx        Ctrl+K 전역 검색
│   ├── TimelineView.jsx       간트 스타일 타임라인
│   ├── PeopleBoard.jsx        팀원별 업무 현황
│   ├── ReleaseNotesModal.jsx  버전 기반 업데이트 내역 모달
│   ├── CommentSection.jsx     댓글 목록
│   ├── Comment.jsx            단일 댓글
│   ├── FileUploadButton.jsx   파일 첨부 UI
│   ├── Sidebar.jsx            좌측 사이드바 (hover mode, open/close, 페이지 DnD)
│   ├── SidebarTree.jsx        재귀 페이지 트리 렌더
│   ├── VirtualizedItemList.jsx  대량 카드용 가상 리스트 (현재 미사용)
│   ├── TiptapEditor.jsx       초기 Tiptap 프로토타입 컴포넌트 (현재 미사용)
│   ├── Auth/
│   │   ├── LoginForm.jsx
│   │   └── SetupProfileForm.jsx
│   ├── UI/
│   │   └── Feedback.jsx       Toast, ConfirmModal, InputModal
│   └── editor/
│       ├── Editor.jsx         Tiptap 에디터 (툴바, 파일업로드, 슬래시커맨드, @멘션)
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
│   ├── usePeopleData.js       피플 보드 전용 데이터 훅 (현재 PeopleView에서는 직접 미사용)
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
    ├── releaseNotes.js        현재 릴리즈 노트 데이터 + localStorage key
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
onCompletePhase(phaseId, isCompleted, meta?) // 프로젝트 완료/복귀 처리
```

---

## 8. Conventions

**stopProp 패턴 (DnD 충돌 방지):**

```javascript
const stopProp = (e) => e.stopPropagation();
// DnD 컨텍스트 내 모든 버튼/인풋에 onPointerDown={stopProp}
// 없으면 클릭 이벤트가 drag start로 인식됨
```

**Portal 메뉴 패턴 (드래그/블러 레이어 분리):**

```javascript
{showMenu && createPortal(
  <>
    <button type="button" className="fixed inset-0 z-[1200] bg-transparent" />
    <div className="fixed z-[1210] bg-white dark:bg-bg-elevated pointer-events-auto" />
  </>,
  document.body,
)}
```

프로젝트 컬럼 메뉴처럼 `backdrop-blur` 헤더나 DnD 컨텍스트 위에 떠야 하는 메뉴는 헤더 내부 `absolute` 대신 body 포털의 `fixed` 오버레이로 렌더한다.

**isReadOnly 패턴:**

```javascript
{!isReadOnly && <button onClick={handleDelete}>삭제</button>}
// 비활성화(disabled)가 아닌 렌더링 제거로 처리
```

**상세 설명 초기 모드 규칙:**

```javascript
const mode = getInitialDescriptionMode({
  isReadOnly,
  description: item?.description || '',
});
```

본문이 있는 상세페이지는 읽기 흐름을 우선해 `preview`, 빈 본문은 바로 입력할 수 있게 `live`로 시작한다.

**Optimistic Update 순서:**

```javascript
// 이동/정렬: 즉시 반영 후 저장
dispatch(action);
await kanbanAPI.method();

// 일반 수정: 저장 성공값으로 반영
const updated = await kanbanAPI.method();
dispatch({ type: 'UPDATE_*', payload: updated });
```

**localStorage UI 상태:**
- `kanban-expanded-sections` — 보드 섹션 접힘 상태
- `kanban-completed-expanded` — 완료된 프로젝트 보드 펼침 상태
- `kanban-main-board-collapsed` — 메인 보드 접힘 상태
- `sidebar-open`, `sidebar-hover-mode`, `sidebar-expanded` — 사이드바 UI 상태
- `kanban-release-notes-last-seen` — 마지막으로 확인한 릴리즈 노트 ID

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
**실제 정적 서빙 경로:** `public/uploads/{itemId}/{sanitized-filename}`

**Supabase 마이그레이션:** SQL은 Codex가 작성, Supabase 대시보드 SQL Editor에서 직접 실행

**Google Chat Bot:**
- 별도 `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OLLAMA_URL`, `OLLAMA_MODEL`
- ngrok 또는 Cloudflare Tunnel로 외부 노출 필요 (Google이 웹훅 호출)

**Lint 주의사항:**
- 현재 `eslint.config.js`는 `dist`만 ignore하고 있어 `.worktrees/`, 빌드 산출물, Node 전용 코드까지 함께 검사됨
- `yarn lint` 결과를 해석할 때는 실제 앱 소스와 설정 범위를 분리해서 봐야 함

---

## 10. Roadmap (미구현 Phase)

**Phase 6 — @멘션 + Google Chat 알림**
- 댓글 에디터에서 @이름 입력 → 구글챗 DM 자동 발송
- 본문 에디터의 `@멘션` UI는 이미 존재함. 댓글 입력과 알림 연동은 아직 미구현
- Express `/api/notify` 엔드포인트 추가

**Phase 7 — 커스텀 속성 시스템**
- 팀별 자체 필드 정의 (노션 DB 속성 스타일)
- 신규 테이블 필요: `item_properties`, `item_property_values`

---

## 11. Documentation System Guide

> 이 프로젝트는 3-레이어 AI 친화적 문서화 시스템을 사용한다.
> 어떤 AI든 아래 규칙을 따르면 동일한 형식으로 문서를 작성·수정할 수 있다.

### 레이어 구조

```
Layer 1: AGENTS.md          ← 프로젝트 전체 청사진 (AI 세션 시작점)
Layer 2: 폴더별 README.md   ← 폴더 역할과 패턴 설명 (탐색 진입 전 읽기)
Layer 3: 파일별 JSDoc       ← 코드 인라인 "왜" 설명 (코드 읽기 전 읽기)
```

**원칙:** 각 레이어는 "아래 레이어를 읽지 않아도 이해 가능"해야 한다.
AGENTS.md만 읽어도 아키텍처를 파악할 수 있고, README.md까지 읽으면 코드 탐색 전략이 세워지고,
JSDoc까지 읽으면 개별 파일을 한 줄씩 분석할 필요가 없어야 한다.

---

### Layer 1 — AGENTS.md 작성 규칙

**목적:** AI 세션 시작 시 컨텍스트 로딩 비용을 최소화. 코드를 읽지 않고도 전체 구조를 파악 가능하게.

**고정 섹션 구조 (번호 바꾸지 말 것):**

| 섹션 | 내용 | 언제 업데이트 |
|------|------|--------------|
| 1. Domain Context | 목적, 사용자, 도메인 특수성 | 비즈니스 요구사항 변경 시 |
| 2. Architecture Overview | 컴포넌트 트리, 상태 흐름, URL 구조 | 주요 컴포넌트 추가/삭제 시 |
| 3. Tech Stack | 기술 스택 테이블 | 패키지 추가/변경 시 |
| 4. Data Model | SQL 스키마 (실제 운영 기준) | DB 컬럼 추가/삭제 시 |
| 5. Business Rules | board_type/page_type/status 등 도메인 규칙 | 규칙 변경 시 |
| 6. Key Flows | 상태 관리, DnD, 파일업로드, AI요약 흐름 | 흐름 변경 시 |
| 7. Component Map | 파일 트리 + 핵심 Props 계약 | 파일 추가/삭제/이동 시 |
| 8. Conventions | 공통 코딩 패턴 (stopProp, isReadOnly 등) | 새 패턴 도입 시 |
| 9. Dev Guide | 실행 명령어, 환경변수, 배포 | 인프라 변경 시 |
| 10. Roadmap | 미구현 Phase | Phase 완료 또는 신규 계획 시 |
| 11. Documentation System Guide | 이 섹션 | 문서화 규칙 자체 변경 시 |

**작성 원칙:**
- **현재 상태만** 기록. "~할 예정"은 Roadmap 섹션에만 작성
- 코드 예시는 실제 코드베이스의 패턴을 그대로 사용 (가상 예시 금지)
- 각 섹션은 독립적으로 읽을 수 있어야 함 (다른 섹션 참조 최소화)
- 한국어 우선. 기술 용어는 영어 유지

**새 컴포넌트/훅 추가 시 AGENTS.md 업데이트 체크리스트:**
```
□ Section 2: Architecture Overview에 컴포넌트 위치 추가
□ Section 7: Component Map 파일 트리에 추가
□ Section 7: 새 Props 계약이 있으면 핵심 Props 계약에 추가
□ Section 8: 새 공통 패턴 도입했으면 Conventions에 추가
```

**DB 변경 시 AGENTS.md 업데이트 체크리스트:**
```
□ Section 4: Data Model SQL 스키마 업데이트
□ Section 5: 새 비즈니스 규칙이 생기면 Business Rules에 추가
□ Section 6: 흐름이 바뀌면 Key Flows 업데이트
```

---

### Layer 2 — 폴더별 README.md 작성 규칙

**목적:** 폴더 안의 파일들을 열기 전에 "이 폴더가 무엇을 담당하는지" 파악. AI가 어느 파일을 읽어야 할지 결정하는 진입점.

**필수 포함 섹션 (템플릿):**

````markdown
# {폴더명}/

> {이 폴더의 한 줄 역할 설명. 왜 이 폴더가 존재하는지 중심으로.}

## 책임
- {이 폴더 코드가 담당하는 관심사 목록}
- {다른 폴더와의 경계: "X는 하지 않고 Y만 한다"}

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `파일명.js` | **핵심.** 한 줄 설명 | 의존 모듈 |
| `파일명.js` | 한 줄 설명 | - |

## 패턴 & 규칙

{이 폴더 코드에서 반복되는 패턴, 주의사항, 코드 예시}
```javascript
// 실제 코드 패턴 예시 (가상 코드 금지)
```
````

**작성 원칙:**
- `> 한 줄 설명`은 "이 폴더가 무엇을 하는가"가 아니라 "**왜** 이 폴더가 필요한가" 중심
- 주요 파일 테이블에서 핵심 파일에는 **핵심.** 접두어 붙이기
- 패턴 & 규칙 섹션: 추상적 설명보다 실제 코드 스니펫 우선
- 하위 폴더가 있으면 "하위 폴더" 섹션을 추가하고 각 폴더를 한 줄로 설명
- 파일이 3개 이하인 폴더는 주요 파일 테이블 생략 가능, 인라인 설명으로 대체

**새 파일 추가 시 README.md 업데이트:**
- 해당 폴더의 README.md `주요 파일` 테이블에 행 추가
- 해당 파일이 새 패턴을 도입했다면 `패턴 & 규칙` 섹션에 예시 추가
- 상위 폴더 README.md에서 이 폴더를 참조하고 있다면 설명 업데이트

---

### Layer 3 — JSDoc 작성 규칙

**목적:** 코드 파일을 열었을 때 첫 20줄 안에 "이 파일이 **왜** 존재하는지"를 파악. 코드를 한 줄씩 읽는 비용 절감.

**@fileoverview — 파일 최상단 필수**

모든 훅(`.js`), API 파일(`.js`), 주요 컴포넌트(`.jsx`)에 추가:

```javascript
/**
 * @fileoverview {이 파일이 왜 필요한가 — 비즈니스 맥락 1~2줄}
 *
 * {핵심 동작 원리 또는 주의사항}
 * {다른 파일과의 관계 (어디서 호출되는지, 무엇에 의존하는지)}
 *
 * {반환값/노출 API가 있으면 한 줄 요약}
 */
```

**좋은 @fileoverview 예시:**
```javascript
/**
 * @fileoverview 전체 칸반 보드 상태의 단일 진실 소스(Single Source of Truth).
 *
 * useReducer로 phases/sections를 관리하고, Supabase Realtime으로 다른 클라이언트와 동기화.
 * 모든 CRUD 작업은 "dispatch 먼저 → API 호출 나중" 패턴(Optimistic Update)을 사용.
 *
 * 상태 구조: phases(칸반 컬럼 배열, items 내장), sections(섹션 배열), loading, error
 */
```

**나쁜 @fileoverview 예시 (금지):**
```javascript
/**
 * @fileoverview 칸반 데이터 훅.  ← "무엇"만 설명, "왜"가 없음
 */
```

**@description — 함수/메서드 단위**

비즈니스 맥락이 있는 함수에만 추가 (단순 getter/setter 제외):

```javascript
/**
 * @description {왜 이 함수가 필요한가 — 비즈니스 요구사항 기준}
 * {핵심 주의사항 또는 사이드이펙트}
 * @param {타입} paramName - {데이터 구조 또는 가능한 값 설명}
 * @returns {타입} {반환값의 의미}
 */
```

**@param 작성 기준:**
- 타입은 간략히 (`string`, `Object`, `Array` 수준). 과도한 TypeScript 스타일 금지
- 가능한 값이 열거 가능하면 명시: `- 'main'|'개발팀'|'AI팀'|'지원팀'`
- 데이터 구조가 복잡하면 인라인 예시 포함:
  ```javascript
  * @param {Object} updates - 변경할 필드만 포함. `{ status: 'done', assignees: ['홍길동'] }`
  ```

**언제 JSDoc을 추가해야 하는가:**
```
✅ 추가할 것:
  - 새 훅 파일 생성 시 → @fileoverview 필수
  - 새 API 함수 생성 시 → @fileoverview (파일) + @description (함수)
  - 새 주요 컴포넌트 생성 시 → @fileoverview 필수
  - 비즈니스 로직이 복잡한 함수 → @description

❌ 추가하지 말 것:
  - 단순 이벤트 핸들러 (e.g., handleClick, handleChange)
  - JSX 내부 인라인 함수
  - 이미 파일명/함수명으로 역할이 명확한 경우
  - 유틸리티 파일의 단순 변환 함수
```

**JSDoc 업데이트 기준:**
- 함수 **시그니처** 변경 시 → @param/@returns 업데이트
- 함수 **목적** 변경 시 → @description 업데이트
- 파일 **역할** 변경 시 → @fileoverview 업데이트
- 단순 버그픽스나 리팩토링은 JSDoc 변경 불필요

---

### 문서 업데이트 트리거 요약

| 변경 사항 | Layer 1 (AGENTS.md) | Layer 2 (README.md) | Layer 3 (JSDoc) |
|-----------|--------------------|--------------------|-----------------|
| 새 컴포넌트 파일 추가 | Section 7 업데이트 | 해당 폴더 README 업데이트 | @fileoverview 추가 |
| 새 훅 추가 | Section 2, 7 업데이트 | hooks/README.md 업데이트 | @fileoverview 추가 |
| DB 컬럼 추가 | Section 4 스키마 업데이트 | 해당 없음 | API 함수 @param 업데이트 |
| 새 비즈니스 규칙 | Section 5 업데이트 | 해당 없음 | 영향받는 함수 @description 업데이트 |
| 새 공통 패턴 도입 | Section 8 업데이트 | 해당 폴더 README 패턴 섹션 | 해당 없음 |
| 파일 삭제 | Section 7에서 제거 | README 테이블에서 제거 | 해당 없음 (파일 삭제됨) |
| 파일 이동/이름 변경 | Section 7 경로 수정 | 양쪽 폴더 README 수정 | @fileoverview 내 경로 언급 수정 |
| Phase 완료 | Section 10 Roadmap에서 제거, 관련 섹션들 현재 상태로 업데이트 | 해당 없음 | 해당 없음 |
