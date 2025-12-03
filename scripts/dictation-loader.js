// scripts/dictation-loader.js

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
   [UPDATE]: Hỗ trợ tách đoạn khi gặp dòng trống
============================================================ */
export async function loadDictationSegments(filename) {
    const resp = await fetch(`texts/dictation/${filename}`);
    if (!resp.ok) throw new Error("Không tìm thấy file: " + filename);

    let raw = await resp.text();
    raw = cleanText(raw);

    // [MODIFIED] Không dùng filter(trim) ngay để giữ dòng trống
    const lines = raw.split(/\r?\n/); 
    const segments = [];

    let isNewParagraph = false; // Cờ đánh dấu đoạn mới

    for (const line of lines) {
        // Nếu dòng trống -> Bật cờ, bỏ qua xử lý
        if (!line.trim()) {
            isNewParagraph = true;
            continue;
        }

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
            cleanText: clean,
            isNewParagraph: isNewParagraph // Lưu trạng thái
        });

        // Reset cờ sau khi đã gán cho segment
        isNewParagraph = false;
    }

    return segments;
}

/* ============================================================
   3) Ghép segments → fullTextRaw, fullText, charStarts[]
   [UPDATE]: Chèn \n\n nếu segment có cờ isNewParagraph
============================================================ */
export function buildDictationText(segments) {
    let fullTextRaw = "";
    let fullText = "";
    const charStarts = [];

    let pos = 0;

    segments.forEach((seg, idx) => {
        // Nếu không phải segment đầu tiên:
        // - Kiểm tra xem segment này có phải đầu đoạn mới không?
        // - Nếu có: raw dùng \n\n (để hiển thị), clean dùng " " (để gõ)
        // - Nếu không: cả hai dùng " "
        
        let sepRaw = " ";
        let sepClean = " ";

        if (idx > 0) {
            if (seg.isNewParagraph) {
                sepRaw = "\n\n"; 
            }
        } else {
            // Segment đầu tiên không cần separator trước nó
            sepRaw = "";
            sepClean = "";
        }

        // Cập nhật vị trí bắt đầu (tính theo cleanText vì engine gõ đếm trên cleanText)
        // Lưu ý: pos hiện tại là độ dài của fullText đã cộng dồn
        // Khi cộng thêm separator vào fullText, pos thực tế của ký tự bắt đầu segment sẽ dịch chuyển
        if (idx > 0) {
            pos += sepClean.length; 
        }
        
        charStarts[idx] = pos;

        fullTextRaw += sepRaw + seg.rawText;
        fullText += sepClean + seg.cleanText;

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