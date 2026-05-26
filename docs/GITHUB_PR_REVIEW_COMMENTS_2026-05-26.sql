-- GitHub PR 리뷰 제출 이벤트를 아이템 댓글 타임라인에 시스템 댓글로 미러링
-- 적용 위치: Supabase SQL Editor

begin;

alter table public.comments
  add column if not exists source text not null default 'user';

alter table public.comments
  add column if not exists source_event_id text;

alter table public.comments
  add column if not exists source_url text;

alter table public.comments
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists comments_source_event_unique_idx
  on public.comments (source, source_event_id)
  where source_event_id is not null;

create index if not exists comments_item_source_created_at_idx
  on public.comments (item_id, source, created_at asc);

commit;
