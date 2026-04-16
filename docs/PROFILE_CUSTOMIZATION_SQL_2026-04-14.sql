-- profile customization + mini reactions (v1)
-- run in Supabase SQL editor

create table if not exists public.profile_customizations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  avatar_style text not null default 'aurora',
  theme_color text not null default 'slate',
  status_message text not null default '',
  mood_emoji text not null default '',
  updated_at timestamptz not null default now(),
  constraint profile_customizations_status_message_len check (char_length(status_message) <= 40)
);

create table if not exists public.profile_reactions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  constraint profile_reactions_type_check check (reaction_type in ('thumbs_up', 'fire', 'clap', 'joy')),
  constraint profile_reactions_unique unique (target_user_id, actor_user_id, reaction_type)
);

alter table public.profile_customizations enable row level security;
alter table public.profile_reactions enable row level security;

drop policy if exists "profile_customizations_read_authenticated" on public.profile_customizations;
create policy "profile_customizations_read_authenticated"
on public.profile_customizations
for select
to authenticated
using (true);

drop policy if exists "profile_customizations_write_own" on public.profile_customizations;
create policy "profile_customizations_write_own"
on public.profile_customizations
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "profile_reactions_read_authenticated" on public.profile_reactions;
create policy "profile_reactions_read_authenticated"
on public.profile_reactions
for select
to authenticated
using (true);

drop policy if exists "profile_reactions_insert_authenticated" on public.profile_reactions;
create policy "profile_reactions_insert_authenticated"
on public.profile_reactions
for insert
to authenticated
with check (
  auth.uid() = actor_user_id
  and auth.uid() <> target_user_id
);

drop policy if exists "profile_reactions_delete_own" on public.profile_reactions;
create policy "profile_reactions_delete_own"
on public.profile_reactions
for delete
to authenticated
using (auth.uid() = actor_user_id);

create index if not exists profile_reactions_target_created_at_idx
on public.profile_reactions(target_user_id, created_at desc);
