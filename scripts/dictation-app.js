// ================================
// dictation-app.js
// ================================

import { DOM, STATE, resetState } from "./state.js";
import { updateStatsDOMImmediate, startTimer, stopTimer } from "./stats.js";
import { displayText } from "./renderer.js";
import { initTheme, setTheme } from "./theme.js";
import { SuperAudioPlayer } from "./superAudioPlayer.js";
import {
    loadDictationPlaylist,
    loadDictationSegments,
    buildDictationText,
    findDictationAudio
} from "./dictation-loader.js";
import { handleDictationInput } from "./dictation-input.js";

// THÊM IMPORT initDictation
import { initDictation } from "./dictation.js";

const superPlayer = new SuperAudioPlayer();

/* ============================================================
   HELPER: UPDATE UI (TOGGLE)
============================================================ */
function updateActionUI() {
    DOM.actionToggle.checked = STATE.isActive;

    if (STATE.isActive) {
        DOM.actionLabel.textContent = "Stop";
        DOM.actionLabel.style.color = "var(--incorrect-text)";
    } else {
        DOM.actionLabel.textContent = "Start";
        DOM.actionLabel.style.color = "var(--correct-text)";
        
        DOM.actionToggle.disabled = !STATE.dictation.fullText;
    }
}

/* ============================================================
   RESET STATE CHO DICTATION
============================================================ */
function resetDictState() {
    resetState();
    STATE.mode = "dictation";
    STATE.dictation.active = false;
    STATE.dictation.segments = [];
    STATE.dictation.fullText = "";
    STATE.dictation.fullTextRaw = "";
    STATE.dictation.charStarts = [];
    STATE.dictation.currentSegmentIndex = 0;
    STATE.dictation.audioUrl = null;
}

/* ============================================================
   ÁP DỤNG BLIND MODE
============================================================ */
export function applyDictationBlindMode() {
    const spans = STATE.textSpans;
    if (!spans || !spans.length) return;

    const caret = DOM.textInput.value.length;

    if (!STATE.blindMode) {
        spans.forEach(s => s.classList.remove("blind-hidden"));
        return;
    }

    for (let i = 0; i < spans.length; i++) {
        if (i <= caret) spans[i].classList.remove("blind-hidden");
        else spans[i].classList.add("blind-hidden");
    }
}

/* ============================================================
   TẢI PLAYLIST
============================================================ */
async function loadDictationPlaylistToUI() {
    const list = await loadDictationPlaylist();
    DOM.playlistSelect.innerHTML = list
        .map((f) => `<option value="${f}">${f.replace(".txt", "")}</option>`)
        .join("");
}

/* ============================================================
   TẢI BÀI DICTATION
============================================================ */
async function loadCurrentDictation() {
    const filename = DOM.playlistSelect.value;
    if (!filename) return;

    const segments = await loadDictationSegments(filename);
    if (!segments.length) {
        alert("File Dictation trống hoặc sai format!");
        return;
    }

    const { fullTextRaw, fullText, charStarts } = buildDictationText(segments);

    resetDictState();
    STATE.dictation.segments = segments;
    STATE.dictation.fullText = fullText;
    STATE.dictation.fullTextRaw = fullTextRaw;
    STATE.dictation.charStarts = charStarts;
    STATE.dictation.active = true;

    // Load mp3
    const audioUrl = await findDictationAudio(filename);
    if (audioUrl) {
        const buf = await (await fetch(audioUrl)).arrayBuffer();
        await superPlayer.load(buf);
        STATE.dictation.audioUrl = audioUrl;
    } else {
        console.warn("Không tìm thấy file MP3 tương ứng!");
    }

    displayText(fullTextRaw);

    STATE.prevIndex = 0;
    if (STATE.textSpans[0]) {
        STATE.textSpans[0].classList.add("current");
    }

    applyDictationBlindMode();

    DOM.textInput.value = "";
    DOM.textInput.disabled = true;

    STATE.isActive = false;
    updateStatsDOMImmediate(100, 0, "0s", 0);
    DOM.textContainer.scrollTop = 0;

    document.querySelector("header h1").textContent = filename.replace(".txt", "");

    updateActionUI();
}

/* ============================================================
   PHÁT ĐOẠN ÂM THANH HIỆN TẠI
============================================================ */
function playCurrentSegment() {
    const idx = STATE.dictation.currentSegmentIndex;
    const seg = STATE.dictation.segments[idx];
    if (!seg) return;

    superPlayer.stop();
    superPlayer.playSegment(seg.audioStart, seg.audioEnd);
}

/* ============================================================
   ACTION HANDLER (GỘP START/RESET)
============================================================ */
function handleAction(e) {
    if (e.target.checked) {
        startDictation();
    } else {
        resetDictation();
    }
}

function startDictation() {
    if (STATE.isActive) return;

    STATE.isActive = true;
    DOM.textInput.disabled = false;
    DOM.textInput.focus();
    
    document.dispatchEvent(new CustomEvent("timer:start"));

    STATE.dictation.currentSegmentIndex = 0;
    playCurrentSegment();
    
    updateActionUI();
}

function resetDictation() {
    document.dispatchEvent(new CustomEvent("timer:stop"));
    loadCurrentDictation();
}

/* ============================================================
   MAIN
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
    initTheme();

    // KHỞI TẠO DICTATION MODAL LOGIC VỚI PLAYER CHÍNH
    initDictation(superPlayer);

    await loadDictationPlaylistToUI();
    await loadCurrentDictation();

    const volInput = document.getElementById("dictationVolume");
    if (volInput) {
        superPlayer.setVolume(parseFloat(volInput.value));
        volInput.addEventListener("input", (e) => {
            superPlayer.setVolume(parseFloat(e.target.value));
        });
    }

    DOM.textInput.addEventListener("input", () => {
        handleDictationInput(superPlayer);
        applyDictationBlindMode();
    });

    if (DOM.actionToggle) {
        DOM.actionToggle.addEventListener("change", handleAction);
    }
    
    DOM.playlistSelect.addEventListener("change", loadCurrentDictation);

    DOM.themeToggle.addEventListener("change", (e) => {
        const newTheme = e.target.checked ? "dark" : "light";
        setTheme(newTheme);
        if (!DOM.textInput.disabled) {
            DOM.textInput.focus();
        }
    });

    DOM.blindModeToggle?.addEventListener("change", (e) => {
        STATE.blindMode = e.target.checked;
        if (STATE.blindMode) {
            document.body.classList.add("blind-mode");
        } else {
            document.body.classList.remove("blind-mode");
        }
        applyDictationBlindMode();
    });

    document.addEventListener("keydown", (e) => {
        if (STATE.mode !== "dictation") return;
        if (e.ctrlKey && (e.key === "b" || e.key === "B")) {
            e.preventDefault();
            STATE.blindMode = !STATE.blindMode;
            DOM.blindModeToggle.checked = STATE.blindMode;
            if (STATE.blindMode) {
                document.body.classList.add("blind-mode");
            } else {
                document.body.classList.remove("blind-mode");
            }
            applyDictationBlindMode();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (STATE.mode !== "dictation") return;
        if (e.ctrlKey && e.code === "Space") {
            e.preventDefault();
            playCurrentSegment();
        }
    });

    DOM.textInput.addEventListener("blur", () => {
        if (STATE.mode === "dictation" && STATE.isActive) {
            setTimeout(() => DOM.textInput.focus(), 50);
        }
    });

    document.addEventListener("timer:start", startTimer);
    document.addEventListener("timer:stop", () => {
        stopTimer();
        if (DOM.textInput.disabled) {
             STATE.isActive = false;
             updateActionUI();
        }
    });
});