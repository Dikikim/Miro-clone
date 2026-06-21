// One-off: crop the flower out of public/transp_bg.png (which has ~22% transparent
// padding) and downsample to a tight 256x256 icon for the header/favicon/spinner.
const fs = require('fs'), zlib = require('zlib');

function decode(path) {
    const b = fs.readFileSync(path);
    const W = b.readUInt32BE(16), H = b.readUInt32BE(20);
    let idat = [], o = 8;
    while (o < b.length) {
        const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8);
        if (type === 'IDAT') idat.push(b.slice(o + 8, o + 8 + len));
        o += 12 + len;
        if (type === 'IEND') break;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const ch = 4, stride = W * ch;
    const out = Buffer.alloc(W * H * ch);
    const prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
    const paeth = (a, bb, c) => { const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; };
    let ptr = 0;
    for (let y = 0; y < H; y++) {
        const f = raw[ptr++];
        for (let i = 0; i < stride; i++) {
            const xb = raw[ptr++], a = i >= ch ? cur[i - ch] : 0, up = prev[i], ul = i >= ch ? prev[i - ch] : 0;
            let v; if (f === 0) v = xb; else if (f === 1) v = xb + a; else if (f === 2) v = xb + up; else if (f === 3) v = xb + ((a + up) >> 1); else v = xb + paeth(a, up, ul);
            cur[i] = v & 255;
        }
        cur.copy(out, y * stride); cur.copy(prev);
    }
    return { W, H, data: out };
}

function encode(W, H, data) {
    const stride = W * 4;
    const rows = Buffer.alloc((stride + 1) * H);
    for (let y = 0; y < H; y++) { rows[y * (stride + 1)] = 0; data.copy(rows, y * (stride + 1) + 1, y * stride, y * stride + stride); }
    const idat = zlib.deflateSync(rows, { level: 9 });
    const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const chunk = (type, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, d]))); return Buffer.concat([len, t, d, crc]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const src = decode('D:/Miro_clone/public/transp_bg.png');
// crop region centred on the flower (bbox 438,420..1546,1540 -> centre 992,980)
// flower is ~1120px tall → side = 1120 / 0.95 makes it fill ~95% of the icon
const cx = 992, cy = 980, side = 1180, x0 = cx - side / 2, y0 = cy - side / 2;
const O = 256, out = Buffer.alloc(O * O * 4);
for (let oy = 0; oy < O; oy++) {
    for (let ox = 0; ox < O; ox++) {
        // box-average the source block (premultiplied alpha to avoid edge fringing)
        const sx0 = Math.floor(x0 + ox * side / O), sx1 = Math.floor(x0 + (ox + 1) * side / O);
        const sy0 = Math.floor(y0 + oy * side / O), sy1 = Math.floor(y0 + (oy + 1) * side / O);
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
            const i = (sy * src.W + sx) * 4, al = src.data[i + 3] / 255;
            r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += src.data[i + 3]; n++;
        }
        const oi = (oy * O + ox) * 4, av = a / n;
        out[oi + 3] = Math.round(av);
        const aw = av > 0 ? (a / 255) : 1; // un-premultiply
        out[oi] = Math.round(r / aw); out[oi + 1] = Math.round(g / aw); out[oi + 2] = Math.round(b / aw);
    }
}
fs.writeFileSync('D:/Miro_clone/public/logo-icon.png', encode(O, O, out));
console.log('wrote public/logo-icon.png', O + 'x' + O);
