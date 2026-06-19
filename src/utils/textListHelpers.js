// Per-line list utilities. Each line is independently a bullet, a numbered
// item, or plain text, so the three can be freely MIXED inside one text block
// (Miro-style). Prefixes ("• ", "N. ") are stored literally in the text and the
// numbers are kept sequential within each consecutive run of numbered lines.

const NUM_RE = /^\d+\.[ \t]/;
const BULLET_RE = /^•[ \t]/;
const STRIP_RE = /^(?:•|\d+\.)[ \t]*/;

export function lineKind(line) {
    if (BULLET_RE.test(line)) return 'bullet';
    if (NUM_RE.test(line)) return 'number';
    return 'plain';
}

export function stripPrefix(line) {
    return line.replace(STRIP_RE, '');
}

// Re-sequence numbered lines. Numbering restarts after any non-numbered line,
// so each run of consecutive "N." lines counts 1, 2, 3… on its own. Bullet and
// plain lines are left untouched.
export function renumber(text) {
    let n = 0;
    return text.split('\n').map((line) => {
        if (NUM_RE.test(line)) { n += 1; return `${n}. ${line.replace(STRIP_RE, '')}`; }
        n = 0;
        return line;
    }).join('\n');
}

// Map an absolute caret offset to { line, col } where col is measured from the
// start of the line's CONTENT (i.e. after any list prefix).
function toLineCol(text, pos) {
    const lines = text.split('\n');
    let acc = 0;
    for (let i = 0; i < lines.length; i++) {
        const end = acc + lines[i].length;
        if (pos <= end) {
            const prefix = lines[i].length - stripPrefix(lines[i]).length;
            return { line: i, col: Math.max(0, (pos - acc) - prefix) };
        }
        acc = end + 1;
    }
    const last = Math.max(0, lines.length - 1);
    return { line: last, col: stripPrefix(lines[last] || '').length };
}

// Convert { line, contentCol } back to an absolute offset in `text`.
function fromLineCol(text, line, col) {
    const lines = text.split('\n');
    const tLine = Math.min(line, lines.length - 1);
    let pos = 0;
    for (let i = 0; i < tLine; i++) pos += lines[i].length + 1;
    const prefix = lines[tLine].length - stripPrefix(lines[tLine]).length;
    return pos + Math.min(prefix + col, lines[tLine].length);
}

// Remap a caret across a change that only altered list prefixes — keeps the
// caret on the same line at the same spot within that line's content.
export function remapCaret(oldText, oldPos, newText) {
    const { line, col } = toLineCol(oldText, oldPos);
    return fromLineCol(newText, line, col);
}

// Toggle `targetType` ('bullet' | 'number') for every line touched by the
// [selStart, selEnd] selection. If all those lines are already that type the
// prefix is removed (toggle off); otherwise they are all set to that type.
// Other lines are untouched, so list types stay mixed. Returns the new
// { text, selStart, selEnd }.
export function toggleList(text, selStart, selEnd, targetType) {
    const lines = text.split('\n');
    const starts = [];
    let acc = 0;
    for (const l of lines) { starts.push(acc); acc += l.length + 1; }
    const lineAt = (pos) => {
        for (let i = lines.length - 1; i >= 0; i--) if (pos >= starts[i]) return i;
        return 0;
    };
    const first = lineAt(selStart);
    const last = lineAt(selEnd);

    let allTarget = true;
    for (let i = first; i <= last; i++) if (lineKind(lines[i]) !== targetType) { allTarget = false; break; }

    for (let i = first; i <= last; i++) {
        const content = stripPrefix(lines[i]);
        if (allTarget) lines[i] = content;                       // toggle off → plain
        else if (targetType === 'bullet') lines[i] = `• ${content}`;
        else lines[i] = `1. ${content}`;                         // renumber fixes the value
    }
    const newText = renumber(lines.join('\n'));
    return {
        text: newText,
        selStart: remapCaret(text, selStart, newText),
        selEnd: remapCaret(text, selEnd, newText),
    };
}

// Enter pressed inside a list line. Continues the SAME kind as the current line
// (renumbering as needed); if the current item is empty, drops its prefix to
// exit the list instead. Returns { text, caret }, or null for a plain line so
// the textarea inserts a normal newline.
export function listEnter(text, pos) {
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd);
    const kind = lineKind(line);
    if (kind === 'plain') return null;

    const content = stripPrefix(line);
    if (content.trim() === '') {
        // Empty item → remove the prefix and stay on the (now plain) line.
        const newText = renumber(text.slice(0, lineStart) + text.slice(lineEnd));
        return { text: newText, caret: lineStart };
    }

    const insert = kind === 'bullet' ? '\n• ' : '\n1. ';
    const withInsert = text.slice(0, pos) + insert + text.slice(pos);
    const newText = renumber(withInsert);
    return { text: newText, caret: remapCaret(withInsert, pos + insert.length, newText) };
}
