// /scripts/audio.js
import { DOM, STATE } from "./state.js";
import { trySources, noop } from "./utils.js";

/* ---------------------------------------------------------
    CLICK SOUND POOL (giữ nguyên)
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
    } catch (e) { }
}

/* ---------------------------------------------------------
    WORD DETECTION (giữ nguyên)
--------------------------------------------------------- */
function isWordSeparator(char) {
    return !char || /\s|[.,!?:;"`]/.test(char);
}
function isNewWordStarting(current, previous) {
    if (current.length < previous.length) return false;
    if (!previous || previous.length === 0) return !isWordSeparator(current[0]);

    const last = current[current.length - 1];
    const prevLast = previous[previous.length - 1];
    if (last === "'") return false;

    return isWordSeparator(prevLast) && !isWordSeparator(last);
}

/* ============================================================
   CHECK AUDIO EXISTS (onloadedmetadata + timeout)
   Trả về true nếu server trả metadata trong timeout.
============================================================ */
function checkAudioExists(url, timeout = 800) {
    return new Promise(resolve => {
        try {
            const a = new Audio();
            a.preload = "auto";
            a.src = url;

            let done = false;
            const finish = ok => {
                if (done) return;
                done = true;
                clearTimeout(t);
                // cleanup handlers
                a.onloadedmetadata = null;
                a.onerror = null;
                resolve(ok);
            };

            a.onloadedmetadata = () => finish(true);
            a.onerror = () => finish(false);

            a.load();
            const t = setTimeout(() => finish(false), timeout);
        } catch (e) {
            resolve(false);
        }
    });
}

/* ============================================================
   PRELOAD: xác định nguồn tồn tại theo thứ tự: sheet -> oxford -> cambridge -> google
   Lưu vào STATE.audioCache[word] = AudioElement (with src)
============================================================ */
async function preloadWord(word) {
    if (!word) return;
    if (STATE.audioCache[word]) return; // đã cache

    const cleaned = String(word).toLowerCase().replace(/['-]/g, "_");

    // 1) check sheet first
    const sheetUrls = await fetchWordFromSheet(cleaned);
    if (sheetUrls && sheetUrls.length > 0) {
        const sheetUrl = sheetUrls[0];
        if (await checkAudioExists(sheetUrl, 900)) {
            const a = new Audio(sheetUrl);
            a.preload = "auto";
            a.load();
            STATE.audioCache[cleaned] = a;
            return;
        }
    }

    // 2) build Oxford / Cambridge / Google exact patterns (match original)
    const baseCambridge = "https://dictionary.cambridge.org/media/english/us_pron/";
    const baseOxford = "https://www.oxfordlearnersdictionaries.com/media/english/us_pron/";
    const baseGoogle = "https://dict.youdao.com/dictvoice?audio=";

    const f1 = cleaned[0] || "_";
    const f3 = cleaned.slice(0, 3).padEnd(3, "_");
    const f5 = cleaned.slice(0, 5).padEnd(5, "_");

    // IMPORTANT: use the exact Oxford filename logic as in your original code
    const oxfordUrl = cleaned.includes("_")
        ? `${baseOxford}${f1}/${f3}/${f5}/${cleaned}_1_us_1.mp3`
        : `${baseOxford}${f1}/${f3}/${f5}/${cleaned}__us_1.mp3`;
    const cambridgeUrl = `${baseCambridge}${f1}/${f3}/${f5}/${cleaned}.mp3`;
    const googleUrl = `${baseGoogle}${cleaned}`;

    const sources = [oxfordUrl, cambridgeUrl, googleUrl];

    for (let url of sources) {
        if (await checkAudioExists(url, 900)) {
            const a = new Audio(url);
            a.preload = "auto";
            a.load();
            STATE.audioCache[cleaned] = a;
            return;
        }
    }

    // none found -> don't cache
}

/* ---------------------------------------------------------
    Sliding window preload (1 current + WIN next)
--------------------------------------------------------- */
function preloadNextWords(originalText, currentWord, WIN = 5) {
    const words = (originalText.toLowerCase().match(/[a-z']+/g) || []);
    const unique = [...new Set(words)];
    const idx = unique.indexOf(currentWord.toLowerCase());
    if (idx === -1) return;

    const nextWords = unique.slice(idx + 1, idx + 1 + WIN);
    nextWords.forEach(w => preloadWord(w));

    // keep cache small: keep current + nextWords
    const allowed = new Set([currentWord, ...nextWords].map(x => String(x).toLowerCase()));
    for (const k of Object.keys(STATE.audioCache)) {
        if (!allowed.has(k)) delete STATE.audioCache[k];
    }
}

/* ---------------------------------------------------------
    CHECK NEW WORD & speak (giữ nguyên logic)
--------------------------------------------------------- */
export function checkNewWordAndSpeak(currentText, originalText) {
    const newWord = isNewWordStarting(currentText, STATE.prevInputText);
    STATE.prevInputText = currentText;
    if (!newWord) return;
    if (STATE.speakLock) return;

    STATE.speakLock = true;
    setTimeout(() => (STATE.speakLock = false), 200);

    const cursor = Math.max(0, currentText.length - 1);

    let start = cursor;
    while (start > 0 && !isWordSeparator(originalText[start - 1])) start--;

    let end = cursor;
    while (end < originalText.length - 1 && !isWordSeparator(originalText[end + 1])) end++;

    const fullWord = originalText.substring(start, end + 1).trim();
    if (!fullWord || fullWord === STATE.lastSpokenWord) return;

    const cleaned = fullWord.replace(/[^a-z0-9'-]/gi, "");
    STATE.lastSpokenWord = cleaned;

    // preload sliding window
    preloadNextWords(originalText, cleaned);

    playWord(cleaned).catch(noop);
}

/* ---------------------------------------------------------
    fetchWordFromSheet (giữ nguyên logic gốc)
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
    } catch (e) {
        // ignore
    }
    return null;
}

/* ============================================================
   tryPlayUrl: chờ oncanplay rồi play; log nguồn
============================================================ */
function tryPlayUrl(url, timeoutMs = 2000) {
    return new Promise(resolve => {
        const audio = new Audio(url);
        audio.preload = "auto";

        let done = false;
        const finish = ok => {
            if (done) return;
            done = true;
            clearTimeout(t);
            resolve(ok);
        };

        audio.oncanplay = () => {
            audio.play()
                .then(() => {
                    console.log("[✓ AUDIO] ", url);
                    finish(true);
                })
                .catch(err => {
                    console.warn("[AUDIO ✗] Play failed:", url, err);
                    finish(false);
                });
        };

        audio.onerror = () => finish(false);

        const t = setTimeout(() => finish(false), timeoutMs);
        audio.load();
    });
}

/* ============================================================
   playWord: ưu tiên cache; fallback theo order sheet->ox->cam->google
   Nếu cache exists but playing it fails, skip that exact URL in fallback.
============================================================ */
export async function playWord(raw) {
    const word = (raw || "").trim().toLowerCase().replace(/['-]/g, "_");
    if (!word) return;

    console.log("\n[AUDIO] speak:", word);

    // if cached, try cache first
    const cached = STATE.audioCache[word];
    if (cached) {
        try {
            cached.currentTime = 0;
            await cached.play();
            console.log("\n", word, cached.src);
            return;
        } catch (e) {
            console.warn("[AUDIO] Cached play failed, will fallback:", cached.src, e);
            // fallthrough to try sources but skip cached.src
        }
    }

    // fallback order: sheet -> oxford -> cambridge -> google
    const sheetUrls = await fetchWordFromSheet(word);

    const baseCambridge = "https://dictionary.cambridge.org/media/english/us_pron/";
    const baseOxford = "https://www.oxfordlearnersdictionaries.com/media/english/us_pron/";
    const baseYoudao = "https://dict.youdao.com/dictvoice?audio=";
    const baseGoogleTTS = "https://autumn-sound-09e5.idmbull.workers.dev/?lang=en&text=";

    const f1 = word[0] || "_";
    const f3 = word.slice(0, 3).padEnd(3, "_");
    const f5 = word.slice(0, 5).padEnd(5, "_");

    const oxfordUrl = word.includes("_")
        ? `${baseOxford}${f1}/${f3}/${f5}/${word}_1_us_1.mp3`
        : `${baseOxford}${f1}/${f3}/${f5}/${word}__us_1.mp3`;
    const cambridgeUrl = `${baseCambridge}${f1}/${f3}/${f5}/${word}.mp3`;
    const youdaoUrl = `${baseYoudao}${word}`;
    const googleTTSUrl = `${baseGoogleTTS}${encodeURIComponent(raw)}`;

    // construct ordered list, sheetUrls come first if present
    const order = [
        ...(sheetUrls || []),
        oxfordUrl,
        cambridgeUrl,
        youdaoUrl,
        googleTTSUrl
    ];

    // if cache exists and has src, skip that src in order to avoid double-try
    const skipSrc = cached?.src || null;

    for (let url of order) {
        if (skipSrc && url === skipSrc) continue;
        const ok = await tryPlayUrl(url);
        if (ok) return;
    }

    console.error("❌ [AUDIO] ", word);
}
