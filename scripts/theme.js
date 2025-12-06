// scripts/theme.js
import { DOM } from "./state.js";

/* ---------------------------------------------------------
    APPLY THEME
   --------------------------------------------------------- */
export function setTheme(themeName) {
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem("theme", themeName);
    
    // Cập nhật trạng thái checkbox (nếu tồn tại)
    if (DOM.themeToggle) {
        DOM.themeToggle.checked = (themeName === "dark");
    }

    const evt = new CustomEvent("theme:changed", { detail: themeName });
    document.dispatchEvent(evt);
}

/* ---------------------------------------------------------
    INIT THEME WHEN LOAD PAGE
   --------------------------------------------------------- */
export function initTheme() {
    // Mặc định là 'light' nếu chưa lưu
    const saved = localStorage.getItem("theme") || "light";
    
    // Set theme lên body
    document.documentElement.setAttribute("data-theme", saved);
    
    // Đồng bộ trạng thái checkbox ngay khi load
    // (Cần setTimeout nhỏ hoặc đảm bảo DOM đã load xong, 
    // nhưng vì gọi trong DOMContentLoaded nên an toàn)
    if (DOM.themeToggle) {
        DOM.themeToggle.checked = (saved === "dark");
    }
}