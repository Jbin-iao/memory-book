create table if not exists public.romantic_archives (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.romantic_archives enable row level security;

drop policy if exists "Users can read own romantic archive" on public.romantic_archives;
create policy "Users can read own romantic archive"
on public.romantic_archives
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own romantic archive" on public.romantic_archives;
create policy "Users can insert own romantic archive"
on public.romantic_archives
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own romantic archive" on public.romantic_archives;
create policy "Users can update own romantic archive"
on public.romantic_archives
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own romantic archive" on public.romantic_archives;
create policy "Users can delete own romantic archive"
on public.romantic_archives
for delete
using (auth.uid() = user_id);

create index if not exists romantic_archives_updated_at_idx
on public.romantic_archives (updated_at desc);
