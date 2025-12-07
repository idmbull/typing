// --- START OF FILE scripts/dictation-input.js ---

import { DOM, STATE } from "./state.js";
import { showTooltipForSpan } from "./tooltip.js";
import { playClick, checkNewWordAndSpeak } from "./audio.js";
import { scheduleStatsUpdate } from "./stats.js";
import { runTypingEngine } from "./typing-engine.js";
import { applyDictationBlindMode } from "./dictation-app.js";

/* ---------------------------------------------------------
   SMOOTH SCROLL LOGIC (COPY FROM TYPING MODE)
   --------------------------------------------------------- */
let targetScrollTop = 0;   
let isAnimating = false;   
let scrollFrameId = null;  

// --- CƠ CHẾ NGẮT KHI NGƯỜI DÙNG CUỘN TAY ---
function stopAutoScroll() {
    if (isAnimating) {
        isAnimating = false;
        cancelAnimationFrame(scrollFrameId);
        targetScrollTop = DOM.textContainer.scrollTop;
    }
}

// Gắn sự kiện (Chỉ chạy khi file module này được load)
if (DOM.textContainer) {
    DOM.textContainer.addEventListener("wheel", stopAutoScroll, { passive: true });
    DOM.textContainer.addEventListener("touchstart", stopAutoScroll, { passive: true });
    DOM.textContainer.addEventListener("mousedown", stopAutoScroll, { passive: true });
}

function smoothScrollLoop() {
    if (!isAnimating) return;

    const container = DOM.textContainer;
    const currentScroll = container.scrollTop;
    const diff = targetScrollTop - currentScroll;

    if (Math.abs(diff) < 0.5) {
        container.scrollTop = targetScrollTop;
        isAnimating = false;
        return;
    }

    // Tốc độ 0.15 (giống typing)
    container.scrollTop = currentScroll + (diff * 0.15);
    scrollFrameId = requestAnimationFrame(smoothScrollLoop);
}

function updateScrollTarget() {
    const idx = STATE.prevIndex;
    const span = STATE.textSpans[idx];
    if (!span) return;

    const container = DOM.textContainer;
    
    if (!isAnimating) {
         targetScrollTop = container.scrollTop;
    }

    const caretRect = span.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const containerHeight = containerRect.height;
    
    const relativeY = caretRect.top - containerRect.top;

    const safeZoneTop = containerHeight * 0.35; 
    const safeZoneBot = containerHeight * 0.55; 

    let delta = 0;
    if (relativeY < safeZoneTop) delta = relativeY - safeZoneTop;
    else if (relativeY > safeZoneBot) delta = relativeY - safeZoneBot;

    if (delta !== 0) {
        targetScrollTop = container.scrollTop + delta;
        const maxScroll = container.scrollHeight - container.clientHeight;
        targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));

        if (!isAnimating) {
            isAnimating = true;
            cancelAnimationFrame(scrollFrameId);
            smoothScrollLoop();
        }
    }
}

/* ---------------------------------------------------------
   HANDLE DICTATION INPUT
   --------------------------------------------------------- */
export function handleDictationInput(superPlayer) {
    const dict = STATE.dictation;
    if (!dict.active) return;

    let val = DOM.textInput.value;
    
    // Đồng bộ xử lý xuống dòng thành dấu cách
    if (val.includes("\n")) val = val.replace(/\n/g, " ");
    
    if (val.length > dict.fullText.length) val = val.slice(0, dict.fullText.length);
    DOM.textInput.value = val;

    const currentText = val;
    const original = dict.fullText; // Chuỗi logic (đã nối bằng " ")
    const spans = STATE.textSpans;

    // Auto-start logic cho Dictation
    if (!STATE.isActive) {
        // Nếu muốn tự start khi gõ thì uncomment dòng dưới
        // Nhưng Dictation thường cần bấm Start để nghe trước
        // STATE.isActive = true; 
        
        // Nếu chưa bấm Start mà gõ thì reset input
        DOM.textInput.value = "";
        return;
    }
    
    // Nếu mới bắt đầu, reset scroll target
    if (currentText.length === 1) {
        targetScrollTop = DOM.textContainer.scrollTop;
    }

    // Chạy Typing Engine
    STATE.originalText = original; // Engine cần biến này
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

    // Apply Blind Mode
    applyDictationBlindMode();

    // Stats Logic (Fix lỗi backspace tương tự Typing)
    // Lưu ý: Dictation cần tự quản lý prevInputLen nếu muốn chính xác tuyệt đối
    // Ở đây ta dùng tạm logic đơn giản hoặc tích hợp logic prevInputLen
    if (currentText.length > 0) {
        // Chỉ cộng nếu độ dài tăng (để tránh cheat stats khi xóa), 
        // nhưng cần biến state riêng. Tạm thời giữ logic cũ hoặc thêm prevInputLen vào STATE.dictation
        STATE.statTotalKeys++;
        const last = currentText.length - 1;
        if (currentText[last] === original[last]) STATE.statCorrectKeys++;
        else STATE.statErrors++;
        scheduleStatsUpdate();
    }

    if (DOM.soundToggle?.checked) playClick();
    if (DOM.autoPronounceToggle?.checked && newWord) {
        checkNewWordAndSpeak(currentText, original);
    }

    // --- SCROLL MƯỢT (NEW) ---
    // Gọi trong setTimeout để UI render xong mới tính toạ độ
    setTimeout(() => {
        updateScrollTarget();
    }, 0);

    // --- SEGMENT LOGIC (Dictation Specific) ---
    // Kiểm tra xem đã gõ hết đoạn hiện tại chưa để phát đoạn tiếp theo
    const segIdx = dict.currentSegmentIndex;
    const seg = dict.segments[segIdx];
    
    if (seg) {
        // dict.charStarts[idx] là vị trí bắt đầu của segment trong chuỗi fullText
        const segStart = dict.charStarts[segIdx];
        const segEnd = segStart + seg.cleanText.length;

        // Nếu con trỏ đã vượt qua điểm cuối của segment này
        if (caret >= segEnd) {
            const next = segIdx + 1;
            // Phát sự kiện để dictation.js xử lý việc chuyển audio
            // (Tránh gọi trực tiếp superPlayer ở đây để code gọn)
            document.dispatchEvent(new CustomEvent("dictation:segmentDone", { detail: segIdx }));
        }
    }

    if (isComplete) {
        DOM.textInput.disabled = true;
        document.dispatchEvent(new CustomEvent("timer:stop"));
        setTimeout(() => {
             alert(`🎉 Hoàn thành Dictation!\nĐộ chính xác: ${DOM.accuracyEl.textContent}`);
        }, 100);
    }
}