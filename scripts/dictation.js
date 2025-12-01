// /scripts/dictation.js (FIXED VERSION)
import { DOM, STATE, resetState } from "./state.js";
import { displayText } from "./renderer.js";
import { SuperAudioPlayer } from "./superAudioPlayer.js";

const superPlayer = new SuperAudioPlayer();

/* ============================================================
   HELPERS
============================================================ */
function cleanDictationText(text) {
    return text.replace(/&nbsp;/gi, " ")
        .replace(/\u00A0/g, " ")
        .replace(/[‘’]/g, "'")
        .replace(/[—–]/g, "-")
        .replace(/\u200B/g, "");
}

function stripDictationMarkup(raw) {
    return raw ? raw.replace(/\^\[[^\]]*]/g, "")
        .replace(/\*\*(.+?)\*\*/g, "$1") : "";
}

function parseTSV(content) {
    return content.split(/\r?\n/).map(line => {
        const parts = line.trim().split("\t");
        if (parts.length >= 3)
            return { audioStart: parseFloat(parts[0]), audioEnd: parseFloat(parts[1]), text: parts.slice(2).join("\t").trim() };

        const m = line.match(/^([\d.]+)\s+([\d.]+)\s+(.*)$/);
        return m ? {
            audioStart: parseFloat(m[1]),
            audioEnd: parseFloat(m[2]),
            text: m[3].trim()
        } : null;
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

/* ============================================================
   INIT — prepare UI + load files + bind events
============================================================ */
export function initDictation() {
    const {
        dictationBtn,
        dictationModal,
        dictationStartBtn,
        dictationCancelBtn,
        dictationBlindMode
    } = DOM;

    dictationBtn.addEventListener("click", () =>
        dictationModal.classList.remove("hidden")
    );

    dictationCancelBtn.addEventListener("click", () =>
        dictationModal.classList.add("hidden")
    );

    const readyCheck = () =>
        dictationStartBtn.disabled =
        !DOM.dictationSubInput.files.length ||
        !DOM.dictationAudioInput.files.length;

    DOM.dictationSubInput.addEventListener("change", readyCheck);
    DOM.dictationAudioInput.addEventListener("change", readyCheck);

    // sync blind mode
    dictationBlindMode.addEventListener("change", (e) => {
        STATE.blindMode = e.target.checked;
        DOM.blindModeToggle.checked = STATE.blindMode;
    });

    DOM.blindModeToggle.addEventListener("change", (e) => {
        dictationBlindMode.checked = e.target.checked;
    });

    // Replay button
    DOM.dictationReplayBtn.addEventListener("click", () => {
        playSegment(STATE.dictation.currentSegmentIndex);
    });

    // Volume
    const vol = document.getElementById("dictationVolume");
    if (vol) {
        vol.addEventListener("input", () =>
            superPlayer.setVolume(parseFloat(vol.value))
        );
    }

    /* ========================================================
       START DICTATION
    ======================================================== */
    dictationStartBtn.addEventListener("click", async () => {
        const subFile = DOM.dictationSubInput.files[0];
        const audioFile = DOM.dictationAudioInput.files[0];
        if (!subFile || !audioFile) return;

        // Set blind mode
        STATE.blindMode = dictationBlindMode.checked;
        DOM.blindModeToggle.checked = STATE.blindMode;

        // Load subtitles
        const reader = new FileReader();
        reader.onload = async (e) => {
            const segments = parseTSV(cleanDictationText(e.target.result));
            if (!segments.length) return alert("File lời thoại bị lỗi!");

            STATE.dictation.segments = segments;
            STATE.dictation.currentSegmentIndex = 0;
            STATE.dictation.active = true;

            // Load audio
            await superPlayer.load(await audioFile.arrayBuffer());

            // Build full text
            buildDictationText();

            dictationModal.classList.add("hidden");

            STATE.mode = "dictation";
            resetState();

            // render text
            displayText(STATE.dictation.fullTextRaw);

            DOM.textInput.value = "";
            DOM.textInput.disabled = true;  // chờ user bấm Start
            DOM.startBtn.disabled = false;
            DOM.startBtn.textContent = "Start";

            document.querySelector("header h1").textContent = subFile.name;

        };

        reader.readAsText(subFile, "utf-8");
    });

    /* ========================================================
       🔥 Nhận event từ Input Engine
       Khi segment finished → play segment mới
    ======================================================== */
    document.addEventListener("dictation:segmentDone", (e) => {
        const next = e.detail + 1;

        if (next < STATE.dictation.segments.length) {
            STATE.dictation.currentSegmentIndex = next;
            playSegment(next);
        }
    });
}
