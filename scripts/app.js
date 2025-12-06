// /scripts/app.js — Typing App
import { DOM, STATE, resetState } from "./state.js";
import {
    loadPlaylist,
    loadInputTextFromFile,
    getCurrentSectionText,
    setupFileLoader,
    loadRawTextFromUserFile
} from "./loader.js";
import { displayText, applyBlindMode } from "./renderer.js";
import { handleInputEvent } from "./input-handler.js";
import { initTheme, setTheme } from "./theme.js";
import { updateStatsDOMImmediate } from "./stats.js";

/* ============================
   HELPER: UPDATE UI (TOGGLE)
============================ */
function updateActionUI() {
    // 1. Đồng bộ trạng thái checkbox
    DOM.actionToggle.checked = STATE.isActive;

    // 2. Cập nhật nhãn (Start / Stop)
    if (STATE.isActive) {
        DOM.actionLabel.textContent = "Stop";
        DOM.actionLabel.style.color = "var(--incorrect-text)"; // Màu đỏ
    } else {
        DOM.actionLabel.textContent = "Start";
        DOM.actionLabel.style.color = "var(--correct-text)"; // Màu thường
        DOM.actionToggle.disabled = false;
    }
}

/* ============================
   START / RESET EXERCISE
============================ */

function handleAction(e) {
    const isChecked = e.target.checked;
    
    if (isChecked) {
        startExercise();
    } else {
        resetExercise();
    }
}

function startExercise() {
    if (STATE.isActive) return;
    STATE.isActive = true;
    
    DOM.textInput.disabled = false;
    DOM.textInput.focus();
    
    document.dispatchEvent(new CustomEvent("timer:start"));
    updateActionUI();
}

function resetExercise() {
    document.dispatchEvent(new CustomEvent("timer:stop"));
    resetState();

    const text = getCurrentSectionText();
    STATE.originalText = text;

    displayText(text);

    DOM.textInput.value = "";
    DOM.textInput.disabled = false;
    DOM.textContainer.scrollTop = 0;
    
    DOM.textInput.focus();
    
    updateStatsDOMImmediate(100, 0, "0s", 0);
    
    // Reset switch về OFF
    updateActionUI();
}

/* ============================
   INIT PAGE
============================ */

function init() {
    resetState();
    const txt = getCurrentSectionText();
    STATE.originalText = txt;
    displayText(txt);
    DOM.textInput.value = "";
    DOM.textInput.disabled = true;
    updateStatsDOMImmediate(100, 0, "0s", 0);
    updateActionUI();
}

document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    await loadPlaylist();
    await loadInputTextFromFile(DOM.playlistSelect.value);
    init();

    // Input typing
    DOM.textInput.addEventListener("input", handleInputEvent);
    
    // Gộp nút Start/Reset (Sự kiện CHANGE)
    if (DOM.actionToggle) {
        DOM.actionToggle.addEventListener("change", handleAction);
    }

    // PLAYLIST SELECT
    DOM.playlistSelect.addEventListener("change", async (e) => {
        await loadInputTextFromFile(e.target.value);
        resetExercise();
    });

    // SECTION SELECT
    DOM.difficultySelect.addEventListener("change", () => {
        document.querySelector("header h1").textContent = DOM.difficultySelect.value;
        resetExercise();
    });

    // Theme toggle
    DOM.themeToggle.addEventListener("change", (e) => {
        const newTheme = e.target.checked ? "dark" : "light";
        setTheme(newTheme);
        if (!DOM.textInput.disabled) {
            DOM.textInput.focus();
        }
    });

    // Blind Mode toggle
    DOM.blindModeToggle.addEventListener("change", (e) => {
        STATE.blindMode = e.target.checked;
        if (STATE.blindMode) {
            document.body.classList.add("blind-mode");
        } else {
            document.body.classList.remove("blind-mode");
        }
        applyBlindMode(DOM.textInput.value.length);
        DOM.textInput.focus();
    });

    // Focus hack
    document.addEventListener("click", (e) => {
        const t = e.target.tagName;
        if (!["BUTTON", "SELECT", "TEXTAREA", "INPUT", "LABEL"].includes(t)) {
            if (!DOM.textInput.disabled) DOM.textInput.focus();
        }
    });

    // Hotkey Ctrl + B
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.code === "KeyB") {
            e.preventDefault();
            STATE.blindMode = !STATE.blindMode;
            DOM.blindModeToggle.checked = STATE.blindMode;
            if (STATE.blindMode) {
                document.body.classList.add("blind-mode");
            } else {
                document.body.classList.remove("blind-mode");
            }
            applyBlindMode(DOM.textInput.value.length);
        }
    });

    // Timer Events
    document.addEventListener("exercise:start", () =>
        document.dispatchEvent(new CustomEvent("timer:start"))
    );
    document.addEventListener("timer:start", () =>
        import("./stats.js").then((m) => m.startTimer())
    );
    
    // Khi timer dừng (hoàn thành bài hoặc reset)
    document.addEventListener("timer:stop", () => {
        import("./stats.js").then((m) => m.stopTimer());
        
        // Nếu hoàn thành bài (textInput bị disable), tự gạt switch về OFF
        if (DOM.textInput.disabled) {
             STATE.isActive = false;
             updateActionUI();
        }
    });
});

// FILE LOADER
setupFileLoader(async (content, filename) => {
    await loadRawTextFromUserFile(content, filename);
    resetExercise();
});

document
    .getElementById("fileLoaderBtn")
    .addEventListener("click", () =>
        document.getElementById("fileLoader").click()
    );