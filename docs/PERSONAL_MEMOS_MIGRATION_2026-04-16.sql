begin;

create table if not exists public.personal_memos (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  description text,
  order_index integer not null default 0,
  ai_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_memos_owner_order_idx
  on public.personal_memos (owner_id, order_index);

create index if not exists personal_memos_owner_updated_idx
  on public.personal_memos (owner_id, updated_at desc);

alter table public.personal_memos enable row level security;

create policy "personal memos select own"
  on public.personal_memos
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "personal memos insert own"
  on public.personal_memos
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "personal memos update own"
  on public.personal_memos
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "personal memos delete own"
  on public.personal_memos
  for delete
  to authenticated
  using (owner_id = auth.uid());

insert into public.personal_memos (
  id,
  owner_id,
  title,
  content,
  description,
  order_index,
  ai_summary,
  created_at,
  updated_at
)
select
  id,
  owner_id,
  coalesce(title, '제목 없음'),
  content,
  description,
  order_index,
  ai_summary,
  coalesce(created_at, now()),
  coalesce(created_at, now())
from public.roadmap_items
where is_private = true
  and owner_id is not null
on conflict (id) do nothing;

delete from public.roadmap_items ri
where ri.is_private = true
  and ri.owner_id is not null
  and exists (
    select 1
    from public.personal_memos pm
    where pm.id = ri.id
  );

commit;
