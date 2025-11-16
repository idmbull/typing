# Gõ Chính Tả & Luyện Phát Âm

Ứng dụng luyện gõ văn bản kết hợp phát âm tiếng Anh theo từng từ khi bắt đầu gõ.  
Hỗ trợ auto-scroll, tooltip chú thích, highlight từng ký tự, tính WPM, độ chính xác và Dark Mode hiện đại.

---

## 🚀 Giới thiệu

Đây là một ứng dụng luyện gõ bàn phím được thiết kế cho người học tiếng Anh.  
Hệ thống cung cấp:

- Highlight đúng/sai theo từng ký tự  
- Tự động cuộn theo vị trí đang gõ  
- Phát âm từ mới khi bắt đầu gõ  
- Tooltip chú thích khi hover và khi đang gõ  
- Theo dõi Accuracy, Errors, Timer, WPM  
- Dark/Light mode  
- Tải nội dung từ playlist và chia đoạn linh hoạt  

Ứng dụng đã được module hoá bằng ES6 để dễ bảo trì và mở rộng.

---

## ✨ Tính năng nổi bật

### 🔤 So sánh ký tự theo thời gian thực
- Tách từng ký tự thành `<span>`  
- Highlight `correct`, `incorrect`, `current`

### 🔊 Tự phát âm khi bắt đầu từ mới
Nguồn phát âm theo thứ tự ưu tiên:
1. Google Sheet  
2. Oxford  
3. Cambridge  
4. Youdao (Google Audio)

### 💬 Tooltip đa chức năng
- Hover hiển thị footnote  
- Tooltip tự động hiển thị khi gõ vào từ có ghi chú  
- Hỗ trợ từ dài xuống dòng (multi-line rect handling)

### 📊 Thống kê theo thời gian thực
- Accuracy  
- Errors  
- WPM  
- Timer  

### 📚 Tải nội dung bài đọc từ file
- Playlist trong `texts/index.json`  
- Mỗi file `.txt` chứa nhiều section (`##`)  

### 🎨 Dark Mode
- Lưu trạng thái theme trong `localStorage`  

---

## 📂 Cấu trúc dự án

```
project/
│
├── index.html
├── styles.css
│
├── texts/
│   ├── index.json
│   └── *.txt
│
└── scripts/
    ├── app.js
    ├── state.js
    ├── utils.js
    ├── loader.js
    ├── renderer.js
    ├── tooltip.js
    ├── stats.js
    ├── audio.js
    ├── input-handler.js
    └── theme.js
```

---

# 📘 Giải thích từng file JavaScript (Module Overview)

Dự án sử dụng kiến trúc module ES6, mỗi chức năng được tách riêng.

---

### **1. `app.js` — Entry Point**
- Điều khiển toàn bộ ứng dụng  
- Gắn event listeners  
- Trigger timer bằng custom events  
- Load playlist và file đầu tiên  
- Tập trung quản lý logic cấp cao

---

### **2. `state.js` — Global State & DOM Reference**
- Chứa toàn bộ biến trạng thái  
- Lưu mọi phần tử DOM cần dùng  
- Hàm `resetState()` để reset khi bắt đầu bài mới

---

### **3. `utils.js` — Hàm hỗ trợ**
- `$`, `$$` truy cập DOM  
- `wrapChars()` tạo span ký tự  
- `convertInlineFootnotes()` tạo tooltip-word  
- `convertMarkdownToPlain()` chuẩn hóa text  
- `trySources()` thử nhiều nguồn audio  
- `isOutOfView()` xử lý auto-scroll

---

### **4. `loader.js` — Load Playlist & Text**
- Load `texts/index.json`  
- Load từng file `.txt`  
- Phân chia text thành các section theo `##`  
- Cập nhật menu “Chọn đoạn”

---

### **5. `renderer.js` — Renderer Markdown → spans**
- Parse markdown bằng MarkedJS  
- Chuyển từng text-node thành `<span>` ký tự  
- Tạo STATE.textSpans  
- Gán highlight ban đầu

---

### **6. `tooltip.js` — Tooltip khi hover/gõ**
- Hiển thị tooltip khi hover  
- Hiển thị tooltip tự động khi gõ  
- Tính toán vị trí tooltip thông minh (top/bottom/left/right)  
- Hỗ trợ từ dài xuống dòng (multi-line)

---

### **7. `stats.js` — Accuracy / Errors / WPM / Timer**
- Tính accuracy  
- Tính WPM  
- Quản lý timer  
- Cập nhật UI bằng requestAnimationFrame  

---

### **8. `audio.js` — Typing Sound & Auto Pronounce**
- Pool âm thanh cho typing sound (không delay)  
- Nhận diện bắt đầu từ mới  
- Chống spam phát âm (lock 600ms)  
- Tự sinh link Oxford / Cambridge / Youdao  
- Lấy audio từ Google Sheet nếu có

---

### **9. `input-handler.js` — Logic xử lý gõ phím**
- So sánh ký tự với text gốc  
- Highlight đúng/sai  
- Cập nhật con trỏ  
- Scroll theo nội dung  
- Gọi thống kê, phát âm, tooltip  
- Kiểm tra hoàn thành

---

### **10. `theme.js` — Dark / Light Mode**
- Lưu theme vào localStorage  
- Cập nhật giao diện theo theme  
- Tạo event `"theme:changed"`

---

## 📥 Cài đặt & Chạy

### 1. Clone dự án
```sh
git clone https://github.com/your-repo/typing-pronunciation.git
cd typing-pronunciation
```

### 2. Chạy bằng server (bắt buộc đối với ES6 modules)
```sh
npx live-server
```
hoặc
```sh
python3 -m http.server
```

### 3. Truy cập
```
http://localhost:8000
```

---

## 🧪 Thêm bài đọc mới

1. Mở `texts/index.json`  
2. Thêm file `.txt`  
3. Dùng mẫu:

```
Tên bài
## Đoạn 1
Nội dung...
## Đoạn 2
Nội dung...
```

---

## 🤝 Đóng góp

Pull request luôn được chào đón!  

---

## 📄 License  
MIT License.

---

## ❤️ Tác giả  
Ứng dụng được xây dựng bởi **Chat GPT**.
