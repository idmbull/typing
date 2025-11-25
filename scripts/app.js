// /scripts/app.js
import { DOM, STATE, resetState } from "./state.js";
import { loadPlaylist, loadInputTextFromFile, getCurrentSectionText } from "./loader.js";
import { displayText } from "./renderer.js";
import { handleInputEvent } from "./input-handler.js";
import { initTheme, setTheme } from "./theme.js";
import { updateStatsDOMImmediate } from "./stats.js";
import { loadRawTextFromUserFile, setupFileLoader } from "./loader.js";

/* ---------------------------------------------------------
    START EXERCISE
   --------------------------------------------------------- */

function startExercise() {
    if (STATE.isActive) return;

    STATE.isActive = true;
    DOM.textInput.disabled = false;
    DOM.textInput.focus();

    DOM.startBtn.textContent = "Typing...";
    DOM.startBtn.disabled = true;

    document.dispatchEvent(new CustomEvent("timer:start"));
}


/* ---------------------------------------------------------
    RESET EXERCISE (giống bản gốc)
   --------------------------------------------------------- */

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


/* ---------------------------------------------------------
    INIT FUNCTION — chạy khi load playlist xong
   --------------------------------------------------------- */

function init() {
    resetState();

    const txt = getCurrentSectionText();
    STATE.originalText = txt;
    displayText(txt);

    DOM.textInput.value = "";
    DOM.textInput.disabled = true;

    updateStatsDOMImmediate(100, 0, "0s", 0);
}


/* ---------------------------------------------------------
    EVENT BINDINGS
   --------------------------------------------------------- */

function bindEvents() {

    // Input typing
    DOM.textInput.addEventListener("input", handleInputEvent);

    // Start
    DOM.startBtn.addEventListener("click", startExercise);

    // Reset
    DOM.resetBtn.addEventListener("click", resetExercise);

    // Chọn playlist
    DOM.playlistSelect.addEventListener("change", async (e) => {
        await loadInputTextFromFile(e.target.value);
        init();

        // ⭐ Auto scroll when switching playlist
        DOM.textContainer.scrollTop = 0;
    });


    // Chọn đoạn (difficulty)
    DOM.difficultySelect.addEventListener("change", () => {
        const sec = DOM.difficultySelect.value;

        // ⭐ Đổi header theo tên section
        document.querySelector("header h1").textContent = sec;

        // ⭐ Render lại đoạn văn
        const text = getCurrentSectionText();
        STATE.originalText = text;
        displayText(text);

        // Reset input & state
        DOM.textInput.value = "";
        resetState();
        updateStatsDOMImmediate(100, 0, "0s", 0);

        // ⭐⭐ AUTO-SCROLL TO TOP ⭐⭐
        DOM.textContainer.scrollTop = 0;
    });



    // Theme toggle
    DOM.themeToggle.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        setTheme(current === "light" ? "dark" : "light");
    });

    // Click ngoài vùng input → tự focus lại
    document.addEventListener("click", (e) => {
        const t = e.target.tagName;
        if (t !== "BUTTON" && t !== "SELECT" && t !== "TEXTAREA" && t !== "INPUT") {
            setTimeout(() => {
                if (!DOM.textInput.disabled) DOM.textInput.focus();
            }, 0);
        }
    });

    /* TIMER EVENTS (do input-handler dùng trigger exercise:start) */
    document.addEventListener("exercise:start", () => {
        document.dispatchEvent(new CustomEvent("timer:start"));
    });

    document.addEventListener("timer:start", () => {
        import("./stats.js").then(mod => {
            mod.startTimer();
        });
    });

    document.addEventListener("timer:stop", () => {
        import("./stats.js").then(mod => {
            mod.stopTimer();
        });
    });
}


/* ---------------------------------------------------------
    APP ENTRY POINT
   --------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {

    // 1) Load theme
    initTheme();

    // 2) Load playlist JSON
    await loadPlaylist();

    // 3) Load bài đầu tiên
    await loadInputTextFromFile(STATE?.playlistSelect?.value || DOM.playlistSelect.value);

    // 4) Init UI
    init();

    // 5) Bind events
    bindEvents();
});

// đưa nội dung file vào ứng dụng
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

document.getElementById("fileLoaderBtn").addEventListener("click", () => {
    document.getElementById("fileLoader").click();
});

document.getElementById("fileLoader").addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
        document.getElementById("fileLoaderBtn").textContent = "✔ Loaded";
    }
});
