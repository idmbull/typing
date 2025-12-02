// ================================
// dictation-app.js — Bản đã vá (Fix Timer)
// ================================

import { DOM, STATE, resetState } from "./state.js";
// [FIX] Import thêm startTimer và stopTimer
import { updateStatsDOMImmediate, startTimer, stopTimer } from "./stats.js";
import { displayText } from "./renderer.js";
import { initTheme } from "./theme.js";
import { SuperAudioPlayer } from "./superAudioPlayer.js";
import {
    loadDictationPlaylist,
    loadDictationSegments,
    buildDictationText,
    findDictationAudio
} from "./dictation-loader.js";
import { handleDictationInput } from "./dictation-input.js";

const superPlayer = new SuperAudioPlayer();

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
   ÁP DỤNG BLIND MODE CHO DICTATION (HÀM MỚI)
============================================================ */
export function applyDictationBlindMode() {
    const spans = STATE.textSpans;
    if (!spans || !spans.length) return;

    const caret = DOM.textInput.value.length;

    if (!STATE.blindMode) {
        // Hiện toàn bộ
        spans.forEach(s => s.classList.remove("blind-hidden"));
        return;
    }

    // Blind Mode: chỉ hiện từ đầu → caret
    for (let i = 0; i < spans.length; i++) {
        if (i <= caret) spans[i].classList.remove("blind-hidden");
        else spans[i].classList.add("blind-hidden");
    }
}

/* ============================================================
   TẢI PLAYLIST TỪ dictation.json
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
        alert("Không tìm thấy file MP3 tương ứng!");
    }

    // Render text
    displayText(fullTextRaw);

    // ⭐ FIX QUAN TRỌNG — giống Typing Mode
    STATE.prevIndex = 0;
    if (STATE.textSpans[0]) {
        STATE.textSpans[0].classList.add("current");
    }

    // Áp dụng blind mode
    applyDictationBlindMode();


    // Không cho gõ trước khi bấm START
    DOM.textInput.value = "";
    DOM.textInput.disabled = true;

    STATE.isActive = false;
    DOM.startBtn.disabled = false;
    DOM.startBtn.textContent = "Start";

    updateStatsDOMImmediate(100, 0, "0s", 0);
    DOM.textContainer.scrollTop = 0;

    document.querySelector("header h1").textContent = filename.replace(".txt", "");

    // Áp dụng trạng thái blind hiện tại (nếu bật)
    applyDictationBlindMode();
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
   BẮT ĐẦU DICTATION
============================================================ */
function startDictation() {
    if (STATE.isActive) return;

    STATE.isActive = true;
    DOM.textInput.disabled = false;
    DOM.textInput.focus();
    DOM.startBtn.textContent = "Typing...";
    DOM.startBtn.disabled = true;

    // Phát sự kiện bắt đầu timer
    document.dispatchEvent(new CustomEvent("timer:start"));

    STATE.dictation.currentSegmentIndex = 0;
    playCurrentSegment();
}

/* ============================================================
   RESET
============================================================ */
function resetDictation() {
    // Phát sự kiện dừng timer
    document.dispatchEvent(new CustomEvent("timer:stop"));
    loadCurrentDictation();
}

/* ============================================================
   MAIN
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
    initTheme();

    await loadDictationPlaylistToUI();
    await loadCurrentDictation();

    // Fix Volume: Gắn sự kiện cho thanh trượt
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

    DOM.startBtn.addEventListener("click", startDictation);
    DOM.resetBtn.addEventListener("click", resetDictation);
    DOM.playlistSelect.addEventListener("change", loadCurrentDictation);

    // Blind Mode toggle
    DOM.blindModeToggle?.addEventListener("change", (e) => {
        STATE.blindMode = e.target.checked;
        if (STATE.blindMode) {
            document.body.classList.add("blind-mode");
        } else {
            document.body.classList.remove("blind-mode");
        }
        applyDictationBlindMode();
    });

    // Hotkey Ctrl+B
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

    // Hotkey Ctrl + Space → replay segment hiện tại
    document.addEventListener("keydown", (e) => {
        if (STATE.mode !== "dictation") return;
        if (e.ctrlKey && e.code === "Space") {
            e.preventDefault();
            const idx = STATE.dictation.currentSegmentIndex;
            const seg = STATE.dictation.segments[idx];
            if (!seg) return;
            superPlayer.stop();
            superPlayer.playSegment(seg.audioStart, seg.audioEnd);
        }
    });

    // Fix mất focus
    DOM.textInput.addEventListener("blur", () => {
        if (STATE.mode === "dictation") {
            setTimeout(() => DOM.textInput.focus(), 50);
        }
    });

    // [FIX] LẮNG NGHE SỰ KIỆN TIMER ĐỂ CHẠY ĐỒNG HỒ
    document.addEventListener("timer:start", startTimer);
    document.addEventListener("timer:stop", stopTimer);
});