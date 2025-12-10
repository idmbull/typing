// scripts/loader.js
import { DOM } from "./state.js";
import { Store } from "./core/store.js";
import { parseReadingContent, parseDictationContent, processSectionText } from "./utils/content-parser.js";

let CACHE_SECTIONS = {};
let CACHE_ORDER = [];

/* ==========================================================================
   TREE VIEW GENERATOR (CUSTOM DROPDOWN)
   ========================================================================== */

/**
 * Hàm đệ quy tạo từng phần tử trong cây thư mục
 * @param {String|Object} item - Tên file hoặc Object thư mục
 * @param {String} pathPrefix - Đường dẫn tích lũy (vd: "Oxford/Level1/")
 * @param {Function} onFileSelect - Callback khi chọn file
 * @returns {HTMLElement} Thẻ <li>
 */
function createTreeItem(item, pathPrefix, onFileSelect) {
    const li = document.createElement('li');
    li.className = 'tree-item';

    // --- TRƯỜNG HỢP 1: LÀ FILE (String) ---
    if (typeof item === 'string') {
        // Tạo đường dẫn đầy đủ để fetch file
        // Nếu item là "Lesson1.txt" và prefix là "Oxford/", fullPath = "Oxford/Lesson1.txt"
        const fullPath = pathPrefix + item;

        // Tên hiển thị (Bỏ đuôi .txt/.md)
        const displayName = item.replace(/\.(txt|md|tsv)$/i, "");

        const label = document.createElement('div');
        label.className = 'tree-label is-file';
        label.innerHTML = `<span class="tree-icon">📄</span> ${displayName}`;

        label.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation(); // Ngăn sự kiện click lan ra ngoài làm đóng dropdown ngay lập tức

            // 1. Xử lý giao diện (Active state)
            const allLabels = document.querySelectorAll('.tree-label');
            allLabels.forEach(el => el.classList.remove('active'));
            label.classList.add('active');

            // 2. Cập nhật Text trên nút bấm Trigger
            const triggerText = document.querySelector('#playlistTrigger span');
            if (triggerText) triggerText.textContent = displayName;

            // 3. Đóng dropdown
            const content = document.getElementById('playlistContent');
            if (content) content.classList.add('hidden');

            // 4. Cập nhật input ẩn (để tương thích logic cũ nếu có)
            const hiddenInput = document.getElementById('playlist');
            if (hiddenInput) hiddenInput.value = fullPath;

            // 5. Gọi hàm load file
            onFileSelect(fullPath);
        };

        li.appendChild(label);
    }
    // --- TRƯỜNG HỢP 2: LÀ THƯ MỤC (Object) ---
    else if (typeof item === 'object' && item.name) {
        // Cập nhật prefix cho các con: "Current/" + "NewFolder/"
        const folderPath = pathPrefix + item.name + "/";

        const label = document.createElement('div');
        label.className = 'tree-label is-folder';
        // Icon mũi tên và icon folder
        label.innerHTML = `<span class="tree-arrow">▶</span> <span class="tree-icon">📁</span> ${item.name}`;

        // Container cho các item con (mặc định ẩn bằng CSS)
        const ulChild = document.createElement('ul');
        ulChild.className = 'tree-ul';

        // Sự kiện click vào tên folder -> Đóng/Mở
        label.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Toggle class 'expanded' cho thẻ li
            li.classList.toggle('expanded');

            // Xử lý hiệu ứng xoay mũi tên và đổi icon
            const arrow = label.querySelector('.tree-arrow');
            const icon = label.querySelector('.tree-icon');

            if (li.classList.contains('expanded')) {
                ulChild.classList.add('expanded'); // Hiện con
                if (arrow) arrow.style.transform = "rotate(90deg)";
                if (icon) icon.textContent = "📂"; // Folder mở
            } else {
                ulChild.classList.remove('expanded'); // Ẩn con
                if (arrow) arrow.style.transform = "rotate(0deg)";
                if (icon) icon.textContent = "📁"; // Folder đóng
            }
        };

        li.appendChild(label);

        // Đệ quy: Tạo các item con
        if (item.items && Array.isArray(item.items)) {
            item.items.forEach(child => {
                ulChild.appendChild(createTreeItem(child, folderPath, onFileSelect));
            });
            li.appendChild(ulChild);
        }
    }

    return li;
}

/**
 * Khởi tạo Dropdown và gán sự kiện
 */
function initCustomDropdown(data, mode) {
    const container = document.getElementById('playlistContent');
    const trigger = document.getElementById('playlistTrigger');
    const dropdown = document.getElementById('playlistDropdown');

    if (!container || !trigger) {
        console.warn("Dropdown DOM elements not found in index.html");
        return;
    }

    // Reset nội dung cũ
    container.innerHTML = '';
    const rootUl = document.createElement('ul');
    rootUl.className = 'tree-ul expanded'; // Root luôn hiển thị

    // --- Callback xử lý khi chọn file ---
    const handleFileSelect = async (fullPath) => {
        try {
            await loadContent(fullPath, mode);

            // [QUAN TRỌNG] Reset bài tập sau khi load nội dung mới
            // Ta truy cập controller thông qua biến global window.currentController
            // (Được gán trong app.js / dictation-app.js)
            if (window.currentController) {
                window.currentController.reset();
            }
        } catch (e) {
            console.error(e);
            alert("Không thể tải bài tập này.");
        }
    };

    // Build cây thư mục từ dữ liệu JSON
    data.forEach(item => {
        // Root items không có prefix
        rootUl.appendChild(createTreeItem(item, "", handleFileSelect));
    });
    container.appendChild(rootUl);

    // --- Sự kiện đóng mở Dropdown ---
    trigger.onclick = (e) => {
        e.stopPropagation();
        container.classList.toggle('hidden');
    };

    // Click ra ngoài thì đóng dropdown
    document.addEventListener('click', (e) => {
        if (dropdown && !dropdown.contains(e.target)) {
            container.classList.add('hidden');
        }
    });
}


/* ==========================================================================
   MAIN EXPORTED FUNCTIONS
   ========================================================================== */

// export async function loadPlaylist(mode) {
//     const file = mode === "dictation" ? "dictation.json" : "index.json";

//     try {
//         const resp = await fetch(file);
//         const data = await resp.json();

//         // Thay vì render <select>, ta render Custom Dropdown
//         initCustomDropdown(data, mode);

//         return data;
//     } catch (e) {
//         console.error("Playlist Error:", e);
//         const trigger = document.getElementById('playlistTrigger');
//         if (trigger) trigger.innerHTML = `<span style="color:red">Error loading list</span>`;
//         return [];
//     }
// }

export async function loadPlaylist(mode) {
    const file = mode === "dictation" ? "dictation.json" : "index.json";

    try {
        const resp = await fetch(file);
        const data = await resp.json();

        // 1. Khởi tạo UI Dropdown
        initCustomDropdown(data, mode);

        // 2. TỰ ĐỘNG CHỌN BÀI ĐẦU TIÊN
        // Tìm phần tử .tree-label là file (không phải folder) đầu tiên trong DOM
        const firstFileItem = document.querySelector('#playlistContent .tree-label.is-file');

        if (firstFileItem) {
            // Giả lập sự kiện click vào item này
            // Việc này sẽ kích hoạt toàn bộ logic: Load nội dung, Update tên hiển thị, Reset Controller
            firstFileItem.click();
        }

        return data;
    } catch (e) {
        console.error("Playlist Error:", e);
        const trigger = document.getElementById('playlistTrigger');
        if (trigger) trigger.innerHTML = `<span style="color:red">Error loading list</span>`;
        return [];
    }
}

export async function loadContent(filename, mode) {
    if (!filename) return;

    const path = mode === "dictation" ? "texts/dictation/" : "texts/typing/";
    // Ghép path với filename (filename đã chứa subfolder nếu có, do logic createTreeItem tạo ra)
    const url = `${path}${filename}`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error("File not found");

    const raw = await resp.text();
    await processAndCacheData(raw, mode, filename);
}

export async function loadUserContent(raw, filename, mode) {
    await processAndCacheData(raw, mode, filename);
}

export function loadSection(sectionName) {
    const sectionData = CACHE_SECTIONS[sectionName];
    if (!sectionData) return;

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

/* ==========================================================================
   INTERNAL HELPER FUNCTIONS
   ========================================================================== */

async function processAndCacheData(raw, mode, filename) {
    CACHE_SECTIONS = {};
    CACHE_ORDER = [];

    // --- SỬA ĐỔI: Tách lấy tên file từ đường dẫn đầy đủ ---
    // 1. split('/'): Cắt chuỗi dựa trên dấu gạch chéo
    // 2. pop(): Lấy phần tử cuối cùng (tên file)
    // 3. replace(...): Xóa phần mở rộng file
    const displayName = filename.split('/').pop().replace(/\.(txt|md|tsv)$/i, "");
    // -----------------------------------------------------

    if (mode === "dictation") {
        const data = parseDictationContent(raw);
        CACHE_SECTIONS = data.sections;
        CACHE_ORDER = data.order;

        // Ưu tiên Title trong nội dung file (H1 #), nếu không có thì dùng tên file ngắn gọn
        DOM.headerTitle.textContent = data.mainTitle || displayName;

        // Tìm file audio (Vẫn dùng filename đầy đủ để tìm đúng path)
        Store.setSource({ hasAudio: true, audioUrl: await findAudio(filename) });

        loadSection("Full Text");

    } else {
        const data = parseReadingContent(raw);
        CACHE_SECTIONS = data.sections;
        CACHE_ORDER = data.order;

        DOM.headerTitle.textContent = data.mainTitle || displayName;
        Store.setSource({ hasAudio: false, audioUrl: null });

        loadSection("Full");
    }
    rebuildSectionSelect();
}

async function findAudio(filename) {
    if (!filename) return null;

    // filename ví dụ: "Oxford/Level1/Lesson1.txt"
    const base = filename.replace(/\.[^.]+$/, ""); // -> "Oxford/Level1/Lesson1"
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