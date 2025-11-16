// /scripts/input-handler.js
import { DOM, STATE } from "./state.js";
import { setClasses, isOutOfView } from "./utils.js";
import { showTooltipForSpan } from "./tooltip.js";
import { playClick, checkNewWordAndSpeak } from "./audio.js";
import { scheduleStatsUpdate } from "./stats.js";

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
    SCROLL LOGIC (hiệu năng cao với throttle)
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
        const wrapper = span.closest(".tooltip-word");
        const targetEl = wrapper || span;

        const rectTop = targetEl.offsetTop;
        const rectHeight = targetEl.offsetHeight;

        const lineHeight =
            parseFloat(getComputedStyle(DOM.textDisplay).lineHeight) || 20;

        const buffer = lineHeight * 2;

        if (isOutOfView(rectTop, rectHeight, container, buffer)) {
            container.scrollTop = Math.max(
                0,
                rectTop - container.clientHeight * 0.33
            );
        }
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
