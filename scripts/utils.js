// /scripts/utils.js
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export function safeCall(fn) {
    try { return fn(); } catch (e) { }
}

export function noop() {}

export function setClasses(el, add = [], remove = []) {
    if (!el) return;
    remove.forEach(c => el.classList.remove(c));
    add.forEach(c => el.classList.add(c));
}

// Tạo fragment gồm nhiều <span>
export function wrapChars(text, className = "", dataNote = "") {
    const frag = document.createDocumentFragment();
    for (const ch of Array.from(text)) {
        const s = document.createElement('span');
        s.textContent = ch;
        if (className) s.classList.add(className);
        if (dataNote) s.dataset.note = dataNote;
        frag.appendChild(s);
    }
    return frag;
}

// Kiểm tra span có nằm ngoài vùng nhìn thấy không
export function isOutOfView(top, height, container, buffer) {
    return top < container.scrollTop + buffer ||
           top + height > container.scrollTop + container.clientHeight - buffer;
}

// Trả về text trong markdown nhưng loại bỏ markup
export function convertMarkdownToPlain(md) {
    return md
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/#+\s*/g, '')
        .replace(/>\s*/g, '')
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Inline footnotes → <span data-note="">
export function convertInlineFootnotes(md) {
    return md.replace(
        /(\*\*[^*]+\*\*|[A-Za-z]+(?:\s+[A-Za-z]+)*)\^\[(.*?)\]/g,
        (m, phrase, note) =>
            `<span class="tooltip-word" data-note="${note}">${phrase}</span>`
    );
}

// Thử nhiều nguồn phát âm (Oxford, Cambridge, Sheet…)
export async function trySources(items, tryFn) {
    for (const it of items) {
        try {
            const ok = await tryFn(it);
            if (ok) return true;
        } catch (e) {}
    }
    return false;
}
