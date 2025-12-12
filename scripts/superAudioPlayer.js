// superAudioPlayer.js — sample-accurate + volume control

export class SuperAudioPlayer {
    constructor() {
        this.ctx = null;
        this.buffer = null;
        this.currentSource = null;

        this.gainNode = null;
        this.volume = 1;
    }

    // [CẬP NHẬT] Hàm load trả về Promise
    async load(arrayBuffer) {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = this.volume;
            this.gainNode.connect(this.ctx.destination);
        }

        // [QUAN TRỌNG] Xóa buffer cũ ngay lập tức để tránh phát nhầm
        this.stop();
        this.buffer = null;

        try {
            // Decode là tác vụ nặng và tốn thời gian
            const decoded = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffer = decoded;
            return true; // Thành công
        } catch (err) {
            console.error("Audio decode error:", err);
            return false; // Thất bại
        }
    }

    setVolume(v) {
        this.volume = v;
        if (this.gainNode) {
            this.gainNode.gain.value = v;
        }
    }

    stop() {
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch { }
            this.currentSource.disconnect();
            this.currentSource = null;
        }
    }

    playSegment(startSec, endSec) {
        if (!this.buffer) return; // Nếu buffer null (đang tải hoặc lỗi) thì không phát

        const duration = endSec - startSec;
        if (duration <= 0) return;

        this.stop();

        try {
            const src = this.ctx.createBufferSource();
            src.buffer = this.buffer;
            src.connect(this.gainNode);

            const now = this.ctx.currentTime;
            src.start(now, startSec, duration);
            // +0.05s để fade out hoặc tránh clip âm thanh cuối
            src.stop(now + duration + 0.05);

            this.currentSource = src;
        } catch (e) {
            console.warn("Play error:", e);
        }
    }
}