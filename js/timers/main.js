import '../shared/changelog.js';
import { state, savedSessionData, resumeId, resumeState, saveTimerSession } from './state.js';
import { loadBlock, selectBlock } from './controls.js';
import { initMobileTabLabels } from './mobile-view.js';
import './trial-clock.js';

// Set team names
document.getElementById('left-team-name').textContent = state.leftTeamName;
document.getElementById('right-team-name').textContent = state.rightTeamName;
initMobileTabLabels(state.leftTeamName, state.rightTeamName);

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
    selectBlock(state.blocks.left[0].id, 'left');
}
