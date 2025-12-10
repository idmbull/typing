// scripts/loader.js
import { DOM } from "./state.js";
import { Store } from "./core/store.js"; // <-- Import Store
import { parseReadingContent, parseDictationContent, processSectionText } from "./utils/content-parser.js";

let CACHE_SECTIONS = {}; 
let CACHE_ORDER = [];

export async function loadPlaylist(mode) {
    const file = mode === "dictation" ? "dictation.json" : "index.json";
    try {
        const resp = await fetch(file);
        const list = await resp.json();
        DOM.playlistSelect.innerHTML = list
            .map(f => `<option value="${f}">${f.replace(".txt", "").replace(".md", "")}</option>`)
            .join("");
        return list;
    } catch (e) {
        console.error("Playlist Error:", e);
        return [];
    }
}

export async function loadContent(filename, mode) {
    if (!filename) return;
    const path = mode === "dictation" ? "texts/dictation/" : "texts/typing/";
    const resp = await fetch(`${path}${filename}`);
    if (!resp.ok) throw new Error("File not found");
    const raw = await resp.text();
    await processAndCacheData(raw, mode, filename);
}

export async function loadUserContent(raw, filename, mode) {
    await processAndCacheData(raw, mode, filename);
}

async function processAndCacheData(raw, mode, filename) {
    CACHE_SECTIONS = {};
    CACHE_ORDER = [];

    if (mode === "dictation") {
        const data = parseDictationContent(raw);
        CACHE_SECTIONS = data.sections;
        CACHE_ORDER = data.order;
        
        DOM.headerTitle.textContent = data.mainTitle || filename.replace(".txt", "");
        
        // Update Store Meta
        Store.setSource({ hasAudio: true, audioUrl: await findAudio(filename) });
        
        loadSection("Full Text");

    } else {
        const data = parseReadingContent(raw);
        CACHE_SECTIONS = data.sections;
        CACHE_ORDER = data.order;
        
        DOM.headerTitle.textContent = data.mainTitle || filename;
        Store.setSource({ hasAudio: false, audioUrl: null });
        
        loadSection("Full");
    }
    rebuildSectionSelect();
}

export function loadSection(sectionName) {
    const sectionData = CACHE_SECTIONS[sectionName];
    if (!sectionData) return;

    // Lấy mode từ Store
    if (Store.getMode() === "dictation") {
        Store.setSource({
            text: sectionData.text,
            html: sectionData.html,
            segments: sectionData.segments,
            charStarts: sectionData.charStarts,
            currentSegment: 0
        });
    } else {
        const { clean, html } = processSectionText(sectionData);
        Store.setSource({
            text: clean,
            html: html,
            segments: [],
            charStarts: []
        });
    }
}

async function findAudio(filename) {
    if(!filename) return null;
    const base = filename.replace(/\.[^.]+$/, "");
    const url = `texts/dictation/${base}.mp3`;
    try {
        const res = await fetch(url, { method: "HEAD" });
        return res.ok ? url : null;
    } catch { return null; }
}

function rebuildSectionSelect() {
    DOM.difficultySelect.innerHTML = "";
    if (CACHE_ORDER.length === 0) {
        CACHE_ORDER.push(Store.getMode() === "dictation" ? "Full Text" : "Full");
    }
    CACHE_ORDER.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        DOM.difficultySelect.appendChild(opt);
    });
    DOM.difficultySelect.classList.remove("hidden");
    if (DOM.difficultySelect.options.length > 0) {
        DOM.difficultySelect.value = CACHE_ORDER[0];
    }
}