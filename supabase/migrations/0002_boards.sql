-- Phase 2: boards, membership, nodes, comments + RLS
-- Run in Supabase Studio → SQL Editor after 0001_profiles.sql.

-- ── Tables ───────────────────────────────────────────────────────────────
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'Untitled board',
  share_token text unique not null default encode(gen_random_bytes(9), 'base64'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Who can open a board. role: 'owner' (full control) | 'member' (own edits only)
create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  role     text not null default 'member',
  added_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- Each canvas object is its own row, owned by whoever created it.
create table if not exists public.nodes (
  id         uuid primary key,
  board_id   uuid not null references public.boards(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists nodes_board_idx on public.nodes(board_id);

create table if not exists public.comments (
  id         uuid primary key,
  board_id   uuid not null references public.boards(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_board_idx on public.comments(board_id);

-- ── Helper functions (SECURITY DEFINER → bypass RLS, avoid policy recursion) ─
create or replace function public.can_access_board(b uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.boards bo where bo.id = b and bo.owner_id = auth.uid())
      or exists (select 1 from public.board_members m where m.board_id = b and m.user_id = auth.uid())
      or public.is_admin();
$$;

create or replace function public.is_board_owner(b uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.boards bo where bo.id = b and bo.owner_id = auth.uid())
      or public.is_admin();
$$;

-- Owner is automatically a member of their own board.
create or replace function public.handle_new_board()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.board_members (board_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_board_created on public.boards;
create trigger on_board_created after insert on public.boards
  for each row execute function public.handle_new_board();

-- ── RLS: boards ──────────────────────────────────────────────────────────
alter table public.boards enable row level security;

drop policy if exists "boards read"   on public.boards;
drop policy if exists "boards insert" on public.boards;
drop policy if exists "boards update" on public.boards;
drop policy if exists "boards delete" on public.boards;

create policy "boards read"   on public.boards for select using (public.can_access_board(id));
create policy "boards insert" on public.boards for insert with check (owner_id = auth.uid());
create policy "boards update" on public.boards for update using (public.is_board_owner(id));
create policy "boards delete" on public.boards for delete using (public.is_board_owner(id));

-- ── RLS: board_members ───────────────────────────────────────────────────
alter table public.board_members enable row level security;

drop policy if exists "members read"   on public.board_members;
drop policy if exists "members insert" on public.board_members;
drop policy if exists "members delete" on public.board_members;

-- See members of any board you can access.
create policy "members read"   on public.board_members for select using (public.can_access_board(board_id));
-- Only the board owner (or admin) adds/removes members.
create policy "members insert" on public.board_members for insert with check (public.is_board_owner(board_id));
create policy "members delete" on public.board_members for delete using (public.is_board_owner(board_id));

-- ── RLS: nodes (THE core rule) ───────────────────────────────────────────
alter table public.nodes enable row level security;

drop policy if exists "nodes read"   on public.nodes;
drop policy if exists "nodes insert" on public.nodes;
drop policy if exists "nodes update" on public.nodes;
drop policy if exists "nodes delete" on public.nodes;

-- Anyone with board access can READ every node (so they see the whole board).
create policy "nodes read"   on public.nodes for select using (public.can_access_board(board_id));
-- Members can add nodes, stamped as their own.
create policy "nodes insert" on public.nodes for insert with check (public.can_access_board(board_id) and created_by = auth.uid());
-- Edit/delete only YOUR nodes — unless you own the board (teacher) or are admin.
create policy "nodes update" on public.nodes for update using (created_by = auth.uid() or public.is_board_owner(board_id));
create policy "nodes delete" on public.nodes for delete using (created_by = auth.uid() or public.is_board_owner(board_id));

-- ── RLS: comments (same ownership rules as nodes) ────────────────────────
alter table public.comments enable row level security;

drop policy if exists "comments read"   on public.comments;
drop policy if exists "comments insert" on public.comments;
drop policy if exists "comments update" on public.comments;
drop policy if exists "comments delete" on public.comments;

create policy "comments read"   on public.comments for select using (public.can_access_board(board_id));
create policy "comments insert" on public.comments for insert with check (public.can_access_board(board_id) and created_by = auth.uid());
create policy "comments update" on public.comments for update using (created_by = auth.uid() or public.is_board_owner(board_id));
create policy "comments delete" on public.comments for delete using (created_by = auth.uid() or public.is_board_owner(board_id));
