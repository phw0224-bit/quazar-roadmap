# Documentation System Guide — 문서 작성 규칙

> 3-레이어 AI 친화적 문서화 시스템

---

## 레이어 구조

```
Layer 1: CLAUDE.md          ← 프로젝트 전체 청사진 (AI 세션 시작점)
Layer 2: 폴더별 README.md   ← 폴더 역할과 패턴 설명 (탐색 진입 전 읽기)
Layer 3: 파일별 JSDoc       ← 코드 인라인 "왜" 설명 (코드 읽기 전 읽기)
```

**원칙:**  
각 레이어는 "아래 레이어를 읽지 않아도 이해 가능"해야 한다.
- CLAUDE.md만 → 아키텍처 파악
- README.md까지 → 코드 탐색 전략 수립
- JSDoc까지 → 개별 파일 한 줄씩 분석 불필요

---

## Layer 1 — CLAUDE.md

**목적:**  
AI 세션 시작 시 컨텍스트 로딩 비용 최소화. 코드를 읽지 않고도 전체 구조 파악.

**고정 섹션 구조 (번호 유지 필수):**

| 섹션 | 내용 | 업데이트 시점 |
|------|------|--------------|
| 1. Domain Context | 목적, 사용자, 도메인 특수성 | 비즈니스 요구사항 변경 |
| 2. Architecture | 컴포넌트 트리, 상태 흐름, URL | 주요 컴포넌트 추가/삭제 |
| 3. Tech Stack | 기술 스택 테이블 | 패키지 추가/변경 |
| 4. Data Model | SQL 스키마 (실제 운영 기준) | DB 컬럼 추가/삭제 |
| 5. Business Rules | 도메인 규칙 | 규칙 변경 |
| 6. Key Flows | 핵심 플로우 | 흐름 변경 |
| 7. Component Map | 파일 트리 + Props 계약 | 파일 추가/삭제/이동 |
| 8. Conventions | 공통 코딩 패턴 | 새 패턴 도입 |
| 9. Dev Guide | 실행, 환경변수, 배포 | 인프라 변경 |
| 10. Roadmap | 미구현 기능 | Phase 완료/신규 계획 |
| 11. Documentation Guide | 이 섹션 | 문서화 규칙 변경 |

**작성 원칙:**
- **현재 상태만** 기록 ("~할 예정"은 Roadmap만)
- 코드 예시는 실제 패턴 사용 (가상 예시 금지)
- 각 섹션 독립적으로 읽기 가능
- 한국어 우선, 기술 용어는 영어

**업데이트 체크리스트:**

**새 컴포넌트/훅 추가 시:**
- [ ] Section 2: Architecture에 위치 추가
- [ ] Section 7: Component Map 파일 트리 업데이트
- [ ] Section 7: 새 Props 계약 → 핵심 Props 추가
- [ ] Section 8: 새 공통 패턴 → Conventions 추가

**DB 변경 시:**
- [ ] Section 4: Data Model SQL 스키마 업데이트
- [ ] Section 5: 새 비즈니스 규칙 → Business Rules 추가
- [ ] Section 6: 흐름 변경 → Key Flows 업데이트

---

## Layer 2 — 폴더별 README.md

**목적:**  
폴더 안 파일 열기 전에 "이 폴더가 무엇을 담당하는지" 파악.
AI가 어느 파일을 읽어야 할지 결정하는 진입점.

**템플릿:**

```markdown
# {폴더명}/

> {이 폴더의 한 줄 역할. 왜 존재하는지 중심으로}

## 책임
- {이 폴더 코드가 담당하는 관심사}
- {다른 폴더와의 경계: "X는 하지 않고 Y만 한다"}

## 주요 파일

| 파일 | 역할 | 주요 의존성 |
|------|------|------------|
| `파일명.js` | **핵심.** 한 줄 설명 | 의존 모듈 |
| `보조.js` | 보조 설명 | - |

**핵심 파일에는 "**핵심.**" 접두어 표시**

## 패턴 & 규칙

- **패턴명:** 이 폴더에서 공통으로 사용하는 코드 패턴 설명
  ```javascript
  // 실제 코드 스니펫
  ```

- **주의사항:** 이 폴더 코드 작성 시 지켜야 할 제약
```

**작성 원칙:**
- "왜"를 중심으로 (How는 코드에, Why는 문서에)
- 예시는 실제 코드 스니펫 우선 (주석보다 코드)
- 핵심 파일에 "**핵심.**" 접두어 명시
- 보조 파일은 간략히

---

## Layer 3 — JSDoc

**목적:**  
코드 파일의 "왜"를 설명. AI가 코드 라인 단위 분석 전에 맥락 파악.

**작성 대상:**
- ✅ **훅 (hooks/)** — 전부 @fileoverview 필수
- ✅ **API (api/)** — 전부 @fileoverview 필수
- ✅ **주요 컴포넌트** — KanbanBoard, ItemDetailPanel 등
- ✅ **비즈니스 로직 복잡한 함수** — @description 추가
- ❌ **단순 UI 컴포넌트** — Button, Input 등은 불필요
- ❌ **이벤트 핸들러** — handleClick 등 명확한 경우
- ❌ **인라인 함수** — map, filter 콜백 등

**@fileoverview 템플릿:**

```javascript
/**
 * @fileoverview {이 파일이 존재하는 이유 1-2문장}
 * 
 * {좀 더 상세한 설명 (선택)}
 * - {핵심 기능 1}
 * - {핵심 기능 2}
 * 
 * @example
 * // 사용 예시 (선택)
 * const data = useKanbanData();
 */
```

**@description 템플릿:**

```javascript
/**
 * @description {이 함수가 왜 필요한지, 어떤 비즈니스 로직을 처리하는지}
 * 
 * @param {string} phaseId - {설명}
 * @param {Object} updates - {가능한 필드: title, status, assignees}
 * @returns {Promise<Object>} {반환 구조: { id, title, ... }}
 */
async function updateItem(phaseId, updates) {
  // ...
}
```

**@param/@returns 작성 규칙:**
- 타입은 간략하게 (JSDoc 표준 타입)
- 파라미터 역할 설명
- 가능한 값/구조 명시 (선택지, 필드 목록 등)

**작성하지 않는 경우:**
```javascript
// ❌ 불필요 (함수명이 충분히 명확)
function handleSubmit(e) { ... }
function formatDate(date) { ... }

// ❌ 불필요 (인라인 헬퍼)
items.map(item => item.id)

// ✅ 필요 (복잡한 비즈니스 로직)
/**
 * @description 이동 시 source/target 두 phase의 order_index를 모두 재계산.
 * cross-phase move 지원.
 */
async function moveItem(sourcePhaseId, targetPhaseId, itemId, targetIndex) { ... }
```

---

## 문서 업데이트 트리거

| 변경사항 | 업데이트 대상 |
|----------|--------------|
| **새 컴포넌트 추가** | CLAUDE.md Section 7 + 폴더 README + @fileoverview |
| **새 훅 추가** | CLAUDE.md Section 2, 7 + hooks/README + @fileoverview |
| **DB 컬럼 추가** | CLAUDE.md Section 4 + API @param |
| **새 비즈니스 규칙** | CLAUDE.md Section 5 + 함수 @description |
| **Phase 완료** | CLAUDE.md Section 10 제거 + 관련 섹션 현재 상태 업데이트 |
| **파일 이동** | CLAUDE.md Section 7 + 이전/신규 폴더 README |
| **새 패턴 도입** | CLAUDE.md Section 8 + 폴더 README |
| **환경변수 변경** | CLAUDE.md Section 9 + README.md |

---

## 예시

### 좋은 @fileoverview

```javascript
/**
 * @fileoverview 전체 보드 상태 관리 훅. useReducer + Supabase Realtime 구독.
 * 
 * - 보드 데이터 로드 (sections, projects, items, comments)
 * - Realtime 구독으로 실시간 동기화
 * - Reducer 액션: SET_DATA, ADD/UPDATE/DELETE/MOVE_ITEM, ...
 * 
 * @example
 * const { sections, phases, comments, dispatch, loading } = useKanbanData(boardType);
 */
```

### 나쁜 @fileoverview

```javascript
/**
 * @fileoverview 칸반 데이터를 관리하는 훅입니다.
 * 
 * 이 훅은 useReducer를 사용합니다.
 */
```
→ "왜" 없음, "무엇"만 있음

---

## 문서 유지보수 원칙

1. **코드가 진실**: 문서와 코드가 다르면 코드를 믿어라
2. **문서는 "왜"**: "무엇"은 코드에, "왜"는 문서에
3. **최신화 책임**: 코드 변경 시 관련 문서 즉시 업데이트
4. **간결함 > 완벽함**: 100% 정확한 긴 문서보다 80% 정확한 짧은 문서가 낫다
5. **AI 친화적**: AI가 읽고 이해하기 쉽게 (명확한 구조, 일관된 형식)
