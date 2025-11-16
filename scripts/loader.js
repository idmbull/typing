// /scripts/loader.js
import { DOM, STATE } from "./state.js";

export let PLAYLIST = [];
export let TEXT_SECTIONS = {};
export let SECTION_ORDER = [];

/** Load danh sách file từ texts/index.json */
export async function loadPlaylist() {
    const resp = await fetch("texts/index.json");
    PLAYLIST = await resp.json();

    DOM.playlistSelect.innerHTML = PLAYLIST.map(f => {
        const name = f.replace(".txt", "");
        return `<option value="${f}">${name}</option>`;
    }).join("");
}

/** Khi chọn playlist → load file txt */
export async function loadInputTextFromFile(filename) {
    const raw = await (await fetch(`texts/${filename}`)).text();

    TEXT_SECTIONS = {};
    SECTION_ORDER = [];

    let currentSection = null;
    let headerTitle = null;

    raw.split(/\r?\n/).forEach(line => {
        if (line.startsWith("# Header")) return;

        if (headerTitle === null && line.trim() !== "" && !line.startsWith("##")) {
            headerTitle = line.trim();
            return;
        }

        if (line.startsWith("## ")) {
            currentSection = line.replace("##", "").trim();
            SECTION_ORDER.push(currentSection);
            TEXT_SECTIONS[currentSection] = "";
            return;
        }

        if (currentSection) TEXT_SECTIONS[currentSection] += line + "\n";
    });

    if (headerTitle)
        document.querySelector("header h1").textContent = headerTitle;

    rebuildSectionSelect();
}

/** Cập nhật dropdown "Chọn đoạn" */
export function rebuildSectionSelect() {
    const sel = DOM.difficultySelect;
    sel.innerHTML = "";

    SECTION_ORDER.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });
}

/** Lấy text của đoạn hiện tại */
export function getCurrentSectionText() {
    return TEXT_SECTIONS[DOM.difficultySelect.value] || "";
}
