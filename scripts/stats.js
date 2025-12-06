// scripts/stats.js
import { DOM, STATE } from "./state.js";

export function scheduleStatsUpdate() {
    if (STATE.scheduledStatUpdate) return;
    STATE.scheduledStatUpdate = true;

    requestAnimationFrame(() => {
        STATE.scheduledStatUpdate = false;

        // 1. Accuracy: (Số lần gõ đúng / Tổng số lần gõ phím) * 100
        const accuracy = STATE.statTotalKeys > 0
            ? Math.floor((STATE.statCorrectKeys / STATE.statTotalKeys) * 100)
            : 100;

        DOM.accuracyEl.textContent = `${accuracy}%`;
        DOM.errorsEl.textContent = STATE.statErrors;
    });
}

export function updateStatsDOMImmediate(accuracy, wpm, timeText, errs) {
    DOM.accuracyEl.textContent = `${accuracy}%`;
    DOM.wpmEl.textContent = `${wpm}`;
    DOM.timeEl.textContent = `${timeText}`;
    DOM.errorsEl.textContent = `${errs}`;
}

export function startTimer() {
    STATE.startTime = Date.now();
    if (STATE.timerInterval) clearInterval(STATE.timerInterval);

    STATE.timerInterval = setInterval(() => {
        const now = Date.now();
        // Tính thời gian trôi qua (giây)
        const elapsedSeconds = (now - STATE.startTime) / 1000; 

        // Hiển thị thời gian
        if (elapsedSeconds < 60) {
            DOM.timeEl.textContent = `${Math.floor(elapsedSeconds)}s`;
        } else {
            const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
            const seconds = Math.floor(elapsedSeconds % 60).toString().padStart(2, "0");
            DOM.timeEl.textContent = `${minutes}:${seconds}`;
        }

        // --- SỬA CÔNG THỨC WPM (Chuẩn quốc tế: 5 chars = 1 word) ---
        // Lấy độ dài text hiện tại
        const charCount = DOM.textInput.value.length;
        
        // WPM = (Số ký tự / 5) / (Số phút)
        // Tránh chia cho 0
        const wpm = elapsedSeconds > 0 
            ? Math.floor((charCount / 5) / (elapsedSeconds / 60)) 
            : 0;

        DOM.wpmEl.textContent = wpm;

    }, 1000);
}

export function stopTimer() {
    clearInterval(STATE.timerInterval);
    STATE.timerInterval = null;
}