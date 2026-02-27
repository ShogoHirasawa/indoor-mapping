-- プロフィールテーブル（auth.users と 1:1、ユーザー名を保存）
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- 本人のみ自分のプロフィールを読める
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 本人のみ自分のプロフィールを更新できる
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 本人のみ自分のプロフィールを挿入できる（初回ログイン時のユーザーID設定で insert）
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
