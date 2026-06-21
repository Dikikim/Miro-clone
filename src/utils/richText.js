// Rich-text model. A node's per-character formatting lives in `colorSegments`
// (the name is kept for backwards-compat with existing boards) — an array of
// runs: { text, fill, fontSize, fontFamily, fontStyle, textDecoration }. Any
// attribute may be omitted on a run, in which case the node-level value is used.
// This lets colour, size, font and style each be applied to just a selected
// range of characters, in both text boxes and sticky notes.

export function nodeBaseAttrs(node) {
    const isSticky = node.type === 'sticky';
    return {
        fill: isSticky ? node.textColor : node.fill,   // undefined when unset → theme default at render
        fontSize: node.fontSize || (isSticky ? 18 : 24),
        fontFamily: node.fontFamily || 'Arial',
        fontStyle: node.fontStyle || 'normal',
        textDecoration: node.textDecoration || '',
    };
}

export function sameAttrs(a, b) {
    return a.fill === b.fill && a.fontSize === b.fontSize && a.fontFamily === b.fontFamily &&
        a.fontStyle === b.fontStyle && a.textDecoration === b.textDecoration;
}

// Expand segments to a per-character attribute array, padded to textLen with the
// node base (segments can lag behind later text edits). Missing per-run fields
// fall back to base, so legacy colour-only segments keep working.
export function charAttrsFromSegments(segments, textLen, base) {
    const attrs = new Array(textLen);
    let idx = 0;
    if (segments) {
        for (const seg of segments) {
            for (let i = 0; i < seg.text.length && idx < textLen; i++, idx++) {
                attrs[idx] = {
                    fill: seg.fill ?? base.fill,
                    fontSize: seg.fontSize ?? base.fontSize,
                    fontFamily: seg.fontFamily ?? base.fontFamily,
                    fontStyle: seg.fontStyle ?? base.fontStyle,
                    textDecoration: seg.textDecoration ?? base.textDecoration,
                };
            }
        }
    }
    for (let i = 0; i < textLen; i++) if (!attrs[i]) attrs[i] = { ...base };
    return attrs;
}

// Coalesce a per-char attrs array back into runs aligned with `text`.
function coalesce(text, attrs) {
    const out = [];
    for (let i = 0; i < text.length; i++) {
        if (out.length && sameAttrs(out[out.length - 1], attrs[i])) {
            out[out.length - 1].text += text[i];
        } else {
            out.push({ text: text[i], ...attrs[i] });
        }
    }
    return out;
}

// Apply `transform(attr) -> attr` to each character in [start, end). Returns
// { segments, uniform, attr } where `uniform` means the whole text ended up with
// a single style (so it can be stored at node level and segments dropped), and
// `attr` is the resulting style of the first character.
export function applyToRange(text, segments, base, start, end, transform) {
    const n = text.length;
    // No text yet → apply the change to the base style so it takes effect for
    // whatever the user types next (lets you set font/size/style/colour first).
    if (n === 0) return { segments: null, uniform: true, attr: transform({ ...base }) };
    const attrs = charAttrsFromSegments(segments, n, base);
    const s = Math.max(0, start), e = Math.min(n, end);
    for (let i = s; i < e; i++) attrs[i] = transform(attrs[i]);
    const runs = coalesce(text, attrs);
    return { segments: runs, uniform: runs.length <= 1, attr: runs[0] || { ...base } };
}

// True only if every character in [start, end) satisfies test(attr). Used to
// decide whether a bold/italic/underline toggle should turn the run on or off.
export function rangeEvery(text, segments, base, start, end, test) {
    const n = text.length;
    if (n === 0) return false;
    const attrs = charAttrsFromSegments(segments, n, base);
    const s = Math.max(0, start), e = Math.min(n, end);
    if (s >= e) return false;
    for (let i = s; i < e; i++) if (!test(attrs[i])) return false;
    return true;
}

// fontStyle combines bold + italic into one string ('bold', 'italic',
// 'bold italic', 'normal') — toggle one axis while preserving the other.
export function setBold(style, on) {
    const italic = (style || '').includes('italic');
    if (on) return italic ? 'bold italic' : 'bold';
    return italic ? 'italic' : 'normal';
}
export function setItalic(style, on) {
    const bold = (style || '').includes('bold');
    if (on) return bold ? 'bold italic' : 'italic';
    return bold ? 'bold' : 'normal';
}
