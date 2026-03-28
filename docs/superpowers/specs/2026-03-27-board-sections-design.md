# 하위 보드 섹션 기능 설계 스펙

**날짜**: 2026-03-27
**상태**: 승인됨

---

## 배경 및 목적

현재 개발팀 보드에 "프로젝트 분리", "스프링부트 마이그레이션" 등 큰 흐름들이 같은 레벨에 나열되어 있어 맥락 파악이 어렵다. 보드 내부에 섹션(그룹)을 만들어 관련 프로젝트를 묶고, 필요 시 접어서 가릴 수 있도록 한다.

모든 보드(main, 개발팀, AI팀, 지원팀 등)에서 사용 가능하며, 섹션 없이 보드에 직접 붙어있는 프로젝트도 허용한다.

---

## 계층 구조

```
보드 (개발팀 보드)
├── 섹션 없는 프로젝트 (section_id = null)
│   └── 기타, 관리대장 등
└── 섹션 (마이그레이션)
    ├── 프로젝트 (프로젝트 분리)
    │   ├── AI팀이랑 겹치는 부분
    │   └── 백엔드 기능별 api 정리
    └── 프로젝트 (스프링부트 마이그레이션)
        └── ...
```

---

## DB 스키마

### 새 테이블: `sections`

```sql
CREATE TABLE sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_type  TEXT NOT NULL,
  title       TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `projects` 테이블 변경

```sql
ALTER TABLE projects
  ADD COLUMN section_id UUID REFERENCES sections(id) ON DELETE SET NULL;
```

- `section_id = null` → 보드에 직접 소속 (섹션 없음)
- `section_id = <uuid>` → 해당 섹션 소속

---

## 데이터 흐름

### 로드 (`getBoardData`)

```
sections 테이블 로드 (board_type별, order_index 순)
projects 테이블 로드 (section_id 포함)
items, comments 기존과 동일

반환 구조:
{
  phases: [...],    // 기존 projects (section_id 필드 포함)
  sections: [...],  // 새로 추가
}
```

### State 구조 (`useKanbanData`)

```javascript
{
  phases: Phase[],      // 기존 유지
  sections: Section[],  // 새로 추가
  loading: boolean,
  error: string | null,
}

Section {
  id: string,
  board_type: string,
  title: string,
  order_index: number,
}
```

---

## UI 구조

### 각 보드 내 렌더링 순서

1. **섹션 없는 프로젝트** (`section_id = null`) — 보드 상단에 기존 방식대로 가로 나열
2. **섹션들** — 순서(order_index)대로 세로로 쌓임, 각 섹션 내부에 프로젝트 가로 나열

### 섹션 헤더 UI

```
▼ [섹션 이름]   [N 프로젝트]   [+ 프로젝트 추가]   [⋯ 메뉴]
```

- 접기/펼치기: `▼` / `▶` 토글
- 메뉴(⋯): 이름 수정, 삭제
- 삭제 시: 소속 프로젝트의 `section_id → null` (프로젝트는 보존, 보드 직속으로 이동)

### 보드 하단 버튼

```
[+ 새 섹션 추가]   [+ 새 프로젝트 추가]
```

### 접기 상태

- `useState<Set<string>>` — 브라우저 session 동안만 유지, DB 저장 없음
- 기본값: 모두 펼쳐짐

---

## 새 컴포넌트: `BoardSection.jsx`

**책임:** 섹션 헤더 렌더링 + 내부 프로젝트 목록(SortableContext 포함)

**Props:**
```javascript
{
  section,              // Section 객체
  phases,               // 이 섹션 소속 프로젝트 배열
  isCollapsed,          // boolean
  onToggleCollapse,     // () => void
  onUpdateSection,      // (sectionId, updates) => Promise
  onDeleteSection,      // (sectionId) => Promise
  // ...ProjectColumn에 전달할 props 그대로
}
```

---

## CRUD 연산

| 연산 | API 함수 | DB 동작 |
|------|---------|---------|
| 섹션 생성 | `addSection(boardType, title)` | `INSERT INTO sections` |
| 섹션 수정 | `updateSection(sectionId, updates)` | `UPDATE sections SET title` |
| 섹션 삭제 | `deleteSection(sectionId)` | `DELETE sections` + `UPDATE projects SET section_id=null` |
| 프로젝트 → 섹션 배정 | `updatePhase(projectId, { section_id })` | `UPDATE projects SET section_id` |

---

## 검증 방법

1. 보드에서 "새 섹션 추가" 클릭 → 섹션 헤더 생성 확인
2. 섹션 이름 수정 → 즉시 반영 확인
3. 섹션 접기/펼치기 → 내부 프로젝트 숨김/표시 확인
4. 섹션 삭제 → 소속 프로젝트가 보드 직속으로 이동하는지 확인
5. 기존 프로젝트(section_id=null)가 섹션 없이 정상 표시되는지 확인
6. 여러 보드에서 각각 독립적으로 섹션 생성 가능한지 확인
7. 페이지 새로고침 후 섹션/프로젝트 구조 유지 확인
