// =============================================
// dictation-input.js — Bản đã vá hoàn chỉnh
// =============================================

import { DOM, STATE } from "./state.js";
import { showTooltipForSpan } from "./tooltip.js";
import { playClick, checkNewWordAndSpeak } from "./audio.js";
import { scheduleStatsUpdate } from "./stats.js";
import { runTypingEngine } from "./typing-engine.js";
import { applyDictationBlindMode } from "./dictation-app.js";

/* Scroll giống typing */
let pendingScroll = false;
function throttleScrollToCurrent() {
    if (pendingScroll) return;
    pendingScroll = true;

    requestAnimationFrame(() => {
        pendingScroll = false;

        const idx = STATE.prevIndex;
        const span = STATE.textSpans[idx];
        if (!span) return;

        const container = DOM.textContainer;
        const caretRect = span.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const caretY = caretRect.top - containerRect.top;

        const safeZoneTop = containerRect.height * 0.2;
        const safeZoneBot = containerRect.height * 0.6;
        let delta = 0;

        if (caretY < safeZoneTop) delta = caretY - safeZoneTop;
        else if (caretY > safeZoneBot) delta = caretY - safeZoneBot;

        if (delta !== 0) {
            delta = delta * 0.2;
            if (Math.abs(delta) > 5) container.scrollTop += delta;
        }
    });
}

/**
 * Handle input cho Dictation Mode
 */
export function handleDictationInput(superPlayer) {
    const dict = STATE.dictation;
    if (!dict.active) return;

    let val = DOM.textInput.value;
    if (val.includes("\n")) val = val.replace(/\n/g, " ");
    if (val.length > dict.fullText.length) val = val.slice(0, dict.fullText.length);
    DOM.textInput.value = val;

    const currentText = val;
    const original = dict.fullText;
    const spans = STATE.textSpans;

    // ❌ Không auto-start khi người dùng nhập
    if (!STATE.isActive) {
        DOM.textInput.value = "";
        return;
    }

    // chạy Typing Engine
    STATE.originalText = original;
    const { caret, changed, newWord, isComplete } = runTypingEngine(currentText);

    // Update spans
    for (const i of changed) {
        const span = spans[i];
        if (!span) continue;

        span.classList.remove("current", "correct", "incorrect");

        if (i < caret) {
            if (currentText[i] === original[i]) span.classList.add("correct");
            else span.classList.add("incorrect");
        }
    }

    STATE.prevIndex = caret;
    if (spans[caret]) {
        spans[caret].classList.add("current");
        if (DOM.autoTooltipToggle?.checked) showTooltipForSpan(spans[caret]);
    }

    // ⭐ NEW — Áp dụng Blind Mode đúng chuẩn
    applyDictationBlindMode();

    // Stats
    if (currentText.length > 0) {
        const last = currentText.length - 1;
        STATE.statTotalKeys++;
        if (currentText[last] === original[last]) STATE.statCorrectKeys++;
        else STATE.statErrors++;
        scheduleStatsUpdate();
    }

    if (DOM.soundToggle?.checked) playClick();
    if (DOM.autoPronounceToggle?.checked && newWord) {
        checkNewWordAndSpeak(currentText, original);
    }

    throttleScrollToCurrent();

    // Segment logic
    const segIdx = dict.currentSegmentIndex;
    const seg = dict.segments[segIdx];
    if (seg) {
        const segStart = dict.charStarts[segIdx];
        const segEnd = segStart + seg.cleanText.length;

        if (caret >= segEnd) {
            const next = segIdx + 1;
            if (next < dict.segments.length) {
                dict.currentSegmentIndex = next;
                superPlayer.stop();
                superPlayer.playSegment(
                    dict.segments[next].audioStart,
                    dict.segments[next].audioEnd
                );
            }
        }
    }

    if (isComplete) {
        DOM.textInput.disabled = true;
        DOM.startBtn.disabled = false;
        DOM.startBtn.textContent = "Start";
        document.dispatchEvent(new CustomEvent("timer:stop"));
        alert("🎉 Hoàn thành Dictation!");
    }
}
