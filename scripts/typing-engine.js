// /scripts/typing-engine.js
import { STATE } from "./state.js";

export function runTypingEngine(currentText) {
    const expected = STATE.originalText;
    const spans = STATE.textSpans;

    const caret = currentText.length;
    const prev = STATE.prevIndex;

    const changed = [];      // các index span cần update
    let newWord = null;      // từ mới (để speak word)
    let isComplete = false;  // đã hoàn thành bài chưa

    // 1) Chỉ update vùng quanh con trỏ (tối ưu DOM)
    const start = Math.min(prev, caret) - 2;
    const end   = Math.max(prev, caret) + 2;

    const lo = Math.max(0, start);
    const hi = Math.min(spans.length - 1, end);

    for (let i = lo; i <= hi; i++) {
        changed.push(i);
    }

    // 2) Kiểm tra hoàn thành toàn bài
    if (caret === expected.length && currentText === expected) {
        isComplete = true;
    }

    // 3) Xác định từ mới cho Speak Word (mọi mode đều dùng được)
    newWord = detectNewWord(caret);

    return {
        caret,
        changed,
        newWord,
        isComplete
    };
}

/**
 * Detect word entry (caret == start+1 của một từ mới)
 * Dùng STATE.wordStarts & STATE.wordTokens do renderer.js tính sẵn
 */
function detectNewWord(caret) {
    const starts = STATE.wordStarts;
    const tokens = STATE.wordTokens;

    if (!tokens.length || !starts.length) return null;

    for (let i = 0; i < starts.length; i++) {
        const start = starts[i];
        const end   = start + tokens[i].length;

        if (caret > start && caret <= end) {
            // chỉ speak khi caret vừa bước vào đầu từ
            if (caret === start + 1 && STATE.lastSpokenWord !== tokens[i]) {
                STATE.lastSpokenWord = tokens[i];
                return tokens[i];
            }
            return null;
        }
    }
    return null;
}
