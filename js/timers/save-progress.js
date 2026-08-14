import { state, resumeState, clearTimerSession } from './state.js';

// Autosave — periodically save progress
const AUTOSAVE_INTERVAL = 30000;
let autosaveTimer = null;

export function startAutosave() {
    stopAutosave();
    autosaveTimer = setInterval(() => {
        if (!state.currentTeam || !state.currentBlockId) return;
        const autosave = {
            sessionId: state.sessionId,
            id: 'autosave',
            name: state.leftTeamName + ' v. ' + state.rightTeamName,
            savedAt: new Date().toISOString(),
            plaintiff: state.leftTeamName,
            defense: state.rightTeamName,
            timedRulingMode: state.timedRulingMode,
            witnessMode: state.witnessMode,
            blocks: state.blockTemplates,
            timerState: {
                blocks: state.blocks,
                currentBlockId: state.currentBlockId,
                currentTeam: state.currentTeam,
                startTime: state.startTime
            }
        };
        localStorage.setItem('bailiff_autosave', JSON.stringify(autosave));
    }, AUTOSAVE_INTERVAL);
}

export function stopAutosave() {
    if (autosaveTimer) {
        clearInterval(autosaveTimer);
        autosaveTimer = null;
    }
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
        t.sessionId === state.sessionId ||
        (t.id && resumeState && t.id === resumeState.id)
    );
    const descInput = document.getElementById('save-desc-input');
    const trial = {
        sessionId: state.sessionId,
        id: existingIdx !== -1 ? trials[existingIdx].id : 'trial-' + Date.now(),
        name: state.leftTeamName + ' v. ' + state.rightTeamName,
        savedAt: new Date().toISOString(),
        plaintiff: state.leftTeamName,
        defense: state.rightTeamName,
        timedRulingMode: state.timedRulingMode,
        witnessMode: state.witnessMode,
        description: descInput ? descInput.value.trim() : '',
        blocks: state.blockTemplates,
        timerState: {
            blocks: state.blocks,
            currentBlockId: state.currentBlockId,
            currentTeam: state.currentTeam,
            currentWitnessId: state.currentWitnessId,
            startTime: state.startTime
        }
    };
    if (existingIdx !== -1) {
        trials[existingIdx] = trial;
    } else {
        trials.unshift(trial);
    }
    localStorage.setItem('bailiff_saved_trials', JSON.stringify(trials));
    localStorage.removeItem('bailiff_autosave');
    clearTimerSession();
    window.location.href = 'index.html';
});

confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) {
        confirmOverlay.classList.add('hidden');
    }
});
