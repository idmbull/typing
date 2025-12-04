// /scripts/loader.js
import { DOM, STATE } from "./state.js";
import { convertMarkdownToPlain } from "./utils.js";

export let PLAYLIST = [];
export let TEXT_SECTIONS = {};
export let SECTION_ORDER = [];

function cleanText(text) {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/\u00A0/g, " ")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, "\"")
        .replace(/[—–]/g, "-");
}

/** Load danh sách file từ index.json */
export async function loadPlaylist() {
    const resp = await fetch("index.json");
    PLAYLIST = await resp.json();

    DOM.playlistSelect.innerHTML = PLAYLIST
        .map(f => {
            const name = f.replace(".txt", "").replace(".md", "");
            return `<option value="${f}">${name}</option>`;
        })
        .join("");
}

/** Load nội dung từ file txt hoặc md */
export async function loadInputTextFromFile(filename) {

    let raw = await (await fetch(`texts/typing/${filename}`)).text();
    raw = cleanText(raw);

    // Reset cấu trúc
    TEXT_SECTIONS = {};
    SECTION_ORDER = [];

    const lines = raw.split(/\r?\n/);
    const fileTitle = filename.replace(/\.[^.]+$/, "");

    /** =============================
     * 1) Lấy tiêu đề # (nếu có)
     * ============================= */
    let headerTitle = null;

    for (let line of lines) {
        if (line.startsWith("# ")) {
            const clean = line.replace("#", "").trim();
            headerTitle = convertMarkdownToPlain(clean);
            break;
        }
    }

    if (!headerTitle) headerTitle = fileTitle;

    /** =============================
     * 2) Tạo section "Toàn văn"
     * ============================= */
    // Loại bỏ dòng # Tiêu đề khi render để gõ
    let cleanedRaw = raw.split(/\r?\n/);

    // nếu dòng đầu là # ..., thì bỏ nó đi
    if (cleanedRaw[0].startsWith("# ")) {
        cleanedRaw = cleanedRaw.slice(1);
    }

    // ghép lại và trim
    TEXT_SECTIONS["Full"] = cleanedRaw.join("\n").trim();

    SECTION_ORDER.push("Full");

    /** =============================
     * 3) Parse các section ## ...
     * ============================= */
    let currentSection = null;

    for (let line of lines) {

        if (line.startsWith("## ")) {

            const rawTitle = line.replace("##", "").trim();
            const cleanTitle = convertMarkdownToPlain(rawTitle);

            currentSection = cleanTitle;
            SECTION_ORDER.push(cleanTitle);
            TEXT_SECTIONS[cleanTitle] = "";
            continue;
        }

        if (currentSection) {
            TEXT_SECTIONS[currentSection] += line + "\n";
        }
    }

    /** =============================
     * 4) Set header theo dòng #
     * ============================= */
    document.querySelector("header h1").textContent = headerTitle;

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

export function setupFileLoader(onLoadedCallback) {
    const input = document.getElementById("fileLoader");
    const btn = document.getElementById("fileLoaderBtn");

    if (!input || !btn) return;

    // --- Hàm xử lý đọc file chung (cho cả Click và Drop) ---
    const handleFile = (file) => {
        if (!file) return;

        // Cập nhật tên nút thành tên file
        btn.textContent = file.name;

        const reader = new FileReader();
        reader.onload = function (e) {
            onLoadedCallback(e.target.result, file.name);
        };
        reader.readAsText(file, "utf-8");
    };

    // 1. Sự kiện CLICK truyền thống (Input Change)
    input.addEventListener("change", function () {
        handleFile(this.files[0]);
    });

    // 2. Sự kiện DRAG & DROP trên Nút

    // Khi kéo file vào vùng nút
    btn.addEventListener("dragover", (e) => {
        e.preventDefault(); // Bắt buộc để cho phép drop
        e.stopPropagation();
        btn.classList.add("dragging"); // Thêm class CSS
        btn.textContent = "Drop here!"; // Đổi text gợi ý
    });

    // Khi kéo ra ngoài nút
    btn.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove("dragging");

        // Trả lại text cũ (nếu input có file thì lấy tên file, ko thì mặc định)
        if (input.files.length > 0) {
            btn.textContent = input.files[0].name;
        } else {
            btn.textContent = "📂 Load";
        }
    });

    // Khi thả file
    btn.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove("dragging");

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            // Gán file vào input (để logic đồng bộ) và xử lý
            input.files = files;
            handleFile(files[0]);
        }
    });
}


export async function loadRawTextFromUserFile(raw, filename = "User File") {
    raw = cleanText(raw);

    // Reset cấu trúc
    TEXT_SECTIONS = {};
    SECTION_ORDER = [];

    const lines = raw.split(/\r?\n/);

    /** =============================
     * 1) Header (# ...)
     * ============================= */
    let headerTitle = null;

    for (let line of lines) {
        if (line.startsWith("# ")) {
            headerTitle = convertMarkdownToPlain(line.replace("#", "").trim());
            break;
        }
    }

    if (!headerTitle) {
        headerTitle = filename.replace(/\.[^.]+$/, "");
    }

    /** =============================
     * 2) Full section
     * ============================= */
    let cleanedRaw = raw.split(/\r?\n/);

    if (cleanedRaw[0].startsWith("# ")) {
        cleanedRaw = cleanedRaw.slice(1);
    }

    TEXT_SECTIONS["Full"] = cleanedRaw.join("\n").trim();
    SECTION_ORDER.push("Full");

    /** =============================
     * 3) Parse ## sections
     * ============================= */
    let currentSection = null;

    for (let line of lines) {

        if (line.startsWith("## ")) {
            const rawTitle = line.replace("##", "").trim();
            const cleanTitle = convertMarkdownToPlain(rawTitle);

            currentSection = cleanTitle;
            SECTION_ORDER.push(cleanTitle);
            TEXT_SECTIONS[cleanTitle] = "";
            continue;
        }

        if (currentSection) {
            TEXT_SECTIONS[currentSection] += line + "\n";
        }
    }

    /** =============================
     * 4) Set header UI
     * ============================= */
    document.querySelector("header h1").textContent = headerTitle;

    rebuildSectionSelect();
}
