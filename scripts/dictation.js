// /scripts/dictation.js
import { DOM, STATE, resetState } from "./state.js";
import { scheduleStatsUpdate } from "./stats.js";
import { playClick, checkNewWordAndSpeak } from "./audio.js";
import { displayText } from "./renderer.js"; 
import { SuperAudioPlayer } from "./superAudioPlayer.js";
import { showTooltipForSpan } from "./tooltip.js";

const superPlayer = new SuperAudioPlayer();
let pendingScroll = false;

/* ... (giữ nguyên các hàm cleanDictationText, stripDictationMarkup, parseTSV, buildDictationText, playSegment, scrollDictation, handleDictationInput) ... */

// -- GIỮ NGUYÊN PHẦN TRÊN, CHỈ SỬA PHẦN INIT --

/* ================= INIT ================= */
export function initDictation() {
    const { dictationBtn, dictationModal, dictationStartBtn, dictationCancelBtn, dictationBlindMode } = DOM;
    
    dictationBtn.addEventListener("click", () => dictationModal.classList.remove("hidden"));
    dictationCancelBtn.addEventListener("click", () => dictationModal.classList.add("hidden"));

    const checkReady = () => dictationStartBtn.disabled = !DOM.dictationSubInput.files.length || !DOM.dictationAudioInput.files.length;
    DOM.dictationSubInput.addEventListener("change", checkReady);
    DOM.dictationAudioInput.addEventListener("change", checkReady);

    // Sync Blind Mode checkbox
    dictationBlindMode.addEventListener("change", (e) => {
        DOM.blindModeToggle.checked = e.target.checked;
        STATE.blindMode = e.target.checked;
    });
    
    DOM.blindModeToggle.addEventListener("change", (e) => {
        dictationBlindMode.checked = e.target.checked;
    });

    DOM.dictationReplayBtn.addEventListener("click", () => {
        playSegment(STATE.dictation.currentSegmentIndex);
        DOM.textInput.focus();
    });
    
    const vol = document.getElementById("dictationVolume");
    if (vol) vol.addEventListener("input", () => superPlayer.setVolume(parseFloat(vol.value)));

    dictationStartBtn.addEventListener("click", async () => {
        const subFile = DOM.dictationSubInput.files[0];
        const audioFile = DOM.dictationAudioInput.files[0];
        if (!subFile || !audioFile) return;

        STATE.blindMode = dictationBlindMode.checked;
        DOM.blindModeToggle.checked = STATE.blindMode;

        const reader = new FileReader();
        reader.onload = async e => {
            const segments = parseTSV(cleanDictationText(e.target.result));
            if (!segments.length) return alert("File lỗi");

            STATE.dictation.segments = segments;
            await superPlayer.load(await audioFile.arrayBuffer());
            
            buildDictationText();
            dictationModal.classList.add("hidden");
            
            STATE.mode = "dictation";
            STATE.dictation.active = true;
            resetState();
            
            displayText(STATE.dictation.fullTextRaw);
            DOM.textInput.value = "";
            DOM.textInput.disabled = false;
            DOM.textInput.focus();
            
            document.querySelector("header h1").textContent = "Dictation: " + subFile.name;
        };
        reader.readAsText(subFile, "utf-8");
    });
    
    // ⭐ HOTKEYS
    document.addEventListener("keydown", e => {
        // Chỉ giữ lại Ctrl + Space cho Replay
        // Ctrl + B đã được chuyển sang app.js để dùng chung
        if (STATE.mode === "dictation" && e.ctrlKey && e.code === "Space") {
            e.preventDefault();
            playSegment(STATE.dictation.currentSegmentIndex);
        }
    });
}

// Bổ sung lại các hàm helpers ở trên nếu bạn copy paste đè file:
function cleanDictationText(text) {
    return text.replace(/&nbsp;/gi, " ").replace(/\u00A0/g, " ").replace(/[‘’]/g, "'").replace(/[—–]/g, "-").replace(/\u200B/g, "");
}

function stripDictationMarkup(raw) {
    return raw ? raw.replace(/\^\[[^\]]*]/g, "").replace(/\*\*(.+?)\*\*/g, "$1") : "";
}

function parseTSV(content) {
    return content.split(/\r?\n/).map(line => {
        const parts = line.trim().split("\t");
        if (parts.length >= 3) return { audioStart: parseFloat(parts[0]), audioEnd: parseFloat(parts[1]), text: parts.slice(2).join("\t").trim() };
        const m = line.match(/^([\d.]+)\s+([\d.]+)\s+(.*)$/);
        return m ? { audioStart: parseFloat(m[1]), audioEnd: parseFloat(m[2]), text: m[3].trim() } : null;
    }).filter(Boolean);
}

function buildDictationText() {
    const dict = STATE.dictation;
    dict.fullText = "";
    dict.fullTextRaw = "";
    dict.charStarts = [];
    let pos = 0;
    dict.segments.forEach((seg, idx) => {
        const clean = stripDictationMarkup(seg.text);
        seg.cleanText = clean;
        dict.charStarts[idx] = pos;
        dict.fullText += clean + (idx < dict.segments.length - 1 ? " " : "");
        dict.fullTextRaw += seg.text + (idx < dict.segments.length - 1 ? " " : "");
        pos = dict.fullText.length;
    });
}

function playSegment(index) {
    const seg = STATE.dictation.segments[index];
    if (seg) {
        superPlayer.stop();
        superPlayer.playSegment(seg.audioStart, seg.audioEnd);
    }
}

function scrollDictation() {
    if (pendingScroll) return;
    pendingScroll = true;
    requestAnimationFrame(() => {
        pendingScroll = false;
        const span = STATE.textSpans[STATE.prevIndex];
        if (!span) return;
        const c = DOM.textContainer;
        const r = span.getBoundingClientRect();
        const cr = c.getBoundingClientRect();
        const delta = (r.top - cr.top) - (cr.height * 0.3);
        if (Math.abs(delta) > 10) c.scrollTop += delta * 0.2;
    });
}

export function handleDictationInput() {
    const dict = STATE.dictation;
    if (!dict.active) return;

    let val = DOM.textInput.value.replace(/\n/g, ' ');
    if (val.length > dict.fullText.length) val = val.slice(0, dict.fullText.length);
    DOM.textInput.value = val;

    const len = val.length;
    const spans = STATE.textSpans;

    if (!STATE.isActive) {
        STATE.isActive = true;
        DOM.startBtn.textContent = "Typing...";
        DOM.startBtn.disabled = true;
        document.dispatchEvent(new CustomEvent("exercise:start"));
        dict.currentSegmentIndex = 0;
        playSegment(0);
    }

    // Logic UI được tối ưu, Blind Mode đã xử lý bởi class
    const indices = new Set([STATE.prevIndex, len, len - 1].filter(i => i >= 0 && i < spans.length));
    indices.forEach(i => {
        const span = spans[i];
        span.classList.remove("current", "correct", "incorrect");
        if (i < len) {
            span.classList.add(val[i] === dict.fullText[i] ? "correct" : "incorrect");
            if (STATE.blindMode) span.classList.remove("blind-hidden");
        } else {
            if (STATE.blindMode && i > len) span.classList.add("blind-hidden");
        }
    });

    STATE.prevIndex = len;
    if (spans[len]) {
        spans[len].classList.add("current");
        if (STATE.blindMode) spans[len].classList.remove("blind-hidden");
        showTooltipForSpan(spans[len]);
    }

    STATE.statTotalKeys++;
    if (len > 0 && val[len-1] === dict.fullText[len-1]) STATE.statCorrectKeys++;
    else STATE.statErrors++;
    scheduleStatsUpdate();
    
    if (DOM.soundToggle?.checked) playClick();
    if (DOM.autoPronounceToggle?.checked) checkNewWordAndSpeak(val, dict.fullText);
    scrollDictation();

    const seg = dict.segments[dict.currentSegmentIndex];
    if (val.length >= dict.charStarts[dict.currentSegmentIndex] + seg.cleanText.length) {
        const next = dict.currentSegmentIndex + 1;
        if (next < dict.segments.length && dict.currentSegmentIndex < next) {
            dict.currentSegmentIndex = next;
            playSegment(next);
        }
    }

    if (val === dict.fullText) {
        DOM.textInput.disabled = true;
        document.dispatchEvent(new CustomEvent("timer:stop"));
        alert("🎉 Hoàn thành Dictation!");
    }
}