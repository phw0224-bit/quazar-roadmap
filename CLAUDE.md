# Quazar Roadmap — Claude Code 작업 가이드

> 이 문서는 Claude Code가 프로젝트 컨텍스트를 빠르게 파악하고
> 바이브코딩을 이어받아 진행하기 위한 종합 참고 문서입니다.

---

## 🗂️ 프로젝트 개요

**목표:** Notion의 모든 기능 + 회사 맞춤 커스텀 + 추가 기능을 갖춘 사내 로드맵/작업 관리 툴

**스택:**
- Frontend: React 19 + Vite 8 + Tailwind CSS v4
- Editor: Tiptap v3 (StarterKit + 확장 예정)
- DnD: @dnd-kit/core + @dnd-kit/sortable
- Backend: Express 5 (server/index.js, port 3001)
- DB: Supabase (PostgreSQL + Realtime)
- AI: Ollama 로컬 LLM (qwen2.5:14b), Google Chat Bot (port 3002)
- 배포 도메인: roadmap.ai-quazar.uk

**실행 명령어:**
```bash
yarn dev:all   # 프론트(5173) + 서버(3001) 동시 실행
yarn dev       # 프론트만
yarn server    # 서버만
```

---

## 📁 파일 구조

```
src/
├── App.jsx                    # 인증 분기 + 최상위 라우팅
├── api/
│   ├── kanbanAPI.js           # Supabase CRUD (projects/items/comments/sections)
│   ├── fileAPI.js             # 파일 업로드/삭제 (axios → Express 서버)
│   └── summarizeAPI.js        # AI 요약 API 호출
├── components/
│   ├── KanbanBoard.jsx        # 메인 보드 (뷰 전환, DnD 오케스트레이터)
│   ├── BoardSection.jsx       # 섹션 그룹 (여러 ProjectColumn 묶음)
│   ├── ProjectColumn.jsx      # 칸반 컬럼 (Phase = Project)
│   ├── KanbanCard.jsx         # 칸반 카드 (Item)
│   ├── ItemDetailPanel.jsx    # 아이템 상세 패널 (681줄, 핵심 컴포넌트)
│   ├── TiptapEditor.jsx       # 리치 텍스트 에디터
│   ├── PeopleBoard.jsx        # 팀원별 업무 현황 뷰
│   ├── CommentSection.jsx     # 댓글 영역
│   ├── Comment.jsx            # 댓글 단일 컴포넌트
│   ├── FileUploadButton.jsx   # 파일 첨부
│   ├── Auth/
│   │   ├── LoginForm.jsx
│   │   └── SetupProfileForm.jsx
│   └── UI/
│       └── Feedback.jsx       # Toast, ConfirmModal, InputModal
├── hooks/
│   ├── useKanbanData.js       # 전체 보드 데이터 (useReducer + Realtime)
│   ├── useAuth.js             # Supabase Auth
│   ├── usePeopleData.js       # 피플 보드 데이터
│   └── useUrlState.js         # URL 파라미터 상태관리
├── lib/
│   ├── constants.js           # TEAMS, GLOBAL_TAGS, STATUS_MAP, PROJECT_TINTS
│   └── supabase.js            # Supabase 클라이언트
└── index.css                  # Tailwind + 커스텀 테마 (다크모드, 폰트, 스크롤바)

server/
└── index.js                   # Express: 파일업로드(/upload) + AI요약(/api/summarize)

google-chat-bot/               # 구글챗 봇 (port 3002)
├── index.js
├── handlers/
│   ├── query.js
│   └── action.js
└── lib/
    └── ollama.js
```

---

## 🗄️ DB 스키마 (Supabase에서 추론)

```sql
-- 섹션 (보드 그룹)
sections (
  id uuid PK,
  board_type text,      -- 'main' | '개발팀' | 'AI팀' | '지원팀'
  title text,
  order_index int
)

-- 프로젝트 = 칸반 컬럼 (Phase)
projects (
  id uuid PK,
  title text,
  board_type text,
  section_id uuid FK → sections,
  assignees text[],
  order_index int,
  created_at timestamptz
)

-- 아이템 = 칸반 카드
items (
  id uuid PK,
  project_id uuid FK → projects,
  title text,
  content text,          -- 부제목 (짧은 설명)
  description text,      -- Tiptap HTML (긴 본문)
  status text,           -- 'none' | 'in-progress' | 'done'
  assignees text[],
  teams text[],
  tags text[],
  related_items uuid[],  -- 관계 아이템
  ai_summary jsonb,      -- {summary: string[], blocks: string[], generatedAt: string}
  files jsonb,           -- 첨부파일 목록
  order_index int,
  created_at timestamptz
)

-- 댓글
comments (
  id uuid PK,
  item_id uuid FK → items,
  user_id uuid FK → profiles,
  content text,
  created_at timestamptz
)

-- 사용자 프로필
profiles (
  id uuid PK → auth.users,
  name text,
  department text,
  updated_at timestamptz
)
```

---

## 🎨 디자인 시스템

**폰트:** Pretendard (본문), JetBrains Mono (코드/숫자)

**다크모드:** `next-themes` + Tailwind `dark:` prefix. `html.dark` 클래스로 전환.

**색상 토큰 (index.css):**
```css
--color-bg-base: #191919        /* 다크 배경 */
--color-bg-elevated: #212121    /* 카드 배경 */
--color-bg-hover: #2a2a2a       /* 호버 상태 */
--color-border-subtle: #2f2f2f
--color-text-primary: #e3e3e3
--color-text-secondary: #9b9b9b
--color-text-tertiary: #5a5a5a
```

**팀 색상 (constants.js):**
- 감정팀: slate, 개발팀: gray, AI팀: green, 기획팀: purple, 지원팀: pink

**뷰 종류:**
- `board` (기본 칸반), `개발팀`, `AI팀`, `지원팀`, `people` (피플 보드)

**URL 상태:**
```
?view=board&item=<uuid>&fullscreen=1&scrollTo=project:<uuid>|section:<uuid>
```

---

## 🔑 핵심 패턴 & 규칙

### 상태 관리
- `useKanbanData` → useReducer로 전체 보드 상태 관리
- Supabase Realtime 구독: `items`, `comments`, `projects` 테이블 변경 감지
- Optimistic Update: dispatch 먼저 → API 호출 (moveItem, movePhase)

### API 패턴
```javascript
// kanbanAPI.js 패턴: 항상 supabase 직접 호출 (Supabase JS Client)
const { data, error } = await supabase.from('items').select('*');
if (error) throw error;
return data;
```

### 컴포넌트 규칙
- `onShowToast(message)` — 성공/실패 알림
- `onShowConfirm(title, message, callback)` — 삭제 확인 모달
- `isReadOnly` prop — 비로그인 사용자는 읽기 전용
- `stopProp = (e) => e.stopPropagation()` — DnD 충돌 방지 패턴

### Tiptap 에디터 현황
- StarterKit (Bold, Italic, Heading, BulletList, CodeBlock 등 포함)
- Image (리사이즈 가능한 커스텀 NodeView)
- Placeholder, Table, TableRow, TableCell, TableHeader
- `marked` (마크다운→HTML), `turndown` (HTML→마크다운) 변환 유틸
- **InputRules 이미 내장:** `#` → H1, `##` → H2, `- ` → 리스트, `**` → Bold 등

---

## 🚀 구현 로드맵

### Phase 1 — 에디터 완성 ← 여기서 시작 권장
**목표:** 슬래시 커맨드 + 노션 스타일 블록 추가

**설치할 패키지:**
```bash
yarn add @tiptap/suggestion @tiptap/extension-code-block-lowlight \
         lowlight @tiptap/extension-color @tiptap/extension-text-style \
         @tiptap/extension-highlight @tiptap/extension-task-list \
         @tiptap/extension-task-item @tiptap/extension-mention
```

**구현 목록:**
1. **SlashCommand Extension** — `/` 입력 시 블록 선택 팝업
   - 텍스트, H1~H3, 구분선, 인용구, 코드블록, 체크리스트, Callout, Toggle, 이미지
   - `@tiptap/suggestion` 기반, 팝업 위치는 현재 커서 기준
2. **Callout 블록** — Custom Node. 배경색 선택 (💡노랑, ⚠️주황, ❌빨강, ℹ️파랑)
3. **Toggle 블록** — Custom Node. 클릭으로 접기/펼치기
4. **체크리스트** — TaskList + TaskItem extension. `- [ ]` 마크다운 문법
5. **코드블록 하이라이팅** — lowlight로 언어별 색상
6. **블록 드래그 핸들** — 각 블록 왼쪽 `⠿` 아이콘으로 순서 변경

**파일 변경:**
- `src/components/TiptapEditor.jsx` → `src/components/editor/` 폴더로 분리
  - `Editor.jsx` (메인)
  - `extensions/SlashCommand.js`
  - `extensions/Callout.js`
  - `extensions/Toggle.js`
  - `SlashCommandMenu.jsx` (팝업 UI)

---

### Phase 2 — 필터/정렬/그룹화
**목표:** 칸반 데이터 건드리지 않고 렌더링 레이어에서 필터링

**URL 파라미터 추가:**
```
?filter=status:in-progress,tags:AI핵심&sort=title:asc&group=assignees
```

**구현 목록:**
1. **`src/hooks/useFilterState.js`** 신규
   ```javascript
   // 관리 상태
   {
     filters: [{ field, op, value }], // AND 조합
     sort: { field, dir },
     group: null | 'status' | 'assignees' | 'tags'
   }
   ```
2. **`src/components/FilterBar.jsx`** 신규
   - 상단 바: `+ 필터` 버튼 → 드롭다운 (필드 선택 → 값 선택)
   - 조건 칩 형태 표시, X로 제거
   - 정렬/그룹화 드롭다운 버튼
3. **`KanbanBoard.jsx`** 수정 — FilterBar 삽입, 필터 적용 로직 연결
4. **`useUrlState.js`** 수정 — 필터 파라미터 추가

**주의:** 필터 적용은 `phases` 데이터를 직접 변경하지 않고 `filteredPhases` 파생 변수로 처리할 것

---

### Phase 3 — Cmd+K 전체 검색
**목표:** 글로벌 검색 팝업

**Supabase SQL 마이그레이션 (대시보드에서 실행):**
```sql
ALTER TABLE items ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(content, '') || ' ' ||
      coalesce(description, '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS items_fts_idx ON items USING GIN(fts);
```

**Express 서버 추가 (`server/index.js`):**
```javascript
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  // supabase.from('items').select().textSearch('fts', q)
});
```

**구현 목록:**
1. **`src/components/SearchModal.jsx`** 신규
   - `Cmd+K` / `Ctrl+K` 단축키
   - 300ms debounce 실시간 검색
   - 결과 클릭 → 해당 아이템 Detail Panel 열기
   - 최근 방문 아이템 (로컬 상태)
2. **`KanbanBoard.jsx`** — 단축키 리스너 + SearchModal 렌더

---

### Phase 4 — 날짜 속성 + 타임라인 뷰
**목표:** 간트 차트 스타일 타임라인

**Supabase SQL 마이그레이션:**
```sql
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS priority smallint DEFAULT 0;
  -- priority: 0=없음, 1=낮음, 2=중간, 3=높음
```

**구현 목록:**
1. **`ItemDetailPanel.jsx`** 수정 — 시작일/마감일 DatePicker, 우선순위 선택 추가
2. **`KanbanCard.jsx`** 수정 — 날짜/우선순위 표시 추가
3. **`src/components/TimelineView.jsx`** 신규
   ```
   ┌────────────────┬──────────────────────────────┐
   │ 아이템 목록    │ 1월  2월  3월  4월  5월       │
   │ (왼쪽 고정)    │                              │
   ├────────────────┼──────────────────────────────┤
   │ 기획 Phase     │    ████████████              │
   │  - 요구사항    │    ████                      │
   └────────────────┴──────────────────────────────┘
   ```
   - DnD Kit으로 간트 바 드래그 (날짜 이동)
   - 바 오른쪽 끝 드래그로 기간 연장
   - 오늘 날짜 수직선
   - 줌: 주/월/분기 전환
   - **라이브러리 없이 CSS Grid + DnD Kit으로 직접 구현**
4. **`KanbanBoard.jsx`** — `timeline` 뷰 추가

---

### Phase 5 — 사이드바 + 무한 중첩 페이지 ⚠️ 가장 큰 변경
**목표:** 왼쪽 사이드바 + 페이지 트리 네비게이션

**Supabase SQL 마이그레이션:**
```sql
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS parent_item_id uuid REFERENCES items(id),
  ADD COLUMN IF NOT EXISTS page_type text DEFAULT 'task';
  -- 'task': 기존 칸반 카드
  -- 'page': 문서 페이지
  -- 'board': 내장 칸반 보드

CREATE INDEX IF NOT EXISTS items_parent_idx ON items(parent_item_id);
```

**구현 목록:**
1. **`src/components/Sidebar.jsx`** 신규
   ```
   ┌──────────────────┐
   │ 🏠 메인 보드     │
   │ 👥 피플 보드     │
   │ ──────────────── │
   │ 📁 기획 (섹션)   │
   │   📋 요구사항    │  ← Project(Phase)
   │     📄 API 설계  │  ← Item(Page)
   │       📄 인증    │  ← Sub-item
   │   📋 디자인      │
   │ 📁 개발          │
   │ + 새 페이지      │
   └──────────────────┘
   ```
   - 트리 접기/펼치기
   - 드래그로 순서 변경
2. **`src/hooks/usePageTree.js`** 신규 — 재귀적 트리 구조 빌더
3. **`kanbanAPI.js`** 수정 — `getPageChildren(parentId)`, `createChildPage(parentId, title)` 추가
4. **`ItemDetailPanel.jsx`** 수정 — 하위 페이지 목록 섹션 추가
5. **`App.jsx`** 수정 — 사이드바 포함 레이아웃으로 전체 구조 변경
6. **`useUrlState.js`** 수정 — `pageId` 파라미터 추가

**주의:** `onBreadcrumbNavigate` 콜백이 ItemDetailPanel에 이미 있음 — 활용할 것

---

### Phase 6 — @멘션 + Google Chat 알림
**목표:** 댓글에서 @이름 → 구글챗 DM 알림

**설치할 패키지:**
```bash
yarn add @tiptap/extension-mention
```

**구현 목록:**
1. **`TiptapEditor.jsx`** 수정 — Mention extension 추가
   - `@` 입력 → profiles 테이블에서 팀원 자동완성
   - 저장 시 멘션 대상 추출
2. **`server/index.js`** 수정 — `/api/notify` 엔드포인트 추가
   - 기존 `google-chat-bot/lib/` 코드 재활용
3. **`CommentSection.jsx`** 수정 — 댓글 저장 시 멘션 파싱 → notify API 호출

---

### Phase 7 — 커스텀 속성 시스템 (장기)
**목표:** 각 팀이 자체 필드 정의 (노션 DB 속성)

**Supabase SQL 마이그레이션:**
```sql
CREATE TABLE IF NOT EXISTS item_properties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  board_type text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  -- 'text'|'number'|'date'|'select'|'multi_select'|'person'|'url'|'formula'
  options jsonb,        -- select 타입 선택지
  formula text,         -- formula 타입 계산식
  order_index int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_property_values (
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  property_id uuid REFERENCES item_properties(id) ON DELETE CASCADE,
  value jsonb,
  PRIMARY KEY (item_id, property_id)
);
```

---

## ⚠️ 작업 시 주의사항

1. **DnD와 클릭 이벤트 충돌** — 항상 `onPointerDown={stopProp}` 패턴 사용
2. **Tiptap StarterKit** — 마크다운 InputRules 이미 내장. `#`→H1, `- `→리스트, `**`→Bold 동작함
3. **Supabase Realtime** — `useKanbanData.js`에 이미 구독 설정됨. 새 테이블 추가 시 채널 추가 필요
4. **다크모드** — 모든 신규 컴포넌트에 `dark:` prefix 필수. 라이트/다크 모두 테스트
5. **isReadOnly** — 비로그인 사용자 읽기 전용 처리. 모든 수정 UI에 `{!isReadOnly && ...}` 적용
6. **board_type** — `'main'|'개발팀'|'AI팀'|'지원팀'` 4가지. 새 뷰 추가 시 `constants.js`도 수정
7. **파일 서버** — Express(3001)가 별도 실행되어야 파일 업로드 동작. `yarn dev:all`로 같이 실행
8. **Ollama** — AI 요약은 로컬 Ollama 필요. 없으면 503 반환 (정상 동작)
9. **TypeScript 미사용** — 현재 순수 JS. 새 파일도 `.jsx`/`.js`로 작성
10. **CSS 방식** — Tailwind v4 유틸리티 클래스. 별도 CSS 파일 최소화

---

## 💡 바이브코딩 팁

- **한 Phase씩** 요청하는 게 좋음 (컨텍스트 오버 방지)
- **`yarn dev:all` 실행 상태**에서 작업하면 즉시 확인 가능
- **Supabase 마이그레이션 SQL**은 Claude Code가 작성 → 대시보드에서 직접 실행
- **기존 패턴 유지:** 새 컴포넌트는 기존 `onShowToast`, `onShowConfirm` 패턴 따를 것
- **커밋 단위:** Phase 하나 완료 시 커밋 권장

---

## 🎯 현재 우선순위

**지금 당장 시작:**
1. Phase 1 — 슬래시 커맨드 + Callout/Toggle 블록
2. Phase 2 — 필터/정렬/그룹화

**다음:**
3. Phase 3 — Cmd+K 검색
4. Phase 4 — 타임라인 뷰

**나중에:**
5. Phase 5 — 사이드바 + 페이지 트리 (아키텍처 대변경)
6. Phase 6 — 멘션 + 알림
7. Phase 7 — 커스텀 속성 시스템
