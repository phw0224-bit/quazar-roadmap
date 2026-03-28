# components/UI/

> 앱 전체에서 공유하는 피드백 UI 컴포넌트.

## 책임
- Toast 알림 (성공/실패 메시지)
- 확인 모달 (삭제 등 파괴적 작업 전)
- 입력 모달 (이름 입력 등)

## 주요 파일

| 파일 | 역할 |
|------|------|
| `Feedback.jsx` | `Toast`, `ConfirmModal`, `InputModal` 세 컴포넌트를 단일 파일에서 export |

## 패턴 & 규칙

KanbanBoard.jsx에서 상태를 관리하고, 콜백(`onShowToast`, `onShowConfirm`, `onShowPrompt`)을
하위 컴포넌트로 전달. 이 콜백이 Feedback 컴포넌트를 트리거함.

```javascript
// KanbanBoard.jsx 사용 패턴
const [toast, setToast] = useState(null);
const showToast = (msg) => setToast({ msg });
// → 자식 컴포넌트에 onShowToast={showToast} 전달
```
