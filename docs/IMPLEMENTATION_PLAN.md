# Quazar Roadmap — 구현 계획서

> 작성일: 2026-03-28
> 목표: Notion의 모든 핵심 기능 + 회사 커스텀 + 추가 기능

---

## 🛠️ 도구 선택: Claude Code vs Claude Desktop (Cowork)

### ✅ 결론: **Claude Code (CLI)** 강력 추천

| 항목 | Claude Code | Claude Desktop |
|------|------------|---------------|
| 여러 파일 동시 수정 | ✅ 한번에 처리 | ❌ 파일 하나씩 |
| npm 패키지 설치 | ✅ 직접 실행 | ❌ 불가 |
| 개발 서버 실행/확인 | ✅ 터미널 직접 | ❌ 불가 |
| 에러 발생시 즉시 수정 | ✅ 로그 보고 fix | ❌ 불가 |
| Git 커밋 | ✅ 자동 처리 | ❌ 불가 |
| DB 마이그레이션 확인 | ✅ 쿼리 실행 가능 | ❌ 불가 |
| 대형 파일 컨텍스트 | ✅ 전체 코드베이스 인식 | 제한적 |

**바이브코딩 = "이 기능 만들어줘" → AI가 코드 작성 + 실행 + 에러 수정 + 반복**
이 사이클 전체가 터미널 없이는 불가능해요. Claude Code가 압도적.

### 사용 방법
```bash
# 프로젝트 폴더에서
cd quazar-roadmap-main
claude  # Claude Code 실행

# 또는 특정 파일 컨텍스트로
claude --add-dir src/
```

**팁:** 각 Phase 시작 전에 이 계획서를 Claude Code에 붙여넣고 "Phase N 구현해줘"라고 하면 됨.

---

## 📊 현재 코드베이스 완전 분석

### 아키텍처

```
quazar-roadmap-main/
├── src/
│   ├── App.jsx                    # 인증 라우팅 (loading → setup → board)
│   ├── components/
│   │   ├── KanbanBoard.jsx        # ⭐ 메인 허브 (32KB, 가장 복잡)
│   │   ├── ProjectColumn.jsx      # Phase 컬럼 (드래그 가능)
│   │   ├── KanbanCard.jsx         # 개별 카드
│   │   ├── ItemDetailPanel.jsx    # 슬라이드 패널 (상세 보기)
│   │   ├── TiptapEditor.jsx       # 리치텍스트 에디터
│   │   ├── BoardSection.jsx       # 섹션 그룹핑
│   │   ├── PeopleBoard.jsx        # 팀원 뷰
│   │   ├── CommentSection.jsx     # 댓글 섹션
│   │   ├── Comment.jsx            # 개별 댓글
│   │   ├── FileUploadButton.jsx   # 파일 업로드
│   │   ├── Auth/LoginForm.jsx     # 로그인
│   │   ├── Auth/SetupProfileForm.jsx  # 최초 프로필 설정
│   │   └── UI/Feedback.jsx        # Toast, ConfirmModal, InputModal
│   ├── hooks/
│   │   ├── useKanbanData.js       # ⭐ 전체 데이터 상태 (useReducer)
│   │   ├── useAuth.js             # Supabase 인증
│   │   ├── usePeopleData.js       # People 뷰 데이터
│   │   └── useUrlState.js         # URL 기반 상태 (view, item, fullscreen)
│   ├── api/
│   │   ├── kanbanAPI.js           # Supabase CRUD 전체
│   │   ├── fileAPI.js             # 파일 업/다운로드
│   │   └── summarizeAPI.js        # AI 요약 (Ollama 호출)
│   └── lib/
│       ├── constants.js           # TEAMS, GLOBAL_TAGS, STATUS_MAP, PROJECT_TINTS
│       └── supabase.js            # Supabase 클라이언트
├── server/
│   └── index.js                   # Express 서버 (포트 3001)
│                                  # - 파일 업로드/삭제
│                                  # - Ollama AI 요약 (/api/summarize)
└── google-chat-bot/               # 구글챗 봇 (포트 3002)
    ├── index.js                   # 웹훅 엔트리포인트
    └── handlers/
        ├── query.js               # 조회 핸들러
        └── action.js              # 액션 핸들러
```

### 현재 DB 스키마

```sql
-- 보드 컬럼 (Phase)
projects (
  id uuid PRIMARY KEY,
  title text,
  order_index int,
  board_type text,          -- 'main' | '개발팀' | 'AI팀' | '지원팀'
  assignees text[],
  section_id uuid REFERENCES sections(id)
)

-- 카드 (Item)
items (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects(id),
  title text,
  content text,             -- 부제목/요약
  description text,         -- HTML (Tiptap 에디터 내용)
  status text,              -- 'none' | 'in-progress' | 'done'
  teams text[],
  assignees text[],
  tags text[],
  related_items uuid[],
  order_index int,
  ai_summary jsonb
)

-- 섹션 그룹
sections (
  id uuid PRIMARY KEY,
  board_type text,
  title text,
  order_index int
)

-- 댓글
comments (
  id uuid PRIMARY KEY,
  item_id uuid REFERENCES items(id),
  user_id uuid REFERENCES profiles(id),
  content text,
  created_at timestamptz
)

-- 사용자 프로필
profiles (
  id uuid PRIMARY KEY,
  name text,
  department text,
  updated_at timestamptz
)
```

### 현재 기능 현황

| 기능 | 상태 | 비고 |
|------|------|------|
| 칸반 보드 (다중 뷰) | ✅ 완성 | main, 팀별, people |
| 드래그&드롭 | ✅ 완성 | 컬럼, 카드, 섹션 |
| 리치텍스트 에디터 | ⚠️ 기본 완성 | 툴바 방식, 슬래시 커맨드 없음 |
| AI 요약 (Ollama) | ✅ 완성 | 로컬 qwen2.5:14b |
| 댓글 시스템 | ✅ 완성 | 작성/수정/삭제 |
| 파일 첨부 | ✅ 완성 | 이미지, PDF, DOCX (10MB) |
| 태그 / 팀 / 담당자 | ✅ 완성 | 하드코딩된 상수 |
| 연관 업무 (Relations) | ✅ 완성 | uuid 배열 기반 |
| 다크모드 | ✅ 완성 | next-themes |
| Supabase 실시간 | ✅ 완성 | projects, items, comments 구독 |
| URL 딥링크 | ✅ 완성 | view, item, fullscreen |
| 구글챗 봇 | ✅ 완성 | 조회/액션 핸들러 |
| 보드 섹션 | ✅ 완성 | 최근 구현됨 |
| 필터/정렬/그룹화 | ❌ 없음 | |
| 슬래시 커맨드 | ❌ 없음 | |
| Callout/Toggle 블록 | ❌ 없음 | |
| 블록 드래그 핸들 | ❌ 없음 | |
| 타임라인/간트 뷰 | ❌ 없음 | 날짜 필드도 없음 |
| 전체 텍스트 검색 | ❌ 없음 | |
| 무한 중첩 페이지 | ❌ 없음 | |
| @멘션 + 알림 | ❌ 없음 | |
| 캘린더 뷰 | ❌ 없음 | |
| 커스텀 속성 | ❌ 없음 | |

---

## 🗺️ 구현 로드맵

---

## Phase 1 — 에디터 개선 (Notion 블록 에디터)

**예상 작업량:** 중 (3~5일)
**임팩트:** 매우 높음 — 매일 쓰는 기능이라 체감 변화 가장 큼

### 현재 문제점

`TiptapEditor.jsx`가 툴바 버튼 방식으로 동작해. 노션처럼 텍스트만 치다가 `#` 입력하면 H1이 되는 방식은 이미 StarterKit에 InputRule로 내장되어 있어서 동작은 함. 근데:
- 슬래시(`/`) 커맨드 없음
- Callout 블록 없음
- Toggle (접기) 블록 없음
- 코드 블록 문법 하이라이팅 없음
- 블록 왼쪽 드래그 핸들 없음
- 에디터 폭 너무 좁음 (툴바가 공간 차지)

### 설치할 패키지

```bash
npm install @tiptap/suggestion
npm install lowlight @tiptap/extension-code-block-lowlight
npm install tippy.js
```

### 수정/생성 파일

**`src/components/TiptapEditor.jsx` — 주요 개편**

1. **슬래시 커맨드** 추가
   - `/` 입력시 팝업 메뉴 등장
   - 선택지: 텍스트, 제목1/2/3, 불릿리스트, 번호리스트, 체크리스트, 코드블록, 인용구, 구분선, Callout, Toggle, 표

2. **Callout 블록** 추가 (Custom Tiptap Node)
   ```
   💡 [아이콘 선택] [텍스트...]
   배경색 있는 강조 블록
   ```

3. **Toggle 블록** 추가 (Custom Tiptap Node)
   ```
   ▶ 클릭하면 펼쳐지는 제목
     숨겨진 내용...
   ```

4. **코드 블록 하이라이팅**
   - `@tiptap/extension-code-block-lowlight` 교체
   - 언어 선택 드롭다운 추가

5. **툴바 노션화**
   - 기존 상단 고정 툴바 → 텍스트 선택시 나타나는 **플로팅 툴바**로 변경
   - 슬래시 커맨드가 생기면 고정 툴바 불필요

6. **마크다운 인풋룰 보완**
   - `#` → H1, `##` → H2, `###` → H3 ✅ (StarterKit 기본 포함)
   - `-` + 스페이스 → 불릿리스트 ✅
   - `1.` + 스페이스 → 번호리스트 ✅
   - `> ` → 인용구 ✅
   - ` ``` ` → 코드블록 ✅
   - `---` → 구분선 ✅
   - `**굵게**` → **굵게** ✅
   - `_기울임_` → *기울임* ✅
   - `[ ]` → 체크박스 (TodoList extension 추가 필요)

### Claude Code 프롬프트 예시

```
TiptapEditor.jsx를 노션 스타일로 개편해줘.
1. 상단 고정 툴바를 텍스트 선택시 나타나는 BubbleMenu로 바꿔
2. / 슬래시 커맨드 메뉴 추가 (텍스트, 제목1/2/3, 리스트, 코드, 인용, 구분선, 표)
3. Callout 블록 Custom Node 만들어 (💡 아이콘 + 배경색)
4. Toggle 블록 Custom Node 만들어 (클릭하면 펼치기/접기)
5. code-block-lowlight로 코드 하이라이팅 추가
기존 파일 업로드, 이미지 리사이즈 기능은 유지해줘
```

---

## Phase 2 — 필터/정렬/그룹화

**예상 작업량:** 소~중 (1~2일)
**임팩트:** 높음 — 아이템이 많아질수록 필수

### 아키텍처 결정

DB 변경 없이 **프론트엔드 필터링**으로 구현.
URL 상태에 필터 조건 저장 → 링크 공유 가능.

### 새로 생성할 파일

**`src/components/FilterBar.jsx`**
```
[🔍 검색...] [상태▼] [담당자▼] [태그▼] [팀▼] [정렬: 순서▼] [그룹화: 없음▼] [필터 초기화×]
```

**`src/hooks/useFilters.js`**
- 필터 상태 관리
- `useUrlState`와 연동 (URL에 필터 저장)
- 필터링 로직:
  ```javascript
  // 예시 필터 구조
  {
    search: '',
    status: [],           // ['none', 'in-progress', 'done']
    assignees: [],        // ['박형우', '홍길동']
    tags: [],             // ['AI 핵심', 'B2B']
    teams: [],            // ['개발팀', 'AI팀']
    sort: 'order',        // 'order' | 'title' | 'status' | 'created_at'
    groupBy: 'none',      // 'none' | 'status' | 'team' | 'assignee'
  }
  ```

### 수정할 파일

**`src/hooks/useUrlState.js`**
- `filters` 파라미터 추가
- JSON 직렬화로 URL에 저장

**`src/components/KanbanBoard.jsx`**
- FilterBar 렌더링 추가 (네비게이션 아래)
- 필터된 아이템 수 표시 ("23개 중 5개 표시 중")

**`src/components/ProjectColumn.jsx`**
- `filteredItems` props 받아서 렌더링
- 그룹화 모드에서는 가상 컬럼 렌더링

### 그룹화 구현 방식

```javascript
// 그룹화 = 없음: 기존 칸반 뷰 유지
// 그룹화 = 상태별: 3개의 가상 컬럼 (미지정/진행중/완료)
//   → 실제 데이터 구조 변경 없이 아이템을 다시 그룹핑해서 렌더링
// 그룹화 = 담당자별: 담당자 수만큼 가상 컬럼
```

### Claude Code 프롬프트 예시

```
칸반 보드에 필터/정렬/그룹화 기능 추가해줘.

1. FilterBar.jsx 컴포넌트 새로 만들어:
   - 텍스트 검색 (title, content 기준)
   - 상태 다중 선택 (none/in-progress/done)
   - 담당자 다중 선택 (현재 아이템들의 assignees 기반 동적 생성)
   - 태그 다중 선택 (GLOBAL_TAGS 기반)
   - 팀 다중 선택 (TEAMS 기반)
   - 정렬: 순서대로/제목순/생성일순
   - 그룹화: 없음/상태별/담당자별

2. useFilters.js 훅 만들어서 필터 상태 관리, useUrlState와 연동해줘

3. KanbanBoard.jsx에 FilterBar 추가, ProjectColumn에 필터된 아이템 전달

기존 selectedTeam, selectedTag, selectedStatus 하이라이팅 로직은 FilterBar로 통합해줘
```

---

## Phase 3 — 날짜 속성 + 타임라인/간트 뷰

**예상 작업량:** 중~대 (3~5일)
**임팩트:** 높음 — 로드맵 툴의 핵심 기능

### DB 마이그레이션

```sql
-- Supabase SQL Editor에서 실행
ALTER TABLE items
  ADD COLUMN start_date DATE,
  ADD COLUMN end_date DATE;

-- 인덱스 (타임라인 쿼리 최적화)
CREATE INDEX items_start_date_idx ON items(start_date) WHERE start_date IS NOT NULL;
CREATE INDEX items_end_date_idx ON items(end_date) WHERE end_date IS NOT NULL;
```

### 설치할 패키지

```bash
# 옵션 1: 직접 구현 (DnD Kit 기반, 더 자유로운 커스텀)
# 추가 패키지 없음

# 옵션 2: 라이브러리 사용
npm install @dhtmlx/gantt  # 강력하지만 무거움
# 또는
npm install react-gantt-timeline  # 가벼움
```

**추천: 직접 구현** — 이미 DnD Kit이 있고, 디자인 커스텀이 필요하기 때문

### 새로 생성할 파일

**`src/components/TimelineView.jsx`**
```
[← 이전달] [2026년 3월] [다음달 →]   [주간▼]

아이템명              | Jan | Feb | Mar | Apr | May | Jun |
──────────────────────┼─────────────────────────────────────
프로젝트 분리          |     |  ████████████              |
스프링부트 마이그레이션 |          |  ██████████████████   |
AI 모델 통합           |               |  ████████          |

└ 드래그로 날짜 조정, 끝 드래그로 기간 조정
```

**`src/components/DatePicker.jsx`**
- 시작일/종료일 선택 UI
- `ItemDetailPanel`에서 사용

### 수정할 파일

**`src/api/kanbanAPI.js`**
- `getBoardData`에 `start_date`, `end_date` 컬럼 추가
- `addItem`, `updateItem` 파라미터에 날짜 포함

**`src/components/ItemDetailPanel.jsx`**
- 속성 섹션에 시작일/종료일 DatePicker 추가
- 📅 아이콘과 함께 표시

**`src/components/KanbanBoard.jsx`**
- `DISPLAY_BOARDS`에 `'timeline'` 추가
- 타임라인 뷰 렌더링

**`src/hooks/useKanbanData.js`**
- `START_DATE`, `END_DATE` 처리 추가

### Claude Code 프롬프트 예시

```
타임라인(간트) 뷰 추가해줘.

먼저 DB에 아이템 날짜 필드 추가가 필요해:
- items 테이블에 start_date DATE, end_date DATE 컬럼 추가 (Supabase Migration 스크립트 작성)

그 다음 코드:
1. DatePicker.jsx 컴포넌트 만들어 (캘린더 UI, 시작일/종료일 선택)
2. ItemDetailPanel.jsx에 날짜 속성 섹션 추가
3. TimelineView.jsx 만들어:
   - 왼쪽: 아이템 목록 (프로젝트 컬럼 기준 그룹화)
   - 오른쪽: 가로 타임라인 (월/주 단위 스크롤)
   - 날짜 바 드래그로 이동, 끝 드래그로 기간 조정
   - 날짜 없는 아이템은 회색으로 표시
4. KanbanBoard.jsx에 'timeline' 탭 추가

디자인은 현재 다크모드/라이트모드, 색상 시스템 (PROJECT_TINTS) 유지해줘
```

---

## Phase 4 — 전체 텍스트 검색 (Cmd+K)

**예상 작업량:** 소 (1~2일)
**임팩트:** 높음 — 아이템 많아질수록 필수

### DB 설정

```sql
-- Supabase에서 한국어 포함 전문 검색
-- 방법 A: PostgreSQL 내장 (빠르게 구현 가능)
ALTER TABLE items
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(content, '') || ' ' ||
      coalesce(array_to_string(tags, ' '), '') || ' ' ||
      coalesce(array_to_string(assignees, ' '), '')
    )
  ) STORED;

CREATE INDEX items_search_idx ON items USING GIN(search_vector);

-- 방법 B: ILIKE (simpler, no index needed for small datasets)
-- Supabase에서 .ilike() 메서드로 바로 사용 가능
```

**추천: 방법 B(ILIKE)로 시작** → 데이터 많아지면 방법 A로 업그레이드

### 새로 생성할 파일

**`src/components/SearchModal.jsx`**
```
╔══════════════════════════════════════════════╗
║ 🔍  검색...                            ⌘K  ║
╠══════════════════════════════════════════════╣
║ 최근 방문                                    ║
║ > 스프링부트 마이그레이션          개발팀    ║
║ > AI 모델 통합                      AI팀     ║
╠══════════════════════════════════════════════╣
║ 검색 결과                                    ║
║ > [제목] ...일치하는 텍스트...      [팀]    ║
╚══════════════════════════════════════════════╝
```

**`src/api/searchAPI.js`**
```javascript
export async function searchItems(query) {
  const { data, error } = await supabase
    .from('items')
    .select('id, title, content, tags, assignees, project_id')
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .limit(20);
  return data;
}
```

### 수정할 파일

**`src/components/KanbanBoard.jsx`**
```javascript
// Cmd+K 단축키 리스너 추가
useEffect(() => {
  const handler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setShowSearch(true);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### Claude Code 프롬프트 예시

```
Cmd+K 전체 검색 기능 추가해줘.

1. SearchModal.jsx 만들어:
   - Cmd+K (Mac) / Ctrl+K (Windows) 단축키로 열기
   - 입력하면 Supabase에서 실시간 검색 (300ms 디바운스)
   - 결과: 아이템 제목, 소속 프로젝트, 팀, 태그 표시
   - 키보드 ↑↓로 결과 탐색, Enter로 해당 아이템 열기
   - ESC로 닫기
   - 검색어 없을 때: 최근 열었던 아이템 표시 (localStorage에 기록)

2. searchAPI.js 만들어 (Supabase .ilike() 사용)

3. KanbanBoard.jsx에 단축키 리스너 + SearchModal 추가

현재 다크모드 스타일 유지해줘
```

---

## Phase 5 — 무한 중첩 페이지 (서브 아이템)

**예상 작업량:** 대 (5~7일)
**임팩트:** 매우 높음 — 노션의 핵심 구조

### 설계 방향

**Approach A: 아이템에 부모-자식 관계 추가** (추천)
- 기존 `items` 테이블 구조 유지
- `parent_item_id` 컬럼만 추가
- 이미 `onBreadcrumbNavigate` 콜백이 `ItemDetailPanel`에 있음

**Approach B: 별도 `pages` 테이블** — 오버엔지니어링, 나중에

### DB 마이그레이션

```sql
-- 아이템에 부모 참조 추가
ALTER TABLE items
  ADD COLUMN parent_item_id UUID REFERENCES items(id) ON DELETE CASCADE;

-- 중첩 깊이 제한 없음 (재귀 쿼리로 전체 트리 조회 가능)
-- 인덱스
CREATE INDEX items_parent_id_idx ON items(parent_item_id);

-- 재귀 조회 함수 (선택사항, 깊은 중첩시 성능 개선)
CREATE OR REPLACE FUNCTION get_item_tree(root_id UUID)
RETURNS TABLE(id UUID, parent_item_id UUID, title TEXT, depth INT) AS $$
  WITH RECURSIVE tree AS (
    SELECT id, parent_item_id, title, 0 as depth FROM items WHERE id = root_id
    UNION ALL
    SELECT i.id, i.parent_item_id, i.title, t.depth + 1
    FROM items i JOIN tree t ON i.parent_item_id = t.id
  )
  SELECT * FROM tree;
$$ LANGUAGE SQL;
```

### 새로 생성할 파일

**`src/components/Sidebar.jsx`**
```
╔═══════════════════╗
║ QUAZAR            ║
╠═══════════════════╣
║ 📋 메인 보드       ║
║ 👥 피플           ║
║ 📅 타임라인        ║
╠═══════════════════╣
║ 📄 페이지 트리     ║
║  └ 스프링부트 마이그 ║
║    └ API 정리      ║
║    └ DB 설계       ║
║  └ AI 모델 통합    ║
╚═══════════════════╝
```

**`src/components/SubItemsSection.jsx`**
- `ItemDetailPanel` 안에서 서브 아이템 목록 표시
- 서브 아이템 추가/열기/삭제
- 체크박스로 완료 표시

**`src/hooks/useItemTree.js`**
- 재귀 아이템 데이터 관리

### 수정할 파일

**`src/api/kanbanAPI.js`**
- `getBoardData`에서 루트 아이템만 가져오기 (`parent_item_id IS NULL`)
- `getChildItems(parentId)` 함수 추가
- `addItem`에 `parentItemId` 파라미터 추가

**`src/components/ItemDetailPanel.jsx`**
- `SubItemsSection` 컴포넌트 추가 (댓글 섹션 위에)
- 브레드크럼 네비게이션 개선 (이미 `onBreadcrumbNavigate` 있음)
  ```
  메인 보드 > 스프링부트 마이그레이션 > API 정리
  ```

**`src/components/KanbanBoard.jsx`**
- 사이드바 레이아웃 추가
- `flex-row` 구조: `<Sidebar /> <main board />`

**`src/hooks/useKanbanData.js`**
- `parent_item_id` 처리
- 서브 아이템 CRUD 액션 추가

### Claude Code 프롬프트 예시

```
무한 중첩 아이템(서브 페이지) 기능 추가해줘.

DB 변경:
- items 테이블에 parent_item_id UUID REFERENCES items(id) 컬럼 추가
- Migration SQL 스크립트 만들어줘

코드:
1. kanbanAPI.js에 addChildItem(parentId, title), getChildItems(parentId) 추가
2. ItemDetailPanel.jsx에 SubItemsSection 추가:
   - 서브 아이템 목록 (제목, 상태, 담당자 표시)
   - "+ 서브 아이템 추가" 버튼
   - 각 서브 아이템 클릭시 해당 아이템 detail 열기
   - 브레드크럼 네비게이션: "부모제목 > 현재제목"
3. Sidebar.jsx 만들어:
   - 왼쪽 사이드바 (230px 고정)
   - 뷰 전환 (보드, 피플, 타임라인)
   - 페이지 트리: 서브 아이템 있는 아이템들을 트리 구조로 표시
   - 접기/펼치기
4. KanbanBoard.jsx 레이아웃에 사이드바 추가

칸반 보드에는 루트 아이템만 표시 (parent_item_id IS NULL)
```

---

## Phase 6 — @멘션 + 알림 시스템

**예상 작업량:** 중 (2~4일)
**임팩트:** 중~높음 — 협업 필수

### DB 마이그레이션

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id),  -- 알림 발생 주체
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
  type TEXT NOT NULL,  -- 'mention' | 'comment' | 'status_change' | 'assignee'
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_id_idx ON notifications(user_id, read, created_at DESC);
```

### 설치할 패키지

```bash
npm install @tiptap/extension-mention
```

### 새로 생성할 파일

**`src/components/NotificationBell.jsx`**
- 헤더 우측 상단 🔔 아이콘
- 읽지 않은 수 배지 표시
- 클릭시 알림 목록 팝업

**`src/api/notificationAPI.js`**
- Supabase Realtime 구독
- 알림 읽음 처리

### 수정할 파일

**`src/components/TiptapEditor.jsx`**
```javascript
// @멘션 extension 추가
import Mention from '@tiptap/extension-mention'

const extensions = [
  // ... 기존 extensions
  Mention.configure({
    HTMLAttributes: { class: 'mention' },
    suggestion: {
      items: ({ query }) => {
        return profiles.filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
      },
      render: () => { /* 드롭다운 UI */ }
    }
  })
]
```

**`src/components/KanbanBoard.jsx`**
- NotificationBell 헤더에 추가
- Supabase Realtime notifications 구독

**`google-chat-bot/handlers/`**
- 멘션 알림을 구글챗으로도 전송 (선택)

### Claude Code 프롬프트 예시

```
@멘션 + 알림 시스템 추가해줘.

1. DB: notifications 테이블 생성 SQL 만들어줘
   (user_id, actor_id, item_id, type, read, created_at)

2. TiptapEditor.jsx에 @tiptap/extension-mention 추가:
   - @이름 입력시 팀원 드롭다운 팝업
   - profiles 테이블에서 팀원 목록 가져오기
   - 멘션된 텍스트 파란색 배지로 표시

3. 댓글 저장 시 @멘션된 사용자에게 알림 생성 (kanbanAPI.js addComment 수정)

4. NotificationBell.jsx 만들어:
   - 헤더 우측에 🔔 아이콘
   - 읽지 않은 알림 수 빨간 배지
   - 클릭하면 알림 목록 드롭다운
   - Supabase Realtime으로 실시간 업데이트

기존 CommentSection.jsx 수정 필요할 수 있어
```

---

## Phase 7 — 캘린더 뷰

**예상 작업량:** 중 (2~3일)
**임팩트:** 중 — Phase 3 날짜 속성 있으면 자연스럽게 구현 가능

*Phase 3 완료 후 진행 (날짜 필드 필요)*

### 새로 생성할 파일

**`src/components/CalendarView.jsx`**
```
[← ] [2026년 3월] [ →]

월  화  수  목  금  토  일
                          1
2   3   4   5   6   7   8
        ┌──────────────┐
9   10  │스프링부트 마이 │ 13  14  15
        └──────────────┘
```

- `react-calendar` 또는 직접 구현
- 날짜 칸에 아이템 표시 (end_date 기준)
- 클릭하면 해당 아이템 detail 열기
- 드래그로 날짜 이동

### Claude Code 프롬프트 예시

```
캘린더 뷰 추가해줘 (Phase 3 날짜 필드 있다는 전제).

CalendarView.jsx 만들어:
- 월간 달력 그리드
- 각 날짜에 end_date가 해당 날인 아이템 표시 (팀 컬러 적용)
- 아이템 클릭시 detail 열기
- 월 이동 버튼
- 아이템 없는 날짜 클릭시 해당 날짜로 새 아이템 만들기

KanbanBoard.jsx에 'calendar' 뷰 탭 추가
```

---

## Phase 8 — 커스텀 속성 시스템

**예상 작업량:** 매우 대 (7~14일)
**임팩트:** 매우 높음 — 팀별 맞춤 워크플로우 가능

이게 완성되면 현재 하드코딩된 `status`, `tags`, `teams`, `assignees`를 동적으로 관리 가능.

### DB 마이그레이션

```sql
-- 속성 정의 테이블 (프로젝트별 또는 전역)
CREATE TABLE property_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,  -- null이면 전역
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  -- 'text' | 'number' | 'date' | 'select' | 'multi_select'
  -- | 'person' | 'relation' | 'checkbox' | 'url' | 'email'
  options JSONB DEFAULT '[]',  -- select 타입의 선택지 목록
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 아이템별 속성값
CREATE TABLE item_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  property_id UUID REFERENCES property_definitions(id) ON DELETE CASCADE,
  value JSONB,  -- 모든 타입의 값을 JSON으로 저장
  UNIQUE(item_id, property_id)
);

-- 인덱스
CREATE INDEX item_properties_item_id_idx ON item_properties(item_id);
CREATE INDEX item_properties_property_id_idx ON item_properties(property_id);
```

### 구현 범위

1. **속성 관리 UI** — 프로젝트 설정에서 속성 추가/수정/삭제
2. **속성 렌더링** — `ItemDetailPanel`에서 동적 속성 표시
3. **필터 연동** — 커스텀 속성으로 필터 가능
4. **뷰 연동** — 테이블 뷰에서 컬럼으로 표시

*이건 복잡해서 작은 단계로 나눠서 진행 권장*

---

## Phase 9 — 테이블 뷰 (Database View)

**예상 작업량:** 중~대 (3~5일)
**임팩트:** 높음 — 노션 DB의 핵심

### 새로 생성할 파일

**`src/components/TableView.jsx`**
```
제목            | 상태     | 담당자    | 태그       | 시작일     | 종료일
────────────────┼─────────┼──────────┼───────────┼───────────┼──────────
스프링부트 마이그 | 진행 중  | 박형우   | B2B       | 2026-02-01 | 2026-04-30
AI 모델 통합    | 완료     | 홍길동   | AI 핵심   | 2026-01-15 | 2026-03-01
```

- 컬럼 순서 변경 (드래그)
- 컬럼 너비 조정
- 인라인 편집 (셀 클릭시 바로 수정)
- 새 행 추가
- 컬럼 추가 (커스텀 속성과 연동)

---

## 📋 진행 순서 권장

```
Phase 1 (에디터) → Phase 2 (필터) → Phase 4 (검색) → Phase 3 (타임라인)
→ Phase 5 (중첩 페이지) → Phase 7 (캘린더) → Phase 6 (알림)
→ Phase 9 (테이블) → Phase 8 (커스텀 속성)
```

**이유:**
- Phase 1,2,4는 기존 DB 변경 없이 바로 가능 → 빠른 성과
- Phase 3은 날짜 필드 추가 필요 (DB 변경)
- Phase 5는 아키텍처 변경이 크니 Phase 1~4 먼저 안정화 후 진행
- Phase 8 (커스텀 속성)은 가장 복잡해서 마지막

---

## 🧠 바이브코딩 팁

### Claude Code 효과적으로 사용하기

**1. 컨텍스트 주기**
```
# 프로젝트 시작 전 한번 실행
claude --add-dir src/ --add-file package.json
```

**2. 한번에 너무 많이 요청하지 않기**
```
❌ "Phase 1부터 Phase 5까지 다 구현해줘"
✅ "TiptapEditor.jsx에 슬래시 커맨드 추가해줘,
    일단 /텍스트, /제목1, /제목2, /리스트, /코드만 지원하면 됨"
```

**3. 구현 후 바로 테스트 요청**
```
"구현했으면 yarn dev 실행해서 에러 없는지 확인해줘.
 에러 있으면 바로 고쳐줘"
```

**4. 디자인 컨텍스트 명시**
```
"현재 프로젝트의 디자인 시스템:
 - Tailwind CSS
 - 다크모드: dark: prefix
 - 폰트: Pretendard (font-sans)
 - 색상: bg-bg-base, text-text-primary 등 custom CSS vars 사용
 - 컴포넌트 스타일: KanbanCard.jsx 참고"
```

**5. 이 계획서 활용**
```
"IMPLEMENTATION_PLAN.md를 읽고 Phase 2 (필터/정렬/그룹화)를 구현해줘.
 계획서의 '수정할 파일' 섹션에 나온 대로 진행해줘"
```

### 자주 쓰는 Claude Code 명령

```bash
# 특정 파일 먼저 읽히고 시작
/add src/components/KanbanBoard.jsx

# 여러 파일 추가
/add src/

# 실행 중인 에러 붙여넣기
# [에러 메시지 붙여넣기] "이 에러 고쳐줘"
```

---

## 🔧 개발 환경 설정

```bash
# 개발 서버 실행 (프론트 + 백엔드)
yarn dev:all

# 포트 충돌시
yarn dev   # 프론트 :5173
yarn server  # 백엔드 :3001

# 구글챗 봇 (별도 터미널)
cd google-chat-bot && node index.js
```

### 환경 변수 (.env)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b
```

---

*이 계획서는 진행하면서 계속 업데이트 예정*
