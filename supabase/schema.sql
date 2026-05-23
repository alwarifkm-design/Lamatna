-- نفّذ هذا الملف من Supabase → SQL Editor → Run

create table if not exists public.game_rooms (
  code text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists game_rooms_updated_at on public.game_rooms (updated_at desc);

alter table public.game_rooms enable row level security;

drop policy if exists "game_rooms_select" on public.game_rooms;
drop policy if exists "game_rooms_insert" on public.game_rooms;
drop policy if exists "game_rooms_update" on public.game_rooms;

create policy "game_rooms_select" on public.game_rooms for select using (true);
create policy "game_rooms_insert" on public.game_rooms for insert with check (true);
create policy "game_rooms_update" on public.game_rooms for update using (true);

-- Realtime: من Dashboard → Database → Replication → فعّل game_rooms
-- أو: alter publication supabase_realtime add table game_rooms;
