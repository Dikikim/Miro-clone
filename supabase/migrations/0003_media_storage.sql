-- Phase 4: media → Supabase Storage
-- Run in Supabase Studio → SQL Editor after 0002_boards.sql.
--
-- Goal: move image/video/audio/PDF bytes out of per-browser IndexedDB and into
-- a shared bucket, so every board member (link holder) — and the same user on a
-- second device — sees everyone's media.

-- ── Bucket ───────────────────────────────────────────────────────────────
-- Public read: a board's media is as visible as the board itself (link holders
-- "view everything"). Paths are board-scoped + UUID-based, so they aren't
-- enumerable: <board_id>/<node_id>/<src|cover|doc.pdf>.
-- Hardening (later): make the bucket private + serve signed URLs, and scope
-- writes to board membership via the path prefix.
insert into storage.buckets (id, name, public)
values ('board-media', 'board-media', true)
on conflict (id) do update set public = excluded.public;

-- ── RLS on storage.objects ───────────────────────────────────────────────
-- Read: anyone (bucket is public). Write: any signed-in user; update/delete is
-- limited to the object's uploader. RLS on the nodes table already governs who
-- can change the canvas object that points at each file.
drop policy if exists "board-media read"   on storage.objects;
drop policy if exists "board-media insert" on storage.objects;
drop policy if exists "board-media update" on storage.objects;
drop policy if exists "board-media delete" on storage.objects;

create policy "board-media read" on storage.objects
  for select using (bucket_id = 'board-media');

create policy "board-media insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'board-media');

create policy "board-media update" on storage.objects
  for update to authenticated
  using (bucket_id = 'board-media' and owner = auth.uid());

create policy "board-media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'board-media' and owner = auth.uid());
