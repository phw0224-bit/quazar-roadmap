# Cloud Supabase to Self-Hosted Docker Migration

> 목표: Cloud Supabase 프로젝트 `ealbfnlqmvitflctlats`를 Docker 기반 self-host Supabase로 완전히 이전하고, 앱을 로컬 self-host API로 테스트한 뒤 서버에 배포한다.

## 결론

이전 방식은 Supabase CLI의 `supabase start` 개발 스택이 아니라, 공식 self-host Docker Compose 스택을 사용한다.

현재 저장소에 포함된 구성:

- `infra/supabase-selfhost/`: Supabase 공식 self-host Docker 구성
- `scripts/setup-supabase-selfhost.ps1`: self-host `.env` 생성 및 JWT/비밀값 생성
- `scripts/export-supabase-cloud.ps1`: Cloud DB에서 roles/schema/data 덤프
- `scripts/restore-local-supabase.ps1`: self-host Postgres에 덤프 복원
- `.env.local.example`: 앱이 self-host Supabase를 바라보는 예시

## 현재 막힌 조건

Cloud DB 전체 덤프에는 Cloud Supabase의 직접 Postgres 접속 URL이 필요하다.

필요한 값:

```powershell
$env:SUPABASE_CLOUD_DB_URL = "postgresql://postgres:<DB_PASSWORD>@db.ealbfnlqmvitflctlats.supabase.co:5432/postgres"
```

중요:

- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`만으로는 전체 DB dump가 불가능하다.
- MCP도 현재 DB 쿼리에서 `Connection terminated due to connection timeout`이 발생한다.
- DB URL이 없으면 Supabase Dashboard에서 백업 파일을 받아 복원하는 경로를 써야 한다.

## 1. Self-Host Env 생성

```powershell
yarn supabase:selfhost:setup
```

출력되는 값을 `.env.local`에 반영한다.

예시:

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<generated anon key>
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=<generated anon key>
SUPABASE_SERVICE_ROLE_KEY=<generated service role key>
APP_BASE_URL=http://localhost:5173
```

## 2. Self-Host Supabase 기동

```powershell
yarn supabase:selfhost:up
yarn supabase:selfhost:ps
```

주요 URL:

- API/Kong: `http://localhost:8000`
- Studio: `http://localhost:3000`
- Postgres: `localhost:5432`

## 3. Cloud Supabase 덤프

Cloud DB 비밀번호를 알고 있으면:

```powershell
$env:SUPABASE_CLOUD_DB_URL = "postgresql://postgres:<DB_PASSWORD>@db.ealbfnlqmvitflctlats.supabase.co:5432/postgres"
yarn supabase:export
```

생성 파일:

- `infra/supabase-selfhost/backups/cloud/roles.sql`
- `infra/supabase-selfhost/backups/cloud/schema.sql`
- `infra/supabase-selfhost/backups/cloud/data.sql`
- `infra/supabase-selfhost/backups/cloud/auth-core.sql`

이 디렉터리는 `.gitignore` 처리되어 커밋되지 않는다.

## 4. Self-Host DB에 복원

```powershell
yarn supabase:restore
```

복원 순서:

1. roles
2. public schema
3. Auth users/identities
4. public data

## 5. 앱 테스트

```powershell
yarn build
yarn dev:all
```

확인 항목:

- 공개 읽기 페이지 로드
- 로그인
- 프로필 생성/갱신
- 보드 데이터 조회
- 카드 생성/수정/이동
- 댓글
- Realtime presence
- 파일 업로드
- `/api/summarize` Ollama 프록시

## 6. 내일 서버 배포 흐름

서버에서:

```powershell
git pull
yarn install
yarn supabase:selfhost:setup
yarn supabase:selfhost:up
```

그 다음 Cloud DB 덤프 파일을 서버로 복사하거나 서버에서 직접:

```powershell
$env:SUPABASE_CLOUD_DB_URL = "postgresql://postgres:<DB_PASSWORD>@db.ealbfnlqmvitflctlats.supabase.co:5432/postgres"
yarn supabase:export
yarn supabase:restore
```

배포 환경변수는 서버 도메인을 기준으로 바꾼다.

```env
VITE_SUPABASE_URL=https://<your-supabase-api-domain>
SUPABASE_URL=https://<your-supabase-api-domain>
APP_BASE_URL=https://roadmap.ai-quazar.uk
```

## 7. Auth/Storage 주의사항

이 프로젝트는 Cloud 기준 `auth.users`, `auth.identities`를 함께 옮긴다. 기존 로그인 세션 토큰은 새 JWT secret 때문에 유지하지 않고, 사용자는 다시 로그인해야 한다.

Cloud Storage bucket/object는 현재 0건으로 확인되어 별도 이전 대상이 없다. 향후 Supabase Storage를 사용하면 `storage.buckets`, `storage.objects`와 실제 object 파일 이전 절차를 추가해야 한다.

## 8. 공식 참고

- Self-host Docker: https://supabase.com/docs/guides/self-hosting/docker
- CLI db dump: https://supabase.com/docs/reference/cli/supabase-db-dump
- Downloaded backup restore: https://supabase.com/docs/guides/local-development/restoring-downloaded-backup
