// ============================================================
//  audio.js — Optimized version (keep full Speak Word logic)
// ============================================================

import { DOM, STATE } from "./state.js";
import { noop } from "./utils.js";
// ===== LOCAL DICTATION STATE (không dùng state.js) =====
let LOCAL_lastSpokenWord = "";
let LOCAL_highestWordIndexReached = -1;
// Tự quản lý trong audio.js — không đụng state.js
let LOCAL_lastCaret = 0;
let LOCAL_lastStart = -1;




/* ---------------------------------------------------------
    CLICK SOUND PACK — Web Audio API (siêu mượt)
--------------------------------------------------------- */

// ===== CHỌN GÓI ÂM TẠI ĐÂY =====
// "typewriter" | "mech_blue" | "mech_brown" | "laptop"
let CURRENT_CLICK_PACK = "cream";

// ===== LINK FILE CHO TỪNG PACK =====
const CLICK_PACK_URLS = {
    typewriter: "https://www.edclub.com/m/audio/typewriter.mp3",
    cream : "https://raw.githubusercontent.com/tplai/kbsim/master/src/assets/audio/cream/release/GENERIC.mp3",
    mech_brown: "https://cdn.jsdelivr.net/gh/idmbull/soundfx/mech-brown.mp3",
    alpaca    : "https://raw.githubusercontent.com/tplai/kbsim/master/src/assets/audio/alpaca/release/GENERIC.mp3"
};

// -----------------------------------------------------

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

        // RANDOM PITCH để tự nhiên hơn
        // source.playbackRate.value = 0.92 + Math.random() * 0.16;

        // Volume
        const gain = clickCtx.createGain();
        gain.gain.value = 5;

        source.connect(gain).connect(clickCtx.destination);
        source.start(0);
    } catch (e) {}
}


/* ---------------------------------------------------------
    WORD DETECTION (GIỮ NGUYÊN)
--------------------------------------------------------- */
function getWordStartIndices(sample) {
    const words = splitWordsSample(sample);
    const starts = [];
    let searchIndex = 0;

    for (let w of words) {
        const pos = sample.indexOf(w, searchIndex);
        starts.push(pos);          // <<--- LƯU start index
        searchIndex = pos + w.length;
    }

    return { words, starts };
}


// function splitWordsSample(text) {
//     return text.match(/[a-z0-9'-]+/gi) || [];
// }

function splitWordsSample(text) {
    // Cho phép số dạng 600,000 ; 1.234.567 ; 12-05-2025 ; 2025/11/26 ; 3.14
    return text.match(/[a-z0-9]+(?:[,'./-][a-z0-9]+)*/gi) || [];
}

function getWordBoundaries(sample) {
    const words = splitWordsSample(sample);
    const boundaries = [];

    let searchIndex = 0;

    for (let w of words) {
        const pos = sample.indexOf(w, searchIndex);
        const end = pos + w.length;
        boundaries.push(end + 1);  // vị trí vượt qua từ hiện tại
        searchIndex = end;
    }

    return { words, boundaries };
}


function isWordSeparator(c, prev = "", next = "") {
    if (!c) return true;

    // --- 1) Separator đặc biệt nằm GIỮA số (KHÔNG tách)
    if (/[0-9]/.test(prev) && /[0-9]/.test(next) && /[.,\/-]/.test(c)) {
        return false;
    }

    // --- 2) Sửa lỗi dấu ' đứng ngay trước từ (như 'There)
    // Nếu: c === `'` AND next là chữ cái → KHÔNG coi là separator
    if (c === "'" && /[a-z]/i.test(next)) {
        return false;
    }

    // --- 3) Danh sách separator chuẩn (giữ nguyên)
    return /[\s\n\t]|[.!?:;"(){}\[\],]/.test(c);
}


function isNewWordStarting(current, previous) {
    const curLen = current.length;
    const prevLen = previous.length;

    // Không tăng độ dài → không phải gõ thêm
    if (curLen <= prevLen) return false;

    // Ký tự vừa gõ
    const last = current[curLen - 1];

    // Nếu ký tự mới KHÔNG phải chữ hoặc số → không phải từ mới
    if (!/[a-z0-9]/i.test(last)) return false;

    // Ký tự ngay trước trong CURRENT
    const prevChar = current[curLen - 2] || "";

    // Nếu ký tự trước đó là separator thật → bắt đầu từ mới
    return isWordSeparator(
        prevChar,
        current[curLen - 3] || "",
        last
    );
}

/* ---------------------------------------------------------
    FAST CHECK AUDIO EXISTS (tối ưu)
--------------------------------------------------------- */
function checkAudioExists(url, timeout = 120) {
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

/* ---------------------------------------------------------
    PRELOAD (GIỮ NGUYÊN LOGIC, NHẸ HƠN)
--------------------------------------------------------- */
async function preloadWord(word) {
    if (!word) return;
    if (STATE.audioCache[word]) return;

    const cleaned = String(word).toLowerCase().replace(/['-]/g, "_");

    // sheet first
    const sheetUrls = await fetchWordFromSheet(cleaned);
    if (sheetUrls && sheetUrls.length) {
        const u = sheetUrls[0];
        if (await checkAudioExists(u, 120)) {
            const a = new Audio(u);
            STATE.audioCache[cleaned] = a;
            return;
        }
    }

    // Oxford/Cambridge/Youdao
    const baseCam = "https://dictionary.cambridge.org/media/english/us_pron/";
    const baseOxf = "https://www.oxfordlearnersdictionaries.com/media/english/us_pron/";
    const baseYou = "https://dict.youdao.com/dictvoice?audio=";
    const f1 = cleaned[0] || "_";
    const f3 = cleaned.slice(0, 3).padEnd(3, "_");
    const f5 = cleaned.slice(0, 5).padEnd(5, "_");

    const oxford = cleaned.includes("_")
        ? `${baseOxf}${f1}/${f3}/${f5}/${cleaned}_1_us_1.mp3`
        : `${baseOxf}${f1}/${f3}/${f5}/${cleaned}__us_1.mp3`;

    const cambridge = `${baseCam}${f1}/${f3}/${f5}/${cleaned}.mp3`;
    const youdao = `${baseYou}${cleaned}`;

    const order = [oxford, cambridge, youdao];

    for (let u of order) {
        if (await checkAudioExists(u, 120)) {
            STATE.audioCache[cleaned] = new Audio(u);
            return;
        }
    }
}

/* ---------------------------------------------------------
    PRELOAD NEXT WORDS (logic giữ nguyên, bỏ xoá cache)
--------------------------------------------------------- */
function preloadNextWords(originalText, currentWord, WIN = 3) {
    const words = (originalText.toLowerCase().match(/[a-z']+/g) || []);
    const unique = [...new Set(words)];
    const idx = unique.indexOf(currentWord.toLowerCase());
    if (idx === -1) return;

    const nextWords = unique.slice(idx + 1, idx + 1 + WIN);
    nextWords.forEach(w => preloadWord(w));

    // ❌ XOÁ BỎ xóa cache (nguyên nhân lag)
    // => giữ nguyên cache, không ảnh hưởng logic speak word
}

/* ---------------------------------------------------------
    checkNewWordAndSpeak (GIỮ NGUYÊN)
--------------------------------------------------------- */

function getCurrentSampleWordIndex(sampleText, typedLength) {
    const words = splitWordsSample(sampleText);

    let searchIndex = 0;

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const pos = sampleText.indexOf(w, searchIndex);
        if (pos === -1) continue;

        const end = pos + w.length;

        if (typedLength <= end) {
            return { index: i, word: w };
        }

        searchIndex = end;
    }

    return { index: -1, word: null };
}

// export function checkNewWordAndSpeak(currentText, originalText) {
//     const newWord = isNewWordStarting(currentText, STATE.prevInputText);
//     STATE.prevInputText = currentText;
//     if (!newWord) return;
//     if (STATE.speakLock) return;

//     STATE.speakLock = true;
//     setTimeout(() => STATE.speakLock = false, 200);

//     const cursor = Math.max(0, currentText.length - 1);

//     let start = cursor;
//     while (start > 0 && !isWordSeparator(originalText[start - 1])) start--;

//     let end = cursor;
//     while (end < originalText.length - 1 && !isWordSeparator(originalText[end + 1])) end++;

//     const fullWord = originalText.substring(start, end + 1).trim();
//     if (!fullWord || fullWord === STATE.lastSpokenWord) return;

//     const cleaned = fullWord.replace(/[^a-z0-9'-]/gi, "");
//     STATE.lastSpokenWord = cleaned;

//     preloadNextWords(originalText, cleaned);
//     playWord(cleaned).catch(noop);
// }
export function checkNewWordAndSpeak(currentText, originalText) {
    const caret = currentText.length;

    const { words, starts } = getWordStartIndices(originalText);

    // 1) Xác định caret đang nằm trong từ nào
    let currentIndex = -1;
    for (let i = 0; i < starts.length; i++) {
        const start = starts[i];
        const end = start + words[i].length;

        // Phạm vi từ: (start+1 ... end)
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

    // 2) CHẶN BACKSPACE (caret giảm)
    const isDeleting = caret < LOCAL_lastCaret;

    if (isDeleting) {
        // Lùi → không phát
        LOCAL_lastCaret = caret;
        return;
    }

    // 3) CHỈ PHÁT KHI TIẾN VÀO START MỚI (caret tăng)
    if (startNow !== LOCAL_lastStart && caret === startNow + 1) {
        // caret vừa bước vào đầu từ → phát
        LOCAL_lastStart = startNow;

        preloadNextWords(originalText, currentWord);
        playWord(currentWord).catch(() => {});
    }

    LOCAL_lastCaret = caret;
}





/* ---------------------------------------------------------
    fetchWordFromSheet (NGUYÊN BẢN)
--------------------------------------------------------- */
async function fetchWordFromSheet(word) {
    const SHEET_ID = "1Nkbmb8eYhBXzuY4bfWdHToxR7mbRei39n36g6YlsrYw";
    const GID = "1105922470";
    try {
        const q = encodeURIComponent(`select A,B where A = '${word.replace(/'/g, "_")}'`);
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tq=${q}&gid=${GID}`;
        const resp = await fetch(url);
        const text = await resp.text();
        const json = JSON.parse(text.substr(47).slice(0, -2));
        if (json.table.rows?.length > 0) {
            const rawCell = json.table.rows[0].c[1]?.v || null;
            if (!rawCell) return null;
            return rawCell.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
        }
    } catch { }
    return null;
}

/* ---------------------------------------------------------
    tryPlayUrl (tối ưu timeout 500ms)
--------------------------------------------------------- */
function tryPlayUrl(url, timeoutMs = 500) {
    return new Promise(resolve => {
        const audio = new Audio(url);
        let done = false;

        const finish = ok => {
            if (done) return;
            done = true;
            clearTimeout(t);
            resolve(ok);
        };

        audio.oncanplay = () => {
            audio.play()
                .then(() => finish(true))
                .catch(() => finish(false));
        };

        audio.onerror = () => finish(false);

        const t = setTimeout(() => finish(false), timeoutMs);
        audio.load();
    });
}

/* ---------------------------------------------------------
    playWord (GIỮ NGUYÊN LOGIC, nhanh hơn)
--------------------------------------------------------- */
export async function playWord(raw) {
    const word = (raw || "").trim().toLowerCase().replace(/['-]/g, "_");
    if (!word) return;
    console.log("\n[AUDIO] speak:", word);
    // cache first
    const cached = STATE.audioCache[word];
    if (cached) {
        try {
            cached.currentTime = 0;
            await cached.play();
            return;
        } catch { }
    }

    // fallback order: sheet -> oxford -> cambridge -> youdao -> google
    const sheetUrls = await fetchWordFromSheet(word);
    const baseCam = "https://dictionary.cambridge.org/media/english/us_pron/";
    const baseOxf = "https://www.oxfordlearnersdictionaries.com/media/english/us_pron/";
    const baseYou = "https://dict.youdao.com/dictvoice?audio=";
    const baseTTS = "https://autumn-sound-09e5.idmbull.workers.dev/?lang=en&text=";

    const f1 = word[0] || "_";
    const f3 = word.slice(0, 3).padEnd(3, "_");
    const f5 = word.slice(0, 5).padEnd(5, "_");

    const oxfordUrl = word.includes("_")
        ? `${baseOxf}${f1}/${f3}/${f5}/${word}_1_us_1.mp3`
        : `${baseOxf}${f1}/${f3}/${f5}/${word}__us_1.mp3`;

    const cambridgeUrl = `${baseCam}${f1}/${f3}/${f5}/${word}.mp3`;
    const youdaoUrl = `${baseYou}${word}`;
    const googleTTSUrl = `${baseTTS}${encodeURIComponent(raw)}`;

    const order = [
        ...(sheetUrls || []),
        oxfordUrl,
        cambridgeUrl,
        youdaoUrl,
        googleTTSUrl
    ];

    const skip = cached?.src;
    for (let url of order) {
        if (skip && url === skip) continue;
        if (await tryPlayUrl(url)) {
            STATE.audioCache[word] = new Audio(url);
            return;
        }
    }
}
