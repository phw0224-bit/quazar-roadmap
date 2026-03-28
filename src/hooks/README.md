# hooks/

> 보드 전체 상태를 관리하는 React 훅 모음. 컴포넌트는 이 훅들을 통해서만 데이터를 읽고 씀.

## 책임
- Supabase 데이터 조회 및 실시간 구독
- useReducer 기반 클라이언트 상태 관리
- URL 파라미터 ↔ UI 상태 동기화
- 필터/정렬 로직 (렌더링 레이어에서만 적용, DB 쿼리 변경 없음)

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `useKanbanData.js` | **핵심.** 전체 보드 상태 (phases, sections) + Realtime 구독 + 모든 CRUD 메서드 | kanbanAPI, supabase |
| `useAuth.js` | Supabase Auth 세션 관리, 프로필 초기 설정 플로우 | supabase |
| `useUrlState.js` | URL 파라미터 파싱/직렬화. view/item/filter/sort/group 동기화 | - |
| `useFilterState.js` | 필터 조건 추가/제거, applyFilterSort(), groupItems() 제공 | - |
| `usePageTree.js` | phases+sections를 재귀 트리 구조로 변환. 사이드바 네비게이션용 | - |
| `usePeopleData.js` | 피플 보드 전용 데이터 (팀원별 assigned items) | kanbanAPI |
| `useLayoutState.jsx` | 사이드바 열림/닫힘/hover 상태. Context로 제공, localStorage 영속 | - |

## 패턴 & 규칙

**Optimistic Update:** `dispatch` 먼저, `API 호출` 나중. 실패해도 Realtime이 재동기화.

```javascript
dispatch({ type: 'UPDATE_ITEM', payload: { phaseId, itemId, updates } });
await kanbanAPI.updateItem(phaseId, itemId, updates);
```

**상태 구조 (useKanbanData):**

```javascript
{
  phases: [{
    id, title, order_index, board_type, section_id, assignees: [],
    items: [{ id, title, status, teams, tags, assignees, comments: [...], ... }]
  }],
  sections: [{ id, board_type, title, order_index }],
  loading: boolean,
  error: null | string
}
```

**page_type 필터링:** `useKanbanData`의 SET_DATA reducer에서 `page_type='page'` 아이템은
phases.items에서 제거됨 → 칸반 보드에 문서 페이지가 섞이지 않음.
