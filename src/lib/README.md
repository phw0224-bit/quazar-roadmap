# lib/

> 앱 전체에서 공유하는 상수와 외부 클라이언트 초기화.

## 책임
- 팀/태그/상태/우선순위 등 비즈니스 상수 정의
- 현재 배포용 릴리즈 노트와 마지막 확인 버전 key 관리
- Supabase 클라이언트 단일 인스턴스 제공

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `constants.js` | TEAMS, GLOBAL_TAGS, STATUS_MAP, PRIORITY_MAP, PROJECT_TINTS 정의 | - |
| `devRequestBoard.js` | 개발팀 요청 섹션, 임시 요청명세 템플릿, 라벨/안내 문구 정의 | - |
| `releaseNotes.js` | **핵심.** 현재 릴리즈 노트 데이터와 `kanban-release-notes-last-seen` key 정의 | - |
| `supabase.js` | `createClient(url, key)` 결과를 export. `.env` 환경변수 필요 | @supabase/supabase-js |

## 패턴 & 규칙

**TEAMS 구조:**

```javascript
[{ name: '개발팀', color: 'gray', bg: 'bg-gray-100 dark:bg-gray-800', ... }]
```

**PROJECT_TINTS:** 칸반 컬럼에 순환 적용되는 4가지 색상 테마 (sky/violet/emerald/slate).
`getProjectTint(index)` 로 `{ column, header, headerHover, body }` CSS 클래스 반환.

**STATUS_MAP:** `items.status` 값 → 한국어 레이블 + Tailwind 클래스 매핑.

```javascript
STATUS_MAP['in-progress'] // → { label: '진행 중', color: 'text-blue-500', ... }
```

**RELEASE_NOTES:** 배열 맨 앞 원소가 현재 배포 기준 릴리즈다. `App.jsx`는 `CURRENT_RELEASE_NOTE.id`와 localStorage 값을 비교해 자동 노출 여부를 결정한다.

```javascript
export const CURRENT_RELEASE_NOTE = RELEASE_NOTES[0];
```

**환경변수:**

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
```
