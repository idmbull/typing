// --- START OF FILE scripts/dictation-app.js ---

import { DOM, STATE, resetState } from "./state.js";
import { updateStatsDOMImmediate, startTimer, stopTimer } from "./stats.js";
import { displayText } from "./renderer.js";
import { initTheme, setTheme } from "./theme.js";
import { SuperAudioPlayer } from "./superAudioPlayer.js";
import {
    loadDictationPlaylist,
    fetchDictationSegments, // Đổi tên từ loadDictationSegments
    buildDictationText,
    findDictationAudio
} from "./dictation-loader.js";
import { handleDictationInput } from "./dictation-input.js";
import { initDictation } from "./dictation.js";

const superPlayer = new SuperAudioPlayer();

// ... (Các hàm updateActionUI, resetDictState, applyDictationBlindMode, loadDictationPlaylistToUI GIỮ NGUYÊN) ...
// (Để tiết kiệm không gian, tôi chỉ viết lại hàm thay đổi chính bên dưới)

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

export function applyDictationBlindMode() {
    const spans = STATE.textSpans;
    if (!spans || !spans.length) return;
    const caret = DOM.textInput.value.length;
    const isBlind = STATE.blindMode;

    for (let i = 0; i < spans.length; i++) {
        if (!isBlind || i <= caret) spans[i].classList.remove("blind-hidden");
        else spans[i].classList.add("blind-hidden");
    }
}

async function loadDictationPlaylistToUI() {
    const list = await loadDictationPlaylist();
    DOM.playlistSelect.innerHTML = list
        .map((f) => `<option value="${f}">${f.replace(".txt", "")}</option>`)
        .join("");
}

/* ============================================================
   TẢI BÀI DICTATION TỪ SERVER (SỬ DỤNG LOGIC MỚI)
============================================================ */
async function loadCurrentDictation() {
    const filename = DOM.playlistSelect.value;
    if (!filename) return;

    // 1. Dùng hàm fetch mới (bên trong gọi parseDictationContent)
    const segments = await fetchDictationSegments(filename);

    if (!segments.length) {
        alert("File Dictation trống hoặc sai format!");
        return;
    }

    // 2. Dùng hàm build chung
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
    if (STATE.textSpans[0]) STATE.textSpans[0].classList.add("current");
    applyDictationBlindMode();

    DOM.textInput.value = "";
    DOM.textInput.disabled = true;
    STATE.isActive = false;
    updateStatsDOMImmediate(100, 0, "0s", 0);
    DOM.textContainer.scrollTop = 0;
    document.querySelector("header h1").textContent = filename.replace(".txt", "");
    updateActionUI();
}

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

    // Nếu reset về 0 thì phát lại từ đầu, nếu đang pause thì phát tiếp (tuỳ logic)
    // Ở đây ta thống nhất Start là phát đoạn hiện tại
    playCurrentSegment();

    updateActionUI();
}

// --- HÀM ĐƯỢC SỬA LẠI ---
function resetDictation() {
    document.dispatchEvent(new CustomEvent("timer:stop"));

    // Kiểm tra: Nếu đã có dữ liệu (dù là Local hay Playlist), ta chỉ reset trạng thái UI
    if (STATE.dictation.fullTextRaw) {
        // 1. Reset các biến trạng thái
        STATE.isActive = false;
        STATE.dictation.currentSegmentIndex = 0; // Quay về đoạn đầu tiên
        STATE.prevIndex = 0; // Quay về ký tự đầu tiên

        // 2. Reset UI Input
        DOM.textInput.value = "";
        DOM.textInput.disabled = true;

        // 3. Render lại văn bản (để xóa hết màu xanh/đỏ cũ)
        displayText(STATE.dictation.fullTextRaw);

        // 4. Highlight ký tự đầu tiên
        if (STATE.textSpans[0]) {
            STATE.textSpans[0].classList.add("current");
        }

        // 5. Reset các chỉ số thống kê & Scroll
        updateStatsDOMImmediate(100, 0, "0s", 0);
        DOM.textContainer.scrollTop = 0;

        // 6. Áp dụng lại Blind Mode (ẩn chữ nếu đang bật)
        applyDictationBlindMode();

        // 7. Cập nhật giao diện nút bấm
        updateActionUI();
    } else {
        // Trường hợp chưa có dữ liệu gì thì mới load từ Playlist
        loadCurrentDictation();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    initDictation(superPlayer); // Truyền player chính vào

    await loadDictationPlaylistToUI();
    await loadCurrentDictation();

    const volInput = document.getElementById("dictationVolume");
    if (volInput) {
        superPlayer.setVolume(parseFloat(volInput.value));
        volInput.addEventListener("input", (e) => superPlayer.setVolume(parseFloat(e.target.value)));
    }

    DOM.textInput.addEventListener("input", () => {
        handleDictationInput(superPlayer);
        applyDictationBlindMode();
    });

    if (DOM.actionToggle) DOM.actionToggle.addEventListener("change", handleAction);
    DOM.playlistSelect.addEventListener("change", loadCurrentDictation);

    DOM.themeToggle.addEventListener("change", (e) => {
        setTheme(e.target.checked ? "dark" : "light");
        if (!DOM.textInput.disabled) DOM.textInput.focus();
    });

    DOM.blindModeToggle?.addEventListener("change", (e) => {
        STATE.blindMode = e.target.checked;
        document.body.classList.toggle("blind-mode", STATE.blindMode);
        applyDictationBlindMode();
    });

    document.addEventListener("keydown", (e) => {
        if (STATE.mode !== "dictation") return;

        // Ctrl+B: Blind Mode
        if (e.ctrlKey && e.code === "KeyB") {
            e.preventDefault();
            STATE.blindMode = !STATE.blindMode;
            DOM.blindModeToggle.checked = STATE.blindMode;
            document.body.classList.toggle("blind-mode", STATE.blindMode);
            applyDictationBlindMode();
        }

        // Ctrl+Space: Replay
        if (e.ctrlKey && e.code === "Space") {
            e.preventDefault();
            playCurrentSegment();
        }
    });

    DOM.textInput.addEventListener("blur", () => {
        if (STATE.mode === "dictation" && STATE.isActive) setTimeout(() => DOM.textInput.focus(), 50);
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