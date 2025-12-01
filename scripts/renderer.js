// /scripts/renderer.js
import { DOM, STATE } from "./state.js";
import { wrapChars, convertInlineFootnotes, convertMarkdownToPlain } from "./utils.js";

/**
 * Precompute word tokens & boundaries for Speak Word
 * Dùng regex giống bên audio (hỗ trợ số như 600,000 / 3.14 / 12-05-2025)
 */
function computeWordMetadata() {
    const text = STATE.originalText || "";
    const tokens = [];
    const starts = [];
    const ends = [];

    // 600,000 — 3.14 — 12-05-2025 — 2025/11/26 — word-word
    const re = /[a-z0-9]+(?:[,'./-][a-z0-9]+)*/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        tokens.push(m[0]);
        starts.push(m.index);
        ends.push(m.index + m[0].length);
    }

    STATE.wordTokens = tokens;
    STATE.wordStarts = starts;
    STATE.wordEnds = ends;
}

/**
 * Render text và xử lý Blind Mode ban đầu
 */
export function displayText(rawText) {
    // 1) Markdown footnotes
    const withFootnotes = convertInlineFootnotes(rawText);

    // 2) Parse markdown → HTML
    DOM.textDisplay.innerHTML = marked.parse(withFootnotes);

    // 3) Chuẩn hóa text gốc để so sánh khi gõ
    //    (giống bản gốc: bỏ footnote rồi convert markdown → plain)
    const noFootnotes = rawText.replace(/\^\[(.*?)\]/g, "");
    STATE.originalText = convertMarkdownToPlain(noFootnotes);

    // 3.5) ⭐ Precompute word boundaries cho Speak Word
    computeWordMetadata();

    // 4) Text Node → Spans
    const walker = document.createTreeWalker(DOM.textDisplay, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
        const parent = node.parentNode;
        const text = node.textContent;
        const chars = Array.from(text);

        if (!chars.length) {
            parent.removeChild(node);
            continue;
        }

        if (parent.classList?.contains("tooltip-word")) {
            parent.innerHTML = "";
            const note = parent.dataset.note || "";
            parent.appendChild(wrapChars(chars.join(""), "tooltip-char", note));
            continue;
        }

        const frag = wrapChars(chars.join(""));
        parent.replaceChild(frag, node);
    }

    // 5) Cache spans
    const allSpanCandidates = Array.from(DOM.textDisplay.querySelectorAll("span"));
    STATE.textSpans = allSpanCandidates.filter(s => s.children.length === 0);

    // 6) Reset UI State & Apply Blind Mode
    STATE.prevIndex = 0;
    allSpanCandidates.forEach(s => s.classList.remove("current", "correct", "incorrect"));

    if (STATE.textSpans[0]) STATE.textSpans[0].classList.add("current");

    // ⭐ APPLY BLIND MODE INITIALLY
    applyBlindMode(0);

    // 7) Tooltip events
    DOM.textDisplay.querySelectorAll(".tooltip-word").forEach(el => {
        el.addEventListener("mouseenter", () => {
            document.dispatchEvent(new CustomEvent("tooltip:show", { detail: el }));
        });
        el.addEventListener("mouseleave", () => {
            document.dispatchEvent(new Event("tooltip:hide"));
        });
    });
}

/**
 * Hàm chung cập nhật hiển thị Blind Mode
 * @param {number} currentIndex - Vị trí con trỏ hiện tại
 */
export function applyBlindMode(currentIndex) {
    const isBlind = STATE.blindMode;
    const spans = STATE.textSpans;

    if (!isBlind) {
        spans.forEach(s => s.classList.remove("blind-hidden"));
        return;
    }

    // Blind Mode:
    //  - Index <= currentIndex → hiện
    //  - Index >  currentIndex → ẩn
    for (let i = 0; i < spans.length; i++) {
        if (i <= currentIndex) spans[i].classList.remove("blind-hidden");
        else spans[i].classList.add("blind-hidden");
    }
}
