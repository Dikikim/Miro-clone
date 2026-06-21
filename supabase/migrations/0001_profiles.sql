-- Phase 1: profiles + roles + auth trigger + RLS
-- Run in Supabase Studio → SQL Editor (or via the Supabase CLI).

-- ── Roles ────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('admin', 'teacher', 'student');
exception when duplicate_object then null; end $$;

-- ── Profiles (one row per auth user) ─────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text,
  avatar_url text,
  role       user_role not null default 'student',
  teacher_id uuid references public.profiles(id),   -- a student's assigned teacher
  created_at timestamptz not null default now()
);

-- ── Helper: is the current user an admin? ────────────────────────────────
-- SECURITY DEFINER so it reads profiles bypassing RLS. This avoids the classic
-- "infinite recursion" error you get when a profiles policy queries profiles.
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Auto-create a profile when a new user signs up ───────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Anti-escalation: only an admin may change a role ─────────────────────
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  -- Only restrict real authenticated app users. Privileged updates from the
  -- SQL editor / service role (auth.uid() is null) are allowed, so the very
  -- first admin can be bootstrapped.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

drop trigger if exists guard_role on public.profiles;
create trigger guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ── Row Level Security ───────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "read own or admin" on public.profiles;
create policy "read own or admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "update own or admin" on public.profiles;
create policy "update own or admin" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- No public INSERT/DELETE policy: profile rows are created by the trigger
-- above (and removed via the auth.users cascade), not by the client.
