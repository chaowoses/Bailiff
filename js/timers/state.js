import { parseTime, formatTime } from '../shared/time.js';

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
let startTime = null;
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
        startTime = resumeState.timerState ? (resumeState.timerState.startTime || null) : null;
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

// A witness-bearing block's Allocated-mode budget is that team's own
// witnesses added up — read directly off the template's witnesses rather
// than trusting a single shared `.time` field, since the setup screen only
// ever stores one side's total there (see witnessSideTotals in
// setup/witnesses.js) and the two sides' real totals may not match if the
// user chose to start anyway despite the uneven-times warning. Each team's
// own block genuinely gets its own budget this way, whether even or not.
function teamBlockTime(t, team) {
    if (witnessMode !== 'allocated' || !t.witnesses || !t.witnesses.length) return t.time;
    const secs = t.witnesses.filter(w => w.side === team).reduce((sum, w) => sum + parseTime(w.time), 0);
    return formatTime(secs);
}

// Create blocks for both teams
let blocks = {
    left: blockTemplates.map(t => ({ ...t, time: teamBlockTime(t, 'left'), team: 'left', remainingSeconds: null, stopped: false, witnesses: initWitnessRuntime(t, 'left') })),
    right: blockTemplates.map(t => ({ ...t, time: teamBlockTime(t, 'right'), team: 'right', remainingSeconds: null, stopped: false, witnesses: initWitnessRuntime(t, 'right') }))
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
    startTime = savedSessionData.startTime || null;
}

export const state = {
    leftTeamName, rightTeamName, timedRulingMode, witnessMode, blockTemplates,
    blocks, currentBlockId, currentTeam, currentWitnessId, startTime,
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
    // Drive the smooth millisecond countdown/pause display (see
    // controls.js's startMsTicker) — purely visual, never persisted, and
    // independent of the whole-second timeRemaining/pauseElapsed state that
    // all the real deduction/ruling logic runs on.
    msDisplayInterval: null,
    msAnchorTime: 0,
    msAnchorValue: 0,
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
            pauseElapsed: state.pauseElapsed, sessionId: state.sessionId, startTime: state.startTime
        }));
    } catch {}
}

export function clearTimerSession() {
    sessionStorage.removeItem(TS_SESSION_KEY);
}
