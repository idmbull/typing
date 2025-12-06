// /scripts/dictation.js (FIXED VERSION)
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
        dictationBlindMode,
        dictationSubInput,   // Thêm tham chiếu
        dictationAudioInput  // Thêm tham chiếu
    } = DOM;

    // 1. Logic mở/đóng Modal cũ (Giữ nguyên)
    dictationBtn.addEventListener("click", () =>
        dictationModal.classList.remove("hidden")
    );
    dictationCancelBtn.addEventListener("click", () =>
        dictationModal.classList.add("hidden")
    );

    // 2. Hàm kiểm tra nút Start (Giữ nguyên)
    const readyCheck = () => {
        dictationStartBtn.disabled =
            !dictationSubInput.files.length ||
            !dictationAudioInput.files.length;
    };

    dictationSubInput.addEventListener("change", readyCheck);
    dictationAudioInput.addEventListener("change", readyCheck);

    // ============================================================
    // 3. THÊM LOGIC KÉO THẢ (DRAG & DROP) - CẬP NHẬT
    // ============================================================
    
    // Helper: Cập nhật tên nút dựa trên file hiện tại
    const updateButtonLabel = () => {
        if (dictationSubInput.files.length > 0) {
            const name = dictationSubInput.files[0].name;
            dictationBtn.textContent = name;
            dictationBtn.title = name; // Tooltip khi tên quá dài
        } else {
            dictationBtn.textContent = "📂 Load File";
            dictationBtn.title = "";
        }
    };

    // Khi kéo file qua nút
    dictationBtn.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dictationBtn.classList.add("dragging");
        dictationBtn.textContent = "Drop Text & Audio!"; 
    });

    // Khi kéo ra ngoài (Hủy kéo) -> Trả lại tên file cũ (nếu có)
    dictationBtn.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dictationBtn.classList.remove("dragging");
        
        // Thay vì reset cứng về "Load File", ta kiểm tra xem đã có file chưa
        updateButtonLabel();
    });

    // Khi thả file
    dictationBtn.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dictationBtn.classList.remove("dragging");

        const files = Array.from(e.dataTransfer.files);
        if (!files.length) {
            updateButtonLabel(); // Trả lại tên cũ nếu không thả file nào
            return;
        }

        // Mở Modal
        dictationModal.classList.remove("hidden");

        // Phân loại file
        let hasText = false;
        let hasAudio = false;

        files.forEach(file => {
            const name = file.name.toLowerCase();
            
            // Xử lý File Text
            if (name.endsWith(".txt") || name.endsWith(".tsv")) {
                const dt = new DataTransfer();
                dt.items.add(file);
                dictationSubInput.files = dt.files;
                hasText = true;
            } 
            // Xử lý File Audio
            else if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".ogg")) {
                const dt = new DataTransfer();
                dt.items.add(file);
                dictationAudioInput.files = dt.files;
                hasAudio = true;
            }
        });

        // Cập nhật trạng thái nút Start trong Modal
        readyCheck();

        // --- CẬP NHẬT TÊN NÚT Ở TOOLBAR ---
        updateButtonLabel();

        // Thông báo nhỏ
        if (files.length === 1) {
            if (hasText && !dictationAudioInput.files.length) {
                // Đã có text, thiếu audio
            } else if (hasAudio && !dictationSubInput.files.length) {
                alert("Đã nhận file Audio. Vui lòng chọn thêm file Text!");
            }
        }
    });

    // Xử lý thêm trường hợp: Người dùng chọn file thủ công qua Modal (không kéo thả)
    // Thì nút bên ngoài cũng nên cập nhật theo
    dictationSubInput.addEventListener("change", () => {
        readyCheck();
        updateButtonLabel();
    });

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

