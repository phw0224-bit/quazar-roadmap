# Business Rules — 비즈니스 로직

> Quazar Roadmap 핵심 비즈니스 규칙 및 제약사항

---

## board_type 필터링

**규칙:**
- `'main'` — 전사 공유 메인 보드
- `'개발팀'`|`'AI팀'`|`'지원팀'` — 팀별 전용 보드

**구현:**
- KanbanBoard의 `view` prop으로 필터링
- Sidebar에서 보드 전환
- sections, projects, items 모두 동일한 board_type으로 필터

**예외:**
- 페이지 트리는 board_type !== 'main'만 렌더

---

## page_type 구분

**규칙:**
- `null` 또는 `'task'` → 칸반 카드 (보드에 표시)
- `'page'` → 문서 페이지 (사이드바 트리에만 표시)

**구현:**
- `useKanbanData`의 SET_DATA 단계에서 `page_type='page'` 필터링
- 칸반 보드 렌더 시 phases에서 제외
- `usePageTree`는 `page_type='page'`만 모아 트리 구성

**왜:**
- Notion처럼 문서와 작업을 하나의 시스템에서 관리
- 칸반 보드는 작업 위주, 사이드바는 문서 위주

---

## status 상태

**가능한 값:**
- `'none'` → 회색, 미지정
- `'in-progress'` → 파란색, 진행 중
- `'done'` → 초록색 + 취소선, 완료

**UI 규칙:**
- 카드에 상태 뱃지 표시
- done 시 제목에 line-through
- 필터바에서 상태별 필터 지원

---

## order_index 재계산

**규칙:**
- 배열 내 순서는 0부터 연속 (gap 없음)
- 이동 시 영향받는 전체 배열 재계산

**예시:**
```javascript
// Cross-phase 이동
// Source Phase: [A:0, B:1, C:2] → C 제거 → [A:0, B:1]
// Target Phase: [D:0, E:1] → C 삽입(index=1) → [D:0, C:1, E:2]
```

**구현:**
- `kanbanAPI.moveItem()` 내부에서 source/target 배열 모두 갱신
- DB 저장 후 전체 재조회 (Realtime으로 동기화)

---

## assignees 저장 방식

**규칙:**
- **정상 케이스:** `profiles.name` 값 그대로 저장
- **미매칭 케이스:** `'name:{입력값}'` 접두사 추가

**구현:**
```javascript
// 저장 시
if (matchedProfile) {
  assignees.push(profile.name);
} else {
  assignees.push(`name:${inputValue}`);
}

// 조회 시 (getPeopleData)
if (assignee.startsWith('name:')) {
  return { name: assignee.slice(5), isFallback: true };
}
```

**왜:**
- 프로필 없는 외부 협업자도 할당 가능
- 나중에 프로필 생성 시 수동 매핑 필요

---

## related_items 양방향 관리

**규칙:**
- A에 B 추가 시 B에도 A 추가
- 수동 양방향 보정 (DB 트리거 없음)

**구현:**
```javascript
// A에 B 추가
await kanbanAPI.updateItem(phaseA, itemA, {
  related_items: [...itemA.related_items, itemB.id]
});

// B에 A 추가 (별도 호출)
await kanbanAPI.updateItem(phaseB, itemB, {
  related_items: [...itemB.related_items, itemA.id]
});
```

**제약:**
- 현재는 단방향 업데이트만 기본 제공
- 하위 페이지 생성 시에만 양방향 보정

**개선 여지:**
- kanbanAPI.addRelation(itemA, itemB) 헬퍼 추가

---

## 완료 프로젝트 아카이브

**규칙:**
- `is_completed=true` → 보드 하단 "완료된 프로젝트" 분리
- 완료 처리 시 원래 위치 저장 (pre_completion_section_id, pre_completion_order_index)
- 복귀 시 저장된 위치로 복원

**구현:**
```javascript
// 완료 처리
onCompletePhase(phaseId, true, {
  pre_completion_section_id: currentSection,
  pre_completion_order_index: currentIndex
});

// 복귀
onCompletePhase(phaseId, false, {
  section_id: phase.pre_completion_section_id,
  order_index: phase.pre_completion_order_index
});
```

**UI:**
- 메인 보드 하단에 별도 영역
- LocalStorage로 펼침/접힘 상태 유지

---

## sections 삭제

**규칙:**
- section 삭제 시 속한 projects는 삭제하지 않음
- projects.section_id만 null로 변경

**구현:**
```sql
UPDATE projects SET section_id = NULL WHERE section_id = ?;
DELETE FROM sections WHERE id = ?;
```

**UI:**
- section_id=null인 projects는 보드 최상단에 표시

---

## Sidebar 페이지 트리 이동

**규칙:**
- **중앙 드롭** → 자식으로 추가
- **상단/하단 드롭** → 형제로 순서 변경
- **프로젝트 위 드롭** → 루트로 이동 (parent_item_id=null)

**업데이트 필드:**
- parent_item_id (계층)
- project_id (루트 변경 시)
- order_index (순서)

**구현:**
- Sidebar 자체 DnD 핸들러
- `kanbanAPI.updateItemHierarchy()` 호출

---

## created_by / 작성자 표시

**규칙:**
- 아이템 생성 시 로그인 사용자 auth.users.id를 created_by에 저장
- 조회 시 profiles 조인하여 creator_profile 표시

**UI:**
- 작성자 없는 기존 아이템은 표시 안 함
- 카드/상세 패널에 작성자 프로필 아바타

---

## 상세 설명 초기 모드

**규칙:**
- **본문 있음** → preview 모드로 시작
- **빈 본문** → live 모드로 시작

**구현:**
- ItemDescriptionSection에서 description.length 체크
- 읽기 전용(isReadOnly)일 때는 항상 preview

---

## 배열 필드 기본값

**규칙:**
- assignees, teams, tags, related_items 모두 빈 값은 `[]`
- null 불가

**구현:**
```javascript
const updates = {
  assignees: assignees || [],
  teams: teams || [],
  tags: tags || [],
  related_items: related_items || []
};
```

---

## URL 상태 관리

**규칙:**
- 뷰/선택 아이템/필터/정렬을 URL 파라미터로 관리
- React Router 미사용

**형식:**
```
?view=board&item=<uuid>&fullscreen=1&filter=status:done&sort=title:asc
```

**구현:**
- useUrlState 훅
- URLSearchParams로 읽기/쓰기
- pushState로 히스토리 관리

---

## LocalStorage UI 상태

**저장 항목:**
- 섹션 접힘 상태
- 완료 프로젝트 펼침 상태
- 메인 보드 접힘 상태
- 사이드바 열림/닫힘
- 마지막 본 릴리즈 노트 ID

**키 형식:**
```
quazar-roadmap:collapsed-sections
quazar-roadmap:completed-expanded
quazar-roadmap:main-board-collapsed
quazar-roadmap:sidebar-state
quazar-roadmap:last-release-id
```
