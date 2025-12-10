// scripts/core/exercise-controller.js
import { DOM } from "../state.js";
import { Store } from "./store.js";
import { initTheme, setTheme } from "../theme.js";
import { updateStatsDOMImmediate, initStatsService } from "../stats.js";
import { applyBlindMode } from "../renderer.js";
import { handleGlobalInput, resetController, getScroller } from "../input-controller.js";
import { initAudioService } from "../audio.js";
import { EventBus, EVENTS } from "./events.js";
import { AutoScroller } from "../utils/scroller.js";


export class ExerciseController {
    constructor(mode, callbacks = {}) {
        this.mode = mode;
        this.ctrlSpaceTimer = null;
        this.ctrlSpaceCount = 0;

        // --- [SỬA LẠI PHẦN KHỞI TẠO NÀY] ---
        this.callbacks = {
            onReset: callbacks.onReset || (() => { }),
            onLoadContent: callbacks.onLoadContent || (async () => { }),
            onActionStart: callbacks.onActionStart || (() => { }),
            onSectionChange: callbacks.onSectionChange || (() => { }),

            // Đảm bảo có giá trị mặc định là hàm rỗng
            // onReplayWord: callbacks.onReplayWord || (() => { }),
            // onReplaySegment: callbacks.onReplaySegment || (() => { }),
            onCtrlSpaceSingle: callbacks.onCtrlSpaceSingle || (() => { }),
            onCtrlSpaceDouble: callbacks.onCtrlSpaceDouble || (() => { })
        };
        // ------------------------------------

        initAudioService();
        initStatsService();

        this.init();
    }

    init() {
        initTheme();
        // Listener mới cho Dropdown
        if (DOM.themeSelect) {
            DOM.themeSelect.addEventListener("change", (e) => {
                setTheme(e.target.value);
                this.refocus();
            });
        }

        if (DOM.blindModeToggle) {
            DOM.blindModeToggle.addEventListener("change", (e) => {
                const checked = e.target.checked;
                Store.setBlindMode(checked); // Update Store
                this.toggleBlindMode(checked);
            });
        }
        if (DOM.actionToggle) {
            DOM.actionToggle.onchange = (e) => this.handleAction(e.target.checked);
        }

        DOM.textInput.oninput = () => handleGlobalInput(this.mode);
        this.setupGlobalEvents();
        this.setupDropdowns();
    }

    setupGlobalEvents() {
        document.onkeydown = (e) => {
            if (Store.getMode() !== this.mode) return;

            // 1. Phím Ctrl + . (Dấu chấm) -> Phát Từ (Speak)
            // if (e.ctrlKey && e.code === "Period") {
            //     e.preventDefault();
            //     this.callbacks.onReplayWord();
            //     return;
            // }

            // 2. Phím Ctrl + Space -> Phát Segment/Câu (Audio gốc)
            // if (e.ctrlKey && e.code === "Space") {
            //     e.preventDefault();
            //     this.callbacks.onReplaySegment();
            //     return;
            // }

            // --- XỬ LÝ CTRL + SPACE (Single vs Double) ---
            if (e.ctrlKey && e.code === "Space") {
                e.preventDefault();
                if (e.repeat) return; // Bỏ qua nếu người dùng giữ đè phím

                if (this.ctrlSpaceTimer) {
                    // TRƯỜNG HỢP 2: Đã có hẹn giờ đang chạy -> Đây là lần nhấn thứ 2 (Double)

                    // 1. Hủy ngay lập tức lệnh Single đang chờ
                    clearTimeout(this.ctrlSpaceTimer);
                    this.ctrlSpaceTimer = null;

                    // 2. Thực hiện lệnh Double
                    this.callbacks.onCtrlSpaceDouble();

                } else {
                    // TRƯỜNG HỢP 1: Chưa có hẹn giờ -> Đây là lần nhấn đầu tiên (Single)

                    // Thiết lập hẹn giờ 300ms (tăng lên chút để dễ bấm kịp)
                    this.ctrlSpaceTimer = setTimeout(() => {
                        // Nếu hết 300ms mà không bị hủy -> Thực hiện lệnh Single
                        this.callbacks.onCtrlSpaceSingle();

                        // Reset timer về null để đón lần nhấn mới
                        this.ctrlSpaceTimer = null;
                    }, 300);
                }
                return;
            }

            // [Giữ nguyên] Phím tắt Blind Mode (Ctrl + B)
            if (e.ctrlKey && e.code === "KeyB") {
                e.preventDefault();
                const newState = !Store.isBlind();
                Store.setBlindMode(newState);
                if (DOM.blindModeToggle) DOM.blindModeToggle.checked = newState;
                this.toggleBlindMode(newState);
            }
        };

        document.onclick = (e) => {
            if (Store.getMode() !== this.mode) return;
            const t = e.target.tagName;
            if (!["BUTTON", "SELECT", "TEXTAREA", "INPUT", "LABEL"].includes(t)) {
                if (!DOM.textInput.disabled) DOM.textInput.focus();
            }
        };

        EventBus.on(EVENTS.EXERCISE_STOP, () => {
            if (DOM.textInput.disabled) {
                this.updateActionUI();
            }
        });

        document.addEventListener("timer:stop", () => {
            if (DOM.textInput.disabled) {
                this.updateActionUI();
            }
        });
    }

    setupDropdowns() {
        DOM.playlistSelect.onchange = async (e) => {
            await this.callbacks.onLoadContent(e.target.value);
            this.reset();
        };
        DOM.difficultySelect.onchange = () => {
            this.callbacks.onSectionChange(DOM.difficultySelect.value);
            this.reset();
        };
    }

    handleAction(isChecked) {
        if (isChecked) this.start();
        else this.reset();
    }

    start() {
        if (Store.getState().isActive) return;

        Store.startExercise(); // Update Store
        DOM.textInput.disabled = false;
        DOM.textInput.focus();

        EventBus.emit(EVENTS.EXERCISE_START);
        document.dispatchEvent(new CustomEvent("timer:start"));

        this.callbacks.onActionStart();
        this.updateActionUI();
        const scroller = getScroller();
        const state = Store.getState();
        const currentSpan = state.textSpans[state.prevIndex || 0];

        if (scroller && currentSpan) {
            // Gọi scrollTo, logic mới trong scroller.js sẽ tự detect off-screen và snap ngay
            scroller.scrollTo(currentSpan);
        }
    }

    reset() {
        EventBus.emit(EVENTS.EXERCISE_STOP);
        document.dispatchEvent(new CustomEvent("timer:stop"));

        resetController();
        Store.reset(); // Reset runtime store

        this.callbacks.onReset();

        DOM.textInput.value = "";
        // Check source exist via store
        const hasText = !!Store.getSource().text;
        DOM.textInput.disabled = !hasText;
        DOM.textContainer.scrollTop = 0;

        if (hasText) DOM.textInput.disabled = true;

        updateStatsDOMImmediate(100, 0, "0s", 0);
        applyBlindMode(0);
        this.updateActionUI();
    }

    updateActionUI() {
        if (!DOM.actionToggle) return;
        const isActive = Store.getState().isActive;
        const hasText = !!Store.getSource().text;

        DOM.actionToggle.checked = isActive;
        if (isActive) {
            DOM.actionLabel.textContent = "Stop";
            DOM.actionLabel.style.color = "var(--incorrect-text)";
        } else {
            DOM.actionLabel.textContent = "Start";
            DOM.actionLabel.style.color = "var(--correct-text)";
            DOM.actionToggle.disabled = !hasText;
        }
    }

    toggleBlindMode(isEnabled) {
        document.body.classList.toggle("blind-mode", isEnabled);
        applyBlindMode(DOM.textInput.value.length);
        this.refocus();
    }

    refocus() {
        if (!DOM.textInput.disabled) DOM.textInput.focus();
    }
}