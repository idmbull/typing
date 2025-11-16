// /scripts/renderer.js
import { DOM, STATE } from "./state.js";
import { wrapChars, convertInlineFootnotes, convertMarkdownToPlain } from "./utils.js";

/**
 * Render markdown → HTML → span theo từng ký tự
 * - Tạo tooltip-word
 * - Tạo STATE.textSpans (tất cả span ký tự)
 * - Reset con trỏ "current"
 */
export function displayText(rawText) {
    // 1) Markdown footnotes → <span class="tooltip-word" data-note="">
    const withFootnotes = convertInlineFootnotes(rawText);

    // 2) Parse markdown thành HTML
    DOM.textDisplay.innerHTML = marked.parse(withFootnotes);

    // 3) Chuẩn hóa text gốc (xóa ^[footnote])
    const noFootnotes = rawText.replace(/\^\[(.*?)\]/g, "");
    STATE.originalText = convertMarkdownToPlain(noFootnotes);

    // 4) Tìm tất cả text node để thay bằng <span> từng ký tự
    const walker = document.createTreeWalker(DOM.textDisplay, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
        const parent = node.parentNode;
        const text = node.textContent;
        const chars = Array.from(text);

        // Bỏ node rỗng
        if (!chars.length) {
            parent.removeChild(node);
            continue;
        }

        // Nếu parent là tooltip-word → cần tạo tooltip-char
        if (parent.classList?.contains("tooltip-word")) {
            parent.innerHTML = "";
            const note = parent.dataset.note || "";
            parent.appendChild(wrapChars(chars.join(""), "tooltip-char", note));
            continue;
        }

        // Thay node bằng nhiều span ký tự
        const frag = wrapChars(chars.join(""));
        parent.replaceChild(frag, node);
    }

    // 5) Lấy toàn bộ span ký tự (leaf node)
    const allSpanCandidates = Array.from(DOM.textDisplay.querySelectorAll("span"));
    STATE.textSpans = allSpanCandidates.filter(s => s.children.length === 0);

    // 6) Reset highlight cursor
    STATE.prevIndex = 0;
    allSpanCandidates.forEach(s => s.classList.remove("current", "correct", "incorrect"));
    if (STATE.textSpans[0]) STATE.textSpans[0].classList.add("current");

    // 7) Gán sự kiện hover tooltip cho các tooltip-word
    DOM.textDisplay.querySelectorAll('.tooltip-word').forEach(el => {
        el.addEventListener('mouseenter', () => {
            const evt = new CustomEvent("tooltip:show", { detail: el });
            document.dispatchEvent(evt);
        });
        el.addEventListener('mouseleave', () => {
            document.dispatchEvent(new Event("tooltip:hide"));
        });
    });
}

export function scrollToCaret() {
    const caret = document.querySelector(".char.current");
    const container = document.querySelector("#text-display");

    if (!caret || !container) return;

    const caretRect = caret.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Vị trí lý tưởng: caret nằm giữa container
    const idealY = containerRect.top + containerRect.height / 2;

    // Độ lệch cần cuộn
    const delta = caretRect.top - idealY;

    // Cuộn mượt – tránh giật
    container.scrollBy({
        top: delta,
        behavior: "smooth"
    });
}
