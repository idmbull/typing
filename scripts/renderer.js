// /scripts/renderer.js
import { DOM, STATE } from "./state.js";
import { wrapChars, convertInlineFootnotes, convertMarkdownToPlain } from "./utils.js";

/**
 * Render text và xử lý Blind Mode ban đầu
 */
export function displayText(rawText) {
    // 1) Markdown footnotes
    const withFootnotes = convertInlineFootnotes(rawText);

    // 2) Parse markdown → HTML
    DOM.textDisplay.innerHTML = marked.parse(withFootnotes);

    // 3) Chuẩn hóa text gốc để so sánh khi gõ
    const noFootnotes = rawText.replace(/\^\[(.*?)\]/g, "");
    STATE.originalText = convertMarkdownToPlain(noFootnotes);

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
    DOM.textDisplay.querySelectorAll('.tooltip-word').forEach(el => {
        el.addEventListener('mouseenter', () => {
            document.dispatchEvent(new CustomEvent("tooltip:show", { detail: el }));
        });
        el.addEventListener('mouseleave', () => {
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
    
    // Nếu không phải Blind Mode, gỡ class ẩn hết
    if (!isBlind) {
        spans.forEach(s => s.classList.remove("blind-hidden"));
        return;
    }

    // Tối ưu: Chỉ loop một lần hoặc dùng logic thông minh
    // Ở đây ta dùng vòng lặp đơn giản: Index < currentIndex => Hiện, còn lại => Ẩn
    // Tuy nhiên, để tối ưu khi gõ (incremental update), hàm này chỉ gọi khi Init hoặc Toggle
    for (let i = 0; i < spans.length; i++) {
        if (i < currentIndex) { 
            spans[i].classList.remove("blind-hidden"); // Đã gõ xong
        } else if (i === currentIndex) {
             // Ký tự đang gõ: Ẩn hay hiện tùy sở thích.
             // Dictation gốc: Hiện ký tự đang gõ (để biết mình đang gõ gì nếu sai).
             // Nhưng Blind Mode đúng nghĩa thường ẩn tất cả chưa gõ đúng.
             // Theo logic cũ: span.classList.remove("blind-hidden") nếu i <= caretIndex
             spans[i].classList.remove("blind-hidden"); 
        } else {
            spans[i].classList.add("blind-hidden"); // Chưa gõ
        }
    }
}

export function scrollToCaret() {
    const caret = document.querySelector(".char.current");
    const container = DOM.textContainer;
    if (!caret || !container) return;
    
    // Logic cuộn đơn giản hơn ở đây, logic phức tạp đã có trong input-handler
    const caretTop = caret.offsetTop;
    const containerMid = container.clientHeight / 2;
    container.scrollTo({ top: caretTop - containerMid, behavior: 'smooth' });
}