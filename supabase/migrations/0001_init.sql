-- Voice Studio AI — initial schema
-- Tables, RLS policies, and storage buckets.

-- ─── Extensions ───────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Profiles ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are editable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Voices ───────────────────────────────────────────────────────────────
create table if not exists public.voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  gender text not null,
  age text,
  accent text,
  language text not null default 'English',
  style text,
  description text,
  favorite boolean not null default false,
  folder text,
  elevenlabs_voice_id text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voices enable row level security;

create policy "Voices are managed by owner"
  on public.voices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists voices_user_id_idx on public.voices (user_id);
create index if not exists voices_folder_idx on public.voices (user_id, folder);

-- ─── Projects ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  voice_id uuid references public.voices (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'processing', 'ready', 'archived')),
  duration_seconds numeric not null default 0,
  favorite boolean not null default false,
  tags text[] not null default '{}',
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Projects are managed by owner"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_status_idx on public.projects (user_id, status);

-- ─── Generations (individual TTS render history) ────────────────────────────
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  voice_id uuid references public.voices (id) on delete set null,
  text text not null,
  duration_seconds numeric not null default 0,
  audio_url text,
  created_at timestamptz not null default now()
);

alter table public.generations enable row level security;

create policy "Generations are managed by owner"
  on public.generations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists generations_user_id_idx on public.generations (user_id);
create index if not exists generations_project_id_idx on public.generations (project_id);

-- ─── User API keys (encrypted at rest by the server before insert) ─────────
create table if not exists public.user_api_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('elevenLabsApiKey', 'openAiApiKey', 'deepgramApiKey')),
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_api_keys enable row level security;

-- No client-side access — only the server (service role) reads/writes this table.
create policy "API keys are not accessible from the client"
  on public.user_api_keys for all
  using (false)
  with check (false);

-- ─── updated_at maintenance ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.voices
  for each row execute procedure public.set_updated_at();

create trigger set_updated_at before update on public.projects
  for each row execute procedure public.set_updated_at();

create trigger set_updated_at before update on public.user_api_keys
  for each row execute procedure public.set_updated_at();

create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ─── Storage buckets ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('voice-samples', 'voice-samples', false),
  ('generated-audio', 'generated-audio', false),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Users may only read/write within a folder prefixed by their own user id,
-- e.g. voice-samples/<user_id>/sample-1.mp3
create policy "Users manage their own voice samples"
  on storage.objects for all
  using (bucket_id = 'voice-samples' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'voice-samples' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users manage their own generated audio"
  on storage.objects for all
  using (bucket_id = 'generated-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'generated-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users manage their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
