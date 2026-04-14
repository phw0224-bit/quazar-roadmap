# components/

> 화면 구성 요소를 기능 단위로 분리해, 보드/사이드바/상세패널/보조 모달을 독립적으로 탐색할 수 있게 하는 레이어.

## 책임
- 칸반 보드, 타임라인, 피플 보드 뷰 렌더링
- 아이템 상세 편집 패널
- DnD 인터랙션 (KanbanBoard → BoardSection → ProjectColumn → KanbanCard)
- Sidebar 페이지 트리 렌더링 및 중첩 페이지 이동
- 전역 피드백 UI (Toast, ConfirmModal, InputModal)
- 릴리즈 노트, 검색, 상세 패널 같은 전역 오버레이/보조 UI

## 주요 파일

| 파일 | 역할 |
|------|------|
| `AppLayout.jsx` | Sidebar와 메인 콘텐츠를 배치하는 공통 레이아웃 |
| `AssigneePicker.jsx` | **핵심.** 담당자 추천 선택 + 직접 입력을 공통화하는 편집 UI |
| `KanbanBoard.jsx` | **최상위 오케스트레이터.** DnD 컨텍스트, 뷰 전환, 전역 모달 관리 |
| `PresenceAvatars.jsx` | 보드 헤더 우측의 전체 접속자 아바타 표시 |
| `ItemDetailPanel.jsx` | 우측 슬라이드 패널. 에디터+메타데이터+AI요약+댓글. 가장 복잡한 컴포넌트 |
| `ItemViewers.jsx` | 상세 패널 상단에서 같은 아이템을 보는 중/편집 중인 사용자 표시 |
| `ItemDescriptionSection.jsx` | ItemDetailPanel 내부의 Markdown live/source/view editor, AI 요약, 링크 모달 전담 섹션 |
| `itemDescriptionMode.js` | 상세 설명 섹션이 본문 유무와 읽기 전용 여부에 따라 기본 모드를 정하는 규칙 |
| `BoardSection.jsx` | 섹션 그룹 (프로젝트 컬럼들을 묶음) |
| `ProjectColumn.jsx` | **핵심.** 칸반 컬럼 하나 (Project). 완료 프로젝트 전환, 프로젝트 가상 페이지 진입 포함 |
| `projectColumnMenu.js` | ProjectColumn 메뉴를 body 포털의 fixed 오버레이로 배치하는 위치 계산/스타일 규칙 |
| `KanbanCard.jsx` | 카드 (Item). DnD sortable |
| `TimelineView.jsx` | 간트 스타일 타임라인 뷰 |
| `PeopleBoard.jsx` | 팀원별 업무 현황 뷰 |
| `Sidebar.jsx` | 좌측 사이드바 |
| `SidebarTree.jsx` | 재귀 페이지 트리 (Sidebar 내부에서 사용) |
| `FilterBar.jsx` | 필터/정렬/그룹 UI |
| `SearchModal.jsx` | Ctrl+K 전역 검색 모달. 담당자 이름 검색 지원 |
| `ReleaseNotesModal.jsx` | 현재 릴리즈의 변경사항을 자동/수동으로 보여주는 내부용 업데이트 내역 모달 |
| `CommentSection.jsx` | 댓글 목록 (ItemDetailPanel 내부) |
| `Comment.jsx` | 단일 댓글 (수정/삭제 포함) |
| `FileUploadButton.jsx` | 파일 첨부 드래그앤드롭 UI |
| `VirtualizedItemList.jsx` | 대량 카드 렌더링 최적화용 가상 리스트. 현재 미사용 |
| `TiptapEditor.jsx` | 초기 에디터 프로토타입. 현재 본문 편집에는 `components/editor/Editor.jsx` + `components/editor/EditorToolbar.jsx` 조합 사용 |

## 패턴 & 규칙

**공통 Props 계약:**

```javascript
isReadOnly         // boolean — 비로그인 시 true, 수정 UI 렌더링 제거
onShowToast(msg)   // 성공/실패 알림
onShowConfirm(title, msg, cb)  // 삭제 확인 모달
onShowPrompt(title, placeholder, cb)  // 이름 입력 모달
onCompleteProject(projectId, isCompleted, meta?)  // 프로젝트 완료/복귀
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

**담당자 편집 공통화:**

```javascript
<AssigneePicker
  value={item.assignees || []}
  onChange={(assignees) => onUpdateItem(phase.id, item.id, { assignees })}
/>
```

추천 유저 선택과 직접 입력을 모두 지원하지만 저장값은 계속 `profiles.name` 기반 `string[]`를 유지한다.

**페이지와 카드 분리 렌더링:**

```javascript
(phase.items || []).filter(item => !item.page_type || item.page_type === 'task')
```

보드 컬럼은 task/card만 렌더링하고, page 타입은 SidebarTree에서 별도로 사용한다.
