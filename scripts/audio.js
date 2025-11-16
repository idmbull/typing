// /scripts/audio.js
import { DOM, STATE } from "./state.js";
import { trySources, noop } from "./utils.js";

/* ---------------------------------------------------------
    CLICK SOUND POOL (tối ưu hiệu năng)
   --------------------------------------------------------- */
(function initClickPool() {
    for (let i = 0; i < 4; i++) {
        const a = new Audio('https://www.edclub.com/m/audio/typewriter.mp3');
        a.preload = 'auto';
        a.volume = 0.6;
        STATE.clickPool.push(a);
    }
})();

export function playClick() {
    try {
        const a = STATE.clickPool[STATE.clickIndex % STATE.clickPool.length];
        STATE.clickIndex++;
        a.currentTime = 0;
        a.play().catch(noop);
    } catch (e) {}
}


/* ---------------------------------------------------------
    WORD DETECTION (phát âm khi bắt đầu gõ từ mới)
   --------------------------------------------------------- */

function isWordSeparator(char) {
    return !char || /\s|[.,!?:;"'`]/.test(char);
}

function isNewWordStarting(currentText, previousText) {
    if (currentText.length === 0) return false;
    if (!previousText || previousText.length === 0) return true;

    const lastChar = currentText[currentText.length - 1];
    const prevLast = previousText[previousText.length - 1];

    return isWordSeparator(prevLast) && !isWordSeparator(lastChar);
}

/**
 * Xác định từ vừa gõ + phát âm nếu hợp lệ
 */
export function checkNewWordAndSpeak(currentText, originalText) {
    const newWord = isNewWordStarting(currentText, STATE.prevInputText);
    STATE.prevInputText = currentText;

    if (!newWord) return;

    const cursor = Math.max(0, currentText.length - 1);

    // xác định đầu/cuối từ trong text gốc
    let start = cursor;
    while (start > 0 && !isWordSeparator(originalText[start - 1])) start--;

    let end = cursor;
    while (end < originalText.length - 1 && !isWordSeparator(originalText[end + 1])) end++;

    const fullWord = originalText.substring(start, end + 1).trim();
    if (!fullWord || fullWord === STATE.lastSpokenWord) return;

    STATE.lastSpokenWord = fullWord;

    // khóa spam (600ms)
    if (STATE.speakLock) return;
    STATE.speakLock = true;
    setTimeout(() => (STATE.speakLock = false), 600);

    const cleaned = fullWord.replace(/[^a-z0-9'-]/gi, "");
    playWord(cleaned).catch(noop);
}


/* ---------------------------------------------------------
    FETCH GOOGLE SHEET (ưu tiên nguồn đã lưu)
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

            return rawCell
                .split(/[,;]\s*/)
                .map(s => s.trim())
                .filter(Boolean);
        }
    } catch (e) {}

    return null;
}


/* ---------------------------------------------------------
    CORE: TRY PLAY URL
   --------------------------------------------------------- */

function tryPlayUrl(url, timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
        if (!url) return reject(new Error("URL rỗng"));

        const audio = DOM.audioPlayer;
        let finished = false;
        const cleanup = () => {
            audio.oncanplay = null;
            audio.onerror = null;
            clearTimeout(timer);
        };

        audio.src = url;
        audio.load();

        audio.oncanplay = async () => {
            if (finished) return;
            finished = true;
            cleanup();

            try {
                await audio.play();
                resolve(true);
            } catch (e) {
                reject(e);
            }
        };

        audio.onerror = () => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(new Error("Không load được: " + url));
        };

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(new Error("Timeout"));
        }, timeoutMs);
    });
}


/* ---------------------------------------------------------
    PLAY WORD (Oxford → Cambridge → Google ... → sheet)
   --------------------------------------------------------- */

export async function playWord(raw) {
    const word = String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/['-]/g, "_");

    if (!word) return;

    const baseCambridge = "https://dictionary.cambridge.org/media/english/us_pron/";
    const baseGoogle = "https://dict.youdao.com/dictvoice?audio=";
    const baseOxford = "https://www.oxfordlearnersdictionaries.com/media/english/us_pron/";

    const f1 = word[0] || "_";
    const f3 = word.slice(0, 3).padEnd(3, "_");
    const f5 = word.slice(0, 5).padEnd(5, "_");

    const cambridgeUrl = `${baseCambridge}${f1}/${f3}/${f5}/${word}.mp3`;
    const oxfordUrl = word.includes("_")
        ? `${baseOxford}${f1}/${f3}/${f5}/${word}_1_us_1.mp3`
        : `${baseOxford}${f1}/${f3}/${f5}/${word}__us_1.mp3`;

    const googleUrl = `${baseGoogle}${word}`;

    // ưu tiên google sheet
    let sheetUrls = null;
    try {
        sheetUrls = await fetchWordFromSheet(word);
    } catch (e) {
        sheetUrls = null;
    }

    const sources = [
        ...(Array.isArray(sheetUrls) ? sheetUrls : []),
        oxfordUrl,
        cambridgeUrl,
        googleUrl,
    ];

    await trySources(sources, async (url) => {
        return await tryPlayUrl(url, 7000);
    });
}
