// scripts/dictation.js

import { DOM, STATE, resetState } from "./state.js";
import { displayText } from "./renderer.js";
import { SuperAudioPlayer } from "./superAudioPlayer.js";

const superPlayer = new SuperAudioPlayer();

/* ============================================================
   HELPERS
============================================================ */
function cleanDictationText(text) {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/\u00A0/g, " ")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, "\"")
        .replace(/[—–]/g, "-")
        .replace(/\u200B/g, "");
}

function stripDictationMarkup(raw) {
    return raw ? raw.replace(/\^\[[^\]]*]/g, "")
        .replace(/\*\*(.+?)\*\*/g, "$1") : "";
}

// [UPDATE]: Parse có xử lý dòng trống
function parseTSV(content) {
    const lines = content.split(/\r?\n/);
    const results = [];
    let isNewParagraph = false;

    for (const line of lines) {
        if (!line.trim()) {
            isNewParagraph = true;
            continue;
        }

        let seg = null;
        const parts = line.trim().split("\t");

        if (parts.length >= 3) {
            seg = { 
                audioStart: parseFloat(parts[0]), 
                audioEnd: parseFloat(parts[1]), 
                text: parts.slice(2).join("\t").trim() 
            };
        } else {
            const m = line.match(/^([\d.]+)\s+([\d.]+)\s+(.*)$/);
            if (m) {
                seg = {
                    audioStart: parseFloat(m[1]),
                    audioEnd: parseFloat(m[2]),
                    text: m[3].trim()
                };
            }
        }

        if (seg) {
            seg.isNewParagraph = isNewParagraph;
            results.push(seg);
            isNewParagraph = false; // Reset sau khi gán
        }
    }
    return results;
}

// [UPDATE]: Build text xử lý \n\n cho hiển thị
function buildDictationText() {
    const dict = STATE.dictation;

    dict.fullText = "";
    dict.fullTextRaw = "";
    dict.charStarts = [];

    let pos = 0;
    
    dict.segments.forEach((seg, idx) => {
        const clean = stripDictationMarkup(seg.text);
        seg.cleanText = clean;

        let sepRaw = " ";
        let sepClean = " ";

        if (idx > 0) {
            if (seg.isNewParagraph) {
                sepRaw = "\n\n";
            }
        } else {
            sepRaw = "";
            sepClean = "";
        }
        
        // Cộng separator vào pos để tính charStart chính xác trên chuỗi Clean
        if (idx > 0) pos += sepClean.length;
        
        dict.charStarts[idx] = pos;

        dict.fullTextRaw += sepRaw + seg.text;
        dict.fullText += sepClean + clean;

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

    dictationBlindMode.addEventListener("change", (e) => {
        STATE.blindMode = e.target.checked;
        DOM.blindModeToggle.checked = STATE.blindMode;
    });

    DOM.blindModeToggle.addEventListener("change", (e) => {
        dictationBlindMode.checked = e.target.checked;
    });

    DOM.dictationReplayBtn.addEventListener("click", () => {
        playSegment(STATE.dictation.currentSegmentIndex);
    });

    const vol = document.getElementById("dictationVolume");
    if (vol) {
        vol.addEventListener("input", () =>
            superPlayer.setVolume(parseFloat(vol.value))
        );
    }

    dictationStartBtn.addEventListener("click", async () => {
        const subFile = DOM.dictationSubInput.files[0];
        const audioFile = DOM.dictationAudioInput.files[0];
        if (!subFile || !audioFile) return;

        STATE.blindMode = dictationBlindMode.checked;
        DOM.blindModeToggle.checked = STATE.blindMode;

        const reader = new FileReader();
        reader.onload = async (e) => {
            // Parse segments với logic mới (giữ dòng trống)
            const segments = parseTSV(cleanDictationText(e.target.result));
            if (!segments.length) return alert("File lời thoại bị lỗi!");

            STATE.dictation.segments = segments;
            STATE.dictation.currentSegmentIndex = 0;
            STATE.dictation.active = true;

            await superPlayer.load(await audioFile.arrayBuffer());

            buildDictationText();

            dictationModal.classList.add("hidden");

            STATE.mode = "dictation";
            resetState();

            // Render sẽ tự động hiểu \n\n là thẻ <p> nhờ marked.js
            displayText(STATE.dictation.fullTextRaw);

            DOM.textInput.value = "";
            DOM.textInput.disabled = true;
            DOM.startBtn.disabled = false;
            DOM.startBtn.textContent = "Start";

            document.querySelector("header h1").textContent = subFile.name;
        };

        reader.readAsText(subFile, "utf-8");
    });

    document.addEventListener("dictation:segmentDone", (e) => {
        const next = e.detail + 1;
        if (next < STATE.dictation.segments.length) {
            STATE.dictation.currentSegmentIndex = next;
            playSegment(next);
        }
    });
}