// --- START OF FILE scripts/input-handler.js ---

import { DOM, STATE } from "./state.js";
import { showTooltipForSpan } from "./tooltip.js";
import { playClick, checkNewWordAndSpeak } from "./audio.js";
import { scheduleStatsUpdate } from "./stats.js";
import { runTypingEngine } from "./typing-engine.js";

/* ---------------------------------------------------------
   SMOOTH SCROLL LOGIC (LERP / DAMPING)
   --------------------------------------------------------- */
let targetScrollTop = 0;   // Vị trí đích
let isAnimating = false;   // Cờ trạng thái Auto-scroll
let scrollFrameId = null;  // ID của animation frame

// --- FIX: CHO PHÉP NGƯỜI DÙNG CUỘN TAY ---
// Hàm dừng Auto-scroll ngay lập tức
function stopAutoScroll() {
    if (isAnimating) {
        isAnimating = false;
        cancelAnimationFrame(scrollFrameId);
        // Cập nhật target bằng vị trí hiện tại để lần gõ sau không bị "nhảy"
        targetScrollTop = DOM.textContainer.scrollTop;
    }
}

// Gắn sự kiện lắng nghe thao tác cuộn của người dùng
// (Chỉ cần chạy 1 lần khi file được load)
if (DOM.textContainer) {
    // 1. Lăn chuột (Mouse Wheel)
    DOM.textContainer.addEventListener("wheel", stopAutoScroll, { passive: true });
    // 2. Chạm vuốt (Touch mobile)
    DOM.textContainer.addEventListener("touchstart", stopAutoScroll, { passive: true });
    // 3. Kéo thanh Scrollbar (Mousedown)
    DOM.textContainer.addEventListener("mousedown", stopAutoScroll, { passive: true });
}
// ------------------------------------------

function smoothScrollLoop() {
    if (!isAnimating) return; // Dừng nếu bị ngắt bởi người dùng

    const container = DOM.textContainer;
    const currentScroll = container.scrollTop;
    
    // Tính khoảng cách
    const diff = targetScrollTop - currentScroll;

    // Dừng nếu đã đến rất gần đích
    if (Math.abs(diff) < 0.5) {
        container.scrollTop = targetScrollTop;
        isAnimating = false;
        return;
    }

    // Lerp: Di chuyển mềm mại (0.15 là tốc độ, càng nhỏ càng êm)
    container.scrollTop = currentScroll + (diff * 0.15);

    // Tiếp tục vòng lặp
    scrollFrameId = requestAnimationFrame(smoothScrollLoop);
}

function updateScrollTarget() {
    const idx = STATE.prevIndex;
    const span = STATE.textSpans[idx];
    if (!span) return;

    const container = DOM.textContainer;
    
    // Nếu đang không chạy auto-scroll (do người dùng vừa cuộn tay xong),
    // hãy đồng bộ lại target để tránh giật màn hình
    if (!isAnimating) {
         targetScrollTop = container.scrollTop;
    }

    const caretRect = span.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const containerHeight = containerRect.height;
    
    const relativeY = caretRect.top - containerRect.top;

    // Vùng an toàn (Safe Zone)
    const safeZoneTop = containerHeight * 0.35; 
    const safeZoneBot = containerHeight * 0.55; 

    let delta = 0;

    if (relativeY < safeZoneTop) {
        delta = relativeY - safeZoneTop;
    } else if (relativeY > safeZoneBot) {
        delta = relativeY - safeZoneBot;
    }

    if (delta !== 0) {
        // Cập nhật đích đến mới
        targetScrollTop = container.scrollTop + delta;

        const maxScroll = container.scrollHeight - container.clientHeight;
        targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));

        // Kích hoạt lại Auto-scroll (nếu đang tắt)
        if (!isAnimating) {
            isAnimating = true;
            cancelAnimationFrame(scrollFrameId);
            smoothScrollLoop();
        }
    }
}

/* ---------------------------------------------------------
   TYPING MODE
   --------------------------------------------------------- */
export function handleInputEvent() {
    // 1. INPUT PROCESSING
    let val = DOM.textInput.value;
    if (val.includes("\n")) val = val.replace(/\n/g, " ");
    
    const maxLen = STATE.originalText.length;
    if (val.length > maxLen) val = val.slice(0, maxLen);
    
    if (DOM.textInput.value !== val) DOM.textInput.value = val;

    const currentText = val;
    const original = STATE.originalText;
    const spans = STATE.textSpans;

    // Auto start logic
    if (!STATE.isActive) {
        document.dispatchEvent(new CustomEvent("exercise:start"));
        STATE.isActive = true;
        STATE.prevInputLen = 0; // Reset bộ đếm độ dài (cho Stats)
        
        if (DOM.actionToggle) DOM.actionToggle.checked = true;
        if (DOM.actionLabel) {
            DOM.actionLabel.textContent = "Stop";
            DOM.actionLabel.style.color = "var(--incorrect-text)";
        }
        
        targetScrollTop = DOM.textContainer.scrollTop;
    }

    // 2. CORE ENGINE
    const { caret, changed, newWord, isComplete } = runTypingEngine(currentText);

    // 3. DOM UPDATE
    for (let i = 0; i < changed.length; i++) {
        const idx = changed[i];
        const span = spans[idx];
        if (!span) continue;

        const cls = span.classList;
        cls.remove("current", "correct", "incorrect", "blind-hidden");
        
        if (idx < caret) {
            if (currentText[idx] === original[idx]) {
                cls.add("correct");
            } else {
                cls.add("incorrect");
            }
        } else {
            if (STATE.blindMode && idx > caret) {
                cls.add("blind-hidden");
            }
        }
    }

    // Update Caret
    STATE.prevIndex = caret;
    if (spans[caret]) {
        spans[caret].classList.add("current");
        if (STATE.blindMode) spans[caret].classList.remove("blind-hidden");
        
        if (DOM.autoTooltipToggle?.checked) {
            showTooltipForSpan(spans[caret]);
        }
    }

    // 4. DEFERRED TASKS
    setTimeout(() => {
        // Audio
        if (DOM.soundToggle?.checked) playClick();
        if (DOM.autoPronounceToggle?.checked && newWord) {
            checkNewWordAndSpeak(currentText, original);
        }

        // --- STATS LOGIC (ĐÃ SỬA: Chỉ tính khi gõ thêm, không tính Backspace) ---
        const currentLen = currentText.length;
        if (currentLen > STATE.prevInputLen) {
            STATE.statTotalKeys++;
            
            // Check ký tự vừa nhập (vị trí len-1)
            const typedChar = currentText[currentLen - 1];
            const targetChar = original[currentLen - 1];

            if (typedChar === targetChar) {
                STATE.statCorrectKeys++;
            } else {
                STATE.statErrors++;
            }
            scheduleStatsUpdate();
        }
        STATE.prevInputLen = currentLen; // Cập nhật độ dài
        // --------------------------------------------------------------------

        // Gọi hàm cuộn (đã có logic ngắt khi user can thiệp)
        updateScrollTarget();

        // Check Finish
        if (isComplete) {
            DOM.textInput.disabled = true;
            document.dispatchEvent(new CustomEvent("timer:stop"));
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                     // Hiển thị đầy đủ thông số
                     alert(`Hoàn thành!\nĐộ chính xác: ${DOM.accuracyEl.textContent}\nWPM: ${DOM.wpmEl.textContent}`);
                });
            });
        }
    }, 0);
}