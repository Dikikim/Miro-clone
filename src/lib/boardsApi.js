import { supabase } from './supabase';

// Thin Supabase data layer for boards + their node/comment rows. Every call is
// best-effort: on error it logs and returns a neutral value so the caller can
// fall back to the localStorage cache instead of crashing.

export async function getUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
}

// ── Boards ───────────────────────────────────────────────────────────────
export async function fetchBoards() {
    const { data, error } = await supabase
        .from('boards')
        .select('id, name, owner_id, created_at')
        .order('created_at', { ascending: true });
    if (error) { console.error('[boards] fetch:', error.message); return null; }
    return data;
}

export async function createBoard(name) {
    const uid = await getUserId();
    if (!uid) return null;
    const { data, error } = await supabase
        .from('boards')
        .insert({ name, owner_id: uid })
        .select('id, name, owner_id')
        .single();
    if (error) { console.error('[boards] create:', error.message); return null; }
    return data;
}

export async function renameBoardCloud(id, name) {
    const { error } = await supabase.from('boards').update({ name }).eq('id', id);
    if (error) console.error('[boards] rename:', error.message);
}

export async function deleteBoardCloud(id) {
    const { error } = await supabase.from('boards').delete().eq('id', id);
    if (error) console.error('[boards] delete:', error.message);
}

// ── Content (nodes + comments) ───────────────────────────────────────────
// Rows store the object in `data` (jsonb); id and created_by live in columns.
export async function fetchBoardContent(boardId) {
    const [nodesRes, commentsRes] = await Promise.all([
        supabase.from('nodes').select('id, created_by, data').eq('board_id', boardId),
        supabase.from('comments').select('id, created_by, data').eq('board_id', boardId),
    ]);
    if (nodesRes.error) console.error('[boards] fetch nodes:', nodesRes.error.message);
    if (commentsRes.error) console.error('[boards] fetch comments:', commentsRes.error.message);
    const nodes = (nodesRes.data || []).map(r => ({ ...r.data, id: r.id, createdBy: r.created_by }));
    const comments = (commentsRes.data || []).map(r => ({ ...r.data, id: r.id, createdBy: r.created_by }));
    return { nodes, comments };
}

const toRow = (boardId, uid, item) => {
    const { createdBy, id, ...rest } = item;
    return {
        id,
        board_id: boardId,
        created_by: createdBy || uid,
        data: rest,
        updated_at: new Date().toISOString(),
    };
};

// Diff-based push: upsert the changed/new items, delete the removed ids. RLS
// silently rejects writes to objects the user doesn't own — that's intended.
export async function pushNodes(boardId, upserts, deleteIds) {
    const uid = await getUserId();
    if (!uid) return;
    if (upserts.length) {
        const rows = upserts.map(n => toRow(boardId, uid, n));
        const { error } = await supabase.from('nodes').upsert(rows, { onConflict: 'id' });
        if (error) console.error('[boards] upsert nodes:', error.message);
    }
    if (deleteIds.length) {
        const { error } = await supabase.from('nodes').delete().in('id', deleteIds);
        if (error) console.error('[boards] delete nodes:', error.message);
    }
}

export async function pushComments(boardId, upserts, deleteIds) {
    const uid = await getUserId();
    if (!uid) return;
    if (upserts.length) {
        const rows = upserts.map(c => toRow(boardId, uid, c));
        const { error } = await supabase.from('comments').upsert(rows, { onConflict: 'id' });
        if (error) console.error('[boards] upsert comments:', error.message);
    }
    if (deleteIds.length) {
        const { error } = await supabase.from('comments').delete().in('id', deleteIds);
        if (error) console.error('[boards] delete comments:', error.message);
    }
}
