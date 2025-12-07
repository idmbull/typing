// --- START OF FILE scripts/dictation.js ---

import { DOM, STATE, resetState } from "./state.js";
import { displayText } from "./renderer.js";
// IMPORT TỪ LOADER (Hợp nhất logic)
import { parseDictationContent, buildDictationText } from "./dictation-loader.js";

let superPlayer;

function playSegment(index) {
    const seg = STATE.dictation.segments[index];
    if (seg && superPlayer) {
        superPlayer.stop();
        superPlayer.playSegment(seg.audioStart, seg.audioEnd);
    }
}

export function initDictation(playerInstance) {
    superPlayer = playerInstance;
    const {
        dictationBtn, dictationModal, dictationStartBtn, dictationCancelBtn,
        dictationBlindMode, dictationSubInput, dictationAudioInput,
        actionToggle, actionLabel // Destructure thêm để dùng bên dưới
    } = DOM;

    // --- Modal UI Logic ---
    dictationBtn.addEventListener("click", () => dictationModal.classList.remove("hidden"));
    dictationCancelBtn.addEventListener("click", () => dictationModal.classList.add("hidden"));

    const readyCheck = () => {
        dictationStartBtn.disabled = !dictationSubInput.files.length || !dictationAudioInput.files.length;
    };
    dictationSubInput.addEventListener("change", readyCheck);
    dictationAudioInput.addEventListener("change", readyCheck);

    // --- Drag & Drop Logic (Giữ nguyên, chỉ rút gọn cho dễ nhìn) ---
    const updateButtonLabel = () => {
        if (dictationSubInput.files.length > 0) {
            dictationBtn.textContent = dictationSubInput.files[0].name;
            dictationBtn.title = dictationSubInput.files[0].name;
        } else {
            dictationBtn.textContent = "📂 Load File";
        }
    };

    dictationBtn.addEventListener("dragover", (e) => {
        e.preventDefault(); e.stopPropagation();
        dictationBtn.classList.add("dragging");
        dictationBtn.textContent = "Drop Text & Audio!";
    });
    dictationBtn.addEventListener("dragleave", (e) => {
        e.preventDefault(); e.stopPropagation();
        dictationBtn.classList.remove("dragging");
        updateButtonLabel();
    });
    dictationBtn.addEventListener("drop", (e) => {
        e.preventDefault(); e.stopPropagation();
        dictationBtn.classList.remove("dragging");
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return updateButtonLabel();
        
        dictationModal.classList.remove("hidden");
        files.forEach(file => {
            const name = file.name.toLowerCase();
            const dt = new DataTransfer(); dt.items.add(file);
            if (name.endsWith(".txt") || name.endsWith(".tsv")) dictationSubInput.files = dt.files;
            else if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".ogg")) dictationAudioInput.files = dt.files;
        });
        readyCheck();
        updateButtonLabel();
    });

    // --- Volume & Replay ---
    DOM.dictationReplayBtn.addEventListener("click", () => playSegment(STATE.dictation.currentSegmentIndex));
    const vol = document.getElementById("dictationVolume");
    if (vol) vol.addEventListener("input", () => superPlayer.setVolume(parseFloat(vol.value)));

    /* ========================================================
       START BUTTON CLICK (Local File Processing)
    ======================================================== */
    dictationStartBtn.addEventListener("click", async () => {
        const subFile = dictationSubInput.files[0];
        const audioFile = dictationAudioInput.files[0];
        if (!subFile || !audioFile) return;

        STATE.blindMode = dictationBlindMode.checked;
        DOM.blindModeToggle.checked = STATE.blindMode;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const rawContent = e.target.result;
            
            // 1. DÙNG CHUNG HÀM PARSE TỪ LOADER
            const segments = parseDictationContent(rawContent);
            
            if (!segments.length) return alert("File lỗi hoặc trống!");

            STATE.dictation.segments = segments;
            
            // 2. Load Audio
            await superPlayer.load(await audioFile.arrayBuffer());

            // 3. DÙNG CHUNG HÀM BUILD TỪ LOADER
            const built = buildDictationText(segments);
            STATE.dictation.fullText = built.fullText;
            STATE.dictation.fullTextRaw = built.fullTextRaw;
            STATE.dictation.charStarts = built.charStarts;

            // 4. Setup State
            dictationModal.classList.add("hidden");
            STATE.mode = "dictation";
            resetState();
            STATE.dictation.active = true;
            STATE.dictation.currentSegmentIndex = 0;

            // 5. Render
            displayText(STATE.dictation.fullTextRaw);
            DOM.textInput.value = "";
            DOM.textInput.disabled = true;
            DOM.startBtn.disabled = false;
            document.querySelector("header h1").textContent = subFile.name;
            
            // Reset Action UI
            if (actionToggle) {
                actionToggle.checked = false;
                actionToggle.disabled = false;
                actionLabel.textContent = "Start";
                actionLabel.style.color = "var(--correct-text)";
            }
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