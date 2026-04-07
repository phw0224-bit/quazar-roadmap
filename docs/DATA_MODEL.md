# Data Model — 상세 스키마

> Quazar Roadmap 전체 데이터 모델 및 관계

---

## 테이블 구조

### sections
칸반 컬럼을 시각적으로 그룹화

```sql
CREATE TABLE sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_type text NOT NULL,       -- 'main'|'개발팀'|'AI팀'|'지원팀'
  title text NOT NULL,
  order_index int NOT NULL,
  timeline_order_index int,       -- 타임라인 뷰 전용 정렬
  created_at timestamptz DEFAULT now()
);
```

### projects
칸반 컬럼 (Phase). 완료 아카이브 지원

```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  board_type text NOT NULL,
  section_id uuid REFERENCES sections(id),  -- null 허용
  description text,                          -- 프로젝트 개요 (가상 페이지용)
  assignees text[],                          -- profiles.name 배열
  is_completed boolean DEFAULT false,        -- 완료 프로젝트 아카이브
  pre_completion_section_id uuid REFERENCES sections(id),  -- 복귀용
  pre_completion_order_index int,
  order_index int NOT NULL,
  timeline_order_index int,                  -- 타임라인 뷰 전용
  created_at timestamptz DEFAULT now()
);
```

### items
칸반 카드 또는 문서 페이지

```sql
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  parent_item_id uuid REFERENCES items(id),   -- 중첩 페이지용 자기참조
  title text NOT NULL,
  content text,                               -- 카드 부제목
  description text,                           -- Tiptap HTML 본문
  status text DEFAULT 'none',                 -- 'none'|'in-progress'|'done'
  priority smallint DEFAULT 0,                -- 0=없음 1=낮음 2=중간 3=높음
  page_type text,                             -- null/'task'=카드, 'page'=문서
  assignees text[],                           -- profiles.name 배열
  teams text[],                               -- TEAMS 상수의 name 값
  tags text[],
  related_items uuid[],                       -- 관계 아이템 (수동 양방향)
  ai_summary jsonb,                           -- {summary, blocks, generatedAt}
  files jsonb,                                -- [{url, filename, ...}]
  start_date date,
  end_date date,
  order_index int,
  timeline_order_index int,                   -- 타임라인 뷰 전용
  created_by uuid REFERENCES auth.users(id),  -- 생성자
  created_at timestamptz DEFAULT now()
);
```

**ai_summary 구조:**
```json
{
  "summary": ["요약 문장 1", "요약 문장 2"],
  "blocks": [
    { "id": "ai-block-0", "summary": "블록 0 요약" },
    { "id": "ai-block-1", "summary": "블록 1 요약" }
  ],
  "generatedAt": "2026-04-03T12:00:00Z"
}
```

**files 구조:**
```json
[
  {
    "url": "/uploads/item-uuid/file.pdf",
    "filename": "file.pdf",
    "originalName": "원본파일.pdf",
    "mimetype": "application/pdf",
    "size": 123456
  }
]
```

### comments
아이템별 댓글

```sql
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### profiles
사용자 프로필 (auth.users 확장)

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text,
  department text,
  updated_at timestamptz DEFAULT now()
);
```

---

## 필드 상세

### board_type
- `'main'` — 전사 공유 메인 보드
- `'개발팀'`|`'AI팀'`|`'지원팀'` — 팀별 전용 보드
- sections, projects, items 모두 이 필드로 필터링

### page_type
- `null` 또는 `'task'` → 칸반 카드 (보드에 표시)
- `'page'` → 문서 페이지 (사이드바 트리에만 표시)

### order_index
- 각 컬렉션 내 정렬 순서 (0부터 연속)
- 이동 시 영향받는 배열 전체 재계산

### timeline_order_index
- 타임라인 뷰 전용 정렬
- 보드 order_index와 독립

### assignees / teams / tags
- 모두 `text[]` 타입
- assignees: profiles.name 값 직접 저장, 미매칭 시 `'name:{값}'`
- teams: TEAMS 상수의 name 값
- tags: 자유 입력

### related_items
- 양방향 수동 관리 (A→B 추가 시 B→A도 추가)
- parent_item_id (계층)와 별개

### is_completed (projects)
- true → 보드 하단 "완료된 프로젝트" 영역 분리
- pre_completion_* 에 복귀 위치 저장

---

## 관계

```
sections (1) ──→ (N) projects (section_id)
projects (1) ──→ (N) items (project_id)
items (1) ──→ (N) items (parent_item_id, 자기참조)
items (1) ──→ (N) comments (item_id)
auth.users (1) ──→ (1) profiles (id)
auth.users (1) ──→ (N) comments (user_id)
auth.users (1) ──→ (N) items (created_by)
```

---

## 인덱스 (권장)

```sql
CREATE INDEX idx_sections_board ON sections(board_type, order_index);
CREATE INDEX idx_projects_board ON projects(board_type, order_index);
CREATE INDEX idx_projects_section ON projects(section_id);
CREATE INDEX idx_items_project ON items(project_id, order_index);
CREATE INDEX idx_items_parent ON items(parent_item_id);
CREATE INDEX idx_items_page_type ON items(page_type);
CREATE INDEX idx_comments_item ON comments(item_id, created_at DESC);
```

---

## 제약 조건

- sections/projects 삭제 시 연결된 하위 항목들의 외래키는 null 허용
- items 삭제 시 comments는 CASCADE 삭제
- assignees/teams/tags는 빈 배열 [] (null 불가)
- order_index는 0부터 연속 (gap 없음)
