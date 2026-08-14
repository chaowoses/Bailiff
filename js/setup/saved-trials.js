import { escapeHtml } from '../shared/dom-utils.js';
import { ICON_SCALES, ICON_INFO, ICON_WITNESS } from './icons.js';
import { showDeleteConfirm } from './dialogs.js';
import { openExportDialog } from './export.js';

const SAVED_TRIALS_KEY = 'bailiff_saved_trials';

// ===== SAVED TRIALS =====
export function getSavedTrials() {
    try {
        return JSON.parse(localStorage.getItem(SAVED_TRIALS_KEY)) || [];
    } catch { return []; }
}

export function saveSavedTrials(trials) {
    localStorage.setItem(SAVED_TRIALS_KEY, JSON.stringify(trials));
}

export function launchTrial(trialId) {
    const trials = getSavedTrials();
    const trial = trials.find(t => t.id === trialId);
    if (!trial || !trial.timerState) return;

    localStorage.setItem('bailiff_resume', JSON.stringify(trial));
    window.location.href = 'timers.html?resume=' + trialId;
}

// Autosave launch also preserves sessionId
// (handled inline in renderSavedTrials)

export function deleteSavedTrial(trialId) {
    let trials = getSavedTrials();
    trials = trials.filter(t => t.id !== trialId);
    saveSavedTrials(trials);
    renderSavedTrials();
}

export function clearAllSavedTrials() {
    saveSavedTrials([]);
    localStorage.removeItem('bailiff_autosave');
    renderSavedTrials();
}

let pendingDescEditId = null;

export function editSavedTrialDescription(trialId) {
    const trials = getSavedTrials();
    const trial = trials.find(t => t.id === trialId);
    if (!trial) return;
    pendingDescEditId = trialId;
    document.getElementById('desc-edit-input').value = trial.description || '';
    document.getElementById('desc-edit-overlay').classList.remove('hidden');
    document.getElementById('desc-edit-input').focus();
}

document.getElementById('desc-edit-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('desc-edit-save').click();
    }
});

document.getElementById('desc-edit-cancel').addEventListener('click', () => {
    pendingDescEditId = null;
    document.getElementById('desc-edit-overlay').classList.add('hidden');
});

document.getElementById('desc-edit-save').addEventListener('click', () => {
    if (!pendingDescEditId) return;
    const trials = getSavedTrials();
    const trial = trials.find(t => t.id === pendingDescEditId);
    if (trial) {
        trial.description = document.getElementById('desc-edit-input').value.trim();
        saveSavedTrials(trials);
        renderSavedTrials();
    }
    pendingDescEditId = null;
    document.getElementById('desc-edit-overlay').classList.add('hidden');
});

document.getElementById('desc-edit-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('desc-edit-overlay')) {
        pendingDescEditId = null;
        document.getElementById('desc-edit-overlay').classList.add('hidden');
    }
});

export function renderSavedTrials() {
    const list = document.getElementById('saved-trials-list');
    let trials = getSavedTrials();

    // Sort chronologically (newest first)
    trials.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    // Check for autosave
    let autosave = null;
    try {
        autosave = JSON.parse(localStorage.getItem('bailiff_autosave'));
    } catch {}

    if (!autosave && trials.length === 0) {
        list.innerHTML = '<div class="saved-trials-empty">No saved trials yet. Save your progress from the timer to see it here.</div>';
        return;
    }

    let html = '';

    if (autosave) {
        html += '<div class="saved-trial-card saved-trial-autosave">' +
            '<div class="saved-trial-info">' +
                '<div class="saved-trial-name">' + escapeHtml(autosave.name) + ' <span class="saved-trial-badge">Auto-saved</span></div>' +
                '<div class="saved-trial-date">Continue from your last session</div>' +
            '</div>' +
            '<div class="saved-trial-actions">' +
                '<button class="saved-trial-launch" data-autosave="1">Launch</button>' +
                '<button class="saved-trial-delete" data-autosave="1">Dismiss</button>' +
            '</div>' +
        '</div>';
    }

    trials.forEach(t => {
        const hasProgress = t.timerState;
        let progressHtml = '';
        if (hasProgress && t.timerState.currentBlockId && t.timerState.currentTeam) {
            const team = t.timerState.currentTeam;
            const blockArr = t.timerState.blocks ? t.timerState.blocks[team] : null;
            if (blockArr) {
                const block = blockArr.find(b => b.id === t.timerState.currentBlockId);
                if (block) {
                    const witness = (block.witnesses && t.timerState.currentWitnessId != null)
                        ? block.witnesses.find(w => w.id === t.timerState.currentWitnessId)
                        : null;

                    let secs;
                    if (witness) {
                        secs = t.witnessMode === 'stopwatch'
                            ? (witness.elapsedSeconds || 0)
                            : (witness.remainingSeconds != null ? witness.remainingSeconds : 0);
                    } else {
                        secs = block.remainingSeconds != null ? block.remainingSeconds : 0;
                    }

                    const isOvertime = secs < 0;
                    const absSecs = Math.abs(secs);
                    const mins = Math.floor(absSecs / 60);
                    const secsDisplay = absSecs % 60;
                    const timeStr = String(mins).padStart(2, '0') + ':' + String(secsDisplay).padStart(2, '0') + (isOvertime ? ' overtime' : '');
                    const sideLabel = team === 'left' ? (t.plaintiff || 'Plaintiff') : (t.defense || 'Defense');
                    const entityLabel = witness ? (block.name + ': ' + witness.name) : block.name;
                    progressHtml = '<div class="saved-trial-progress' + (isOvertime ? ' saved-trial-progress--overtime' : '') + '">' + escapeHtml(sideLabel) + ' &mdash; ' + escapeHtml(entityLabel) + ' &middot; ' + timeStr + '</div>';
                }
            }
        }

        const descHtml = t.description ? '<div class="saved-trial-desc">' + escapeHtml(t.description) + '</div>' : '';
        const trBadge = (t.timedRulingMode || t.advancedMode) ? '<span class="saved-trial-badge tr-mode-badge">' + ICON_SCALES + 'Timed Ruling Mode<span class="badge-info-icon">' + ICON_INFO + '</span></span>' : '';
        const hasAnyWitnesses = Array.isArray(t.blocks) && t.blocks.some(b => Array.isArray(b.witnesses) && b.witnesses.length > 0);
        const witnessModeBadge = hasAnyWitnesses
            ? '<span class="saved-trial-badge">' + ICON_WITNESS + (t.witnessMode === 'stopwatch' ? 'Total Time' : 'Allocated Time') + '</span>'
            : '';
        html += '<div class="saved-trial-card">' +
            '<div class="saved-trial-info">' +
                '<div class="saved-trial-name">' + escapeHtml(t.name) + trBadge + witnessModeBadge + '</div>' +
                descHtml +
                '<div class="saved-trial-date">' + new Date(t.savedAt).toLocaleDateString() + ' ' + new Date(t.savedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + '</div>' +
                progressHtml +
            '</div>' +
            '<div class="saved-trial-actions">' +
                (hasProgress ? '<button class="saved-trial-launch" data-id="' + t.id + '">Launch</button>' : '') +
                '<button class="saved-trial-edit saved-trial-export-btn" data-id="' + t.id + '" title="Export this trial">Export</button>' +
                '<button class="saved-trial-edit saved-trial-edit-desc" data-id="' + t.id + '" title="Edit description">Edit</button>' +
                '<button class="saved-trial-delete saved-trial-delete-trial" data-id="' + t.id + '">Delete</button>' +
            '</div>' +
        '</div>';
    });

    list.innerHTML = html;

    // Launch autosave
    list.querySelectorAll('[data-autosave="1"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('saved-trial-launch')) {
                window.location.href = 'timers.html?resume=autosave';
            } else {
                localStorage.removeItem('bailiff_autosave');
                renderSavedTrials();
            }
        });
    });

    list.querySelectorAll('.saved-trial-launch:not([data-autosave])').forEach(btn => {
        btn.addEventListener('click', () => launchTrial(btn.dataset.id));
    });
    list.querySelectorAll('.saved-trial-export-btn').forEach(btn => {
        btn.addEventListener('click', () => openExportDialog(btn.dataset.id));
    });
    list.querySelectorAll('.saved-trial-edit-desc').forEach(btn => {
        btn.addEventListener('click', () => editSavedTrialDescription(btn.dataset.id));
    });
    list.querySelectorAll('.saved-trial-delete-trial').forEach(btn => {
        btn.addEventListener('click', () => showDeleteConfirm(
            'Delete this saved trial?',
            'This trial will be permanently removed and cannot be resumed.',
            () => deleteSavedTrial(btn.dataset.id)
        ));
    });
}

document.getElementById('clear-trials-btn').addEventListener('click', () => {
    const trials = getSavedTrials();
    const hasAutosave = (() => { try { return !!JSON.parse(localStorage.getItem('bailiff_autosave')); } catch { return false; } })();
    if (trials.length === 0 && !hasAutosave) return;
    showDeleteConfirm(
        'Clear all saved trials?',
        'This will permanently remove all saved trials and auto-saves. This cannot be undone.',
        () => { clearAllSavedTrials(); },
        'Clear All'
    );
});
