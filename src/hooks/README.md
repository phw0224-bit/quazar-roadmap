# hooks/

> 보드 상태, URL 상태, 레이아웃 상태를 컴포넌트에서 분리해 단일 진실 소스와 파생 상태 계산을 유지하는 레이어.

## 책임
- Supabase 데이터 조회 및 실시간 구독
- useReducer 기반 클라이언트 상태 관리
- URL 파라미터 ↔ UI 상태 동기화
- 필터/정렬 로직 (렌더링 레이어에서만 적용, DB 쿼리 변경 없음)
- Sidebar/패널/보드 접힘 상태의 localStorage 영속화

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `useKanbanData.js` | **핵심.** 전체 보드 상태 (projects, sections) + Realtime 구독 + 모든 CRUD 메서드 | kanbanAPI, supabase |
| `useAuth.js` | Supabase Auth 세션 관리, 프로필 초기 설정 플로우 | supabase |
| `useUrlState.js` | URL 파라미터 파싱/직렬화. view/item/filter/sort/group 동기화 | - |
| `useFilterState.js` | 필터 조건 추가/제거, applyFilterSort(), groupItems() 제공 | - |
| `usePresence.js` | Supabase Presence 채널 구독. 접속자 목록과 현재 편집 필드 상태 추적 | supabase |
| `usePresenceContext.jsx` | `usePresence` 결과를 하위 컴포넌트에 공유하는 Context 래퍼 | react |
| `usePageTree.js` | projects+sections를 재귀 트리 구조로 변환. `page_type='page'`만 추려 사이드바 트리 생성 | - |
| `usePeopleData.js` | 피플 보드 전용 데이터 (팀원별 assigned items). 현재는 직접 사용보다 보조 훅 성격 | kanbanAPI |
| `useLayoutState.jsx` | 사이드바 열림/닫힘/너비 상태. Context로 제공, localStorage 영속 | - |

## 패턴 & 규칙

**혼합 업데이트 전략:** 이동/정렬은 optimistic, 일반 수정은 API 성공값 반영.

```javascript
dispatch({ type: 'MOVE_ITEM', payload: { sourceProjectId, targetProjectId, itemId, targetIndex } });
await kanbanAPI.moveItem(sourceProjectId, targetProjectId, itemId, targetIndex);

const updated = await kanbanAPI.updateItem(projectId, itemId, updates);
dispatch({ type: 'UPDATE_ITEM', payload: { projectId, itemId, updates: updated } });
```

**상태 구조 (useKanbanData):**

```javascript
{
  projects: [{
    id, title, order_index, board_type, section_id, assignees: [],
    items: [{ id, title, status, teams, tags, assignees, comments: [...], ... }]
  }],
  sections: [{ id, board_type, title, order_index }],
  loading: boolean,
  error: null | string
}
```

**page_type 필터링:** `useKanbanData`는 page 타입도 그대로 로드한다.
보드에서는 렌더 직전에 task/card만 필터링하고, Sidebar는 `usePageTree`에서 page 타입만 재구성한다.
