// /scripts/stats.js
import { DOM, STATE } from "./state.js";

/* ---------------------------------------------------------
    FORMAT THỜI GIAN: < 60s = Xs, >= 60s = Xm
   --------------------------------------------------------- */
function formatTime(seconds) {
    if (seconds === undefined || seconds === null || isNaN(seconds)) {
        return "0s";
    }

    seconds = Math.floor(seconds);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
}


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
export function updateStatsDOMImmediate(accuracy, wpm, timeSecs, errs) {
    DOM.accuracyEl.textContent = `${accuracy}%`;
    DOM.wpmEl.textContent = `${wpm}`;
    DOM.timeEl.textContent = `${formatTime(timeSecs)}`;
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

        // ⭐ hiển thị thời gian theo format mới
        DOM.timeEl.textContent = formatTime(elapsed);

        // tính WPM
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
