import '../shared/changelog.js';
import { pNameInput, dNameInput, timedRulingToggle } from './dom.js';
import { state, restoreSetupSession, clearSetupSession } from './state.js';
import { updateLinkVisibility, renderBlocks } from './blocks.js';
import { renderSavedTrials } from './saved-trials.js';
import { renderPresets, loadPreset } from './presets.js';
import { FAMOUS_CASES } from './cases.js';
import { witnessSideTotals, formatSeconds } from './witnesses.js';
import { showDeleteConfirm } from './dialogs.js';

// witness-copy.js and import.js wire up their own DOM event listeners at
// module-evaluation time and are never imported by any other module (unlike
// e.g. witnesses.js or export.js, which get pulled in transitively through
// blocks.js / saved-trials.js) — so they need an explicit boot import here
// or their listeners would never register.
import './witness-copy.js';
import './import.js';

// Each side gets its own copy of a witness-bearing block's Time as its own
// starting budget (see witnessSideTotals in witnesses.js) — if the two
// sides' witnesses don't add up to the same total, one side is either
// short-changed or padded, so catch it here rather than mid-trial.
function findUnevenAllocatedBlocks() {
    if (state.globalWitnessMode !== 'allocated') return [];
    return state.blocks
        .filter(b => b.witnesses && b.witnesses.length)
        .map(b => ({ block: b, totals: witnessSideTotals(b.witnesses) }))
        .filter(({ totals }) => !totals.even);
}

function startTrial() {
    const leftTeam = pNameInput.value || 'Plaintiff';
    const rightTeam = dNameInput.value || 'Defense';
    const trMode = timedRulingToggle.checked;

    const params = new URLSearchParams({
        leftTeam,
        rightTeam,
        advanced: trMode.toString(),
        witnessMode: state.globalWitnessMode,
        blocks: encodeURIComponent(JSON.stringify(state.blocks))
    });

    clearSetupSession();
    sessionStorage.removeItem('bailiff_timer_session');
    window.location.href = `timers.html?${params.toString()}`;
}

document.getElementById("start-trial-btn").addEventListener("click", () => {
    if (state.blocks.length === 0) {
        alert('Please add at least one block before starting the trial.');
        return;
    }

    const uneven = findUnevenAllocatedBlocks();
    if (uneven.length > 0) {
        const names = uneven.map(({ block, totals }) =>
            '"' + block.name + '" (P: ' + formatSeconds(totals.left) + ', D: ' + formatSeconds(totals.right) + ')'
        ).join(', ');
        showDeleteConfirm(
            'Uneven Witness Times',
            'Plaintiff and Defense witness times don’t match in ' + names + '. Each side gets the same block budget, so the longer side may run out of time. Go back and fix it, or start anyway.',
            startTrial,
            'Start Anyway',
            null,
            'confirm-leave'
        );
        return;
    }

    startTrial();
});

// Info dialogs
const trModeOverlay = document.getElementById('tr-mode-info-overlay');

document.getElementById('tr-mode-info').addEventListener('click', () => {
    trModeOverlay.classList.remove('hidden');
});

document.getElementById('tr-mode-info-ok').addEventListener('click', () => {
    trModeOverlay.classList.add('hidden');
});

trModeOverlay.addEventListener('click', (e) => {
    if (e.target === trModeOverlay) {
        trModeOverlay.classList.add('hidden');
    }
});

const witnessModeOverlay = document.getElementById('witness-mode-info-overlay');

document.getElementById('witness-mode-info').addEventListener('click', () => {
    witnessModeOverlay.classList.remove('hidden');
});

document.getElementById('witness-mode-info-ok').addEventListener('click', () => {
    witnessModeOverlay.classList.add('hidden');
});

witnessModeOverlay.addEventListener('click', (e) => {
    if (e.target === witnessModeOverlay) {
        witnessModeOverlay.classList.add('hidden');
    }
});

// Delegate badge info clicks (badges are re-rendered)
document.addEventListener('click', (e) => {
    const badgeInfo = e.target.closest('.badge-info-icon');
    if (badgeInfo) {
        trModeOverlay.classList.remove('hidden');
    }
});

function setPlaceholderCase() {
    if (FAMOUS_CASES.length === 0) return;
    const randomCase = FAMOUS_CASES[Math.floor(Math.random() * FAMOUS_CASES.length)];
    pNameInput.placeholder = randomCase.p;
    dNameInput.placeholder = randomCase.d;
}

// No saved in-progress session (first visit, or after starting/clearing a
// trial) means there's nothing to restore — default to the VLRE preset
// instead of leaving the bare state.js scaffold blocks in place.
if (restoreSetupSession()) {
    document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === state.globalWitnessMode);
    });
    updateLinkVisibility();
    renderBlocks();
} else {
    loadPreset('preset-vlre');
}
renderSavedTrials();
renderPresets();
setPlaceholderCase();
