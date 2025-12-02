// ============================================================
//  audio.js — AudioEngine PRO (Scheduler + Speak Word)
// ============================================================

import { STATE } from "./state.js";

// Đảm bảo cache tồn tại
if (!STATE.audioCache) {
    STATE.audioCache = {};
}

// ===== LOCAL STATE cho Speak Word (chỉ dùng trong file này) =====
let LOCAL_lastCaret = 0;
let LOCAL_lastStart = -1;

// ============================================================
//  CLICK SOUND PACK — Web Audio API (siêu mượt)
// ============================================================

// "typewriter" | "cream" | "mech_brown" | "alpaca"
let CURRENT_CLICK_PACK = "cream";

const CLICK_PACK_URLS = {
    typewriter: "https://www.edclub.com/m/audio/typewriter.mp3",
    cream:      "https://raw.githubusercontent.com/tplai/kbsim/master/src/assets/audio/cream/release/GENERIC.mp3",
    mech_brown: "https://cdn.jsdelivr.net/gh/idmbull/soundfx/mech-brown.mp3",
    alpaca:     "https://raw.githubusercontent.com/tplai/kbsim/master/src/assets/audio/alpaca/release/GENERIC.mp3"
};

let clickCtx = null;
let clickBuffer = null;

async function loadClickBuffer() {
    if (clickBuffer) return;

    clickCtx = new (window.AudioContext || window.webkitAudioContext)();
    const url = CLICK_PACK_URLS[CURRENT_CLICK_PACK];

    const resp = await fetch(url);
    const array = await resp.arrayBuffer();
    clickBuffer = await clickCtx.decodeAudioData(array);
}

export async function playClick() {
    try {
        if (!clickBuffer) {
            await loadClickBuffer();
        }

        const source = clickCtx.createBufferSource();
        source.buffer = clickBuffer;

        const gain = clickCtx.createGain();
        gain.gain.value = 5;

        source.connect(gain).connect(clickCtx.destination);
        source.start(0);
    } catch (e) {}
}


// ============================================================
//  WORD TOKENIZATION (giống renderer, hỗ trợ 600,000 / 3.14 / 12-05-2025…)
// ============================================================
function splitWordsSample(text) {
    return (text || "").match(/[a-z0-9%]+(?:[,'./-][a-z0-9%]+)*/gi) || [];
}

function getWordStartIndices(sample) {
    const src = sample || "";
    const words = splitWordsSample(src);
    const starts = [];
    let searchIndex = 0;

    for (let w of words) {
        const pos = src.indexOf(w, searchIndex);
        if (pos === -1) continue;
        starts.push(pos);
        searchIndex = pos + w.length;
    }

    return { words, starts };
}


// ============================================================
//  AUDIO HELPERS (sheet → Oxford → Cambridge → Youdao → GoogleTTS)
// ============================================================

const SHEET_ID = "1Nkbmb8eYhBXzuY4bfWdHToxR7mbRei39n36g6YlsrYw";
const GID = "1105922470";

async function fetchWordFromSheet(word) {
    try {
        const cleaned = String(word).toLowerCase().replace(/'/g, "_");
        const q = encodeURIComponent(`select A,B where A = '${cleaned}'`);
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tq=${q}&gid=${GID}`;
        const resp = await fetch(url);
        const text = await resp.text();
        const json = JSON.parse(text.substr(47).slice(0, -2));
        if (json.table.rows?.length > 0) {
            const rawCell = json.table.rows[0].c[1]?.v || null;
            if (!rawCell) return null;
            return rawCell.split(/[,]\s*/).map(s => s.trim()).filter(Boolean);
        }
    } catch {
        // ignore
    }
    return null;
}

function checkAudioExists(url, timeout = 600) {
    return new Promise(resolve => {
        try {
            const a = new Audio();
            let done = false;

            const finish = ok => {
                if (done) return;
                done = true;
                clearTimeout(t);
                resolve(ok);
            };

            a.onloadedmetadata = () => finish(true);
            a.onerror = () => finish(false);

            a.src = url;
            a.load();

            const t = setTimeout(() => finish(false), timeout);
        } catch {
            resolve(false);
        }
    });
}

function normalizeWord(raw) {
    return (raw || "").trim().toLowerCase().replace(/['-]/g, "_");
}

// Resolve nguồn audio cho một từ (trả về HTMLAudioElement hoặc null)
async function resolveAudioFor(rawWord, cleaned) {
    const key = cleaned || normalizeWord(rawWord);
    if (!key) return null;

    // 1) Cache
    if (STATE.audioCache[key]) {
        return STATE.audioCache[key];
    }

    const baseCam = "https://dictionary.cambridge.org/media/english/us_pron/";
    const baseOxf = "https://www.oxfordlearnersdictionaries.com/media/english/us_pron/";
    const baseYou = "https://dict.youdao.com/dictvoice?audio=";
    const baseTTS = "https://autumn-sound-09e5.idmbull.workers.dev/?lang=en&text=";

    const f1 = key[0] || "_";
    const f3 = key.slice(0, 3).padEnd(3, "_");
    const f5 = key.slice(0, 5).padEnd(5, "_");

    const oxfordUrl = key.includes("_")
        ? `${baseOxf}${f1}/${f3}/${f5}/${key}_1_us_1.mp3`
        : `${baseOxf}${f1}/${f3}/${f5}/${key}__us_1.mp3`;

    const cambridgeUrl = `${baseCam}${f1}/${f3}/${f5}/${key}.mp3`;
    const youdaoUrl = `${baseYou}${key}`;
    const googleTTSUrl = `${baseTTS}${encodeURIComponent(rawWord || key)}`;

    const urls = [];

    // Sheet trước
    const sheetUrls = await fetchWordFromSheet(key);
    if (sheetUrls && sheetUrls.length) {
        urls.push(...sheetUrls);
    }

    urls.push(oxfordUrl, cambridgeUrl, youdaoUrl, googleTTSUrl);

    for (const u of urls) {
        if (!u) continue;
        const ok = await checkAudioExists(u, 600);
        if (!ok) continue;

        const audio = new Audio(u);
        STATE.audioCache[key] = audio;
        return audio;
    }

    return null;
}

async function preloadWord(word) {
    const cleaned = normalizeWord(word);
    if (!cleaned) return;
    if (STATE.audioCache[cleaned]) return;

    await resolveAudioFor(word, cleaned);
}

// Preload vài từ tiếp theo quanh currentWord
function preloadNextWords(originalText, currentWord, WIN = 3) {
    if (!originalText || !currentWord) return;
    const words = (originalText.toLowerCase().match(/[a-z']+/g) || []);
    const unique = Array.from(new Set(words));
    const idx = unique.indexOf(currentWord.toLowerCase());
    if (idx === -1) return;

    const nextWords = unique.slice(idx + 1, idx + 1 + WIN);
    nextWords.forEach(w => preloadWord(w));
}


// ============================================================
//  AUDIO SCHEDULER — KHÔNG CHỒNG TIẾNG, HÀNG ĐỢI THÔNG MINH
// ============================================================

const SPEAK_QUEUE = [];
let SPEAK_PLAYING = false;
let LAST_ENQUEUED = "";

const MAX_QUEUE = 3;

function enqueueSpeak(rawWord) {
    const cleaned = normalizeWord(rawWord);
    if (!cleaned) return;

    // Không enqueue trùng ngay trước đó
    if (cleaned === LAST_ENQUEUED) return;
    LAST_ENQUEUED = cleaned;

    // Không cho từ đã nằm trong queue
    if (SPEAK_QUEUE.some(item => item.cleaned === cleaned)) return;

    SPEAK_QUEUE.push({ raw: rawWord, cleaned });

    // Giới hạn backlog
    if (SPEAK_QUEUE.length > MAX_QUEUE) {
        SPEAK_QUEUE.splice(0, SPEAK_QUEUE.length - MAX_QUEUE);
    }

    if (!SPEAK_PLAYING) {
        void processSpeakQueue();
    }
}

async function processSpeakQueue() {
    if (SPEAK_PLAYING) return;
    const item = SPEAK_QUEUE.shift();
    if (!item) return;

    SPEAK_PLAYING = true;
    const { raw, cleaned } = item;

    let audio = STATE.audioCache[cleaned];
    if (!audio) {
        audio = await resolveAudioFor(raw, cleaned);
    }

    if (!audio) {
        SPEAK_PLAYING = false;
        if (SPEAK_QUEUE.length) void processSpeakQueue();
        return;
    }

    try {
        audio.currentTime = 0;

        audio.onended = () => {
            audio.onended = null;
            SPEAK_PLAYING = false;
            if (SPEAK_QUEUE.length) void processSpeakQueue();
        };

        audio.onpause = () => {
            audio.onpause = null;
            SPEAK_PLAYING = false;
            if (SPEAK_QUEUE.length) void processSpeakQueue();
        };

        await audio.play();
    } catch {
        SPEAK_PLAYING = false;
        if (SPEAK_QUEUE.length) void processSpeakQueue();
    }
}


// ============================================================
//  PUBLIC API — checkNewWordAndSpeak + playWord
// ============================================================

/**
 * 🔊 Hàm chính: được gọi từ input-handler.js
 * - currentText: nội dung user đã gõ
 * - originalText: toàn bộ text chuẩn (renderer đã chuẩn hoá)
 *
 * Logic:
 *  - Xác định caret đang ở trong từ nào
 *  - Chặn backspace
 *  - Chỉ phát khi caret vừa bước vào vị trí start+1 của từ mới
 *  - Preload vài từ tiếp theo
 *  - Đưa từ vào AudioScheduler (enqueueSpeak)
 */
export function checkNewWordAndSpeak(currentText, originalText) {
    const sample = originalText || "";
    const caret = currentText.length;

    const { words, starts } = getWordStartIndices(sample);

    // 1) Xác định caret đang nằm trong từ nào
    let currentIndex = -1;
    for (let i = 0; i < starts.length; i++) {
        const start = starts[i];
        const end = start + words[i].length;

        if (caret > start && caret <= end) {
            currentIndex = i;
            break;
        }
    }

    if (currentIndex === -1) {
        LOCAL_lastCaret = caret;
        return;
    }

    const startNow = starts[currentIndex];
    const currentWord = words[currentIndex];

    // 2) CHẶN BACKSPACE (caret lùi)
    const isDeleting = caret < LOCAL_lastCaret;
    if (isDeleting) {
        LOCAL_lastCaret = caret;
        return;
    }

    // 3) CHỈ PHÁT KHI caret VỪA BƯỚC VÀO START+1 CỦA TỪ
    if (startNow !== LOCAL_lastStart && caret === startNow + 1) {
        LOCAL_lastStart = startNow;

        // Preload một số từ tiếp theo
        preloadNextWords(sample, currentWord);

        // Đưa vào scheduler (không phát trực tiếp)
        enqueueSpeak(currentWord);
    }

    LOCAL_lastCaret = caret;
}

/**
 * Giữ export playWord để tương thích, nhưng bên trong chỉ enqueue.
 * Nếu ở đâu đó gọi trực tiếp playWord("hello"), vẫn được xếp hàng phát.
 */
export async function playWord(raw) {
    enqueueSpeak(raw);
}


