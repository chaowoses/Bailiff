import { parseTime, formatTime } from '../shared/time.js';
import {
    countdown, currentBlockName, timeLabel, secondaryTimer, startBtn, stopBtn, nextBtn,
    resetBtn, add15Btn, add30Btn, sub15Btn, sub30Btn, customTimeInput, addCustomBtn, setCustomBtn, subCustomBtn, clearCustomBtn
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

    const witnessSuffix = hasWitnesses ? ` — ${entity.name}` : '';
    currentBlockName.textContent = `${state.currentTeam === 'left' ? state.leftTeamName : state.rightTeamName} - ${block.name}${witnessSuffix}`;
    countdown.textContent = formatTime(state.timeRemaining);
    updateCountdownColor();
    timeLabel.textContent = stopwatch ? 'Elapsed Time' : 'Time Remaining';
    secondaryTimer.classList.remove('visible');

    startBtn.style.display = 'inline-block';
    startBtn.textContent = state.isStopped ? 'Restart' : 'Start';
    startBtn.className = 'bench-btn bench-btn-primary';
    stopBtn.style.display = 'none';

    const currentIndex = state.blocks[state.currentTeam].findIndex(b => b.id === state.currentBlockId);
    const hasNextWitness = hasWitnesses &&
        block.witnesses.findIndex(w => w.id === state.currentWitnessId) < block.witnesses.length - 1;
    nextBtn.style.display = (hasNextWitness || currentIndex < state.blocks[state.currentTeam].length - 1) ? 'inline-block' : 'none';

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

        countdown.textContent = formatTime(state.timeRemaining);
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

    countdown.textContent = '00:00';
    countdown.classList.remove('warning', 'critical', 'overtime');
    countdown.classList.add('paused');
    timeLabel.textContent = 'Time Paused';
    secondaryTimer.textContent = formatTime(state.originalTimeBeforePause);
    secondaryTimer.classList.add('visible');

    startBtn.style.display = 'none';
    stopBtn.style.display = 'none';

    showPauseButtons();

    state.pauseInterval = setInterval(() => {
        state.pauseElapsed++;
        countdown.textContent = formatTime(state.pauseElapsed);
    }, 1000);
    saveTimerSession();
}

export function resumeTimer() {
    clearInterval(state.pauseInterval);
    state.isPaused = false;
    state.pauseElapsed = 0;

    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());

    countdown.textContent = formatTime(state.timeRemaining);
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
    state.isRunning = false;
    state.isPaused = false;
    state.isStopped = false;
    stopAutosave();

    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());
    saveTimerSession();
}

export function nextBlock() {
    // A witness-bearing block is exhausted witness-by-witness before moving
    // on to the next actual block.
    const block = state.blocks[state.currentTeam].find(b => b.id === state.currentBlockId);
    if (block && block.witnesses && block.witnesses.length) {
        const wIndex = block.witnesses.findIndex(w => w.id === state.currentWitnessId);
        if (wIndex !== -1 && wIndex < block.witnesses.length - 1) {
            fullStop();
            selectBlock(block.id, state.currentTeam, block.witnesses[wIndex + 1].id);
            saveTimerSession();
            return;
        }
    }

    const currentIndex = state.blocks[state.currentTeam].findIndex(b => b.id === state.currentBlockId);
    if (currentIndex < state.blocks[state.currentTeam].length - 1) {
        const next = state.blocks[state.currentTeam][currentIndex + 1];
        fullStop();
        selectBlock(next.id, state.currentTeam);
    }
    saveTimerSession();
}

export function adjustTime(seconds) {
    const entity = getCurrentTimeable();
    if (entity) {
        state.timeRemaining += seconds;
        setEntityValue(entity, isCurrentStopwatch(), state.timeRemaining);

        // Update originalTimeBeforePause if paused
        if (state.isPaused) {
            state.originalTimeBeforePause = state.timeRemaining;
            secondaryTimer.textContent = formatTime(state.originalTimeBeforePause);
        } else {
            countdown.textContent = formatTime(state.timeRemaining);
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
        state.timeRemaining = stopwatch ? 0 : parseTime(entity.time);
        setEntityValue(entity, stopwatch, state.timeRemaining);
        entity.stopped = false;

        // Update originalTimeBeforePause if paused
        if (state.isPaused) {
            state.originalTimeBeforePause = state.timeRemaining;
            secondaryTimer.textContent = formatTime(state.originalTimeBeforePause);
        } else {
            countdown.textContent = formatTime(state.timeRemaining);
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

    if (entity) {
        state.timeRemaining = seconds;
        setEntityValue(entity, isCurrentStopwatch(), state.timeRemaining);

        // Update originalTimeBeforePause if paused
        if (state.isPaused) {
            state.originalTimeBeforePause = state.timeRemaining;
            secondaryTimer.textContent = formatTime(state.originalTimeBeforePause);
        } else {
            countdown.textContent = formatTime(state.timeRemaining);
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
