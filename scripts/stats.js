// /scripts/stats.js
import { DOM, STATE } from "./state.js";

/* ---------------------------------------------------------
    BATCHED STAT UPDATES (hiệu năng cao)
   --------------------------------------------------------- */
export function scheduleStatsUpdate() {
    if (STATE.scheduledStatUpdate) return;
    STATE.scheduledStatUpdate = true;

    requestAnimationFrame(() => {
        STATE.scheduledStatUpdate = false;

        const accuracy =
            STATE.statTotalKeys > 0
                ? Math.floor((STATE.statCorrectKeys / STATE.statTotalKeys) * 100)
                : 100;

        DOM.accuracyEl.textContent = `${accuracy}%`;
        DOM.errorsEl.textContent = STATE.statErrors;
    });
}

/* ---------------------------------------------------------
    UPDATE STATS IMMEDIATELY
   --------------------------------------------------------- */
export function updateStatsDOMImmediate(accuracy, wpm, timeText, errs) {
    DOM.accuracyEl.textContent = `${accuracy}%`;
    DOM.wpmEl.textContent = `${wpm}`;
    DOM.timeEl.textContent = `${timeText}`;
    DOM.errorsEl.textContent = `${errs}`;
}

/* ---------------------------------------------------------
    TIMER: START / STOP
   --------------------------------------------------------- */

export function startTimer() {
    STATE.startTime = Date.now();

    if (STATE.timerInterval) clearInterval(STATE.timerInterval);

    STATE.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - STATE.startTime) / 1000);

        // ⭐ HIỂN THỊ THỜI GIAN
        if (elapsed < 60) {
            // < 1 phút → chỉ hiển thị "23s"
            DOM.timeEl.textContent = `${elapsed}s`;
        } else {
            // ≥ 1 phút → hiển thị mm:ss
            const minutes = Math.floor(elapsed / 60)
                .toString()
                .padStart(2, "0");
            const seconds = (elapsed % 60)
                .toString()
                .padStart(2, "0");

            DOM.timeEl.textContent = `${minutes}:${seconds}`;
        }

        // ⭐ TÍNH WPM
        const words = DOM.textInput.value.trim()
            ? DOM.textInput.value.trim().split(/\s+/).length
            : 0;

        const wpm = elapsed > 0 ? Math.floor((words / elapsed) * 60) : 0;
        DOM.wpmEl.textContent = wpm;

    }, 1000);
}


export function stopTimer() {
    clearInterval(STATE.timerInterval);
    STATE.timerInterval = null;
}
