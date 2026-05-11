create table public.backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  device_id text,
  device_name text,
  size_bytes integer,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.backups enable row level security;

create policy "Users can read own backup"
  on public.backups for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own backup"
  on public.backups for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own backup"
  on public.backups for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own backup"
  on public.backups for delete
  to authenticated
  using (auth.uid() = user_id);
