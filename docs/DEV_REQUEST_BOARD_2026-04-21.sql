begin;

create table if not exists public.team_requests (
  id uuid primary key default gen_random_uuid(),
  board_type text not null default '개발팀',
  title text not null,
  description text not null default '',
  request_team text,
  status text not null default '접수됨',
  priority text not null default '중간',
  template_data jsonb not null default '{}'::jsonb,
  order_index integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_requests_title_nonempty check (char_length(trim(title)) > 0),
  constraint team_requests_board_type_nonempty check (char_length(trim(board_type)) > 0)
);

create index if not exists team_requests_board_order_idx
  on public.team_requests (board_type, order_index);

create index if not exists team_requests_board_updated_idx
  on public.team_requests (board_type, updated_at desc);

alter table public.team_requests enable row level security;

drop policy if exists "team requests select all" on public.team_requests;
create policy "team requests select all"
on public.team_requests
for select
to anon, authenticated
using (true);

drop policy if exists "team requests insert authenticated" on public.team_requests;
create policy "team requests insert authenticated"
on public.team_requests
for insert
to authenticated
with check (true);

drop policy if exists "team requests update authenticated" on public.team_requests;
create policy "team requests update authenticated"
on public.team_requests
for update
to authenticated
using (true)
with check (true);

drop policy if exists "team requests delete authenticated" on public.team_requests;
create policy "team requests delete authenticated"
on public.team_requests
for delete
to authenticated
using (true);

insert into public.team_requests (
  id,
  board_type,
  title,
  description,
  request_team,
  status,
  priority,
  template_data,
  order_index,
  created_by,
  created_at,
  updated_at
)
select
  source.id,
  coalesce(source.board_type, '개발팀'),
  coalesce(source.title, '제목 없음'),
  coalesce(source.description, source.content, ''),
  null,
  coalesce(source.status, '접수됨'),
  coalesce(source.priority, '중간'),
  '{}'::jsonb,
  coalesce(source.order_index, 0),
  source.created_by,
  coalesce(source.created_at, now()),
  coalesce(source.updated_at, coalesce(source.created_at, now()))
from public.items source
where source.board_type = '개발팀'
  and (
    source.entity_type = 'request'
    or coalesce(source.tags, '{}'::text[]) @> array['request']::text[]
  )
on conflict (id) do nothing;

delete from public.items source
where source.board_type = '개발팀'
  and (
    source.entity_type = 'request'
    or coalesce(source.tags, '{}'::text[]) @> array['request']::text[]
  )
  and exists (
    select 1
    from public.team_requests tr
    where tr.id = source.id
  );

insert into public.team_requests (
  id,
  board_type,
  title,
  description,
  request_team,
  status,
  priority,
  template_data,
  order_index,
  created_by,
  created_at,
  updated_at
)
select
  source.id,
  coalesce(source.board_type, '개발팀'),
  coalesce(source.title, '제목 없음'),
  coalesce(source.description, source.content, ''),
  null,
  coalesce(source.status, '접수됨'),
  coalesce(source.priority, '중간'),
  '{}'::jsonb,
  coalesce(source.order_index, 0),
  source.created_by,
  coalesce(source.created_at, now()),
  coalesce(source.updated_at, coalesce(source.created_at, now()))
from public.roadmap_items source
where source.board_type = '개발팀'
  and (
    source.entity_type = 'request'
    or coalesce(source.tags, '{}'::text[]) @> array['request']::text[]
  )
on conflict (id) do nothing;

delete from public.roadmap_items source
where source.board_type = '개발팀'
  and (
    source.entity_type = 'request'
    or coalesce(source.tags, '{}'::text[]) @> array['request']::text[]
  )
  and exists (
    select 1
    from public.team_requests tr
    where tr.id = source.id
  );

commit;
