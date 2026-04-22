begin;

alter table public.team_requests
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists notified_at timestamptz;

create index if not exists team_requests_submitted_idx
  on public.team_requests (board_type, submitted_at desc)
  where submitted_at is not null;

create index if not exists team_requests_notified_idx
  on public.team_requests (board_type, notified_at desc)
  where notified_at is not null;

create index if not exists team_requests_created_by_idx
  on public.team_requests (created_by)
  where created_by is not null;

create index if not exists team_requests_submitted_by_idx
  on public.team_requests (submitted_by)
  where submitted_by is not null;

commit;
