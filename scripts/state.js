// /scripts/state.js
import { $ } from "./utils.js";

export const DOM = {
    textDisplay: $('#textDisplay'),
    textContainer: $('#textContainer'),
    textInput: $('#textInput'),

    // THAY ĐỔI: Chuyển sang Toggle Switch
    actionToggle: $('#actionToggle'), // Checkbox input
    actionLabel: $('#actionLabel'),   // Label text (Start/Stop)

    // Settings
    soundToggle: $('#soundToggle'),
    autoPronounceToggle: $('#autoPronounceToggle'),
    autoTooltipToggle: $('#autoTooltipToggle'),
    blindModeToggle: $('#blindModeToggle'),
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
    prevInputLen: 0,
    scheduledStatUpdate: false,

    prevIndex: 0,
    textSpans: [],
    originalText: "",

    // WORD META
    wordTokens: [],
    wordStarts: [],
    wordEnds: [],

    // Click sound
    clickPool: [],
    clickIndex: 0,

    // Audio state
    lastSpokenWord: "",
    speakLock: false,
    prevInputText: "",
    audioCache: {},

    // Blind Mode
    blindMode: false,

    // Mode
    mode: "typing",

    // Dictation meta
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
    STATE.prevInputLen = 0;
    STATE.scheduledStatUpdate = false;

    STATE.prevIndex = 0;
    STATE.lastSpokenWord = "";
    STATE.prevInputText = "";

    STATE.wordTokens = [];
    STATE.wordStarts = [];
    STATE.wordEnds = [];
}