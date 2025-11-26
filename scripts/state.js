// /scripts/state.js
import { $ } from "./utils.js";

export const DOM = {
    textDisplay: $('#textDisplay'),
    textContainer: $('#textContainer'),
    textInput: $('#textInput'),
    startBtn: $('#startBtn'),
    resetBtn: $('#resetBtn'),
    
    // Settings
    soundToggle: $('#soundToggle'),
    autoPronounceToggle: $('#autoPronounceToggle'),
    autoTooltipToggle: $('#autoTooltipToggle'),
    blindModeToggle: $('#blindModeToggle'), // ⭐ NEW
    themeToggle: $('#themeToggle'),
    
    difficultySelect: $('#difficulty'),
    playlistSelect: $('#playlist'),
    
    // Stats
    accuracyEl: $('#accuracy'),
    wpmEl: $('#wpm'),
    timeEl: $('#time'),
    errorsEl: $('#errors'),
    
    globalTooltip: $('#globalTooltip'),
    audioPlayer: $('#player'),

    // Dictation UI
    dictationBtn: $('#dictationBtn'),
    dictationReplayBtn: $('#dictationReplayBtn'),
    dictationModal: $('#dictationModal'),
    dictationSubInput: $('#dictationSubInput'),
    dictationAudioInput: $('#dictationAudioInput'),
    dictationBlindMode: $('#dictationBlindMode'),
    dictationStartBtn: $('#dictationStartBtn'),
    dictationCancelBtn: $('#dictationCancelBtn'),
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
    prevInputText: '',
    audioCache: {},
    
    blindMode: false, // ⭐ NEW Global state

    mode: "typing", // "typing" | "dictation"

    dictation: {
        active: false,
        segments: [],
        fullText: "",
        fullTextRaw: "",
        currentSegmentIndex: 0,
        audioUrl: null,
        charToSeg: [],
        charStarts: [],
        charEnds: []
    }
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
    // blindMode giữ nguyên theo toggle UI
}