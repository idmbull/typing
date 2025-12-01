// /scripts/dictation-app.js
import { DOM, STATE, resetState } from "./state.js";
import { updateStatsDOMImmediate } from "./stats.js";
import { displayText } from "./renderer.js";
import { setTheme, initTheme } from "./theme.js";
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
   TẢI PLAYLIST TỪ dictation.json
============================================================ */
async function loadDictationPlaylistToUI() {
    const list = await loadDictationPlaylist(); // đọc dictation.json
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

    // segments từ /texts/dictation/<file>.txt
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
    STATE.dictation.currentSegmentIndex = 0;

    // Tìm file mp3 cùng tên trong texts/dictation/
    const audioUrl = await findDictationAudio(filename);
    if (!audioUrl) {
        alert("Không tìm thấy file MP3 tương ứng!");
    } else {
        const buf = await (await fetch(audioUrl)).arrayBuffer();
        await superPlayer.load(buf);
        STATE.dictation.audioUrl = audioUrl;
    }

    // render text
    displayText(fullTextRaw);

    // reset input
    DOM.textInput.value = "";

    // KHÔNG cho gõ trước khi bấm Start
    DOM.textInput.disabled = true;
    STATE.isActive = false;

    DOM.startBtn.disabled = false;
    DOM.startBtn.textContent = "Start";

    updateStatsDOMImmediate(100, 0, "0s", 0);
    DOM.textContainer.scrollTop = 0;

    // đặt tiêu đề
    document.querySelector("header h1").textContent = filename.replace(".txt", "");
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

    document.dispatchEvent(new CustomEvent("timer:start"));

    // phát đoạn đầu
    STATE.dictation.currentSegmentIndex = 0;
    playCurrentSegment();
}

/* ============================================================
   RESET
============================================================ */
function resetDictation() {
    document.dispatchEvent(new CustomEvent("timer:stop"));
    loadCurrentDictation();
}

/* ============================================================
   MAIN
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
    initTheme();

    // 1) Load playlist từ dictation.json
    await loadDictationPlaylistToUI();

    // 2) Load bài đầu tiên
    await loadCurrentDictation();

    // 3) Lắng nghe INPUT
    DOM.textInput.addEventListener("input", () => handleDictationInput(superPlayer));
    DOM.startBtn.addEventListener("click", startDictation);
    DOM.resetBtn.addEventListener("click", resetDictation);
    DOM.playlistSelect.addEventListener("change", loadCurrentDictation);

    // Theme toggle
    DOM.themeToggle?.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        setTheme(current === "light" ? "dark" : "light");
    });

    // Blind mode toggle
    DOM.blindModeToggle?.addEventListener("change", (e) => {
        STATE.blindMode = e.target.checked;
        if (STATE.blindMode) document.body.classList.add("blind-mode");
        else document.body.classList.remove("blind-mode");
    });

    // Replay button
    DOM.dictationReplayBtn?.addEventListener("click", () => playCurrentSegment());

    // Volume slider
    const vol = document.getElementById("dictationVolume");
    vol?.addEventListener("input", () => {
        superPlayer.setVolume(parseFloat(vol.value));
    });

    // Hotkey Ctrl + Space → replay đoạn
    document.addEventListener("keydown", (e) => {
        if (STATE.mode !== "dictation") return;
        if (e.ctrlKey && e.code === "Space") {
            e.preventDefault();
            playCurrentSegment();
        }
    });

    // Hotkey Ctrl + B → bật/tắt blind mode
    document.addEventListener("keydown", (e) => {
        if (STATE.mode !== "dictation") return;
        if (e.ctrlKey && (e.key === "b" || e.key === "B")) {
            e.preventDefault();
            STATE.blindMode = !STATE.blindMode;
            DOM.blindModeToggle.checked = STATE.blindMode;

            if (STATE.blindMode) document.body.classList.add("blind-mode");
            else document.body.classList.remove("blind-mode");

            handleDictationInput(superPlayer);
        }
    });

    // Không cho mất focus khi click ra ngoài
    DOM.textInput.addEventListener("blur", () => {
        if (STATE.mode === "dictation") {
            setTimeout(() => DOM.textInput.focus(), 50);
        }
    });

    // Timer events
    document.addEventListener("timer:start", () =>
        import("./stats.js").then((m) => m.startTimer())
    );
    document.addEventListener("timer:stop", () =>
        import("./stats.js").then((m) => m.stopTimer())
    );
});
