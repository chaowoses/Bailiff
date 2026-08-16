import { parseTime, formatTime, formatTimeMs } from '../shared/time.js';
import {
    countdown, currentBlockName, timeLabel, secondaryTimer, startBtn, stopBtn, nextBtn,
    resetBtn, add15Btn, add30Btn, sub15Btn, sub30Btn, customTimeInput, addCustomBtn, setCustomBtn, subCustomBtn, clearCustomBtn,
    adjustHint
} from './dom.js';
import { state, saveTimerSession } from './state.js';
import {
    getCurrentTimeable, getBlockRemaining, getCurrentParentBlock, isCurrentStopwatch, getEntityValue, setEntityValue
} from './engine.js';
import { setMobileView } from './mobile-view.js';
import { startAutosave, stopAutosave } from './save-progress.js';
// See widgets.js for why this circular import (controls.js <-> widgets.js) is safe.
import { renderWidgets } from './widgets.js';
// See ruling.js for why this circular import (controls.js <-> ruling.js) is safe.
import { showPauseButtons } from './ruling.js';

// Drives the main countdown display's millisecond precision independently
// of the once-a-second timeRemaining/pauseElapsed state — `getValue` reads
// an anchor (timestamp + value at that timestamp) and interpolates via
// performance.now() so the display is smooth between whole-second ticks.
function startMsTicker(getValue) {
    clearInterval(state.msDisplayInterval);
    state.msDisplayInterval = setInterval(() => {
        countdown.textContent = formatTimeMs(getValue());
    }, 33);
}

function stopMsTicker() {
    clearInterval(state.msDisplayInterval);
    state.msDisplayInterval = null;
}

// For a manual, mid-run adjustment (buttons/reset/custom input) to
// timeRemaining outside the live tick: resync the ms anchor so a running
// ticker keeps counting smoothly from the new value, and paint the display
// immediately in case nothing is running to pick it up.
function resyncMsDisplay() {
    state.msAnchorTime = performance.now();
    state.msAnchorValue = state.timeRemaining;
    countdown.textContent = formatTimeMs(state.timeRemaining);
}

export function updateCountdownColor() {
    countdown.classList.remove('warning', 'critical', 'paused', 'overtime');
    // An open-ended stopwatch has nothing to run out of, so it never earns
    // the countdown's urgency colors.
    if (isCurrentStopwatch()) return;
    if (state.timeRemaining < 0) {
        countdown.classList.add('overtime');
    } else if (state.timeRemaining <= 10) {
        countdown.classList.add('critical');
    } else if (state.timeRemaining <= 30) {
        countdown.classList.add('warning');
    }
}

export function selectBlock(blockId, team, witnessId) {
    if (state.isRunning || state.isPaused) {
        fullStop();
    }
    state.currentBlockId = blockId;
    state.currentTeam = team;
    state.currentWitnessId = witnessId != null ? witnessId : null;
    loadBlock();
    saveTimerSession();
}

export function loadBlock() {
    const block = state.blocks[state.currentTeam].find(b => b.id === state.currentBlockId);
    if (!block) return;
    const entity = getCurrentTimeable();
    if (!entity) return;

    const hasWitnesses = block.witnesses && block.witnesses.length > 0;
    const stopwatch = hasWitnesses && state.witnessMode === 'stopwatch';
    state.timeRemaining = getEntityValue(entity, stopwatch);
    if (!stopwatch && entity.remainingSeconds === null) entity.remainingSeconds = state.timeRemaining;

    stopMsTicker();
    const witnessSuffix = hasWitnesses ? ` — ${entity.name}` : '';
    currentBlockName.textContent = `${state.currentTeam === 'left' ? state.leftTeamName : state.rightTeamName} - ${block.name}${witnessSuffix}`;
    countdown.textContent = formatTimeMs(state.timeRemaining);
    updateCountdownColor();
    timeLabel.textContent = stopwatch ? 'Elapsed Time' : 'Time Remaining';
    secondaryTimer.classList.remove('visible');
    // In Total Time mode the number above is elapsed (spent) time, not the
    // real budget — so the +/- buttons deliberately move it opposite to
    // their label (a "+" grant winds elapsed back) while the actual case
    // clock (the superblock) moves the intuitive direction. Spell that out
    // since it's the opposite of every other mode.
    adjustHint.textContent = stopwatch
        ? "These buttons adjust the case's real time left; per-witness elapsed time above moves the opposite way to match."
        : '';

    startBtn.style.display = 'inline-block';
    startBtn.textContent = state.isStopped ? 'Restart' : 'Start';
    startBtn.className = 'bench-btn bench-btn-primary';
    stopBtn.style.display = 'none';

    nextBtn.style.display = nextBlockTarget() ? 'inline-block' : 'none';

    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());

    renderWidgets();
    setMobileView(state.currentTeam);
}

export function startTimer() {
    if (state.isRunning) return;
    state.isRunning = true;
    state.isPaused = false;
    state.isStopped = false;
    const entity = getCurrentTimeable();
    if (entity) entity.stopped = false;
    const stopwatch = isCurrentStopwatch();
    renderWidgets();
    startBtn.textContent = 'Pause';
    startBtn.className = 'bench-btn bench-btn-warn';
    stopBtn.style.display = 'inline-block';
    timeLabel.textContent = stopwatch ? 'Elapsed Time' : 'Time Remaining';
    updateCountdownColor();
    startAutosave();

    state.msAnchorTime = performance.now();
    state.msAnchorValue = state.timeRemaining;
    startMsTicker(() => {
        const elapsed = (performance.now() - state.msAnchorTime) / 1000;
        return isCurrentStopwatch() ? state.msAnchorValue + elapsed : state.msAnchorValue - elapsed;
    });

    state.timerInterval = setInterval(() => {
        const entity = getCurrentTimeable();
        const stopwatch = isCurrentStopwatch();

        state.timeRemaining = stopwatch ? state.timeRemaining + 1 : state.timeRemaining - 1;
        setEntityValue(entity, stopwatch, state.timeRemaining);

        // The block's own real countdown always ticks down ambiently while
        // any of its witnesses is running, regardless of mode — in Total
        // Time mode it's the shared budget witnesses draw against; in
        // Allocated mode it's the running sum of the witnesses' own
        // independent countdowns, so it stays in sync with them live
        // instead of only updating at ruling-deduction moments.
        const block = getCurrentParentBlock();
        if (block && block.witnesses && block.witnesses.length) {
            block.remainingSeconds = getBlockRemaining(block) - 1;
        }

        // Resync the ms anchor to this whole-second tick so the smooth
        // display never drifts from the real timeRemaining it's derived from.
        state.msAnchorTime = performance.now();
        state.msAnchorValue = state.timeRemaining;
        updateCountdownColor();
        renderWidgets();
    }, 1000);
    saveTimerSession();
}

export function pauseTimer() {
    if (!state.isRunning || state.isPaused) return;
    state.isPaused = true;
    state.isRunning = false;
    clearInterval(state.timerInterval);

    state.originalTimeBeforePause = state.timeRemaining;
    state.pauseElapsed = 0;

    countdown.classList.remove('warning', 'critical', 'overtime');
    countdown.classList.add('paused');
    timeLabel.textContent = 'Time Paused';
    secondaryTimer.textContent = formatTime(state.originalTimeBeforePause);
    secondaryTimer.classList.add('visible');

    startBtn.style.display = 'none';
    stopBtn.style.display = 'none';

    showPauseButtons();

    // The countdown display keeps its ms precision here too — it just counts
    // up from zero instead of down while paused.
    state.msAnchorTime = performance.now();
    state.msAnchorValue = 0;
    startMsTicker(() => (performance.now() - state.msAnchorTime) / 1000);

    state.pauseInterval = setInterval(() => {
        state.pauseElapsed++;
    }, 1000);
    saveTimerSession();
}

export function resumeTimer() {
    clearInterval(state.pauseInterval);
    state.isPaused = false;
    state.pauseElapsed = 0;

    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());

    stopMsTicker();
    countdown.textContent = formatTimeMs(state.timeRemaining);
    updateCountdownColor();
    timeLabel.textContent = 'Time Remaining';
    secondaryTimer.classList.remove('visible');
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'inline-block';

    renderWidgets();
    startTimer();
}

export function stopTimerButton() {
    if (!state.isRunning && !state.isPaused) return;

    if (state.isPaused) {
        clearInterval(state.pauseInterval);
        state.isPaused = false;
        const pauseButtons = document.querySelectorAll('.pause-btn');
        pauseButtons.forEach(btn => btn.remove());
    }

    if (state.isRunning) {
        clearInterval(state.timerInterval);
        state.isRunning = false;
    }

    stopMsTicker();
    countdown.textContent = formatTimeMs(state.timeRemaining);

    state.isStopped = true;

    const entity = getCurrentTimeable();
    if (entity) entity.stopped = true;

    timeLabel.textContent = 'Stopped';
    secondaryTimer.classList.remove('visible');

    startBtn.textContent = 'Restart';
    startBtn.className = 'bench-btn bench-btn-primary';
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    renderWidgets();
    saveTimerSession();
}

export function fullStop() {
    // nextBlock() calls this unconditionally, even on a block that was never
    // started — only mark it "stopped" if it was actually running/paused,
    // so navigating past an untouched block doesn't fake a stop.
    if (state.isRunning || state.isPaused) {
        const entity = getCurrentTimeable();
        if (entity) entity.stopped = true;
    }

    clearInterval(state.timerInterval);
    clearInterval(state.pauseInterval);
    stopMsTicker();
    state.isRunning = false;
    state.isPaused = false;
    state.isStopped = false;
    stopAutosave();

    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());
    saveTimerSession();
}

// Both teams' block lists are built from the same ordered block templates
// (see timers/state.js), so index i in 'left' and index i in 'right' are
// the same row — e.g. both sides' Direct Examination. Within a row, a
// witness-bearing block's witnesses are its "steps"; a plain block (no
// witnesses) is just a single step, so the same zig-zag logic covers both.
// Actual trial order alternates sides at each step (e.g. Plaintiff Witness
// 1, then Defense Witness 1, then Plaintiff Witness 2...) before moving to
// the next row, rather than exhausting one side's whole row — or one whole
// side's schedule — first.
function rowSteps(team, rowIndex) {
    const block = state.blocks[team][rowIndex];
    if (!block) return null;
    return (block.witnesses && block.witnesses.length) ? block.witnesses.map(w => w.id) : [null];
}

function stepAt(team, rowIndex, stepIndex) {
    const steps = rowSteps(team, rowIndex);
    if (!steps || stepIndex < 0 || stepIndex >= steps.length) return null;
    return { team, id: state.blocks[team][rowIndex].id, witnessId: steps[stepIndex] };
}

function nextBlockTarget() {
    const rowIndex = state.blocks[state.currentTeam].findIndex(b => b.id === state.currentBlockId);
    const stepIndex = rowSteps(state.currentTeam, rowIndex).indexOf(state.currentWitnessId);

    const next = state.currentTeam === 'left'
        ? stepAt('right', rowIndex, stepIndex) || stepAt('left', rowIndex, stepIndex + 1) || stepAt('right', rowIndex, stepIndex + 1)
        : stepAt('left', rowIndex, stepIndex + 1) || stepAt('right', rowIndex, stepIndex + 1);
    if (next) return next;

    // Both sides' steps in this row are exhausted — drop to the first step
    // of the next row (always starts on the left).
    return stepAt('left', rowIndex + 1, 0);
}

export function nextBlock() {
    const target = nextBlockTarget();
    if (target) {
        fullStop();
        selectBlock(target.id, target.team, target.witnessId);
    }
    saveTimerSession();
}

// A manual adjustment to the current witness must also move the block's
// derived total — the real budget — the same as a ruling deduction does
// (see ruling.js), otherwise the superblock header drifts from the actual
// remaining time whenever it's changed outside of the live countdown tick.
// `delta` here is always "seconds granted to the current speaker" (positive
// = more time left), so it applies to the superblock the same way in every
// mode, regardless of which direction it happens to move the entity's own
// on-screen number (see adjustTime).
function adjustSuperblock(delta) {
    if (!delta) return;
    const block = getCurrentParentBlock();
    if (block && block.witnesses && block.witnesses.length) {
        block.remainingSeconds = getBlockRemaining(block) + delta;
    }
}

// In every mode, positive `seconds` means "grant the current speaker more
// time" — negative means take time away. For a plain/Allocated entity that
// directly is its own remaining time, so it's a normal += . For a Total
// Time witness, the on-screen number is time already spent (elapsed), so
// granting time means winding that counter back rather than forward — the
// real shared budget (the superblock) gains only however much elapsed time
// actually got wound back. Elapsed can't go below 0, so a grant larger than
// what's actually elapsed clamps there — and the superblock must only be
// credited for the real amount that moved, not the nominal button size,
// or it would be credited with time that was never really spent.
export function adjustTime(seconds) {
    const entity = getCurrentTimeable();
    if (entity) {
        const stopwatch = isCurrentStopwatch();
        let granted = seconds;
        if (stopwatch) {
            const previous = state.timeRemaining;
            state.timeRemaining = Math.max(0, previous - seconds);
            entity.elapsedSeconds = state.timeRemaining;
            granted = previous - state.timeRemaining;
        } else {
            state.timeRemaining += seconds;
            setEntityValue(entity, false, state.timeRemaining);
        }
        adjustSuperblock(granted);

        // Update originalTimeBeforePause if paused
        if (state.isPaused) {
            state.originalTimeBeforePause = state.timeRemaining;
            secondaryTimer.textContent = formatTime(state.originalTimeBeforePause);
        } else {
            resyncMsDisplay();
            updateCountdownColor();
        }

        renderWidgets();
        saveTimerSession();
    }
}

startBtn.addEventListener('click', () => {
    if (state.isStopped) {
        state.isStopped = false;
        startTimer();
    } else if (state.isRunning) {
        pauseTimer();
    } else if (!state.isPaused) {
        startTimer();
    }
});

stopBtn.addEventListener('click', stopTimerButton);
nextBtn.addEventListener('click', nextBlock);

// Quick control buttons
resetBtn.addEventListener('click', () => {
    const entity = getCurrentTimeable();
    const stopwatch = isCurrentStopwatch();
    if (entity) {
        const previous = getEntityValue(entity, stopwatch);
        state.timeRemaining = stopwatch ? 0 : parseTime(entity.time);
        setEntityValue(entity, stopwatch, state.timeRemaining);
        // Granted seconds: for elapsed time, winding it down hands that much
        // back to the superblock; for remaining time, the new value directly
        // is the grant (see adjustTime).
        adjustSuperblock(stopwatch ? previous - state.timeRemaining : state.timeRemaining - previous);
        entity.stopped = false;

        // Update originalTimeBeforePause if paused
        if (state.isPaused) {
            state.originalTimeBeforePause = state.timeRemaining;
            secondaryTimer.textContent = formatTime(state.originalTimeBeforePause);
        } else {
            resyncMsDisplay();
            updateCountdownColor();
        }

        renderWidgets();
        saveTimerSession();
    }
});

add15Btn.addEventListener('click', () => adjustTime(15));
add30Btn.addEventListener('click', () => adjustTime(30));
sub15Btn.addEventListener('click', () => adjustTime(-15));
sub30Btn.addEventListener('click', () => adjustTime(-30));

// Custom time input formatting
customTimeInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 4) v = v.slice(0, 4);
    if (v.length >= 3) v = v.slice(0, v.length - 2) + ':' + v.slice(v.length - 2);
    e.target.value = v;
});

addCustomBtn.addEventListener('click', () => {
    const seconds = parseTime(customTimeInput.value.length < 3 ? "00:00" : customTimeInput.value);
    adjustTime(seconds);
});

setCustomBtn.addEventListener('click', () => {
    if (!customTimeInput.value.trim() || customTimeInput.value.length < 3) return;

    const seconds = parseTime(customTimeInput.value);
    const entity = getCurrentTimeable();
    const stopwatch = isCurrentStopwatch();

    if (entity) {
        const previous = getEntityValue(entity, stopwatch);
        state.timeRemaining = seconds;
        setEntityValue(entity, stopwatch, state.timeRemaining);
        adjustSuperblock(stopwatch ? previous - state.timeRemaining : state.timeRemaining - previous);

        // Update originalTimeBeforePause if paused
        if (state.isPaused) {
            state.originalTimeBeforePause = state.timeRemaining;
            secondaryTimer.textContent = formatTime(state.originalTimeBeforePause);
        } else {
            resyncMsDisplay();
            updateCountdownColor();
        }

        renderWidgets();
    }

    saveTimerSession();
});

subCustomBtn.addEventListener('click', () => {
    const seconds = parseTime(customTimeInput.value.length < 3 ? "00:00" : customTimeInput.value);
    adjustTime(-seconds);
});

clearCustomBtn.addEventListener('click', () => {
    customTimeInput.value = '';
});
