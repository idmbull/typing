// /scripts/app.js
import { DOM, STATE, resetState } from "./state.js";
import { loadPlaylist, loadInputTextFromFile, getCurrentSectionText, setupFileLoader, loadRawTextFromUserFile } from "./loader.js";
import { displayText, applyBlindMode } from "./renderer.js";
import { handleInputEvent } from "./input-handler.js";
import { initTheme, setTheme } from "./theme.js";
import { updateStatsDOMImmediate } from "./stats.js";
import { initDictation } from "./dictation.js";

/* ... (giữ nguyên các hàm startExercise, resetExercise, init như cũ) ... */

function startExercise() {
    if (STATE.isActive) return;
    STATE.isActive = true;
    DOM.textInput.disabled = false;
    DOM.textInput.focus();
    DOM.startBtn.textContent = "Typing...";
    DOM.startBtn.disabled = true;
    document.dispatchEvent(new CustomEvent("timer:start"));
}

function resetExercise() {
    document.dispatchEvent(new CustomEvent("timer:stop"));
    resetState();

    const text = STATE.mode === "dictation" ? STATE.dictation.fullTextRaw : getCurrentSectionText();
    STATE.originalText = STATE.mode === "dictation" ? STATE.dictation.fullText : text;

    displayText(text);

    DOM.textInput.value = "";
    DOM.textInput.disabled = false;
    DOM.startBtn.disabled = false;
    DOM.startBtn.textContent = "Start";
    DOM.textContainer.scrollTop = 0;
    updateStatsDOMImmediate(100, 0, "0s", 0);
}

function init() {
    resetState();
    const txt = getCurrentSectionText();
    STATE.originalText = txt;
    displayText(txt);
    DOM.textInput.value = "";
    DOM.textInput.disabled = true;
    updateStatsDOMImmediate(100, 0, "0s", 0);
}

document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    await loadPlaylist();
    await loadInputTextFromFile(DOM.playlistSelect.value);
    init();
    initDictation();

    // Event Bindings
    DOM.textInput.addEventListener("input", handleInputEvent);
    DOM.startBtn.addEventListener("click", startExercise);
    DOM.resetBtn.addEventListener("click", resetExercise);

    DOM.playlistSelect.addEventListener("change", async (e) => {
        await loadInputTextFromFile(e.target.value);
        init();
        DOM.textContainer.scrollTop = 0;
    });

    DOM.difficultySelect.addEventListener("change", () => {
        document.querySelector("header h1").textContent = DOM.difficultySelect.value;
        const text = getCurrentSectionText();
        STATE.originalText = text;
        displayText(text);
        DOM.textInput.value = "";
        resetState();
        updateStatsDOMImmediate(100, 0, "0s", 0);
        DOM.textContainer.scrollTop = 0;
    });

    DOM.themeToggle.addEventListener("click", () => {
        setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
    });

    // Toggle Blind Mode qua UI (Checkbox)
    DOM.blindModeToggle.addEventListener("change", (e) => {
        STATE.blindMode = e.target.checked;
        if (STATE.blindMode) {
            document.body.classList.add("blind-mode");
        } else {
            document.body.classList.remove("blind-mode");
        }

        if (DOM.dictationBlindMode) DOM.dictationBlindMode.checked = e.target.checked;
        applyBlindMode(DOM.textInput.value.length);
        DOM.textInput.focus();
    });

    // Focus Hack
    document.addEventListener("click", (e) => {
        const t = e.target.tagName;
        if (!['BUTTON', 'SELECT', 'TEXTAREA', 'INPUT', 'LABEL'].includes(t)) {
            if (!DOM.textInput.disabled) DOM.textInput.focus();
        }
    });

    // ⭐ GLOBAL HOTKEYS (Thêm mới đoạn này)
    document.addEventListener("keydown", (e) => {
        // Ctrl + B: Toggle Blind Mode
        // Ctrl + B: Toggle Blind Mode
        if (e.ctrlKey && e.code === "KeyB") {
            e.preventDefault();

            STATE.blindMode = !STATE.blindMode;

            // Đồng bộ checkbox
            DOM.blindModeToggle.checked = STATE.blindMode;

            // ⭐ Thay toggle bằng add/remove để không bao giờ lỗi
            if (STATE.blindMode) {
                document.body.classList.add("blind-mode");
            } else {
                document.body.classList.remove("blind-mode");
            }

            applyBlindMode(DOM.textInput.value.length);
        }

    });

    // Timer Events
    document.addEventListener("exercise:start", () => document.dispatchEvent(new CustomEvent("timer:start")));
    document.addEventListener("timer:start", () => import("./stats.js").then(m => m.startTimer()));
    document.addEventListener("timer:stop", () => import("./stats.js").then(m => m.stopTimer()));
});

// File Loader
setupFileLoader(async (content, filename) => {
    await loadRawTextFromUserFile(content, filename);
    const txt = getCurrentSectionText();
    STATE.originalText = txt;
    displayText(txt);
    DOM.textInput.value = "";
    resetState();
    updateStatsDOMImmediate(100, 0, "0s", 0);
    DOM.textContainer.scrollTop = 0;
});
document.getElementById("fileLoaderBtn").addEventListener("click", () => document.getElementById("fileLoader").click());
document.getElementById("fileLoader").addEventListener("change", (e) => { if (e.target.files.length) $('#fileLoaderBtn').textContent = "✔ Loaded"; });