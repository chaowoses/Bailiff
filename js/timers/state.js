// Session persistence for page reload resilience
const TS_SESSION_KEY = 'bailiff_timer_session';

const DEFAULT_BLOCK_TEMPLATES = [
    { id: 1, name: "Opening Statement", time: "05:00", linked: null },
    { id: 2, name: "Direct Examination", time: "25:00", linked: 3 },
    { id: 3, name: "Cross Examination", time: "20:00", linked: 2 },
    { id: 4, name: "Closing Argument", time: "05:00", linked: null }
];

// Check if this is a page reload (F5) vs a fresh navigation
const isPageReload = (() => {
    try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) return nav.type === 'reload';
    } catch {}
    try {
        return performance.navigation.type === 1;
    } catch {}
    return false;
})();

export let savedSessionData = null;
if (isPageReload) {
    try {
        const saved = JSON.parse(sessionStorage.getItem(TS_SESSION_KEY));
        if (saved) savedSessionData = saved;
    } catch {}
} else {
    sessionStorage.removeItem(TS_SESSION_KEY);
}

// Get data from URL params or use defaults
const urlParams = new URLSearchParams(window.location.search);
export const resumeId = urlParams.get('resume');

let leftTeamName, rightTeamName, timedRulingMode, witnessMode, blockTemplates, resumeBlocks;
export let resumeState = null;

if (resumeId) {
    try {
        const cacheKey = resumeId === 'autosave' ? 'bailiff_autosave' : 'bailiff_resume';
        resumeState = JSON.parse(localStorage.getItem(cacheKey));
        localStorage.removeItem(cacheKey);
        leftTeamName = resumeState.plaintiff || 'Plaintiff';
        rightTeamName = resumeState.defense || 'Defense';
        timedRulingMode = resumeState.timedRulingMode === true || resumeState.advancedMode === true;
        witnessMode = resumeState.witnessMode || 'allocated';
        blockTemplates = resumeState.blocks;
        resumeBlocks = resumeState.timerState ? resumeState.timerState.blocks : null;
    } catch (e) {
        resumeState = null;
    }
}

if (!resumeState) {
    leftTeamName = urlParams.get('leftTeam') || 'Plaintiff';
    rightTeamName = urlParams.get('rightTeam') || 'Defense';
    timedRulingMode = urlParams.get('advanced') === 'true';
    witnessMode = urlParams.get('witnessMode') || 'allocated';

    try {
        blockTemplates = JSON.parse(decodeURIComponent(urlParams.get('blocks') || '[]'));
    } catch (e) {
        blockTemplates = DEFAULT_BLOCK_TEMPLATES;
    }
    resumeBlocks = null;
}

// Fallback if no blocks came from the URL or a parse failure left it empty
if (!blockTemplates || blockTemplates.length === 0) {
    blockTemplates = DEFAULT_BLOCK_TEMPLATES;
}

// Generate a session ID so saves overwrite within the same session
// (use the resumed trial's sessionId so re-saves update the same entry)
let sessionId = (resumeState && resumeState.sessionId) || 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

function initWitnessRuntime(t, team) {
    return (t.witnesses || []).filter(w => w.side === team).map(w => ({ ...w, remainingSeconds: null, elapsedSeconds: 0, stopped: false }));
}

// Create blocks for both teams
let blocks = {
    left: blockTemplates.map(t => ({ ...t, team: 'left', remainingSeconds: null, stopped: false, witnesses: initWitnessRuntime(t, 'left') })),
    right: blockTemplates.map(t => ({ ...t, team: 'right', remainingSeconds: null, stopped: false, witnesses: initWitnessRuntime(t, 'right') }))
};

// Restore saved timer progress if resuming
if (resumeBlocks) {
    blocks = {
        left: resumeBlocks.left.map(b => ({ ...b })),
        right: resumeBlocks.right.map(b => ({ ...b }))
    };
}

let currentBlockId = null;
let currentTeam = null;
let currentWitnessId = null;
let timeRemaining = 0;
let originalTimeBeforePause = 0;
let pauseElapsed = 0;
let isStopped = false;

// Restore everything from session on true reload
if (savedSessionData) {
    leftTeamName = savedSessionData.leftTeamName;
    rightTeamName = savedSessionData.rightTeamName;
    timedRulingMode = savedSessionData.timedRulingMode || savedSessionData.advancedMode;
    witnessMode = savedSessionData.witnessMode || 'allocated';
    blockTemplates = savedSessionData.blockTemplates;
    blocks = savedSessionData.blocks;
    sessionId = savedSessionData.sessionId;

    currentBlockId = savedSessionData.currentBlockId;
    currentTeam = savedSessionData.currentTeam;
    currentWitnessId = savedSessionData.currentWitnessId != null ? savedSessionData.currentWitnessId : null;
    timeRemaining = savedSessionData.timeRemaining;
    originalTimeBeforePause = savedSessionData.originalTimeBeforePause;
    pauseElapsed = savedSessionData.pauseElapsed;
    isStopped = true;
}

export const state = {
    leftTeamName, rightTeamName, timedRulingMode, witnessMode, blockTemplates,
    blocks, currentBlockId, currentTeam, currentWitnessId,
    // Which witness-bearing block widgets are manually expanded, keyed
    // "team:blockId". The block currently on the clock is always
    // force-expanded regardless of this set (see renderWidgets).
    expandedBlocks: new Set(),
    isRunning: false,
    isPaused: false,
    isStopped,
    timeRemaining,
    originalTimeBeforePause,
    pauseElapsed,
    timerInterval: null,
    pauseInterval: null,
    sessionId
};

export function saveTimerSession() {
    try {
        sessionStorage.setItem(TS_SESSION_KEY, JSON.stringify({
            leftTeamName: state.leftTeamName, rightTeamName: state.rightTeamName,
            timedRulingMode: state.timedRulingMode, witnessMode: state.witnessMode,
            blockTemplates: state.blockTemplates, blocks: state.blocks,
            currentBlockId: state.currentBlockId, currentTeam: state.currentTeam, currentWitnessId: state.currentWitnessId,
            timeRemaining: state.timeRemaining, originalTimeBeforePause: state.originalTimeBeforePause,
            pauseElapsed: state.pauseElapsed, sessionId: state.sessionId
        }));
    } catch {}
}

export function clearTimerSession() {
    sessionStorage.removeItem(TS_SESSION_KEY);
}
