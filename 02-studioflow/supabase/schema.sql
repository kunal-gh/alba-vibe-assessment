create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  color text not null default '#c7ff45',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text,
  image_url text not null check (image_url ~ '^https?://'),
  tags text[] not null default '{}',
  featured boolean not null default false,
  captured_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep this explicit for projects created from an earlier schema revision.
alter table public.assets alter column featured set default false;

create index if not exists projects_owner_created_idx on public.projects(user_id, created_at desc);
create index if not exists assets_owner_project_created_idx on public.assets(user_id, project_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute procedure public.set_updated_at();
drop trigger if exists set_assets_updated_at on public.assets;
create trigger set_assets_updated_at before update on public.assets for each row execute procedure public.set_updated_at();

alter table public.projects enable row level security;
alter table public.assets enable row level security;

drop policy if exists "projects are isolated by owner" on public.projects;
drop policy if exists "assets are isolated by owner" on public.assets;
drop policy if exists "owners can create assets in their projects" on public.assets;
drop policy if exists "owners can update their assets" on public.assets;
drop policy if exists "owners can delete their assets" on public.assets;

create policy "projects are isolated by owner" on public.projects
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "assets are isolated by owner" on public.assets
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owners can create assets in their projects" on public.assets
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.projects where projects.id = project_id and projects.user_id = (select auth.uid()))
  );
create policy "owners can update their assets" on public.assets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.projects where projects.id = project_id and projects.user_id = (select auth.uid()))
  );
create policy "owners can delete their assets" on public.assets
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Enables the optional live-update enhancement used by the dashboard. The
-- duplicate-object guards make this schema safe to re-run in Supabase SQL Editor.
do $$
begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.assets;
exception when duplicate_object then
  null;
end;
$$;
