// scripts/input-controller.js
import { DOM } from "./state.js";
import { Store } from "./core/store.js";
import { runTypingEngine } from "./typing-engine.js";
import { runDictationEngine } from "./dictation-engine.js";
import { updateActiveSpans, applyBlindMode } from "./renderer.js";
import { showTooltipForSpan } from "./tooltip.js";
import { AutoScroller } from "./utils/scroller.js";
import { EventBus, EVENTS } from "./core/events.js";

const PRELOAD_WINDOW = 5; // Số lượng từ tải trước
let scroller;

export function initController() {
    if (!scroller && DOM.textContainer) {
        scroller = new AutoScroller(DOM.textContainer);
    }
}

export function getScroller() {
    return scroller;
}

export function resetController() {
    if (scroller) scroller.reset();
}

// Helper: Tìm index của từ hiện tại
function getCurrentWordIndex(caret, wordStarts, wordTokens) {
    for (let i = 0; i < wordStarts.length; i++) {
        const start = wordStarts[i];
        const end = start + wordTokens[i].length;
        if (caret >= start && caret <= end + 1) {
            return i;
        }
    }
    return -1;
}

// Trigger Preload
function triggerPreload(currentIndex) {
    const state = Store.getState();
    const tokens = state.wordTokens;
    if (!tokens || !tokens.length) return;

    const startIdx = currentIndex === -1 ? 0 : currentIndex + 1;
    const endIdx = startIdx + PRELOAD_WINDOW;

    const nextWords = tokens.slice(startIdx, endIdx);
    if (nextWords.length > 0) {
        EventBus.emit(EVENTS.AUDIO_PRELOAD, nextWords);
    }
}

export function handleGlobalInput(mode) {
    const el = DOM.textInput;
    let val = el.value;
    if (val.includes("\n")) val = val.replace(/\n/g, " ");

    const state = Store.getState();
    const originalText = state.source.text;
    const isDeleting = val.length < state.prevInputLen;

    if (val.length > originalText.length) val = val.slice(0, originalText.length);
    if (el.value !== val) el.value = val;
    const currentText = val;

    // Auto Start
    if (!state.isActive) {
        if (mode === "typing") {
            EventBus.emit(EVENTS.EXERCISE_START);
            document.dispatchEvent(new CustomEvent("timer:start"));
            Store.startExercise();
            Store.setPrevInputLen(0);
            if (DOM.actionToggle) DOM.actionToggle.checked = true;

            // Preload ngay khi gõ ký tự đầu
            triggerPreload(0);
        } else {
            el.value = ""; return;
        }
    }

    const oldSegIdx = Store.getSource().currentSegment;

    // Run Engine
    const engineResult = mode === "dictation"
        ? runDictationEngine(currentText)
        : runTypingEngine(currentText);

    const { caret, changed, newWord, isComplete } = engineResult;

    // UI Updates
    updateActiveSpans(changed, currentText, originalText, caret);
    if (state.blindMode) applyBlindMode(caret);

    const currentSpan = state.textSpans[caret];
    if (currentSpan && DOM.autoTooltipToggle?.checked) showTooltipForSpan(currentSpan);
    Store.setPrevIndex(caret);
    if (scroller && currentSpan) scroller.scrollTo(currentSpan);

    // Dictation Logic
    if (mode === "dictation") {
        const newSegIdx = engineResult.segmentIndex;
        if (newSegIdx !== oldSegIdx) {
            Store.setCurrentSegment(newSegIdx);
            if (!isDeleting && newSegIdx > oldSegIdx) {
                EventBus.emit(EVENTS.DICTATION_SEGMENT_CHANGE, newSegIdx);
            }
        }
        if (engineResult.segmentDone) {
            document.dispatchEvent(new CustomEvent("dictation:segmentDone", { detail: engineResult.segmentIndex }));
            EventBus.emit(EVENTS.DICTATION_SEGMENT_DONE, engineResult.segmentIndex);
        }
    }

    // Events
    const currentLen = currentText.length;
    let isCorrect = currentLen > 0 ? currentText[currentLen - 1] === originalText[currentLen - 1] : false;

    EventBus.emit(EVENTS.INPUT_CHANGE, {
        currentText, originalText, caret, currentLen,
        prevInputLen: state.prevInputLen, isCorrect
    });
    Store.setPrevInputLen(currentLen);

    // New Word & Sliding Preload
    if (newWord && !isDeleting) {
        EventBus.emit(EVENTS.INPUT_NEW_WORD, { word: newWord, currentText, originalText });

        // Tính toán và preload các từ tiếp theo
        const currentIdx = getCurrentWordIndex(caret, state.wordStarts, state.wordTokens);
        triggerPreload(currentIdx);
    }

    // Completion
    if (isComplete) {
        el.disabled = true;
        EventBus.emit(EVENTS.EXERCISE_COMPLETE);
        document.dispatchEvent(new CustomEvent("timer:stop"));
        setTimeout(() => {
            alert(`🎉 Hoàn thành!\nAcc: ${DOM.accuracyEl.textContent}\nWPM: ${DOM.wpmEl.textContent}`);
        }, 100);
    }
}