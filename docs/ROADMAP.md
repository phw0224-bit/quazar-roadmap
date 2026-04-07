# Roadmap — 미구현 기능

> Quazar Roadmap 향후 개발 계획

---

## Phase 6 — @멘션 + Google Chat 알림

**목표:**  
댓글에서 @이름 입력 → 구글챗 DM 자동 발송

**구현 계획:**

### 1. 멘션 기능
- Tiptap `@tiptap/extension-mention` 추가
- 댓글 에디터에서 @ 입력 시 팀원 목록 표시
- 선택 시 `<span data-type="mention" data-id="user-id">@이름</span>` 삽입

### 2. 알림 발송
- Express `/api/notify` 엔드포인트 추가
- 댓글 저장 시 HTML 파싱 → mention 노드 추출
- 각 멘션된 사용자에게 Google Chat DM 발송

**필요 패키지:**
```json
{
  "@tiptap/extension-mention": "^2.x",
  "@google-apps/chat": "^0.x"
}
```

**API 설계:**
```javascript
POST /api/notify
{
  "user_ids": ["uuid1", "uuid2"],
  "message": "누군가 당신을 멘션했습니다",
  "item_url": "https://roadmap.ai-quazar.uk/?item=uuid"
}
```

**구현 포인트:**
- profiles에 google_chat_id 필드 추가 필요
- Google Chat API 인증 설정
- 알림 실패 시 fallback (이메일?)

---

## Phase 7 — 커스텀 속성 시스템

**목표:**  
팀별 필드 정의 (예: 개발팀만 "난이도" 필드)

**DB 스키마:**

```sql
-- 속성 정의
CREATE TABLE item_properties (
  id uuid PRIMARY KEY,
  board_type text NOT NULL,        -- 'main'|'개발팀' 등
  name text NOT NULL,               -- 'difficulty'
  label text NOT NULL,              -- '난이도'
  field_type text NOT NULL,         -- 'text'|'number'|'select'|'date'
  options jsonb,                    -- select 타입일 때 선택지
  order_index int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 속성 값
CREATE TABLE item_property_values (
  id uuid PRIMARY KEY,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  property_id uuid REFERENCES item_properties(id) ON DELETE CASCADE,
  value jsonb,                      -- 유연한 타입 저장
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, property_id)
);
```

**UI 설계:**

1. **설정 페이지**
   - 팀별 속성 정의 관리
   - 필드 타입 선택 (텍스트, 숫자, 선택, 날짜)
   - select 타입일 때 옵션 정의

2. **아이템 상세 패널**
   - 기본 필드 아래에 커스텀 속성 표시
   - board_type에 맞는 속성만 렌더
   - 인라인 편집 지원

3. **필터/정렬**
   - 커스텀 속성으로도 필터 가능
   - 타임라인 뷰에서 커스텀 날짜 필드 사용

**구현 포인트:**
- 속성 정의는 관리자만 가능
- 속성 삭제 시 연결된 값도 CASCADE 삭제
- 타입별 유효성 검사 (number는 숫자만)
- 기본 필드와 커스텀 속성 UI 구분

**예시:**
```javascript
// 개발팀 보드 전용 속성
{
  name: 'difficulty',
  label: '난이도',
  field_type: 'select',
  options: ['쉬움', '보통', '어려움']
}

// 아이템에 값 저장
{
  item_id: 'uuid',
  property_id: 'prop-uuid',
  value: '어려움'
}
```

---

## Phase 8 — 템플릿 시스템

**목표:**  
자주 사용하는 프로젝트/페이지 구조를 템플릿으로 저장

**기능:**
- 프로젝트 템플릿: 섹션 + 프로젝트 구조
- 페이지 템플릿: 페이지 계층 + 기본 내용
- "템플릿으로 저장" / "템플릿에서 생성" 버튼

**DB 스키마:**
```sql
CREATE TABLE templates (
  id uuid PRIMARY KEY,
  board_type text,
  name text NOT NULL,
  description text,
  template_type text NOT NULL, -- 'project'|'page'
  structure jsonb NOT NULL,    -- 전체 구조 JSON
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

---

## Phase 9 — 활동 로그

**목표:**  
누가, 언제, 무엇을 변경했는지 이력 추적

**DB 스키마:**
```sql
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  item_id uuid REFERENCES items(id),
  action text NOT NULL,        -- 'created'|'updated'|'deleted'|'moved'
  field_name text,             -- 'title'|'assignees' 등
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);
```

**UI:**
- 아이템 상세 패널 "활동" 탭
- 타임라인 형식으로 표시
- 변경 전/후 비교

---

## Phase 10 — 자동화 (Automation)

**목표:**  
조건에 따라 자동 작업 실행

**예시:**
- 상태가 'done'으로 변경 → 완료일 자동 기록
- 특정 태그 추가 → 담당자 자동 할당
- 마감일 3일 전 → Google Chat 알림

**구현:**
- DB 트리거 + Edge Functions 조합
- 또는 Express Cron Job

---

## Phase 11 — 대시보드

**목표:**  
전체 보드 현황을 한눈에

**차트:**
- 팀별 작업 진행률
- 상태별 아이템 수
- 마감 임박 작업 목록
- 활동 통계 (주간/월간)

**기술:**
- Chart.js 또는 Recharts
- Supabase Views로 집계 쿼리 최적화
