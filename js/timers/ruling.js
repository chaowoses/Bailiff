import { parseTime } from '../shared/time.js';
import { state } from './state.js';
import {
    getCurrentTimeable, getLinkedTimeable, getBlockRemaining, resolveLinkedDeductionTarget,
    getCurrentParentBlock, isCurrentStopwatch
} from './engine.js';
// See controls.js for why this circular import (ruling.js <-> controls.js) is safe.
import { resumeTimer } from './controls.js';

export function showPauseButtons() {
    const existingPauseButtons = document.querySelectorAll('.pause-btn');
    existingPauseButtons.forEach(btn => btn.remove());

    const mainControls = document.querySelector('.bench-main-controls');

    if (state.timedRulingMode) {
        // Timed Ruling Mode links witnesses directly to their opposing-side
        // counterpart, in both Allocated and Total Time mode, via the
        // witness's own `.linked` (set by the Copy Witnesses dialog). A
        // plain block with no witnesses still links block-to-block via its
        // own `.linked`, exactly as before witnesses existed. An unlinked
        // witness/block just doesn't get an Overrule option — Sustain is
        // always available regardless.
        const linkSource = getCurrentTimeable();
        const linked = getLinkedTimeable(linkSource, state.currentTeam);

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

export function resumeWithDeduction() {
    const block = getCurrentParentBlock();
    const entity = getCurrentTimeable();
    const hasWitnesses = block && block.witnesses && block.witnesses.length > 0;

    if (isCurrentStopwatch()) {
        // Total Time: the block's real countdown absorbs the pause. The
        // witness's own stopwatch also kept running for real time while
        // paused — it wasn't stopped, just not displayed — so deducting
        // (as opposed to discarding via plain Resume) rolls that dead time
        // into it too.
        if (block) block.remainingSeconds = getBlockRemaining(block) - state.pauseElapsed;
        state.timeRemaining = state.originalTimeBeforePause + state.pauseElapsed;
        if (entity) entity.elapsedSeconds = state.timeRemaining;
    } else {
        state.timeRemaining = state.originalTimeBeforePause - state.pauseElapsed;
        if (entity) entity.remainingSeconds = state.timeRemaining;
        // Allocated: a witness's own deduction also comes out of the
        // block's derived total, so the superblock reflects it too.
        if (hasWitnesses) {
            block.remainingSeconds = getBlockRemaining(block) - state.pauseElapsed;
        }
    }
    resumeTimer();
}

export function resumeWithLinkedDeduction() {
    const linkSource = getCurrentTimeable();
    const linked = getLinkedTimeable(linkSource, state.currentTeam);

    if (linked) {
        const target = resolveLinkedDeductionTarget(linked);
        const targetRemaining = target.remainingSeconds !== null ? target.remainingSeconds : parseTime(target.time);
        target.remainingSeconds = targetRemaining - state.pauseElapsed;

        if (linked.isWitness) {
            if (state.witnessMode === 'stopwatch') {
                // Total Time: the target above is the parent block. The
                // specific linked witness's own stopwatch reflects the same
                // dead time too, so its row stays consistent with the
                // block header it belongs to.
                const w = linked.item;
                w.elapsedSeconds = (w.elapsedSeconds || 0) + state.pauseElapsed;
            } else {
                // Allocated: the target above is the witness itself. Its
                // parent block's derived total reflects the loss too.
                const pBlock = linked.parentBlock;
                pBlock.remainingSeconds = getBlockRemaining(pBlock) - state.pauseElapsed;
            }
        }
    }

    // The current witness/block's own clock still reflects the real time
    // that passed during the pause — same stopwatch-bump reasoning as
    // resumeWithDeduction.
    if (isCurrentStopwatch()) {
        state.timeRemaining = state.originalTimeBeforePause + state.pauseElapsed;
        const entity = getCurrentTimeable();
        if (entity) entity.elapsedSeconds = state.timeRemaining;
    } else {
        state.timeRemaining = state.originalTimeBeforePause;
        const entity = getCurrentTimeable();
        if (entity) entity.remainingSeconds = state.timeRemaining;
    }
    resumeTimer();
}

export function resumeWithoutDeduction() {
    state.timeRemaining = state.originalTimeBeforePause;
    if (!isCurrentStopwatch()) {
        const entity = getCurrentTimeable();
        if (entity) entity.remainingSeconds = state.timeRemaining;
    }
    resumeTimer();
}
