// --- START OF FILE scripts/dictation-loader.js ---

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
    return await resp.json();
}

/* ============================================================
   2) Load segments từ texts/dictation/*.txt
   CẬP NHẬT: Logic phát hiện dòng trống để chia đoạn
============================================================ */
export async function loadDictationSegments(filename) {
    const resp = await fetch(`texts/dictation/${filename}`);
    if (!resp.ok) throw new Error("Không tìm thấy file: " + filename);

    let raw = await resp.text();
    raw = cleanText(raw);

    const lines = raw.split(/\r?\n/);
    const segments = [];
    let pendingNewParagraph = false; // Cờ đánh dấu đoạn mới

    for (const line of lines) {
        // 1. Nếu dòng trống -> Đánh dấu chuẩn bị sang đoạn mới
        if (!line.trim()) {
            pendingNewParagraph = true;
            continue;
        }

        // 2. Parse dữ liệu (Tab-separated hoặc Space-separated)
        const parts = line.trim().split("\t");
        let start, end, text;

        if (parts.length >= 3) {
            start = parseFloat(parts[0]);
            end = parseFloat(parts[1]);
            text = parts.slice(2).join("\t").trim();
        } else {
            // Fallback regex cho định dạng cũ
            const m = line.match(/^([\d.]+)\s+([\d.]+)\s+(.*)$/);
            if (m) {
                start = parseFloat(m[1]);
                end = parseFloat(m[2]);
                text = m[3].trim();
            } else {
                continue; // Bỏ qua dòng lỗi
            }
        }

        // 3. Xử lý text (Markdown / HTML)
        const withFootnotes = convertInlineFootnotes(text);
        const clean = convertMarkdownToPlain(text.replace(/\^\[(.*?)\]/g, ""));

        // 4. Tạo segment object
        const seg = {
            audioStart: start,
            audioEnd: end,
            rawText: text,
            displayHTML: withFootnotes,
            cleanText: clean
        };

        // Gắn cờ đoạn mới nếu cần
        if (pendingNewParagraph) {
            seg.isNewParagraph = true;
            pendingNewParagraph = false;
        }

        segments.push(seg);
    }

    return segments;
}

/* ============================================================
   3) Ghép segments -> Full Text
   CẬP NHẬT: Logic nối chuỗi \n\n cho hiển thị, " " cho logic
============================================================ */
export function buildDictationText(segments) {
    let fullTextRaw = ""; // Chuỗi hiển thị (HTML/Markdown)
    let fullText = "";    // Chuỗi logic (Input check)
    const charStarts = [];

    let pos = 0;

    segments.forEach((seg, idx) => {
        // Tính toán vị trí bắt đầu cho Audio Segment (dựa trên chuỗi logic)
        // Lưu ý: Logic separator luôn là 1 ký tự (dấu cách)
        // ngoại trừ segment đầu tiên không có separator.
        const logicSeparatorLength = (idx > 0) ? 1 : 0; 
        
        // Vị trí bắt đầu của segment này = Vị trí cũ + separator
        charStarts[idx] = pos + logicSeparatorLength;

        // 1. Xác định dấu nối hiển thị
        let rawSeparator = "";
        if (idx > 0) {
            rawSeparator = seg.isNewParagraph ? "\n\n" : " ";
        }

        // 2. Xác định dấu nối logic (Luôn là space để đồng bộ với Typing Engine)
        let logicSeparator = "";
        if (idx > 0) {
            logicSeparator = " ";
        }

        fullTextRaw += rawSeparator + seg.rawText;
        fullText += logicSeparator + seg.cleanText;

        pos = fullText.length;
    });

    return { fullTextRaw, fullText, charStarts };
}

/* ============================================================
   4) Tìm file mp3
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