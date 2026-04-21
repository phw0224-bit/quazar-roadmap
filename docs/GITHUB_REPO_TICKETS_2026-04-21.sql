-- GitHub 레포별 티켓 약어 설정 + 번호 발급
-- 적용 위치: Supabase SQL Editor
--
-- 기존 전역 QZR-N 티켓은 그대로 유지한다.
-- 새 GitHub 이슈 생성부터는 관리자가 repo별 ticket_prefix를 먼저 설정해야 하며,
-- 첫 티켓 발급 후 prefix는 잠긴다.

create table if not exists public.github_repository_settings (
  repo_full_name text primary key,
  ticket_prefix text not null unique,
  prefix_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint github_repository_settings_prefix_format check (ticket_prefix ~ '^[A-Z0-9]{2,8}$'),
  constraint github_repository_settings_locked_at_consistency check (
    (prefix_locked = false and locked_at is null)
    or (prefix_locked = true and locked_at is not null)
  )
);

create table if not exists public.repo_ticket_counters (
  repo_key text primary key,
  next_number bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repo_ticket_counters_key_format check (repo_key ~ '^[A-Z0-9]{2,8}$')
);

create or replace function public.allocate_repo_ticket_number(repo_key text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_key text;
  allocated_number bigint;
begin
  normalized_key := upper(trim(coalesce(repo_key, '')));

  if normalized_key !~ '^[A-Z0-9]{2,8}$' then
    raise exception 'repo_key must match ^[A-Z0-9]{2,8}$';
  end if;

  insert into public.repo_ticket_counters (repo_key, next_number)
  values (normalized_key, 2)
  on conflict (repo_key)
  do update set
    next_number = public.repo_ticket_counters.next_number + 1,
    updated_at = now()
  returning next_number - 1 into allocated_number;

  return allocated_number;
end;
$$;

create or replace function public.lock_github_repository_ticket_prefix(target_repo_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.github_repository_settings
  set prefix_locked = true,
      locked_at = coalesce(locked_at, now()),
      updated_at = now()
  where repo_full_name = target_repo_full_name;

  if not found then
    raise exception 'github repository settings not found for %', target_repo_full_name;
  end if;
end;
$$;

grant execute on function public.allocate_repo_ticket_number(text) to service_role;
grant execute on function public.lock_github_repository_ticket_prefix(text) to service_role;
