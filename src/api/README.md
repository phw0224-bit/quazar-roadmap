# api/

> 데이터 저장소와 보조 서버 호출을 한곳에 모아, UI가 Supabase 쿼리나 업로드 프로토콜 세부사항을 직접 알지 않게 하는 레이어.

## 책임
- Supabase JS Client를 통한 PostgreSQL CRUD
- Express 서버 파일 업로드/삭제 호출
- Ollama AI 요약 호출 (Express 프록시)
- 개발팀 요청 생성 후 Google Chat webhook 알림 호출
- 순서 재계산, 완료 프로젝트 복귀 위치 저장 같은 DB 반영 규칙 캡슐화

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `kanbanAPI.js` | **핵심.** boards/items/comments/sections/projects 전체 CRUD와 일반 문서/개인 메모 API. 개인 메모는 `personal_memos` 테이블을 사용 | supabase |
| `fileAPI.js` | 파일 업로드/삭제 (POST/DELETE to Express :3001). 클라이언트 측 MIME 검증 | axios |
| `summarizeAPI.js` | AI 요약 (POST /api/summarize). HTML → Ollama JSON 요약 | fetch |

## 패턴 & 규칙

**Supabase 직접 호출 패턴:**

```javascript
const { data, error } = await supabase.from('items').select('*');
if (error) throw error;
return data;
```

**정렬 관리:**
- 보드 뷰는 `order_index`
- 타임라인 뷰는 `timeline_order_index`
- 이동 시 영향받는 배열 전체를 재계산하여 gap 없이 0부터 연속 정수 유지

**getBoardData() 반환 구조:**

```javascript
{
  projects: [{
    ...project,
    items: [{ ...item, comments: [{ ...comment, profiles: { name, department } }] }]
  }],
  sections: [{ ...section }]
}
```

**오류 처리:** 모든 함수는 Supabase/HTTP error를 throw. 호출 측(훅/컴포넌트)에서 toast 또는 fallback 처리.

**관련 규칙:**
- `completeProject()`는 완료 시 원래 위치(`pre_completion_*`)를 저장하고, 복귀 시 복원한다.
- `moveItem()`은 칸반 보드뿐 아니라 Sidebar 트리 이동도 지원하도록 `targetParentId`를 받을 수 있다.
- `getPersonalMemos()` 계열은 더 이상 `roadmap_items.is_private`에 의존하지 않고 전용 `personal_memos` 저장소를 사용한다.
- 담당자 저장은 `assignees` 표시 이름 배열과 `assignee_user_ids` 식별자 배열을 함께 동기화한다.
- 담당자 변경 알림은 `updateItem()` / `updateProject()`에서 assignee diff를 계산한 뒤 `POST /api/notifications/assignments`로 전달한다.
- 개발팀 요청 알림은 `createTeamRequest()`가 insert 성공 후 `POST /api/notifications/dev-requests`를 호출해 Google Chat incoming webhook으로 전달한다.
- 알림 저장소는 `notifications` 테이블을 기준으로 설계하며, 쓰기는 Express 서버의 service-role 경로를 통하고 읽기 권한은 수신자 본인으로 제한한다.
- 클라이언트 알림함은 `getNotifications()`, `markNotificationsAsRead()`, `markAllNotificationsAsRead()`로 최근 알림 조회와 읽음 처리를 수행한다.
