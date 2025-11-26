// /scripts/input-handler.js
import { DOM, STATE } from "./state.js";
import { showTooltipForSpan } from "./tooltip.js";
import { playClick, checkNewWordAndSpeak } from "./audio.js";
import { scheduleStatsUpdate } from "./stats.js";

let pendingScroll = false;

/* ---------------------------------------------------------
    SCROLL LOGIC (Optimized Kindle-style)
   --------------------------------------------------------- */
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

        const safeZoneTop = containerRect.height * 0.20;
        const safeZoneBot = containerRect.height * 0.60;
        let delta = 0;

        if (caretY < safeZoneTop) delta = caretY - safeZoneTop;
        else if (caretY > safeZoneBot) delta = caretY - safeZoneBot;

        if (delta !== 0) {
            delta = delta * 0.2; // Smooth damping
            if (Math.abs(delta) > 5) container.scrollTop += delta;
        }
    });
}

/* ---------------------------------------------------------
    INPUT HANDLER
   --------------------------------------------------------- */
export function handleInputEvent() {
    // Chuyển quyền cho Dictation nếu đang ở mode đó
    if (STATE.mode === "dictation") {
        import("./dictation.js").then(mod => mod.handleDictationInput());
        return;
    }

    // Chuẩn hóa input
    let rawVal = DOM.textInput.value;
    if (rawVal.includes('\n')) {
        rawVal = rawVal.replace(/\n/g, ' ');
        DOM.textInput.value = rawVal;
    }

    const currentText = DOM.textInput.value;
    const len = currentText.length;
    const original = STATE.originalText;
    const spans = STATE.textSpans;

    // Auto Start
    if (!STATE.isActive) {
        document.dispatchEvent(new CustomEvent("exercise:start"));
    }

    // --- LOGIC HIỂN THỊ KÝ TỰ (Đúng/Sai + Blind Mode) ---
    // Chỉ cập nhật các index thay đổi: prevIndex (cũ) và len (mới)
    const indicesToUpdate = new Set([STATE.prevIndex, len, len - 1].filter(i => i >= 0 && i < spans.length));

    indicesToUpdate.forEach(i => {
        const span = spans[i];
        
        // 1. Reset class trạng thái
        span.classList.remove("current", "correct", "incorrect");

        // 2. Check đúng sai
        if (i < len) {
            if (currentText[i] === original[i]) span.classList.add("correct");
            else span.classList.add("incorrect");
            
            // ⭐ BLIND MODE: Ký tự đã gõ -> Hiện
            if (STATE.blindMode) span.classList.remove("blind-hidden");
        } 
        else {
            // ⭐ BLIND MODE: Ký tự chưa gõ (tương lai) -> Ẩn
            if (STATE.blindMode && i > len) span.classList.add("blind-hidden");
        }
    });

    // --- CON TRỎ & CURRENT CHAR ---
    STATE.prevIndex = len;
    if (spans[len]) {
        spans[len].classList.add("current");
        
        // ⭐ BLIND MODE: Ký tự tại con trỏ -> Luôn hiện (để biết gõ gì)
        if (STATE.blindMode) spans[len].classList.remove("blind-hidden");
        
        if (DOM.autoTooltipToggle.checked) showTooltipForSpan(spans[len]);
    }

    // --- STATS ---
    STATE.statTotalKeys++;
    if (len > 0 && currentText[len - 1] === original[len - 1]) STATE.statCorrectKeys++;
    else STATE.statErrors++;
    scheduleStatsUpdate();

    // --- UTILS ---
    if (DOM.soundToggle.checked) playClick();
    if (DOM.autoPronounceToggle.checked) checkNewWordAndSpeak(currentText, original);
    throttleScrollToCurrent();

    // --- CHECK COMPLETION ---
    if (len === original.length && currentText === original) {
        DOM.textInput.disabled = true;
        DOM.startBtn.disabled = false;
        DOM.startBtn.textContent = "Start";
        setTimeout(() => alert(`Hoàn thành! Độ chính xác: ${DOM.accuracyEl.textContent}`), 100);
        document.dispatchEvent(new CustomEvent("timer:stop"));
    }
}