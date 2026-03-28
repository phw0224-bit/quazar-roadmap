# api/

> Supabase와 Express 서버에 대한 모든 네트워크 호출을 담당. 컴포넌트는 이 파일들을 직접 import하지 않고, 훅(useKanbanData 등)을 통해 간접 사용.

## 책임
- Supabase JS Client를 통한 PostgreSQL CRUD
- Express 서버 파일 업로드/삭제 호출
- Ollama AI 요약 호출 (Express 프록시)

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `kanbanAPI.js` | **핵심.** boards/items/comments/sections/projects 전체 CRUD. order_index 재계산 포함 | supabase |
| `fileAPI.js` | 파일 업로드/삭제 (POST/DELETE to Express :3001). 클라이언트 측 MIME 검증 | axios |
| `summarizeAPI.js` | AI 요약 (POST /api/summarize to Express :3001). HTML → Ollama JSON 요약 | axios |

## 패턴 & 규칙

**Supabase 직접 호출 패턴:**

```javascript
const { data, error } = await supabase.from('items').select('*');
if (error) throw error;
return data;
```

**order_index 관리:** 아이템/페이즈/섹션 이동 시 영향받는 배열 전체를 재계산하여 일괄 upsert.
gap 없이 0부터 연속 정수로 유지.

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

**오류 처리:** 모든 함수는 Supabase error를 throw. 호출 측(훅)에서 catch 처리.
