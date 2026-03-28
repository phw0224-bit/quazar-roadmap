# components/

> UI를 구성하는 React 컴포넌트 모음. 상태를 직접 관리하지 않고, hooks와 props를 통해 데이터를 받아 렌더링.

## 책임
- 칸반 보드, 타임라인, 피플 보드 뷰 렌더링
- 아이템 상세 편집 패널
- DnD 인터랙션 (KanbanBoard → BoardSection → ProjectColumn → KanbanCard)
- 전역 피드백 UI (Toast, ConfirmModal, InputModal)

## 주요 파일

| 파일 | 역할 |
|------|------|
| `KanbanBoard.jsx` | **최상위 오케스트레이터.** DnD 컨텍스트, 뷰 전환, 전역 모달 관리 |
| `ItemDetailPanel.jsx` | 우측 슬라이드 패널. 에디터+메타데이터+AI요약+댓글. 가장 복잡한 컴포넌트 |
| `BoardSection.jsx` | 섹션 그룹 (프로젝트 컬럼들을 묶음) |
| `ProjectColumn.jsx` | 칸반 컬럼 하나 (Phase). DnD droppable + draggable |
| `KanbanCard.jsx` | 카드 (Item). DnD sortable |
| `TimelineView.jsx` | 간트 스타일 타임라인 뷰 |
| `PeopleBoard.jsx` | 팀원별 업무 현황 뷰 |
| `Sidebar.jsx` | 좌측 사이드바 |
| `SidebarTree.jsx` | 재귀 페이지 트리 (Sidebar 내부에서 사용) |
| `FilterBar.jsx` | 필터/정렬/그룹 UI |
| `SearchModal.jsx` | Ctrl+K 전역 검색 모달 |
| `CommentSection.jsx` | 댓글 목록 (ItemDetailPanel 내부) |
| `Comment.jsx` | 단일 댓글 (수정/삭제 포함) |
| `FileUploadButton.jsx` | 파일 첨부 드래그앤드롭 UI |

## 패턴 & 규칙

**공통 Props 계약:**

```javascript
isReadOnly         // boolean — 비로그인 시 true, 수정 UI 렌더링 제거
onShowToast(msg)   // 성공/실패 알림
onShowConfirm(title, msg, cb)  // 삭제 확인 모달
onShowPrompt(title, placeholder, cb)  // 이름 입력 모달
```

**stopProp 패턴:** DnD 컨텍스트 내 모든 interactive 요소에 필수.

```javascript
const stopProp = (e) => e.stopPropagation();
<button onPointerDown={stopProp} onClick={handleClick}>버튼</button>
```

**다크모드:** 모든 컴포넌트에 `dark:` prefix 적용. `html.dark` 클래스 기반.

**isReadOnly 적용:**

```javascript
{!isReadOnly && <button>삭제</button>}  // disabled가 아닌 렌더링 제거
```
