// /scripts/input-handler.js
import { DOM, STATE } from "./state.js";
import { setClasses, isOutOfView } from "./utils.js";
import { showTooltipForSpan } from "./tooltip.js";
import { playClick, checkNewWordAndSpeak } from "./audio.js";
import { scheduleStatsUpdate } from "./stats.js";
import { scrollToCaret } from "./renderer.js";

let pendingScroll = false;

/* ---------------------------------------------------------
    HIGHLIGHT & CURSOR MANAGEMENT
   --------------------------------------------------------- */

function updateCharState(index, currentText) {
    const span = STATE.textSpans[index];
    if (!span) return;

    span.classList.remove("correct", "incorrect", "current");

    if (index < currentText.length) {
        if (currentText[index] === STATE.originalText[index])
            span.classList.add("correct");
        else
            span.classList.add("incorrect");
    }
}

function moveCursorTo(index) {
    const prev = STATE.prevIndex;
    if (prev !== index && STATE.textSpans[prev])
        STATE.textSpans[prev].classList.remove("current");

    STATE.prevIndex = index;

    const current = STATE.textSpans[index];
    if (current) current.classList.add("current");
}

/* ---------------------------------------------------------
   SCROLL LOGIC — kiểu Kindle (micro-scroll, cực nhẹ)
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

        // Kindle không đưa caret về giữa — chỉ giữ nó khỏi mép dưới
        const safeZoneTop = containerRect.height * 0.15;   // vùng an toàn trên
        const safeZoneBot = containerRect.height * 0.50;   // vùng an toàn dưới

        let delta = 0;

        if (caretY < safeZoneTop) {
            // Caret gần mép trên → cuộn nhẹ xuống
            delta = caretY - safeZoneTop;
        }
        else if (caretY > safeZoneBot) {
            // Caret gần mép dưới → cuộn nhẹ lên
            delta = caretY - safeZoneBot;
        }

        // Không cuộn nếu caret đang trong vùng an toàn
        if (delta === 0) return;

        // ⭐ Độ “nhẹ” kiểu Kindle — 20% lực cuộn
        delta = delta * 0.15;

        // ⭐ Nếu lệch quá ít (< 8px), bỏ qua để tránh rung
        if (Math.abs(delta) < 8) return;

        // ⭐ Cuộn tức thì, không smooth (vì smooth gây "floaty" → mệt mắt)
        container.scrollTop += delta;
    });
}


/* ---------------------------------------------------------
    CHECK COMPLETION
   --------------------------------------------------------- */

function checkCompletion(currentText) {
    if (currentText.length !== STATE.originalText.length) return false;

    const complete = currentText === STATE.originalText;

    DOM.textInput.disabled = true;
    DOM.startBtn.disabled = false;
    DOM.startBtn.textContent = "Start";

    if (complete) {
        setTimeout(() => {
            const accuracy =
                STATE.statTotalKeys > 0
                    ? Math.floor(
                        (STATE.statCorrectKeys / STATE.statTotalKeys) * 100
                    )
                    : 100;

            alert(`Chúc mừng! Bạn đã hoàn thành bài tập với độ chính xác ${accuracy}%`);
        }, 100);
    }

    return true;
}


/* ---------------------------------------------------------
    INPUT HANDLER — CORE LOGIC
   --------------------------------------------------------- */

export function handleInputEvent() {
    const currentText = DOM.textInput.value;
    const len = currentText.length;

    // Nếu chưa start → tự start
    if (!STATE.isActive) {
        const evt = new CustomEvent("exercise:start");
        document.dispatchEvent(evt);
    }

    // Chỉ update vị trí bị ảnh hưởng: prevIndex, len, len-1
    const indices = new Set([STATE.prevIndex, len, len - 1]);
    for (const i of indices) {
        if (i >= 0 && i < STATE.textSpans.length) {
            updateCharState(i, currentText);
        }
    }

    // Cập nhật con trỏ
    moveCursorTo(len);

    // Tooltip theo ký tự
    if (DOM.autoTooltipToggle.checked) {
        const span = STATE.textSpans[len];
        if (span) showTooltipForSpan(span);
    }

    // Update stats
    STATE.statTotalKeys++;
    if (len > 0 && currentText[len - 1] === STATE.originalText[len - 1])
        STATE.statCorrectKeys++;
    else
        STATE.statErrors++;

    scheduleStatsUpdate();

    // Sound
    if (DOM.soundToggle.checked) playClick();

    // Auto pronounce
    if (DOM.autoPronounceToggle.checked)
        checkNewWordAndSpeak(currentText, STATE.originalText);

    // Scroll
    throttleScrollToCurrent();

    // Check completion
    checkCompletion(currentText);
}
