// scripts/dictation-app.js
import { DOM } from "./state.js";
import { Store } from "./core/store.js";
import { SuperAudioPlayer } from "./superAudioPlayer.js";
import { loadPlaylist, loadContent, loadSection, loadUserContent } from "./loader.js";
import { initController } from "./input-controller.js";
import { ExerciseController } from "./core/exercise-controller.js";
import { setupDragDrop } from "./utils/drag-drop.js";
import { replayLastWord } from "./audio.js";
import { EventBus, EVENTS } from "./core/events.js";
import { displayText } from "./renderer.js";

const superPlayer = new SuperAudioPlayer();
let controller;
let maxReachedSegment = 0;

// [QUAN TRỌNG] Các biến quản lý phiên tải
let currentAbortController = null; // Để hủy fetch mạng
let currentLoadId = 0;             // Để hủy logic decode

function resetDictState() {
    Store.setCurrentSegment(0);
    displayText(Store.getSource().html);
    // Không gọi superPlayer.stop() ở đây nữa vì logic load sẽ tự xử lý
    maxReachedSegment = 0;
}

function playCurrentSegment() {
    const source = Store.getSource();
    const idx = source.currentSegment;
    const seg = source.segments[idx];
    if (seg) {
        // Chỉ stop nếu đang phát, load logic tự clear buffer rồi
        superPlayer.stop();
        superPlayer.playSegment(seg.audioStart, seg.audioEnd);
    }
}

// Hàm tìm Segment giữ nguyên
function findSegmentIndexByCharIndex(charIndex, charStarts) {
    if (!charStarts || charStarts.length === 0) return 0;
    let found = 0;
    for (let i = 0; i < charStarts.length; i++) {
        if (charIndex >= charStarts[i]) {
            found = i;
        } else {
            break;
        }
    }
    return found;
}

export async function initDictationMode() {
    initController();

    // Setup Volume... (Giữ nguyên)
    if (DOM.volumeInput) {
        superPlayer.setVolume(parseFloat(DOM.volumeInput.value));
        DOM.volumeInput.oninput = (e) => superPlayer.setVolume(parseFloat(e.target.value));
    }

    // Sự kiện Double Click... (Giữ nguyên)
    if (DOM.textDisplay) {
        DOM.textDisplay.addEventListener("dblclick", (e) => {
            if (e.target.tagName !== "SPAN" || e.target.classList.contains("newline-char")) return;
            const spans = Store.getState().textSpans;
            const charIndex = spans.indexOf(e.target);
            if (charIndex === -1) return;
            const source = Store.getSource();
            const segIdx = findSegmentIndexByCharIndex(charIndex, source.charStarts);
            const seg = source.segments[segIdx];
            if (seg) {
                superPlayer.stop();
                superPlayer.playSegment(seg.audioStart, seg.audioEnd);
            }
        });
    }

    // Sự kiện Segment Change... (Giữ nguyên)
    EventBus.on(EVENTS.DICTATION_SEGMENT_CHANGE, (newIndex) => {
        if (newIndex > maxReachedSegment) {
            maxReachedSegment = newIndex;
            playCurrentSegment();
        }
    });

    // Load Playlist... (Giữ nguyên)
    await loadPlaylist("dictation");

    // Setup Local File Upload... (Giữ nguyên)
    setupLocalFileUpload();

    controller = new ExerciseController("dictation", {
        onReset: resetDictState,

        // --- [SỬA LẠI HOÀN TOÀN LOGIC TẢI BÀI] ---
        onLoadContent: async (filename) => {
            // 1. Hủy request cũ nếu đang chạy
            if (currentAbortController) {
                currentAbortController.abort();
            }
            // Tạo controller mới cho request này
            currentAbortController = new AbortController();
            const signal = currentAbortController.signal; // Signal để truyền vào fetch

            // 2. Tăng ID phiên làm việc
            // Mọi logic chạy sau await phải kiểm tra ID này
            const myLoadId = ++currentLoadId;

            // 3. Xóa Audio cũ ngay lập tức (tránh tiếng ma)
            superPlayer.stop();

            // Cập nhật UI
            const actionLabel = document.getElementById('actionLabel');
            if (actionLabel) actionLabel.textContent = "⏳ Text...";

            try {
                // 4. Tải Text (Nhanh)
                await loadContent(filename, "dictation");

                // [CHECKPOINT 1] Nếu ID đã đổi (người dùng bấm bài khác trong lúc tải text), dừng ngay
                if (myLoadId !== currentLoadId) return;

                const audioUrl = Store.getSource().audioUrl;

                if (audioUrl) {
                    if (actionLabel) actionLabel.textContent = "⏳ Audio...";

                    // 5. Tải Audio với Signal (Nếu abort, fetch sẽ throw AbortError)
                    const res = await fetch(audioUrl, { signal });
                    if (!res.ok) throw new Error("Fetch failed");

                    const buf = await res.arrayBuffer();

                    // [CHECKPOINT 2] Nếu ID đã đổi trong lúc tải Audio, dừng ngay
                    // (Lúc này currentLoadId có thể đã tăng lên n+1)
                    if (myLoadId !== currentLoadId) return;

                    // 6. Decode và nạp vào Player
                    await superPlayer.load(buf);

                    // [CHECKPOINT 3] Kiểm tra lần cuối sau khi decode
                    if (myLoadId !== currentLoadId) {
                        // Nếu lỡ decode xong mà bài đã đổi, xóa buffer vừa nạp
                        superPlayer.stop(); // Trong superAudioPlayer đã sửa hàm load để xóa buffer
                        return;
                    }

                    console.log("Audio ready:", filename);
                    if (actionLabel) actionLabel.textContent = "Start";
                } else {
                    console.log("No audio for this file");
                    if (actionLabel) actionLabel.textContent = "No Audio";
                }

            } catch (err) {
                // Nếu lỗi là do mình chủ động abort thì bỏ qua (không log lỗi đỏ lòm)
                if (err.name === 'AbortError') {
                    console.log("Load aborted for:", filename);
                } else {
                    console.error("Load failed:", err);
                    if (myLoadId === currentLoadId && actionLabel) {
                        actionLabel.textContent = "Error";
                    }
                }
            } finally {
                // Dọn dẹp nếu đây là request cuối cùng
                if (myLoadId === currentLoadId) {
                    currentAbortController = null;
                }
            }
        },
        // ------------------------------------------

        onSectionChange: (val) => {
            loadSection(val);
            Store.setCurrentSegment(0);
            maxReachedSegment = 0;
        },

        onActionStart: () => {
            const current = Store.getSource().currentSegment;
            maxReachedSegment = current;
            playCurrentSegment();
        },

        onCtrlSpaceSingle: () => playCurrentSegment(),
        onCtrlSpaceDouble: () => replayLastWord()
    });

    window.currentController = controller;

    // Kích hoạt bài đầu tiên nếu có trong playlist (sử dụng logic mới)
    if (DOM.playlistSelect.value) {
        controller.callbacks.onLoadContent(DOM.playlistSelect.value);
    }
    controller.reset();

    // Replay Button
    if (DOM.dictationReplayBtn) {
        DOM.dictationReplayBtn.onclick = () => playCurrentSegment();
    }
}

// ... (hàm setupLocalFileUpload giữ nguyên)
function setupLocalFileUpload() {
    // ... Copy lại nội dung cũ của hàm này ...
    const {
        dictationBtn, dictationModal, dictationStartBtn, dictationCancelBtn,
        dictationSubInput, dictationAudioInput, dictationBlindMode, blindModeToggle
    } = DOM;

    dictationBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        dictationModal.classList.remove("hidden");
    };
    dictationCancelBtn.onclick = () => dictationModal.classList.add("hidden");

    const checkReady = () => {
        dictationStartBtn.disabled = !dictationSubInput.files.length || !dictationAudioInput.files.length;
    };
    dictationSubInput.onchange = checkReady;
    dictationAudioInput.onchange = checkReady;

    setupDragDrop(dictationBtn, (files) => {
        dictationModal.classList.remove("hidden");
        const dtSub = new DataTransfer();
        const dtAudio = new DataTransfer();
        let hasSub = false, hasAudio = false;

        files.forEach(f => {
            const n = f.name.toLowerCase();
            if (/\.(txt|tsv)$/.test(n)) {
                dtSub.items.add(f); hasSub = true;
            } else if (/\.(mp3|wav|ogg)$/.test(n)) {
                dtAudio.items.add(f); hasAudio = true;
            }
        });

        if (hasSub) dictationSubInput.files = dtSub.files;
        if (hasAudio) dictationAudioInput.files = dtAudio.files;
        checkReady();
    }, "Drop Text & Audio!");

    dictationStartBtn.onclick = async () => {
        const subFile = dictationSubInput.files[0];
        const audioFile = dictationAudioInput.files[0];
        if (!subFile || !audioFile) return;

        // Tăng ID để hủy các tiến trình load từ server nếu có
        currentLoadId++;
        if (currentAbortController) currentAbortController.abort();

        const isBlind = dictationBlindMode.checked;
        Store.setBlindMode(isBlind);
        if (blindModeToggle) blindModeToggle.checked = isBlind;

        const reader = new FileReader();
        reader.onload = async (e) => {
            await loadUserContent(e.target.result, subFile.name, "dictation");
            const audioBuf = await audioFile.arrayBuffer();

            // Dọn dẹp player và load cái mới
            superPlayer.stop(); // Trong code mới hàm này sẽ clear buffer
            await superPlayer.load(audioBuf);

            Store.setSource({ ...Store.getSource(), hasAudio: true, audioUrl: null });

            dictationBtn.textContent = subFile.name;
            dictationModal.classList.add("hidden");
            controller.reset();
        };
        reader.readAsText(subFile, "utf-8");
    };
}