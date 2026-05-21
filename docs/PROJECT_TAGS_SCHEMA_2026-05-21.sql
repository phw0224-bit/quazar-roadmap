begin;

alter table public.projects
  add column if not exists tags text[] not null default '{}'::text[];

alter table public.roadmap_projects
  add column if not exists tags text[] not null default '{}'::text[];

commit;
