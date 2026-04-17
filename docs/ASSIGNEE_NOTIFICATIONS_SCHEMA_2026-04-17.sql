begin;

alter table public.items
  add column if not exists assignee_user_ids uuid[] not null default '{}'::uuid[];

alter table public.projects
  add column if not exists assignee_user_ids uuid[] not null default '{}'::uuid[];

alter table public.roadmap_items
  add column if not exists assignee_user_ids uuid[] not null default '{}'::uuid[];

alter table public.roadmap_projects
  add column if not exists assignee_user_ids uuid[] not null default '{}'::uuid[];

update public.items as target
set assignee_user_ids = coalesce((
  select array_agg(resolved.user_id order by resolved.first_ord)
  from (
    select p.id as user_id, min(source.ord) as first_ord
    from unnest(coalesce(target.assignees, '{}'::text[])) with ordinality as source(name, ord)
    join public.profiles p
      on lower(trim(p.name)) = lower(trim(source.name))
    group by p.id
  ) as resolved
), '{}'::uuid[]);

update public.projects as target
set assignee_user_ids = coalesce((
  select array_agg(resolved.user_id order by resolved.first_ord)
  from (
    select p.id as user_id, min(source.ord) as first_ord
    from unnest(coalesce(target.assignees, '{}'::text[])) with ordinality as source(name, ord)
    join public.profiles p
      on lower(trim(p.name)) = lower(trim(source.name))
    group by p.id
  ) as resolved
), '{}'::uuid[]);

update public.roadmap_items as target
set assignee_user_ids = coalesce((
  select array_agg(resolved.user_id order by resolved.first_ord)
  from (
    select p.id as user_id, min(source.ord) as first_ord
    from unnest(coalesce(target.assignees, '{}'::text[])) with ordinality as source(name, ord)
    join public.profiles p
      on lower(trim(p.name)) = lower(trim(source.name))
    group by p.id
  ) as resolved
), '{}'::uuid[]);

update public.roadmap_projects as target
set assignee_user_ids = coalesce((
  select array_agg(resolved.user_id order by resolved.first_ord)
  from (
    select p.id as user_id, min(source.ord) as first_ord
    from unnest(coalesce(target.assignees, '{}'::text[])) with ordinality as source(name, ord)
    join public.profiles p
      on lower(trim(p.name)) = lower(trim(source.name))
    group by p.id
  ) as resolved
), '{}'::uuid[]);

create index if not exists items_assignee_user_ids_gin
  on public.items using gin (assignee_user_ids);

create index if not exists projects_assignee_user_ids_gin
  on public.projects using gin (assignee_user_ids);

create index if not exists roadmap_items_assignee_user_ids_gin
  on public.roadmap_items using gin (assignee_user_ids);

create index if not exists roadmap_projects_assignee_user_ids_gin
  on public.roadmap_projects using gin (assignee_user_ids);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type text not null,
  entity_table text not null,
  entity_id uuid not null,
  parent_entity_table text,
  parent_entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_nonempty check (char_length(trim(type)) > 0),
  constraint notifications_entity_table_nonempty check (char_length(trim(entity_table)) > 0),
  constraint notifications_parent_entity_table_nonempty check (
    parent_entity_table is null
    or char_length(trim(parent_entity_table)) > 0
  )
);

create index if not exists notifications_recipient_created_at_idx
  on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_entity_idx
  on public.notifications (entity_table, entity_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own"
on public.notifications
for select
to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

commit;
