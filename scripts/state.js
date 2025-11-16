// /scripts/state.js
import { $ } from "./utils.js";

export const DOM = {
    textDisplay: $('#textDisplay'),
    textContainer: $('#textContainer'),
    textInput: $('#textInput'),
    startBtn: $('#startBtn'),
    resetBtn: $('#resetBtn'),
    soundToggle: $('#soundToggle'),
    autoPronounceToggle: $('#autoPronounceToggle'),
    difficultySelect: $('#difficulty'),
    accuracyEl: $('#accuracy'),
    wpmEl: $('#wpm'),
    timeEl: $('#time'),
    errorsEl: $('#errors'),
    themeToggle: $('#themeToggle'),
    autoTooltipToggle: $('#autoTooltipToggle'),
    globalTooltip: $('#globalTooltip'),
    audioPlayer: $('#player'),
    playlistSelect: $('#playlist'),
};

export let STATE = {
    isActive: false,
    startTime: null,
    timerInterval: null,
    statTotalKeys: 0,
    statCorrectKeys: 0,
    statErrors: 0,
    scheduledStatUpdate: false,
    prevIndex: 0,
    textSpans: [],
    originalText: '',
    clickPool: [],
    clickIndex: 0,
    lastSpokenWord: '',
    speakLock: false,
    prevInputText: ''
};

export function resetState() {
    STATE.isActive = false;
    STATE.startTime = null;
    STATE.statTotalKeys = 0;
    STATE.statCorrectKeys = 0;
    STATE.statErrors = 0;
    STATE.scheduledStatUpdate = false;
    STATE.prevIndex = 0;
    STATE.lastSpokenWord = '';
    STATE.prevInputText = '';
}
