// /scripts/loader.js
import { DOM, STATE } from "./state.js";
import { convertMarkdownToPlain } from "./utils.js";

export let PLAYLIST = [];
export let TEXT_SECTIONS = {};
export let SECTION_ORDER = [];

function cleanText(text) {
    return text
        .replace(/&nbsp;/gi, " ")  // đổi thành khoảng trắng bình thường
        .replace(/\u00A0/g, " ");  // thay ký tự NBSP thật
}


/** Load danh sách file từ texts/index.json */
export async function loadPlaylist() {
    // const resp = await fetch("texts/index.json");
    const resp = await fetch("index.json");
    PLAYLIST = await resp.json();

    DOM.playlistSelect.innerHTML = PLAYLIST.map(f => {
        const name = f.replace(".txt", "").replace(".md", "");
        return `<option value="${f}">${name}</option>`;
    }).join("");
}

/** Load nội dung từ file txt hoặc md */
export async function loadInputTextFromFile(filename) {

    let raw = await (await fetch(`texts/${filename}`)).text();
    raw = cleanText(raw);


    // Reset cấu trúc
    TEXT_SECTIONS = {};
    SECTION_ORDER = [];

    let headerTitle = null;                   // tiêu đề từ "#"
    let currentSection = null;                // tiêu đề section hiện tại
    let foundSection = false;                 // phát hiện ## hay chưa
    let openingBuffer = [];                   // nội dung trước ## (mở đầu)

    const fileTitle = filename.replace(/\.[^.]+$/, ""); // tên file không đuôi
    const lines = raw.split(/\r?\n/);

    /** -----------------------------
     * 1) QUÉT FILE – BẮT HEADING & SECTION
     * ------------------------------ */
    for (let line of lines) {

        // Bắt tiêu đề "# Tiêu đề bài"
        if (line.startsWith("# ") && !headerTitle) {
            const clean = line.replace("#", "").trim();
            headerTitle = convertMarkdownToPlain(clean);
            continue;
        }

        // Gặp section "## ..."
        if (line.startsWith("## ")) {
            foundSection = true;

            const rawTitle = line.replace("##", "").trim();
            const cleanTitle = convertMarkdownToPlain(rawTitle);

            currentSection = cleanTitle;
            SECTION_ORDER.push(cleanTitle);
            TEXT_SECTIONS[cleanTitle] = "";
            continue;
        }

        // Thu thập nội dung
        if (currentSection) {
            TEXT_SECTIONS[currentSection] += line + "\n";
        } else {
            openingBuffer.push(line);
        }
    }

    /** -----------------------------
     * 2) TRƯỜNG HỢP: KHÔNG CÓ SECTION ##
     * ------------------------------ */
    if (!foundSection) {

        // Nếu có # dùng làm title, không có thì tên file
        const title = headerTitle || fileTitle;
        SECTION_ORDER = [title];

        // Nội dung = toàn bộ file trừ dòng "#"
        let content = raw;
        if (headerTitle) {
            content = raw.split(/\r?\n/).slice(1).join("\n");
        }

        TEXT_SECTIONS[title] = content.trim();

        // Header = title
        document.querySelector("header h1").textContent = title;
        rebuildSectionSelect();
        return;
    }

    /** -----------------------------
     * 3) TRƯỜNG HỢP: CÓ SECTION ##
     *    XỬ LÝ NỘI DUNG MỞ ĐẦU
     * ------------------------------ */
    const openingText = openingBuffer.join("\n").trim();

    if (openingText) {
        // Tên section đầu tiên = # tiêu đề bài, hoặc tên file
        const firstName = headerTitle || fileTitle;

        SECTION_ORDER.unshift(firstName);
        TEXT_SECTIONS[firstName] = openingText;
    }

    /** Header = tên section đầu tiên */
    const firstHeader = SECTION_ORDER[0];
    document.querySelector("header h1").textContent = firstHeader;

    rebuildSectionSelect();
}

/** Cập nhật dropdown Section */
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

/** Lấy nội dung theo section đang chọn */
export function getCurrentSectionText() {
    return TEXT_SECTIONS[DOM.difficultySelect.value] || "";
}
