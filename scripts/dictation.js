// /scripts/dictation.js (FIXED VERSION)
import { DOM, STATE, resetState } from "./state.js";
import { displayText } from "./renderer.js";

// XÓA IMPORT SuperAudioPlayer vì không tạo mới ở đây nữa
// import { SuperAudioPlayer } from "./superAudioPlayer.js";

// Khai báo biến để giữ tham chiếu (không new)
let superPlayer;

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

/* ============================================================
   HELPERS (UPDATED FOR PARAGRAPHS)
============================================================ */

function parseTSV(content) {
    const lines = content.split(/\r?\n/);
    const segments = [];
    let pendingNewParagraph = false; // Cờ đánh dấu đoạn mới

    for (const line of lines) {
        // 1. Nếu gặp dòng trống -> Bật cờ đoạn mới
        if (!line.trim()) {
            pendingNewParagraph = true;
            continue;
        }

        // 2. Parse dòng dữ liệu
        const parts = line.trim().split("\t");
        let seg = null;

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

        // 3. Nếu parse thành công, thêm vào danh sách
        if (seg) {
            // Nếu trước đó có dòng trống, đánh dấu segment này là đầu đoạn mới
            if (pendingNewParagraph) {
                seg.isNewParagraph = true;
                pendingNewParagraph = false; // Reset cờ
            }
            segments.push(seg);
        }
    }

    return segments;
}

// --- TRONG FILE scripts/dictation.js ---

function buildDictationText() {
    const dict = STATE.dictation;

    dict.fullText = "";     // Chuỗi logic (để so sánh đúng/sai)
    dict.fullTextRaw = "";  // Chuỗi hiển thị (để render HTML)
    dict.charStarts = [];

    let pos = 0; // Vị trí ký tự trong chuỗi logic

    dict.segments.forEach((seg, idx) => {
        const clean = stripDictationMarkup(seg.text);
        seg.cleanText = clean;

        // 1. Xác định dấu nối cho HIỂN THỊ (Markdown/HTML)
        // Nếu là đoạn mới -> \n\n, ngược lại -> khoảng trắng
        let rawSeparator = "";
        if (idx > 0) {
            rawSeparator = seg.isNewParagraph ? "\n\n" : " ";
        }

        // 2. Xác định dấu nối cho LOGIC (So sánh Input)
        // QUAN TRỌNG: Luôn dùng 1 dấu cách để đồng bộ với Typing Mode & Renderer
        // Renderer sẽ convert \n\n thành 1 khoảng trắng khi tạo spans
        let logicSeparator = "";
        if (idx > 0) {
            logicSeparator = " "; 
        }

        // 3. Xây dựng chuỗi
        dict.fullTextRaw += rawSeparator + seg.text;
        dict.fullText += logicSeparator + clean;

        // 4. Tính toán vị trí Audio Start dựa trên chuỗi LOGIC
        // Vì người dùng sẽ gõ theo chuỗi logic (dấu cách) nên ta phải tính pos theo logicSeparator
        dict.charStarts[idx] = pos + logicSeparator.length;

        // Cập nhật pos cho vòng lặp sau
        pos = dict.fullText.length;
    });
}

function playSegment(index) {
    const seg = STATE.dictation.segments[index];
    // Kiểm tra superPlayer tồn tại trước khi gọi
    if (seg && superPlayer) {
        superPlayer.stop();
        superPlayer.playSegment(seg.audioStart, seg.audioEnd);
    }
}

/* ============================================================
   INIT — prepare UI + load files + bind events
   THAY ĐỔI: Nhận playerInstance từ bên ngoài
============================================================ */
export function initDictation(playerInstance) {
    // Gán player được truyền vào cho biến cục bộ
    superPlayer = playerInstance;

    const {
        dictationBtn,
        dictationModal,
        dictationStartBtn,
        dictationCancelBtn,
        dictationBlindMode,
        dictationSubInput,
        dictationAudioInput
    } = DOM;

    // 1. Logic mở/đóng Modal
    dictationBtn.addEventListener("click", () =>
        dictationModal.classList.remove("hidden")
    );
    dictationCancelBtn.addEventListener("click", () =>
        dictationModal.classList.add("hidden")
    );

    // 2. Hàm kiểm tra nút Start
    const readyCheck = () => {
        dictationStartBtn.disabled =
            !dictationSubInput.files.length ||
            !dictationAudioInput.files.length;
    };

    dictationSubInput.addEventListener("change", readyCheck);
    dictationAudioInput.addEventListener("change", readyCheck);

    // ============================================================
    // 3. LOGIC KÉO THẢ (DRAG & DROP)
    // ============================================================

    const updateButtonLabel = () => {
        if (dictationSubInput.files.length > 0) {
            const name = dictationSubInput.files[0].name;
            dictationBtn.textContent = name;
            dictationBtn.title = name;
        } else {
            dictationBtn.textContent = "📂 Load File";
            dictationBtn.title = "";
        }
    };

    dictationBtn.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dictationBtn.classList.add("dragging");
        dictationBtn.textContent = "Drop Text & Audio!";
    });

    dictationBtn.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dictationBtn.classList.remove("dragging");
        updateButtonLabel();
    });

    dictationBtn.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dictationBtn.classList.remove("dragging");

        const files = Array.from(e.dataTransfer.files);
        if (!files.length) {
            updateButtonLabel();
            return;
        }

        dictationModal.classList.remove("hidden");

        let hasText = false;
        let hasAudio = false;

        files.forEach(file => {
            const name = file.name.toLowerCase();
            if (name.endsWith(".txt") || name.endsWith(".tsv")) {
                const dt = new DataTransfer();
                dt.items.add(file);
                dictationSubInput.files = dt.files;
                hasText = true;
            }
            else if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".ogg")) {
                const dt = new DataTransfer();
                dt.items.add(file);
                dictationAudioInput.files = dt.files;
                hasAudio = true;
            }
        });

        readyCheck();
        updateButtonLabel();

        if (files.length === 1) {
            if (hasAudio && !dictationSubInput.files.length) {
                alert("Đã nhận file Audio. Vui lòng chọn thêm file Text!");
            }
        }
    });

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

        STATE.blindMode = dictationBlindMode.checked;
        DOM.blindModeToggle.checked = STATE.blindMode;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const segments = parseTSV(cleanDictationText(e.target.result));
            if (!segments.length) return alert("File lời thoại bị lỗi!");

            STATE.dictation.segments = segments;
            STATE.dictation.currentSegmentIndex = 0;
            STATE.dictation.active = true;

            // Load audio vào player được truyền vào
            await superPlayer.load(await audioFile.arrayBuffer());

            buildDictationText();

            dictationModal.classList.add("hidden");

            STATE.mode = "dictation";
            resetState();

            displayText(STATE.dictation.fullTextRaw);

            DOM.textInput.value = "";
            DOM.textInput.disabled = true;
            DOM.startBtn.disabled = false; // Nút start ảo (nếu có)

            // Cập nhật Action Toggle UI (Start/Stop button)
            if (DOM.actionToggle) {
                DOM.actionToggle.checked = false;
                DOM.actionToggle.disabled = false;
                DOM.actionLabel.textContent = "Start";
                DOM.actionLabel.style.color = "var(--correct-text)";
            }

            document.querySelector("header h1").textContent = subFile.name;

        };

        reader.readAsText(subFile, "utf-8");
    });

    /* ========================================================
       Segment Done Event
    ======================================================== */
    document.addEventListener("dictation:segmentDone", (e) => {
        const next = e.detail + 1;

        if (next < STATE.dictation.segments.length) {
            STATE.dictation.currentSegmentIndex = next;
            playSegment(next);
        }
    });
}