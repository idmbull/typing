// dictation-engine.js
import { STATE } from "./state.js";
import { runTypingEngine } from "./typing-engine.js";

export function runDictationEngine(currentText) {
    const base = runTypingEngine(currentText);

    const idx = findCurrentSegment(base.caret);
    let segmentDone = false;
    let dictationDone = false;

    if (idx !== STATE.dictation.currentSegmentIndex) {
        STATE.dictation.currentSegmentIndex = idx;
    }

    const seg = STATE.dictation.segments[idx];
    const segStart = STATE.dictation.charStarts[idx];
    const segEnd   = segStart + seg.cleanText.length;

    if (base.caret === segEnd) {
        segmentDone = true;
    }

    if (base.isComplete) {
        dictationDone = true;
    }

    return {
        ...base,
        segmentIndex: idx,
        segmentDone,
        dictationDone
    };
}

function findCurrentSegment(caret) {
    const arr = STATE.dictation.charStarts;
    for (let i = arr.length - 1; i >= 0; i--) {
        if (caret >= arr[i]) return i;
    }
    return 0;
}
