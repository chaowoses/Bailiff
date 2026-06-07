// Session persistence for page reload resilience
const TS_SESSION_KEY = 'bailiff_timer_session';

function saveTimerSession() {
    try {
        sessionStorage.setItem(TS_SESSION_KEY, JSON.stringify({
            leftTeamName, rightTeamName, timedRulingMode, blockTemplates,
            blocks, currentBlockId, currentTeam,
            timeRemaining, originalTimeBeforePause, pauseElapsed, sessionId
        }));
    } catch {}
}

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

let savedSessionData = null;
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
const resumeId = urlParams.get('resume');

let leftTeamName, rightTeamName, timedRulingMode, blockTemplates, resumeBlocks;
let resumeState = null;

if (resumeId) {
    try {
        const cacheKey = resumeId === 'autosave' ? 'bailiff_autosave' : 'bailiff_resume';
        resumeState = JSON.parse(localStorage.getItem(cacheKey));
        localStorage.removeItem(cacheKey);
        leftTeamName = resumeState.plaintiff || 'Plaintiff';
        rightTeamName = resumeState.defense || 'Defense';
        timedRulingMode = resumeState.timedRulingMode === true || resumeState.advancedMode === true;
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

    try {
        blockTemplates = JSON.parse(decodeURIComponent(urlParams.get('blocks') || '[]'));
    } catch (e) {
        blockTemplates = [
            { id: 1, name: "Opening Statement", time: "05:00", linked: null },
            { id: 2, name: "Direct Examination", time: "25:00", linked: 3 },
            { id: 3, name: "Cross Examination", time: "20:00", linked: 2 },
            { id: 4, name: "Closing Argument", time: "05:00", linked: null }
        ];
    }
    resumeBlocks = null;
}

// Generate a session ID so saves overwrite within the same session
// (use the resumed trial's sessionId so re-saves update the same entry)
let sessionId = (resumeState && resumeState.sessionId) || 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

// Create blocks for both teams
let blocks = {
    left: blockTemplates.map(t => ({ ...t, team: 'left', remainingSeconds: null })),
    right: blockTemplates.map(t => ({ ...t, team: 'right', remainingSeconds: null }))
};

// Restore saved timer progress if resuming
if (resumeBlocks) {
    blocks = {
        left: resumeBlocks.left.map(b => ({ ...b })),
        right: resumeBlocks.right.map(b => ({ ...b }))
    };
}

// Restore everything from session on true reload
if (savedSessionData) {
    leftTeamName = savedSessionData.leftTeamName;
    rightTeamName = savedSessionData.rightTeamName;
    timedRulingMode = savedSessionData.timedRulingMode || savedSessionData.advancedMode;
    blockTemplates = savedSessionData.blockTemplates;
    blocks = savedSessionData.blocks;
    sessionId = savedSessionData.sessionId;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const ICON_LINK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="link-svg"><path d="M7 20l10 0"/><path d="M6 6l6 -1l6 1"/><path d="M12 3l0 17"/><path d="M9 12l-3 -6l-3 6a3 3 0 0 0 6 0"/><path d="M21 12l-3 -6l-3 6a3 3 0 0 0 6 0"/></svg>`;

let currentBlockId = null;
let currentTeam = null;
let isRunning = false;
let isPaused = false;
let isStopped = false;
let timeRemaining = 0;
let originalTimeBeforePause = 0;
let pauseElapsed = 0;
let timerInterval = null;
let pauseInterval = null;

// Restore timer state variables from session
if (savedSessionData) {
    currentBlockId = savedSessionData.currentBlockId;
    currentTeam = savedSessionData.currentTeam;
    timeRemaining = savedSessionData.timeRemaining;
    originalTimeBeforePause = savedSessionData.originalTimeBeforePause;
    pauseElapsed = savedSessionData.pauseElapsed;
    isStopped = true;
}

const leftWidgets = document.getElementById('left-widgets');
const rightWidgets = document.getElementById('right-widgets');
const countdown = document.getElementById('countdown');
const currentBlockName = document.getElementById('current-block-name');
const timeLabel = document.getElementById('time-label');
const secondaryTimer = document.getElementById('secondary-timer');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const nextBtn = document.getElementById('next-btn');
const timerControls = document.getElementById('timer-controls');
const resetBtn = document.getElementById('reset-btn');
const add15Btn = document.getElementById('add-15-btn');
const add30Btn = document.getElementById('add-30-btn');
const sub15Btn = document.getElementById('sub-15-btn');
const sub30Btn = document.getElementById('sub-30-btn');
const customTimeInput = document.getElementById('custom-time-input');
const addCustomBtn = document.getElementById('add-custom-btn');
const setCustomBtn = document.getElementById('set-custom-btn');
const subCustomBtn = document.getElementById('sub-custom-btn');
const clearCustomBtn = document.getElementById('clear-custom-btn');

// Set team names
document.getElementById('left-team-name').textContent = leftTeamName;
document.getElementById('right-team-name').textContent = rightTeamName;



function parseTime(timeStr) {
    const [mins, secs] = timeStr.split(':').map(Number);
    return mins * 60 + secs;
}

function formatTime(seconds) {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return `${isNegative ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateCountdownColor() {
    countdown.classList.remove('warning', 'critical', 'paused', 'overtime');
    if (timeRemaining < 0) {
        countdown.classList.add('overtime');
    } else if (timeRemaining <= 10) {
        countdown.classList.add('critical');
    } else if (timeRemaining <= 30) {
        countdown.classList.add('warning');
    }
}

function renderWidgets() {
    leftWidgets.innerHTML = '';
    rightWidgets.innerHTML = '';
    
    ['left', 'right'].forEach(team => {
        blocks[team].forEach(block => {
            const widget = document.createElement('div');
            widget.className = 'block-widget';
            
            if (block.id === currentBlockId && block.team === currentTeam) {
                widget.classList.add('active');
            }
            
            // Highlight linked block in opposing team
            if (timedRulingMode && currentBlockId && currentTeam) {
                const currentBlock = blocks[currentTeam].find(b => b.id === currentBlockId);
                if (currentBlock && currentBlock.linked === block.id && block.team !== currentTeam) {
                    widget.classList.add('linked-highlight');
                }
            }
            
            if (block.remainingSeconds !== null && block.remainingSeconds <= 0) {
                widget.classList.add('completed');
            }

            let remaining;
            if (block.remainingSeconds !== null) {
                remaining = block.remainingSeconds;
            } else {
                remaining = parseTime(block.time);
            }

            const linkIcon = block.linked && timedRulingMode ? `<span class="link-icon">${ICON_LINK}</span>` : '';
            
            // Determine color class for sidebar timer
            let remainingClass = 'widget-remaining';
            if (remaining < 0) {
                remainingClass += ' negative';
            } else if (remaining <= 10) {
                remainingClass += ' critical';
            } else if (remaining <= 30) {
                remainingClass += ' warning';
            }

            widget.innerHTML = `
                <div class="widget-name">${linkIcon}${escapeHtml(block.name)}</div>
                <div class="widget-times">
                    <span class="${remainingClass}">${formatTime(remaining)}</span>
                    <span class="widget-total">${escapeHtml(block.time)}</span>
                </div>
            `;

            widget.addEventListener('click', () => selectBlock(block.id, block.team));
            
            if (team === 'left') {
                leftWidgets.appendChild(widget);
            } else {
                rightWidgets.appendChild(widget);
            }
        });
    });
}

function selectBlock(blockId, team) {
    if (isRunning || isPaused) {
        fullStop();
    }
    currentBlockId = blockId;
    currentTeam = team;
    loadBlock();
    saveTimerSession();
}

function loadBlock() {
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);
    if (!block) return;
    
    if (block.remainingSeconds !== null) {
        timeRemaining = block.remainingSeconds;
    } else {
        timeRemaining = parseTime(block.time);
        block.remainingSeconds = timeRemaining;
    }
    
    currentBlockName.textContent = `${currentTeam === 'left' ? leftTeamName : rightTeamName} - ${block.name}`;
    countdown.textContent = formatTime(timeRemaining);
    updateCountdownColor();
    timeLabel.textContent = 'Time Remaining';
    secondaryTimer.classList.remove('visible');
    
    startBtn.style.display = 'inline-block';
    startBtn.textContent = isStopped ? 'Restart' : 'Start';
    startBtn.className = 'bench-btn bench-btn-primary';
    stopBtn.style.display = 'none';
    
    const currentIndex = blocks[currentTeam].findIndex(b => b.id === currentBlockId);
    nextBtn.style.display = currentIndex < blocks[currentTeam].length - 1 ? 'inline-block' : 'none';
    
    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());
    
    renderWidgets();
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    isPaused = false;
    isStopped = false;
    startBtn.textContent = 'Pause';
    startBtn.className = 'bench-btn bench-btn-warn';
    stopBtn.style.display = 'inline-block';
    timeLabel.textContent = 'Time Remaining';
    updateCountdownColor();
    startAutosave();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        const block = blocks[currentTeam].find(b => b.id === currentBlockId);
        if (block) block.remainingSeconds = timeRemaining;
        
        countdown.textContent = formatTime(timeRemaining);
        updateCountdownColor();
        renderWidgets();
    }, 1000);
    saveTimerSession();
}

function pauseTimer() {
    if (!isRunning || isPaused) return;
    isPaused = true;
    isRunning = false;
    clearInterval(timerInterval);
    
    originalTimeBeforePause = timeRemaining;
    pauseElapsed = 0;
    
    countdown.textContent = '00:00';
    countdown.classList.remove('warning', 'critical', 'overtime');
    countdown.classList.add('paused');
    timeLabel.textContent = 'Time Paused';
    secondaryTimer.textContent = formatTime(originalTimeBeforePause);
    secondaryTimer.classList.add('visible');
    
    startBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    
    showPauseButtons();
    
    pauseInterval = setInterval(() => {
        pauseElapsed++;
        countdown.textContent = formatTime(pauseElapsed);
    }, 1000);
    saveTimerSession();
}

function showPauseButtons() {
    const existingPauseButtons = document.querySelectorAll('.pause-btn');
    existingPauseButtons.forEach(btn => btn.remove());
    
    const mainControls = document.querySelector('.bench-main-controls');
    
    if (timedRulingMode) {
        const deductBtn = document.createElement('button');
        deductBtn.className = 'bench-btn bench-btn-danger pause-btn';
        deductBtn.textContent = 'Sustain Objection (Deduct from Time)';
        deductBtn.addEventListener('click', resumeWithDeduction);
        mainControls.appendChild(deductBtn);
        
        const block = blocks[currentTeam].find(b => b.id === currentBlockId);
        if (block && block.linked !== null) {
            const oppositeTeam = currentTeam === 'left' ? 'right' : 'left';
            const linkedBlock = blocks[oppositeTeam].find(b => b.id === block.linked);
            if (linkedBlock) {
                const deductLinkedBtn = document.createElement('button');
                deductLinkedBtn.className = 'bench-btn bench-btn-danger pause-btn';
                deductLinkedBtn.textContent = `Overrule Objection (Deduct from ${linkedBlock.name})`;
                deductLinkedBtn.addEventListener('click', resumeWithLinkedDeduction);
                mainControls.appendChild(deductLinkedBtn);
            }
        }
    }
    
    const discardBtn = document.createElement('button');
    discardBtn.className = 'bench-btn bench-btn-secondary pause-btn';
    discardBtn.textContent = 'Resume';
    discardBtn.addEventListener('click', resumeWithoutDeduction);
    mainControls.appendChild(discardBtn);
}

function resumeWithDeduction() {
    timeRemaining = originalTimeBeforePause - pauseElapsed;
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);
    if (block) block.remainingSeconds = timeRemaining;
    resumeTimer();
}

function resumeWithLinkedDeduction() {
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);
    const oppositeTeam = currentTeam === 'left' ? 'right' : 'left';
    const linkedBlock = blocks[oppositeTeam].find(b => b.id === block.linked);
    
    if (linkedBlock) {
        const linkedRemaining = linkedBlock.remainingSeconds !== null ? 
            linkedBlock.remainingSeconds : parseTime(linkedBlock.time);
        linkedBlock.remainingSeconds = linkedRemaining - pauseElapsed;
    }
    
    timeRemaining = originalTimeBeforePause;
    if (block) block.remainingSeconds = timeRemaining;
    resumeTimer();
}

function resumeWithoutDeduction() {
    timeRemaining = originalTimeBeforePause;
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);
    if (block) block.remainingSeconds = timeRemaining;
    resumeTimer();
}

function resumeTimer() {
    clearInterval(pauseInterval);
    isPaused = false;
    pauseElapsed = 0;
    
    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());
    
    countdown.textContent = formatTime(timeRemaining);
    updateCountdownColor();
    timeLabel.textContent = 'Time Remaining';
    secondaryTimer.classList.remove('visible');
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'inline-block';
    
    renderWidgets();
    startTimer();
}

function stopTimerButton() {
    if (!isRunning && !isPaused) return;
    
    if (isPaused) {
        clearInterval(pauseInterval);
        isPaused = false;
        const pauseButtons = document.querySelectorAll('.pause-btn');
        pauseButtons.forEach(btn => btn.remove());
    }
    
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
    }
    
    isStopped = true;
    
    timeLabel.textContent = 'Stopped';
    secondaryTimer.classList.remove('visible');
    
    startBtn.textContent = 'Restart';
    startBtn.className = 'bench-btn bench-btn-primary';
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    saveTimerSession();
}

function fullStop() {
    clearInterval(timerInterval);
    clearInterval(pauseInterval);
    isRunning = false;
    isPaused = false;
    isStopped = false;
    stopAutosave();
    
    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());
    saveTimerSession();
}

function nextBlock() {
    const currentIndex = blocks[currentTeam].findIndex(b => b.id === currentBlockId);
    if (currentIndex < blocks[currentTeam].length - 1) {
        const nextBlock = blocks[currentTeam][currentIndex + 1];
        fullStop();
        selectBlock(nextBlock.id, currentTeam);
    }
    saveTimerSession();
}

startBtn.addEventListener('click', () => {
    if (isStopped) {
        isStopped = false;
        startTimer();
    } else if (isRunning) {
        pauseTimer();
    } else if (!isPaused) {
        startTimer();
    }
});

stopBtn.addEventListener('click', stopTimerButton);
nextBtn.addEventListener('click', nextBlock);

// Quick control buttons
resetBtn.addEventListener('click', () => {
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);
    if (block) {
        timeRemaining = parseTime(block.time);
        block.remainingSeconds = timeRemaining;
        
        // Update originalTimeBeforePause if paused
        if (isPaused) {
            originalTimeBeforePause = timeRemaining;
            secondaryTimer.textContent = formatTime(originalTimeBeforePause);
        } else {
            countdown.textContent = formatTime(timeRemaining);
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
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);

    if (block) {
        timeRemaining = seconds;
        block.remainingSeconds = timeRemaining;

        // Update originalTimeBeforePause if paused
        if (isPaused) {
            originalTimeBeforePause = timeRemaining;
            secondaryTimer.textContent = formatTime(originalTimeBeforePause);
        } else {
            countdown.textContent = formatTime(timeRemaining);
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

function adjustTime(seconds) {
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);
    if (block) {
        timeRemaining += seconds;
        block.remainingSeconds = timeRemaining;
        
        // Update originalTimeBeforePause if paused
        if (isPaused) {
            originalTimeBeforePause = timeRemaining;
            secondaryTimer.textContent = formatTime(originalTimeBeforePause);
        } else {
            countdown.textContent = formatTime(timeRemaining);
            updateCountdownColor();
        }
        
        renderWidgets();
        saveTimerSession();
    }
}

// Fallback if no blocks came from URL
if (blockTemplates.length === 0) {
    blockTemplates = [
        { id: 1, name: "Opening Statement", time: "05:00", linked: null },
        { id: 2, name: "Direct Examination", time: "25:00", linked: 3 },
        { id: 3, name: "Cross Examination", time: "20:00", linked: 2 },
        { id: 4, name: "Closing Argument", time: "05:00", linked: null }
    ];
    blocks = {
        left: blockTemplates.map(t => ({ ...t, team: 'left', remainingSeconds: null })),
        right: blockTemplates.map(t => ({ ...t, team: 'right', remainingSeconds: null }))
    };
}

// Confirmation dialog for Return to Lobby
const confirmOverlay = document.getElementById('confirm-overlay');
document.querySelector('.bench-lobby-link').addEventListener('click', (e) => {
    e.preventDefault();
    const descInput = document.getElementById('save-desc-input');
    if (descInput && resumeState && resumeState.description) {
        descInput.value = resumeState.description;
    }
    confirmOverlay.classList.remove('hidden');
    setTimeout(() => { if (descInput) descInput.focus(); }, 100);
});

document.getElementById('confirm-cancel').addEventListener('click', () => {
    confirmOverlay.classList.add('hidden');
});

document.getElementById('save-desc-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('confirm-save-exit').click();
    }
});

document.getElementById('confirm-save-exit').addEventListener('click', () => {
    let trials = JSON.parse(localStorage.getItem('bailiff_saved_trials')) || [];
    // Match by sessionId first (same session), then by id (re-launched trial)
    const existingIdx = trials.findIndex(t =>
        t.sessionId === sessionId ||
        (t.id && resumeState && t.id === resumeState.id)
    );
    const descInput = document.getElementById('save-desc-input');
    const trial = {
        sessionId: sessionId,
        id: existingIdx !== -1 ? trials[existingIdx].id : 'trial-' + Date.now(),
        name: leftTeamName + ' v. ' + rightTeamName,
        savedAt: new Date().toISOString(),
        plaintiff: leftTeamName,
        defense: rightTeamName,
        timedRulingMode: timedRulingMode,
        description: descInput ? descInput.value.trim() : '',
        blocks: blockTemplates,
        timerState: {
            blocks: blocks,
            currentBlockId: currentBlockId,
            currentTeam: currentTeam
        }
    };
    if (existingIdx !== -1) {
        trials[existingIdx] = trial;
    } else {
        trials.unshift(trial);
    }
    localStorage.setItem('bailiff_saved_trials', JSON.stringify(trials));
    localStorage.removeItem('bailiff_autosave');
    sessionStorage.removeItem(TS_SESSION_KEY);
    window.location.href = 'index.html';
});

confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) {
        confirmOverlay.classList.add('hidden');
    }
});

// Autosave — periodically save progress
const AUTOSAVE_INTERVAL = 30000;
let autosaveTimer = null;

function startAutosave() {
    stopAutosave();
    autosaveTimer = setInterval(() => {
        if (!currentTeam || !currentBlockId) return;
        const autosave = {
            sessionId: sessionId,
            id: 'autosave',
            name: leftTeamName + ' v. ' + rightTeamName,
            savedAt: new Date().toISOString(),
            plaintiff: leftTeamName,
            defense: rightTeamName,
            timedRulingMode: timedRulingMode,
            blocks: blockTemplates,
            timerState: {
                blocks: blocks,
                currentBlockId: currentBlockId,
                currentTeam: currentTeam
            }
        };
        localStorage.setItem('bailiff_autosave', JSON.stringify(autosave));
    }, AUTOSAVE_INTERVAL);
}

function stopAutosave() {
    if (autosaveTimer) {
        clearInterval(autosaveTimer);
        autosaveTimer = null;
    }
}

// Clear autosave on fresh start (not when resuming it)
if (!resumeId) {
    localStorage.removeItem('bailiff_autosave');
}

// Save state on page unload (catches latest tick during countdown)
window.addEventListener('beforeunload', saveTimerSession);

// Initialize — restore from session, resume from saved block, or start with first block of left team
if (savedSessionData) {
    loadBlock();
} else if (resumeState && resumeState.timerState && resumeState.timerState.currentBlockId && resumeState.timerState.currentTeam) {
    selectBlock(resumeState.timerState.currentBlockId, resumeState.timerState.currentTeam);
} else {
    selectBlock(blocks.left[0].id, 'left');
}