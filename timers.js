// Session persistence for page reload resilience
const TS_SESSION_KEY = 'bailiff_timer_session';

function saveTimerSession() {
    try {
        sessionStorage.setItem(TS_SESSION_KEY, JSON.stringify({
            leftTeamName, rightTeamName, timedRulingMode, witnessMode, blockTemplates,
            blocks, currentBlockId, currentTeam, currentWitnessId,
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

let leftTeamName, rightTeamName, timedRulingMode, witnessMode, blockTemplates, resumeBlocks;
let resumeState = null;

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

// Restore everything from session on true reload
if (savedSessionData) {
    leftTeamName = savedSessionData.leftTeamName;
    rightTeamName = savedSessionData.rightTeamName;
    timedRulingMode = savedSessionData.timedRulingMode || savedSessionData.advancedMode;
    witnessMode = savedSessionData.witnessMode || 'allocated';
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
const ICON_CHEVRON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="widget-expand-svg"><path d="M6 9l6 6l6 -6"/></svg>`;

let currentBlockId = null;
let currentTeam = null;
let currentWitnessId = null;
// Which witness-bearing block widgets are manually expanded, keyed
// "team:blockId". The block currently on the clock is always force-expanded
// regardless of this set (see renderWidgets).
let expandedBlocks = new Set();
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
    currentWitnessId = savedSessionData.currentWitnessId != null ? savedSessionData.currentWitnessId : null;
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

// Mobile team tabs — lets a phone user flip between agendas without the
// active timer's team changing (that only changes via selectBlock).
const courtroomBody = document.getElementById('courtroom-body');
const mobileTabLeft = document.getElementById('tab-left');
const mobileTabRight = document.getElementById('tab-right');
mobileTabLeft.textContent = leftTeamName;
mobileTabRight.textContent = rightTeamName;

function setMobileView(team) {
    courtroomBody.dataset.mobileView = team;
    mobileTabLeft.classList.toggle('active', team === 'left');
    mobileTabRight.classList.toggle('active', team === 'right');
}

mobileTabLeft.addEventListener('click', () => setMobileView('left'));
mobileTabRight.addEventListener('click', () => setMobileView('right'));



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

// Resolves whichever entity the bench is actually running a timer for right
// now: the selected witness if the current block has any, else the block
// itself. Defaults currentWitnessId to the block's first witness if unset
// or stale (e.g. right after switching to a block with witnesses).
function getCurrentTimeable() {
    const block = blocks[currentTeam] && blocks[currentTeam].find(b => b.id === currentBlockId);
    if (!block) return null;
    if (block.witnesses && block.witnesses.length) {
        let witness = block.witnesses.find(w => w.id === currentWitnessId);
        if (!witness) {
            witness = block.witnesses[0];
            currentWitnessId = witness.id;
        }
        return witness;
    }
    currentWitnessId = null;
    return block;
}

// Generalizes "find the linked block on the other side" to also search
// witnesses nested inside the opposite team's blocks, since a witness's
// `linked` id refers to another witness, not a block. Returns null if
// unlinked, else { item, parentBlock, isWitness } — `item` is the linked
// witness/block itself, `parentBlock` is its containing block (equal to
// `item` when it's not a witness) — see resolveLinkedDeductionTarget.
function getLinkedTimeable(entity, team) {
    if (!entity || entity.linked == null) return null;
    const oppositeTeam = team === 'left' ? 'right' : 'left';
    for (const b of blocks[oppositeTeam]) {
        if (b.id === entity.linked) return { item: b, parentBlock: b, isWitness: false };
        if (b.witnesses) {
            const w = b.witnesses.find(w2 => w2.id === entity.linked);
            if (w) return { item: w, parentBlock: b, isWitness: true };
        }
    }
    return null;
}

// A block's own remaining time is always real and independent — even with
// witnesses, it's never a sum of them. It ticks down ambiently (see
// startTimer's interval) whenever any of its witnesses is running.
function getBlockRemaining(block) {
    return block.remainingSeconds !== null ? block.remainingSeconds : parseTime(block.time);
}

// A linked witness has no real budget of its own in Total Time mode (it's
// just a stopwatch) — the deduction actually has to land on its parent
// block, the only real budget that mode has. Allocated-mode witnesses, and
// plain blocks, take the deduction directly. Named `target` because this is
// also what the "Overrule Objection" button names — the superblock in
// Total Time mode, the witness itself in Allocated mode.
function resolveLinkedDeductionTarget(linked) {
    if (!linked) return null;
    return (linked.isWitness && witnessMode === 'stopwatch') ? linked.parentBlock : linked.item;
}

function getCurrentParentBlock() {
    return blocks[currentTeam] && blocks[currentTeam].find(b => b.id === currentBlockId);
}

// Stopwatch-mode witnesses have no time budget: they count up from zero
// instead of down. Timed Ruling Mode still links witness-to-witness in this
// mode (see getLinkedTimeable), but the actual deduction lands on the
// linked witness's parent block instead of the witness itself, since only
// the block has a real budget to take from (see showPauseButtons).
function isCurrentStopwatch() {
    const block = getCurrentParentBlock();
    return !!(block && block.witnesses && block.witnesses.length && witnessMode === 'stopwatch');
}

function getEntityValue(entity, stopwatch) {
    if (!entity) return 0;
    if (stopwatch) return entity.elapsedSeconds || 0;
    return entity.remainingSeconds !== null ? entity.remainingSeconds : parseTime(entity.time);
}

function setEntityValue(entity, stopwatch, value) {
    if (!entity) return;
    if (stopwatch) entity.elapsedSeconds = value;
    else entity.remainingSeconds = value;
}

function updateCountdownColor() {
    countdown.classList.remove('warning', 'critical', 'paused', 'overtime');
    // An open-ended stopwatch has nothing to run out of, so it never earns
    // the countdown's urgency colors.
    if (isCurrentStopwatch()) return;
    if (timeRemaining < 0) {
        countdown.classList.add('overtime');
    } else if (timeRemaining <= 10) {
        countdown.classList.add('critical');
    } else if (timeRemaining <= 30) {
        countdown.classList.add('warning');
    }
}

function widgetTimeClass(remaining) {
    let cls = 'widget-remaining';
    if (remaining < 0) cls += ' negative';
    else if (remaining <= 10) cls += ' critical';
    else if (remaining <= 30) cls += ' warning';
    return cls;
}

// Shows "Elapsed" whenever any time has actually been used against the
// budget — not gated on whether the item was ever independently started or
// stopped, since a linked ruling deduction can eat into a block/witness
// that was never itself put on the clock.
function widgetElapsedHtml(item, remaining, onTheClock) {
    if (onTheClock) return '';
    const total = parseTime(item.time);
    if (remaining >= total) return '';
    const elapsedSecs = total - remaining;
    const overtime = remaining < 0;
    return `<div class="widget-elapsed${overtime ? ' overtime' : ''}">Elapsed: ${formatTime(elapsedSecs)}</div>`;
}

function renderWidgets() {
    leftWidgets.innerHTML = '';
    rightWidgets.innerHTML = '';

    // Resolved once per render (not per widget) since it can default
    // currentWitnessId as a side effect — repeating that inside the loop
    // below would be wasteful and, worse, order-dependent.
    const currentEntity = (currentBlockId != null && currentTeam != null) ? getCurrentTimeable() : null;

    ['left', 'right'].forEach(team => {
        blocks[team].forEach(block => {
            const witnesses = block.witnesses || [];
            const hasWitnesses = witnesses.length > 0;
            const isBlockActive = block.id === currentBlockId && block.team === currentTeam;

            const widget = document.createElement('div');
            widget.className = 'block-widget';

            if (hasWitnesses) {
                widget.classList.add('has-witnesses');
                const stopwatchMode = witnessMode === 'stopwatch';
                const expandKey = team + ':' + block.id;
                // Linked witnesses need to be visible, not buried behind a
                // collapsed superblock header — force-expand any block that
                // has at least one when Timed Ruling Mode is on, same as an
                // active block always does.
                const hasLinkedWitness = timedRulingMode && witnesses.some(w => w.linked != null);
                const expanded = isBlockActive || expandedBlocks.has(expandKey) || hasLinkedWitness;
                if (expanded) widget.classList.add('expanded');

                // No timer ever runs on the block itself — the header is a
                // read-only rollup that just expands/collapses the witness
                // list; only witness rows select. Timed Ruling Mode links
                // witnesses directly (both modes) rather than the block, so
                // the block header itself never gets a linked-highlight.
                if (isBlockActive) widget.classList.add('active-parent');

                const remaining = getBlockRemaining(block);

                let witnessRowsHtml = '';
                witnesses.forEach(w => {
                    const isWitnessActive = isBlockActive && w.id === currentWitnessId;
                    const rowClasses = ['witness-widget-row'];
                    if (isWitnessActive) rowClasses.push('active');
                    if (currentEntity && currentEntity.linked === w.id && block.team !== currentTeam) {
                        rowClasses.push('linked-highlight');
                    }
                    const wLinkIcon = w.linked && timedRulingMode ? `<span class="link-icon">${ICON_LINK}</span>` : '';

                    if (stopwatchMode) {
                        const wElapsed = w.elapsedSeconds || 0;
                        witnessRowsHtml += `
                            <div class="${rowClasses.join(' ')}" data-witness-id="${w.id}">
                                <div class="widget-name">${wLinkIcon}${escapeHtml(w.name)}</div>
                                <div class="widget-times">
                                    <span class="widget-remaining widget-stopwatch">${formatTime(wElapsed)}</span>
                                    <span class="widget-total">Stopwatch</span>
                                </div>
                            </div>
                        `;
                    } else {
                        if (w.remainingSeconds !== null && w.remainingSeconds <= 0) rowClasses.push('completed');

                        const wRemaining = w.remainingSeconds !== null ? w.remainingSeconds : parseTime(w.time);
                        const wOnTheClock = isWitnessActive && (isRunning || isPaused);

                        witnessRowsHtml += `
                            <div class="${rowClasses.join(' ')}" data-witness-id="${w.id}">
                                <div class="widget-name">${wLinkIcon}${escapeHtml(w.name)}</div>
                                <div class="widget-times">
                                    <span class="${widgetTimeClass(wRemaining)}">${formatTime(wRemaining)}</span>
                                    <span class="widget-total">${escapeHtml(w.time)}</span>
                                </div>
                                ${widgetElapsedHtml(w, wRemaining, wOnTheClock)}
                            </div>
                        `;
                    }
                });

                widget.innerHTML = `
                    <div class="widget-block-header">
                        <div class="widget-name">${escapeHtml(block.name)}<span class="widget-expand-icon">${ICON_CHEVRON}</span></div>
                        <div class="widget-times">
                            <span class="${widgetTimeClass(remaining)}">${formatTime(remaining)}</span>
                            <span class="widget-total">${escapeHtml(block.time)}</span>
                        </div>
                        ${widgetElapsedHtml(block, remaining, false)}
                    </div>
                    <div class="witness-widget-list">${witnessRowsHtml}</div>
                `;

                widget.querySelector('.widget-block-header').addEventListener('click', () => {
                    if (expandedBlocks.has(expandKey)) expandedBlocks.delete(expandKey);
                    else expandedBlocks.add(expandKey);
                    renderWidgets();
                });

                widget.querySelectorAll('.witness-widget-row').forEach(row => {
                    row.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectBlock(block.id, block.team, parseInt(row.dataset.witnessId));
                    });
                });
            } else {
                if (isBlockActive) widget.classList.add('active');

                if (currentEntity && currentEntity.linked === block.id && block.team !== currentTeam) {
                    widget.classList.add('linked-highlight');
                }

                if (block.remainingSeconds !== null && block.remainingSeconds <= 0) {
                    widget.classList.add('completed');
                }

                const remaining = block.remainingSeconds !== null ? block.remainingSeconds : parseTime(block.time);
                const linkIcon = block.linked && timedRulingMode ? `<span class="link-icon">${ICON_LINK}</span>` : '';
                const onTheClock = isBlockActive && (isRunning || isPaused);

                widget.innerHTML = `
                    <div class="widget-name">${linkIcon}${escapeHtml(block.name)}</div>
                    <div class="widget-times">
                        <span class="${widgetTimeClass(remaining)}">${formatTime(remaining)}</span>
                        <span class="widget-total">${escapeHtml(block.time)}</span>
                    </div>
                    ${widgetElapsedHtml(block, remaining, onTheClock)}
                `;

                widget.addEventListener('click', () => selectBlock(block.id, block.team));
            }

            if (team === 'left') {
                leftWidgets.appendChild(widget);
            } else {
                rightWidgets.appendChild(widget);
            }
        });
    });
}

function selectBlock(blockId, team, witnessId) {
    if (isRunning || isPaused) {
        fullStop();
    }
    currentBlockId = blockId;
    currentTeam = team;
    currentWitnessId = witnessId != null ? witnessId : null;
    loadBlock();
    saveTimerSession();
}

function loadBlock() {
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);
    if (!block) return;
    const entity = getCurrentTimeable();
    if (!entity) return;

    const hasWitnesses = block.witnesses && block.witnesses.length > 0;
    const stopwatch = hasWitnesses && witnessMode === 'stopwatch';
    timeRemaining = getEntityValue(entity, stopwatch);
    if (!stopwatch && entity.remainingSeconds === null) entity.remainingSeconds = timeRemaining;

    const witnessSuffix = hasWitnesses ? ` — ${entity.name}` : '';
    currentBlockName.textContent = `${currentTeam === 'left' ? leftTeamName : rightTeamName} - ${block.name}${witnessSuffix}`;
    countdown.textContent = formatTime(timeRemaining);
    updateCountdownColor();
    timeLabel.textContent = stopwatch ? 'Elapsed Time' : 'Time Remaining';
    secondaryTimer.classList.remove('visible');

    startBtn.style.display = 'inline-block';
    startBtn.textContent = isStopped ? 'Restart' : 'Start';
    startBtn.className = 'bench-btn bench-btn-primary';
    stopBtn.style.display = 'none';

    const currentIndex = blocks[currentTeam].findIndex(b => b.id === currentBlockId);
    const hasNextWitness = hasWitnesses &&
        block.witnesses.findIndex(w => w.id === currentWitnessId) < block.witnesses.length - 1;
    nextBtn.style.display = (hasNextWitness || currentIndex < blocks[currentTeam].length - 1) ? 'inline-block' : 'none';

    const pauseButtons = document.querySelectorAll('.pause-btn');
    pauseButtons.forEach(btn => btn.remove());

    renderWidgets();
    setMobileView(currentTeam);
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    isPaused = false;
    isStopped = false;
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

    timerInterval = setInterval(() => {
        const entity = getCurrentTimeable();
        const stopwatch = isCurrentStopwatch();

        timeRemaining = stopwatch ? timeRemaining + 1 : timeRemaining - 1;
        setEntityValue(entity, stopwatch, timeRemaining);

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
        // Timed Ruling Mode links witnesses directly to their opposing-side
        // counterpart, in both Allocated and Total Time mode, via the
        // witness's own `.linked` (set by the Copy Witnesses dialog). A
        // plain block with no witnesses still links block-to-block via its
        // own `.linked`, exactly as before witnesses existed. An unlinked
        // witness/block just doesn't get an Overrule option — Sustain is
        // always available regardless.
        const linkSource = getCurrentTimeable();
        const linked = getLinkedTimeable(linkSource, currentTeam);

        const deductBtn = document.createElement('button');
        deductBtn.className = 'bench-btn bench-btn-danger pause-btn';
        deductBtn.textContent = 'Sustain Objection (Deduct from Time)';
        deductBtn.addEventListener('click', resumeWithDeduction);
        mainControls.appendChild(deductBtn);

        if (linked) {
            const target = resolveLinkedDeductionTarget(linked);
            const deductLinkedBtn = document.createElement('button');
            deductLinkedBtn.className = 'bench-btn bench-btn-danger pause-btn';
            deductLinkedBtn.textContent = `Overrule Objection (Deduct from ${target.name})`;
            deductLinkedBtn.addEventListener('click', resumeWithLinkedDeduction);
            mainControls.appendChild(deductLinkedBtn);
        }
    }

    const discardBtn = document.createElement('button');
    discardBtn.className = 'bench-btn bench-btn-secondary pause-btn';
    discardBtn.textContent = 'Resume';
    discardBtn.addEventListener('click', resumeWithoutDeduction);
    mainControls.appendChild(discardBtn);
}

function resumeWithDeduction() {
    const block = getCurrentParentBlock();
    const entity = getCurrentTimeable();
    const hasWitnesses = block && block.witnesses && block.witnesses.length > 0;

    if (isCurrentStopwatch()) {
        // Total Time: the block's real countdown absorbs the pause. The
        // witness's own stopwatch also kept running for real time while
        // paused — it wasn't stopped, just not displayed — so deducting
        // (as opposed to discarding via plain Resume) rolls that dead time
        // into it too.
        if (block) block.remainingSeconds = getBlockRemaining(block) - pauseElapsed;
        timeRemaining = originalTimeBeforePause + pauseElapsed;
        if (entity) entity.elapsedSeconds = timeRemaining;
    } else {
        timeRemaining = originalTimeBeforePause - pauseElapsed;
        if (entity) entity.remainingSeconds = timeRemaining;
        // Allocated: a witness's own deduction also comes out of the
        // block's derived total, so the superblock reflects it too.
        if (hasWitnesses) {
            block.remainingSeconds = getBlockRemaining(block) - pauseElapsed;
        }
    }
    resumeTimer();
}

function resumeWithLinkedDeduction() {
    const linkSource = getCurrentTimeable();
    const linked = getLinkedTimeable(linkSource, currentTeam);

    if (linked) {
        const target = resolveLinkedDeductionTarget(linked);
        const targetRemaining = target.remainingSeconds !== null ? target.remainingSeconds : parseTime(target.time);
        target.remainingSeconds = targetRemaining - pauseElapsed;

        if (linked.isWitness) {
            if (witnessMode === 'stopwatch') {
                // Total Time: the target above is the parent block. The
                // specific linked witness's own stopwatch reflects the same
                // dead time too, so its row stays consistent with the
                // block header it belongs to.
                const w = linked.item;
                w.elapsedSeconds = (w.elapsedSeconds || 0) + pauseElapsed;
            } else {
                // Allocated: the target above is the witness itself. Its
                // parent block's derived total reflects the loss too.
                const pBlock = linked.parentBlock;
                pBlock.remainingSeconds = getBlockRemaining(pBlock) - pauseElapsed;
            }
        }
    }

    // The current witness/block's own clock still reflects the real time
    // that passed during the pause — same stopwatch-bump reasoning as
    // resumeWithDeduction.
    if (isCurrentStopwatch()) {
        timeRemaining = originalTimeBeforePause + pauseElapsed;
        const entity = getCurrentTimeable();
        if (entity) entity.elapsedSeconds = timeRemaining;
    } else {
        timeRemaining = originalTimeBeforePause;
        const entity = getCurrentTimeable();
        if (entity) entity.remainingSeconds = timeRemaining;
    }
    resumeTimer();
}

function resumeWithoutDeduction() {
    timeRemaining = originalTimeBeforePause;
    if (!isCurrentStopwatch()) {
        const entity = getCurrentTimeable();
        if (entity) entity.remainingSeconds = timeRemaining;
    }
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

function fullStop() {
    // nextBlock() calls this unconditionally, even on a block that was never
    // started — only mark it "stopped" if it was actually running/paused,
    // so navigating past an untouched block doesn't fake a stop.
    if (isRunning || isPaused) {
        const entity = getCurrentTimeable();
        if (entity) entity.stopped = true;
    }

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
    // A witness-bearing block is exhausted witness-by-witness before moving
    // on to the next actual block.
    const block = blocks[currentTeam].find(b => b.id === currentBlockId);
    if (block && block.witnesses && block.witnesses.length) {
        const wIndex = block.witnesses.findIndex(w => w.id === currentWitnessId);
        if (wIndex !== -1 && wIndex < block.witnesses.length - 1) {
            fullStop();
            selectBlock(block.id, currentTeam, block.witnesses[wIndex + 1].id);
            saveTimerSession();
            return;
        }
    }

    const currentIndex = blocks[currentTeam].findIndex(b => b.id === currentBlockId);
    if (currentIndex < blocks[currentTeam].length - 1) {
        const next = blocks[currentTeam][currentIndex + 1];
        fullStop();
        selectBlock(next.id, currentTeam);
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
    const entity = getCurrentTimeable();
    const stopwatch = isCurrentStopwatch();
    if (entity) {
        timeRemaining = stopwatch ? 0 : parseTime(entity.time);
        setEntityValue(entity, stopwatch, timeRemaining);
        entity.stopped = false;

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
    const entity = getCurrentTimeable();

    if (entity) {
        timeRemaining = seconds;
        setEntityValue(entity, isCurrentStopwatch(), timeRemaining);

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
    const entity = getCurrentTimeable();
    if (entity) {
        timeRemaining += seconds;
        setEntityValue(entity, isCurrentStopwatch(), timeRemaining);

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
        left: blockTemplates.map(t => ({ ...t, team: 'left', remainingSeconds: null, stopped: false, witnesses: initWitnessRuntime(t, 'left') })),
        right: blockTemplates.map(t => ({ ...t, team: 'right', remainingSeconds: null, stopped: false, witnesses: initWitnessRuntime(t, 'right') }))
    };
}

// Confirmation dialog for Return to Atrium
const confirmOverlay = document.getElementById('confirm-overlay');
document.querySelector('.bench-atrium-link').addEventListener('click', (e) => {
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
        witnessMode: witnessMode,
        description: descInput ? descInput.value.trim() : '',
        blocks: blockTemplates,
        timerState: {
            blocks: blocks,
            currentBlockId: currentBlockId,
            currentTeam: currentTeam,
            currentWitnessId: currentWitnessId
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
            witnessMode: witnessMode,
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
    selectBlock(resumeState.timerState.currentBlockId, resumeState.timerState.currentTeam, resumeState.timerState.currentWitnessId);
} else {
    selectBlock(blocks.left[0].id, 'left');
}