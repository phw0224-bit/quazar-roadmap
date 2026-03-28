# components/Auth/

> Supabase 인증 관련 UI 컴포넌트. App.jsx에서 auth 상태에 따라 렌더링.

## 책임
- 이메일/비밀번호 로그인 폼
- 신규 사용자 프로필 초기 설정 (이름, 부서, 비밀번호 변경)

## 주요 파일

| 파일 | 역할 |
|------|------|
| `LoginForm.jsx` | 이메일+비밀번호 로그인. `useAuth().login()` 호출 |
| `SetupProfileForm.jsx` | 첫 로그인 시 이름/부서/비밀번호 설정. `useAuth().updateProfileAndStep()` 호출 |

## 패턴 & 규칙

**렌더링 조건 (App.jsx):**

```javascript
if (needsPasswordSetup) return <SetupProfileForm />;
if (!user && showLogin) return <LoginForm />;
```

신규 사용자는 `user_metadata.needs_password_setup = true` 플래그를 가짐.
SetupProfileForm 완료 후 플래그 제거.
