# Key Flows — 핵심 플로우

> Quazar Roadmap 주요 데이터 흐름 및 코드 예제

---

## 상태 관리 (useKanbanData)

**패턴:**
```javascript
// 이동/정렬 계열: dispatch 선반영 (Optimistic Update)
dispatch({ type: 'MOVE_ITEM', payload: { sourcePhaseId, targetPhaseId, itemId, targetIndex } });
await kanbanAPI.moveItem(sourcePhaseId, targetPhaseId, itemId, targetIndex);

// 일반 CRUD: API 호출 후 dispatch
const updatedItem = await kanbanAPI.updateItem(phaseId, itemId, updates);
dispatch({ type: 'UPDATE_ITEM', payload: { phaseId, itemId, updates: updatedItem } });
```

**Reducer 액션:**
- `SET_DATA` — 전체 보드 데이터 로드
- `ADD/UPDATE/DELETE/MOVE_PHASE` — 프로젝트 관리
- `ADD/UPDATE/DELETE/MOVE_ITEM` — 아이템 관리
- `ADD/UPDATE/DELETE_COMMENT` — 댓글 관리
- `ADD/UPDATE/DELETE/MOVE_SECTION` — 섹션 관리
- `ADD_CHILD_PAGE` — 하위 페이지 생성

**왜:**
- Optimistic Update로 즉각 반응형 UX
- API 실패 시 Realtime 구독이 재동기화

---

## Realtime 구독

**채널별 처리:**

```javascript
// items 채널
supabase
  .channel('items')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
    fetchBoardData(); // 전체 재조회
  })
  .subscribe();

// comments 채널
supabase
  .channel('comments')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload) => {
    const comment = await fetchSingleComment(payload.new.id);
    dispatch({ type: 'ADD_COMMENT', payload: { itemId, comment } });
  })
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (payload) => {
    dispatch({ type: 'DELETE_COMMENT', payload: { commentId: payload.old.id } });
  })
  .subscribe();

// projects 채널
supabase
  .channel('projects')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
    fetchBoardData(); // 전체 재조회
  })
  .subscribe();
```

**sections는 구독 없음** (클라이언트 dispatch 또는 이후 재조회)

---

## Presence (접속자 상태)

**구독:**
```javascript
const channel = supabase.channel('board-presence');

channel
  .on('presence', { event: 'sync' }, () => {
    const presenceState = channel.presenceState();
    setPresence(transformPresence(presenceState));
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED' && user) {
      await channel.track({
        userId: user.id,
        name: user.user_metadata.name || 'Unknown',
        itemId: null,
        editingField: null
      });
    }
  });
```

**업데이트:**
```javascript
// 아이템 상세 패널 열 때
channel.track({
  userId: user.id,
  name: userName,
  itemId: selectedItem.id,
  editingField: null
});

// 필드 편집 시작
channel.track({
  userId: user.id,
  name: userName,
  itemId: selectedItem.id,
  editingField: 'title'
});
```

**UI 표시:**
- PresenceAvatars: 상단에 전체 접속자 표시
- ItemViewers: 아이템별 현재 보는 사람 표시
- 편집 중인 필드 색상 변경 (border-blue-500)

---

## DnD (Drag & Drop)

**타입 판별:**
```javascript
const activeId = active.id; // 'section-{uuid}' | 'phase-{uuid}' | '{uuid}'

if (activeId.startsWith('section-')) {
  // 섹션 이동
  moveSection(oldIndex, newIndex);
} else if (activeType === 'phase') {
  // 프로젝트 이동
  movePhase(phaseId, newSectionId, newIndex);
} else {
  // 아이템 이동
  moveItem(sourcePhaseId, targetPhaseId, itemId, newIndex);
}
```

**Cross-phase 이동:**
```javascript
async function moveItem(sourcePhaseId, targetPhaseId, itemId, targetIndex) {
  // 1. UI 즉시 반영
  dispatch({
    type: 'MOVE_ITEM',
    payload: { sourcePhaseId, targetPhaseId, itemId, targetIndex }
  });

  // 2. source phase items 재계산
  const sourceItems = phases[sourcePhaseId].items
    .filter(item => item.id !== itemId)
    .map((item, index) => ({ ...item, order_index: index }));

  // 3. target phase items 재계산
  const targetItems = [
    ...phases[targetPhaseId].items.slice(0, targetIndex),
    { ...movedItem, project_id: targetPhaseId, order_index: targetIndex },
    ...phases[targetPhaseId].items.slice(targetIndex)
  ].map((item, index) => ({ ...item, order_index: index }));

  // 4. DB 일괄 업데이트
  await kanbanAPI.bulkUpdateItems([...sourceItems, ...targetItems]);
}
```

---

## Sidebar 페이지 트리 이동

**드롭 위치 판별:**
```javascript
const dropIndicator = getDropIndicator(clientY, targetRect);
// 'center' → 자식으로 추가
// 'top' / 'bottom' → 형제로 순서 변경
```

**업데이트 로직:**
```javascript
if (dropIndicator === 'center') {
  // 자식으로 추가
  updates = {
    parent_item_id: targetItem.id,
    project_id: targetItem.project_id,
    order_index: targetItem.children.length // 마지막에 추가
  };
} else {
  // 형제로 순서 변경
  updates = {
    parent_item_id: targetItem.parent_item_id,
    project_id: targetItem.project_id,
    order_index: dropIndicator === 'top' ? targetIndex : targetIndex + 1
  };
}

await kanbanAPI.updateItemHierarchy(draggedItem.id, updates);
```

**프로젝트 위 드롭 (루트로 이동):**
```javascript
updates = {
  parent_item_id: null,
  project_id: targetProjectId,
  order_index: 0
};
```

---

## 파일 업로드

**플로우:**
```
1. Editor/FileUploadButton 클릭
2. <input type="file"> 선택
3. POST /upload/:itemId (multipart/form-data)
4. Express multer → server/uploads/{itemId}/{filename}
5. 응답: { url, filename, originalName, mimetype, size }
6. items.files jsonb에 추가
7. 이미지: <img src={url}> 삽입
   문서: <a href={url}>{originalName}</a> 삽입
```

**코드:**
```javascript
// fileAPI.js
export async function uploadFile(itemId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`http://localhost:3001/upload/${itemId}`, {
    method: 'POST',
    body: formData
  });

  return res.json(); // { url, filename, ... }
}

// Editor.jsx
async function handleUpload(file) {
  const result = await uploadFile(item.id, file);
  
  // DB 업데이트
  await kanbanAPI.updateItem(phaseId, item.id, {
    files: [...item.files, result]
  });

  // 에디터 삽입
  if (result.mimetype.startsWith('image/')) {
    editor.chain().focus().setImage({ src: result.url }).run();
  } else {
    editor.chain().focus().insertContent(`<a href="${result.url}">${result.originalName}</a>`).run();
  }
}
```

---

## AI 요약

**플로우:**
```
1. ItemDetailPanel "요약 생성" 버튼
2. description HTML 추출
3. extractTextBlocks(html) → h1~h4, p, li 태그만
4. POST /api/summarize { blocks: [...] }
5. Ollama qwen2.5:14b 호출
6. 응답: { summary: string[], blocks: [{id, summary}], generatedAt }
7. items.ai_summary 저장
8. 상세 패널 요약 섹션 표시
9. [N] 클릭 → data-id로 에디터 블록 스크롤
```

**코드:**
```javascript
// summarizeAPI.js
export async function summarizeContent(html) {
  const blocks = extractTextBlocks(html); // 번호 부여
  
  const res = await fetch('http://localhost:3001/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks })
  });

  return res.json(); // { summary, blocks, generatedAt }
}

// ItemDetailPanel.jsx
async function handleSummarize() {
  const result = await summarizeContent(item.description);
  
  await kanbanAPI.updateItem(phaseId, item.id, {
    ai_summary: result
  });
}

// 라이브 프리뷰 클릭 매핑
function handleSummaryBlockClick(blockId) {
  const element = document.querySelector(`[data-id="${blockId}"]`);
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

**extractTextBlocks 로직:**
```javascript
function extractTextBlocks(html) {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const blocks = [];
  let index = 0;

  dom.querySelectorAll('h1, h2, h3, h4, p, li').forEach(el => {
    const text = el.textContent.trim();
    if (text) {
      const id = `ai-block-${index}`;
      el.setAttribute('data-id', id); // 역매핑용
      blocks.push({ id, text });
      index++;
    }
  });

  return blocks;
}
```

---

## 아이템 생성 + 작성자

**플로우:**
```javascript
// 1. 로그인 사용자 확인
const { data: { user } } = await supabase.auth.getUser();

// 2. 아이템 생성
const newItem = await kanbanAPI.createItem({
  project_id: phaseId,
  title: newTitle,
  created_by: user.id, // ← 작성자 저장
  order_index: items.length
});

// 3. 조회 시 profiles 조인
const { data } = await supabase
  .from('items')
  .select(`
    *,
    creator_profile:profiles!created_by(id, name, department)
  `);

// 4. UI 표시
{item.creator_profile && (
  <div className="flex items-center gap-1">
    <Avatar name={item.creator_profile.name} />
    <span>{item.creator_profile.name}</span>
  </div>
)}
```

---

## 하위 페이지 생성 (양방향 관계)

**플로우:**
```javascript
async function createChildPage(parentItem, title) {
  // 1. 자식 페이지 생성
  const child = await kanbanAPI.createItem({
    title,
    page_type: 'page',
    parent_item_id: parentItem.id,
    project_id: parentItem.project_id,
    order_index: parentItem.children?.length || 0
  });

  // 2. 부모의 related_items에 자식 추가 (양방향 보정)
  await kanbanAPI.updateItem(parentItem.project_id, parentItem.id, {
    related_items: [...(parentItem.related_items || []), child.id]
  });

  // 3. 자식의 related_items에 부모 추가
  await kanbanAPI.updateItem(child.project_id, child.id, {
    related_items: [parentItem.id]
  });

  dispatch({ type: 'ADD_CHILD_PAGE', payload: { parentId: parentItem.id, child } });
}
```

---

## 완료 프로젝트 아카이브/복귀

**완료 처리:**
```javascript
async function completePhase(phaseId) {
  const phase = phases[phaseId];
  
  await kanbanAPI.updatePhase(phaseId, {
    is_completed: true,
    pre_completion_section_id: phase.section_id,
    pre_completion_order_index: phase.order_index
  });
}
```

**복귀:**
```javascript
async function uncompletePhase(phaseId) {
  const phase = phases[phaseId];
  
  await kanbanAPI.updatePhase(phaseId, {
    is_completed: false,
    section_id: phase.pre_completion_section_id,
    order_index: phase.pre_completion_order_index
  });
}
```
