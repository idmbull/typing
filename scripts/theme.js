// /scripts/theme.js
import { DOM } from "./state.js";

/* ---------------------------------------------------------
    APPLY THEME
   --------------------------------------------------------- */
export function setTheme(themeName) {
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem("theme", themeName);
    DOM.themeToggle.textContent = themeName === "dark" ? "Light" : "Dark";

    // phát sự kiện để module khác có thể react nếu cần
    const evt = new CustomEvent("theme:changed", { detail: themeName });
    document.dispatchEvent(evt);
}

/* ---------------------------------------------------------
    INIT THEME WHEN LOAD PAGE
   --------------------------------------------------------- */
export function initTheme() {
    const saved = localStorage.getItem("theme") || "light";
    setTheme(saved);
}
