# api/

> 데이터 저장소와 보조 서버 호출을 한곳에 모아, UI가 Supabase 쿼리나 업로드 프로토콜 세부사항을 직접 알지 않게 하는 레이어.

## 책임
- Supabase JS Client를 통한 PostgreSQL CRUD
- Express 서버 파일 업로드/삭제 호출
- Ollama AI 요약 호출 (Express 프록시)
- 순서 재계산, 완료 프로젝트 복귀 위치 저장 같은 DB 반영 규칙 캡슐화

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `kanbanAPI.js` | **핵심.** boards/items/comments/sections/projects 전체 CRUD. `order_index`, `timeline_order_index`, 완료 프로젝트 보정 포함 | supabase |
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
  phases: [{
    ...project,
    items: [{ ...item, comments: [{ ...comment, profiles: { name, department } }] }]
  }],
  sections: [{ ...section }]
}
```

**오류 처리:** 모든 함수는 Supabase/HTTP error를 throw. 호출 측(훅/컴포넌트)에서 toast 또는 fallback 처리.

**관련 규칙:**
- `completePhase()`는 완료 시 원래 위치(`pre_completion_*`)를 저장하고, 복귀 시 복원한다.
- `moveItem()`은 칸반 보드뿐 아니라 Sidebar 트리 이동도 지원하도록 `targetParentId`를 받을 수 있다.
