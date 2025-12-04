# 📘 Documentation: Gõ Chính Tả & Dictation App

## 1. Giới thiệu
Đây là một ứng dụng web tĩnh (Static Web App) hỗ trợ luyện gõ phím và nghe chép chính tả (Dictation). Ứng dụng tập trung vào trải nghiệm người dùng với các tính năng như âm thanh bàn phím cơ, phát âm từ vựng, chế độ "Blind Mode" (gõ không nhìn), và hỗ trợ định dạng Markdown.

### Các tính năng chính
*   **Typing Mode (Reading):** Luyện gõ theo văn bản mẫu. Hỗ trợ Markdown, Tooltip chú giải, chia đoạn theo Heading.
*   **Dictation Mode (Listening):** Nghe audio và gõ lại nội dung. Hỗ trợ tua lại từng câu (segment), tự động chuyển câu.
*   **Audio Features:**
    *   Âm thanh gõ phím (Click sound).
    *   Phát âm từ vựng (Speak Word) khi gõ xong một từ (nguồn: Oxford, Cambridge, Google TTS).
*   **UI/UX:** Dark/Light mode, Blind mode (ẩn văn bản chưa gõ), Drag & Drop file.

---

## 2. Cài đặt & Chạy dự án

Do dự án sử dụng **ES Modules** (`<script type="module">`) và **Fetch API** để tải file JSON/Text, bạn **không thể** mở trực tiếp file `index.html` bằng cách double-click (giao thức `file://`).

### Yêu cầu
*   Trình duyệt hiện đại (Chrome, Edge, Firefox).
*   Một local web server.

### Cách chạy
1.  **Sử dụng VS Code (Khuyên dùng):**
    *   Cài đặt Extension **Live Server**.
    *   Chuột phải vào `index.html` chọn **"Open with Live Server"**.

2.  **Sử dụng Python:**
    *   Mở terminal tại thư mục dự án.
    *   Chạy lệnh: `python -m http.server 8000`
    *   Truy cập: `http://localhost:8000`

---

## 3. Cấu trúc thư mục

```
project-root/
├── index.html              # Giao diện chính (Typing Mode)
├── dictation.html          # Giao diện Dictation Mode
├── styles.css              # Style chung cho toàn bộ app
├── index.json              # Danh sách bài tập Typing
├── dictation.json          # Danh sách bài tập Dictation
├── scripts/                # Mã nguồn JavaScript
│   ├── app.js              # Entry point cho index.html
│   ├── dictation-app.js    # Entry point cho dictation.html
│   ├── dictation.js        # Logic xử lý Dictation (File upload/Modal)
│   ├── dictation-loader.js # Parser cho file dictation (.txt)
│   ├── typing-engine.js    # Core logic so sánh text gõ vs text gốc
│   ├── renderer.js         # Render HTML từ Markdown
│   ├── audio.js            # Xử lý TTS (Speak Word) và Click sound
│   ├── superAudioPlayer.js # Xử lý Audio Context (cắt segment chính xác)
│   ├── state.js            # Quản lý trạng thái toàn cục (State Management)
│   ├── loader.js           # Xử lý load file, Drag & Drop
│   └── ... (utils, stats, theme, tooltip)
└── texts/                  # Chứa dữ liệu bài tập
    ├── typing/             # File .md/.txt cho Typing Mode
    └── dictation/          # File .txt (kịch bản) và .mp3 cho Dictation Mode
```

---

## 4. Định dạng dữ liệu (Data Format)

Để thêm nội dung mới, bạn cần tạo file đúng định dạng và đặt vào thư mục tương ứng.

### A. Typing Mode (File `.md` hoặc `.txt`)
Hỗ trợ cú pháp Markdown cơ bản.

*   **Tiêu đề bài:** Dòng bắt đầu bằng `# `.
*   **Chia phần (Section):** Dòng bắt đầu bằng `## `. Ứng dụng sẽ tạo dropdown menu để chọn phần.
*   **Tooltip (Chú giải):** Sử dụng cú pháp `^[Nội dung chú giải]`.
    *   Đặt ngay sau từ: `Word^[Giải nghĩa]`
    *   Đặt sau cụm từ (bôi đậm): `**Phrasal Verbs**^[Cụm động từ]`

**Ví dụ:**
```markdown
# Bài Học Số 1

## Phần 1: Giới thiệu
Hello world. This is a **bold text**^[Văn bản in đậm].
Run out of^[Hết cái gì đó] time.

## Phần 2: Nội dung
Đoạn văn tiếp theo...
```

### B. Dictation Mode (File `.txt` + `.mp3`)
Yêu cầu 2 file cùng tên (ví dụ: `d01.txt` và `d01.mp3`) đặt trong `texts/dictation/`.

**Định dạng file `.txt` (TSV - Tab Separated Values):**
Mỗi dòng đại diện cho một câu (segment).
Cấu trúc: `StartTime` {TAB} `EndTime` {TAB} `Nội dung`

*   **StartTime/EndTime:** Tính bằng giây (Seconds).
*   **Nội dung:** Hỗ trợ Markdown và Tooltip giống Typing Mode.
*   **Dòng trống:** Nếu có dòng trống giữa các dòng, ứng dụng sẽ hiểu là **ngắt đoạn văn** (Paragraph break).

**Ví dụ:**
```text
0.5	2.3	Hello everyone, welcome back.
2.5	5.0	Today we will learn about **Javascript**^[Ngôn ngữ lập trình].

5.5	8.0	(Dòng trên là dòng trống, câu này sẽ sang đoạn mới).
```

---

## 5. Hướng dẫn sử dụng

### Chế độ Typing (Reading)
1.  **Chọn bài:** Sử dụng dropdown ở footer hoặc kéo thả file `.txt/.md` vào nút **📂 Load**.
2.  **Cài đặt:**
    *   *Sound:* Bật/tắt tiếng gõ phím.
    *   *Speak Word:* Đọc từ vựng tiếng Anh khi gõ xong từ đó.
    *   *Tooltip:* Tự động hiện chú giải khi gõ đến từ có note.
    *   *Blind Mode:* Ẩn văn bản chưa gõ, giúp luyện trí nhớ.
3.  **Bắt đầu:** Nhấn nút **Start** hoặc bắt đầu gõ vào ô input.

### Chế độ Dictation (Listening)
1.  **Chọn bài:** Chọn từ playlist hoặc nhấn **📂 Load** để tải file thủ công (chọn cặp file `.txt` + `.mp3`).
2.  **Quy trình:**
    *   Audio sẽ phát đoạn (segment) đầu tiên.
    *   Gõ lại nội dung nghe được.
    *   Nếu gõ đúng hết segment, audio tự động chuyển sang segment tiếp theo.
3.  **Hỗ trợ:**
    *   Nhấn `Ctrl + Space` để nghe lại đoạn hiện tại.
    *   Dùng thanh trượt Volume để chỉnh âm lượng.

### Phím tắt (Hotkeys)

| Phím tắt | Chức năng | Phạm vi |
| :--- | :--- | :--- |
| `Ctrl + B` | Bật / Tắt Blind Mode | Toàn cục |
| `Ctrl + Space` | Nghe lại đoạn (Replay Segment) | Dictation |
| `Tab` | (Khi đang gõ) Reset focus vào ô input | Toàn cục |

---

## 6. Kiến trúc kỹ thuật (Dành cho Developer)

### State Management (`state.js`)
Sử dụng một đối tượng `STATE` duy nhất để lưu trữ trạng thái app (text gốc, text đang gõ, vị trí con trỏ, audio segment, word boundaries...).

### Typing Engine (`typing-engine.js`)
*   Không so sánh chuỗi đơn thuần.
*   **Logic:**
    1.  `renderer.js` chuyển Markdown -> HTML (để hiển thị) và Markdown -> Plain Text (để so sánh).
    2.  Khi người dùng gõ, `typing-engine` so sánh ký tự tại con trỏ với Plain Text gốc.
    3.  Trả về mảng `changed` (các index cần re-render màu xanh/đỏ) để tối ưu hiệu năng DOM.

### Audio System (`audio.js` & `superAudioPlayer.js`)
*   **TTS (Speak Word):** Sử dụng chiến lược "Fallback". Tìm audio theo thứ tự: Google Sheet (Cache) -> Oxford -> Cambridge -> Google TTS. Có hàng đợi (Scheduler) để tránh chồng âm thanh khi gõ nhanh.
*   **Dictation Player:** Sử dụng `AudioContext` (Web Audio API) thay vì thẻ `<audio>` thông thường để đảm bảo độ trễ thấp nhất và cắt đoạn (loop segment) chính xác đến mili-giây.

### Loader & Drag-Drop (`loader.js`)
*   Xử lý sự kiện `dragover` và `drop` trên nút Load.
*   Sử dụng `FileReader` để đọc nội dung file text phía client mà không cần upload lên server.

---

## 7. Troubleshooting (Xử lý lỗi thường gặp)

**Q: Tại sao Dictation không chạy khi tôi chọn bài?**
A: Kiểm tra xem file `.mp3` có tồn tại trong thư mục `texts/dictation/` và có tên trùng khớp với file `.txt` không. Mở Console (F12) để xem lỗi 404.

**Q: Tại sao tôi gõ đúng nhưng vẫn báo sai?**
A: Kiểm tra file nguồn xem có chứa ký tự lạ (như Non-breaking space `&nbsp;`) không. Engine đã có hàm `cleanText` nhưng đôi khi copy từ PDF/Word vẫn bị lỗi font.

**Q: Drag & Drop không hoạt động?**
A: Hãy chắc chắn bạn kéo file vào đúng nút "Load" (nút sẽ sáng lên). Chỉ hỗ trợ file text (`.txt`, `.md`, `.json`).
