// /scripts/app.js — Typing App (không còn dictation trong file này)
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
   START / RESET EXERCISE
============================ */

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

    const text = getCurrentSectionText();
    STATE.originalText = text;

    displayText(text);

    DOM.textInput.value = "";
    DOM.textInput.disabled = false;
    DOM.startBtn.disabled = false;
    DOM.startBtn.textContent = "Start";
    DOM.textContainer.scrollTop = 0;
    updateStatsDOMImmediate(100, 0, "0s", 0);
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
}

document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    await loadPlaylist();
    await loadInputTextFromFile(DOM.playlistSelect.value);
    init();

    // Input typing
    DOM.textInput.addEventListener("input", handleInputEvent);
    DOM.startBtn.addEventListener("click", startExercise);
    DOM.resetBtn.addEventListener("click", resetExercise);

    // PLAYLIST SELECT
    DOM.playlistSelect.addEventListener("change", async (e) => {
        await loadInputTextFromFile(e.target.value);

        resetState();
        const txt = getCurrentSectionText();
        displayText(txt);

        DOM.textInput.value = "";
        DOM.textInput.disabled = true;
        updateStatsDOMImmediate(100, 0, "0s", 0);
        DOM.textContainer.scrollTop = 0;
    });

    // SECTION SELECT
    DOM.difficultySelect.addEventListener("change", () => {
        document.querySelector("header h1").textContent = DOM.difficultySelect.value;

        resetState();
        const text = getCurrentSectionText();
        displayText(text);

        DOM.textInput.value = "";
        DOM.textInput.disabled = true;
        updateStatsDOMImmediate(100, 0, "0s", 0);
        DOM.textContainer.scrollTop = 0;
    });

    // Theme toggle
    DOM.themeToggle.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme") || "light";
        setTheme(cur === "light" ? "dark" : "light");
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

    // Hotkey Ctrl + B: toggle Blind Mode
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
    document.addEventListener("timer:stop", () =>
        import("./stats.js").then((m) => m.stopTimer())
    );
});

// FILE LOADER
setupFileLoader(async (content, filename) => {
    await loadRawTextFromUserFile(content, filename);

    resetState();
    const txt = getCurrentSectionText();
    displayText(txt);

    DOM.textInput.value = "";
    DOM.textInput.disabled = true;
    updateStatsDOMImmediate(100, 0, "0s", 0);
    DOM.textContainer.scrollTop = 0;
});
document
    .getElementById("fileLoaderBtn")
    .addEventListener("click", () =>
        document.getElementById("fileLoader").click()
    );