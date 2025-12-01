// /scripts/dictation-loader.js

import { convertMarkdownToPlain, convertInlineFootnotes } from "./utils.js";

function cleanText(text) {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/\u00A0/g, " ")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, "\"")
        .replace(/[—–]/g, "-");
}
/* ============================================================
   1) Load playlist từ dictation.json
============================================================ */
export async function loadDictationPlaylist() {
    const resp = await fetch("dictation.json");
    if (!resp.ok) throw new Error("Không load được dictation.json");
    return await resp.json();   // ["d01.txt", "d02.txt", ...]
}

/* ============================================================
   2) Load segments từ texts/dictation/*.txt
   Format mỗi dòng:
   start<TAB>end<TAB>text-with-markdown-+-tooltip
============================================================ */
export async function loadDictationSegments(filename) {
    // Đúng thư mục mới: texts/dictation/
    const resp = await fetch(`texts/dictation/${filename}`);
    if (!resp.ok) throw new Error("Không tìm thấy file: " + filename);

    let raw = await resp.text();
    raw = cleanText(raw);

    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    const segments = [];

    for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length < 3) continue;

        const start = parseFloat(parts[0]);
        const end = parseFloat(parts[1]);
        const text = parts.slice(2).join("\t").trim();

        // HTML có footnote
        const withFootnotes = convertInlineFootnotes(text);

        // Plain text cho engine so sánh
        const clean = convertMarkdownToPlain(text.replace(/\^\[(.*?)\]/g, ""));

        segments.push({
            audioStart: start,
            audioEnd: end,
            rawText: text,
            displayHTML: withFootnotes,
            cleanText: clean
        });
    }

    return segments;
}

/* ============================================================
   3) Ghép segments → fullTextRaw, fullText, charStarts[]
============================================================ */
export function buildDictationText(segments) {
    let fullTextRaw = "";
    let fullText = "";
    const charStarts = [];

    let pos = 0;

    segments.forEach((seg, idx) => {
        charStarts[idx] = pos;

        const sep = idx < segments.length - 1 ? " " : "";

        fullTextRaw += seg.rawText + sep;
        fullText += seg.cleanText + sep;

        pos = fullText.length;
    });

    return { fullTextRaw, fullText, charStarts };
}

/* ============================================================
   4) Tìm file mp3 cùng tên trong texts/dictation/
============================================================ */
export async function findDictationAudio(filename) {
    const base = filename.replace(/\.[^.]+$/, "");
    const url = `texts/dictation/${base}.mp3`;

    try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) return url;
    } catch (err) {
        console.warn("Không load được audio:", err);
    }

    return null;
}
