// scripts/renderer.js
import { DOM } from "./state.js";
import { Store } from "./core/store.js";
import { wrapChars, convertInlineFootnotes } from "./utils.js";
import { EventBus, EVENTS } from "./core/events.js";

function computeWordMetadata(text) {
    const tokens = [];
    const starts = [];
    const re = /[a-z0-9]+(?:[,'./-][a-z0-9]+)*/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        tokens.push(m[0]);
        starts.push(m.index);
    }
    Store.setWordMetadata(tokens, starts);
}

export function displayText(rawHtmlOrMarkdown) {
    // 1. Render Markdown & Wrap
    const withFootnotes = convertInlineFootnotes(rawHtmlOrMarkdown);
    DOM.textDisplay.innerHTML = marked.parse(withFootnotes);

    // 2. Metadata
    const sourceText = Store.getSource().text || "";
    computeWordMetadata(sourceText);

    // [MỚI] TRIGGER INITIAL PRELOAD
    const tokens = Store.getState().wordTokens;
    if (tokens && tokens.length > 0) {
        const initialBatch = tokens.slice(0, 5);
        EventBus.emit(EVENTS.AUDIO_PRELOAD, initialBatch);
    }

    // 3. Process Text Nodes
    // TreeWalker sẽ đi qua cả text node của "Alice: "
    const walker = document.createTreeWalker(DOM.textDisplay, NodeFilter.SHOW_TEXT);
    const nodesToReplace = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent && !node.parentNode.classList.contains("tooltip-word")) continue;
        nodesToReplace.push(node);
    }

    nodesToReplace.forEach(node => {
        const parent = node.parentNode;
        const text = node.textContent;
        if (!text && parent === DOM.textDisplay) return;

        if (parent.classList?.contains("tooltip-word")) {
            parent.innerHTML = "";
            const note = parent.dataset.note || "";
            parent.appendChild(wrapChars(text, "tooltip-char", note));
        } else {
            const frag = wrapChars(text);
            parent.replaceChild(frag, node);
        }
    });

    // 4. Fix Layout & Orphan Newlines
    const orphans = DOM.textDisplay.querySelectorAll(':scope > .newline-char');
    orphans.forEach(span => {
        const prev = span.previousElementSibling;
        if (prev && /^(P|DIV|H[1-6]|LI|BLOCKQUOTE)$/.test(prev.tagName)) {
            prev.appendChild(span);
            if (span.nextElementSibling?.classList.contains('visual-break')) {
                prev.appendChild(span.nextElementSibling);
            }
        }
    });

    // 5. Update State Spans
    // [QUAN TRỌNG] Lọc bỏ các span nằm trong .speaker-label
    const allCandidates = Array.from(DOM.textDisplay.querySelectorAll("span"));

    const textSpans = allCandidates.filter(s =>
        !s.children.length &&
        !s.classList.contains('tooltip-word') &&
        !s.closest('.speaker-label') // <--- THÊM DÒNG NÀY: Bỏ qua tên người nói
    );

    Store.setSpans(textSpans);
    Store.setPrevIndex(0);

    allCandidates.forEach(s => s.classList.remove("current", "correct", "incorrect"));
    if (textSpans[0]) textSpans[0].classList.add("current");

    applyBlindMode(0);

    DOM.textDisplay.querySelectorAll(".tooltip-word").forEach(el => {
        el.addEventListener("mouseenter", () => document.dispatchEvent(new CustomEvent("tooltip:show", { detail: el })));
        el.addEventListener("mouseleave", () => document.dispatchEvent(new Event("tooltip:hide")));
    });
}

export function applyBlindMode(currentIndex) {
    const isBlind = Store.isBlind();
    const spans = Store.getState().textSpans;
    if (!isBlind) {
        spans.forEach(s => s.classList.remove("blind-hidden"));
        return;
    }
    for (let i = 0; i < spans.length; i++) {
        if (i <= currentIndex) spans[i].classList.remove("blind-hidden");
        else spans[i].classList.add("blind-hidden");
    }
}

export function updateActiveSpans(changedIndices, currentText, originalText, caret) {
    const spans = Store.getState().textSpans;
    for (const i of changedIndices) {
        const span = spans[i];
        if (!span) continue;
        span.classList.remove("current", "correct", "incorrect", "blind-hidden");
        if (i < caret) {
            if (currentText[i] === originalText[i]) span.classList.add("correct");
            else span.classList.add("incorrect");
        }
    }
    if (spans[caret]) spans[caret].classList.add("current");
}