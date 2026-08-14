import '../shared/changelog.js';
import { pNameInput, dNameInput, timedRulingToggle } from './dom.js';
import { state, restoreSetupSession, clearSetupSession } from './state.js';
import { updateLinkVisibility, renderBlocks } from './blocks.js';
import { renderSavedTrials } from './saved-trials.js';
import { renderPresets } from './presets.js';
import { FAMOUS_CASES } from './cases.js';

// witness-copy.js and import.js wire up their own DOM event listeners at
// module-evaluation time and are never imported by any other module (unlike
// e.g. witnesses.js or export.js, which get pulled in transitively through
// blocks.js / saved-trials.js) — so they need an explicit boot import here
// or their listeners would never register.
import './witness-copy.js';
import './import.js';

document.getElementById("start-trial-btn").addEventListener("click", () => {
    if (state.blocks.length === 0) {
        alert('Please add at least one block before starting the trial.');
        return;
    }

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

restoreSetupSession();
document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.globalWitnessMode);
});
updateLinkVisibility();
renderBlocks();
renderSavedTrials();
renderPresets();
setPlaceholderCase();
