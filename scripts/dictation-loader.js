// --- START OF FILE scripts/dictation-loader.js ---

import { convertMarkdownToPlain, convertInlineFootnotes } from "./utils.js";

/* ============================================================
   1. UTILS (Private)
============================================================ */

function cleanText(text) {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/\u00A0/g, " ")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, "\"")
        .replace(/[—–]/g, "-")
        .replace(/\u200B/g, ""); // Zero-width space
}

export function stripDictationMarkup(raw) {
    return raw ? raw.replace(/\^\[[^\]]*]/g, "") // Bỏ footnote ^[...]
        .replace(/\*\*(.+?)\*\*/g, "$1") : "";   // Bỏ bold **...**
}

/* ============================================================
   2. CORE PARSER (Dùng chung cho cả File & Playlist)
   Input: Nội dung raw string của file
   Output: Mảng segments []
============================================================ */
export function parseDictationContent(rawContent) {
    const cleanContent = cleanText(rawContent);
    const lines = cleanContent.split(/\r?\n/);
    const segments = [];
    let pendingNewParagraph = false;

    for (const line of lines) {
        // Phát hiện dòng trống -> Đánh dấu đoạn mới
        if (!line.trim()) {
            pendingNewParagraph = true;
            continue;
        }

        const parts = line.trim().split("\t");
        let start, end, text;

        // Ưu tiên format TSV: start <tab> end <tab> text
        if (parts.length >= 3) {
            start = parseFloat(parts[0]);
            end = parseFloat(parts[1]);
            text = parts.slice(2).join("\t").trim();
        } else {
            // Fallback format cũ: start end text (cách nhau bởi space)
            const m = line.match(/^([\d.]+)\s+([\d.]+)\s+(.*)$/);
            if (m) {
                start = parseFloat(m[1]);
                end = parseFloat(m[2]);
                text = m[3].trim();
            } else {
                continue; // Bỏ qua dòng rác
            }
        }

        // Xử lý Markdown cho hiển thị
        const withFootnotes = convertInlineFootnotes(text);
        const clean = convertMarkdownToPlain(stripDictationMarkup(text));

        const seg = {
            audioStart: start,
            audioEnd: end,
            rawText: text,            // Text gốc trong file (có markdown)
            displayHTML: withFootnotes, // HTML để hiển thị tooltip
            cleanText: clean          // Text thuần để so khớp gõ phím
        };

        if (pendingNewParagraph) {
            seg.isNewParagraph = true;
            pendingNewParagraph = false;
        }

        segments.push(seg);
    }

    return segments;
}

/* ============================================================
   3. BUILDER (Dùng chung)
   Input: segments []
   Output: { fullText, fullTextRaw, charStarts }
============================================================ */
export function buildDictationText(segments) {
    let fullTextRaw = ""; // Chuỗi hiển thị (có \n\n)
    let fullText = "";    // Chuỗi logic (chỉ có space)
    const charStarts = [];

    let pos = 0;

    segments.forEach((seg, idx) => {
        // Logic Separator: Luôn là 1 khoảng trắng (trừ đầu dòng)
        const logicSeparator = (idx > 0) ? " " : "";
        
        // Raw Separator: \n\n nếu là đoạn mới, " " nếu không
        let rawSeparator = "";
        if (idx > 0) {
            rawSeparator = seg.isNewParagraph ? "\n\n" : " ";
        }

        // Vị trí Audio Start tính theo chuỗi Logic
        charStarts[idx] = pos + logicSeparator.length;

        fullTextRaw += rawSeparator + seg.rawText;
        fullText += logicSeparator + seg.cleanText;

        pos = fullText.length;
    });

    return { fullTextRaw, fullText, charStarts };
}

/* ============================================================
   4. PLAYLIST LOADERS (Specific for Server Fetching)
============================================================ */
export async function loadDictationPlaylist() {
    const resp = await fetch("dictation.json");
    if (!resp.ok) throw new Error("Không load được dictation.json");
    return await resp.json();
}

export async function fetchDictationSegments(filename) {
    const resp = await fetch(`texts/dictation/${filename}`);
    if (!resp.ok) throw new Error("Không tìm thấy file: " + filename);

    const raw = await resp.text();
    
    // GỌI HÀM CORE PARSER
    return parseDictationContent(raw);
}

export async function findDictationAudio(filename) {
    const base = filename.replace(/\.[^.]+$/, "");
    const url = `texts/dictation/${base}.mp3`;
    try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) return url;
    } catch (err) { }
    return null;
}