import { parseTime } from '../shared/time.js';
import { state } from './state.js';

// Resolves whichever entity the bench is actually running a timer for right
// now: the selected witness if the current block has any, else the block
// itself. Defaults currentWitnessId to the block's first witness if unset
// or stale (e.g. right after switching to a block with witnesses).
export function getCurrentTimeable() {
    const block = state.blocks[state.currentTeam] && state.blocks[state.currentTeam].find(b => b.id === state.currentBlockId);
    if (!block) return null;
    if (block.witnesses && block.witnesses.length) {
        let witness = block.witnesses.find(w => w.id === state.currentWitnessId);
        if (!witness) {
            witness = block.witnesses[0];
            state.currentWitnessId = witness.id;
        }
        return witness;
    }
    state.currentWitnessId = null;
    return block;
}

// Generalizes "find the linked block on the other side" to also search
// witnesses nested inside the opposite team's blocks, since a witness's
// `linked` id refers to another witness, not a block. Returns null if
// unlinked, else { item, parentBlock, isWitness } — `item` is the linked
// witness/block itself, `parentBlock` is its containing block (equal to
// `item` when it's not a witness) — see resolveLinkedDeductionTarget.
export function getLinkedTimeable(entity, team) {
    if (!entity || entity.linked == null) return null;
    const oppositeTeam = team === 'left' ? 'right' : 'left';
    for (const b of state.blocks[oppositeTeam]) {
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
export function getBlockRemaining(block) {
    return block.remainingSeconds !== null ? block.remainingSeconds : parseTime(block.time);
}

// A linked witness has no real budget of its own in Total Time mode (it's
// just a stopwatch) — the deduction actually has to land on its parent
// block, the only real budget that mode has. Allocated-mode witnesses, and
// plain blocks, take the deduction directly. Named `target` because this is
// also what the "Overrule Objection" button names — the superblock in
// Total Time mode, the witness itself in Allocated mode.
export function resolveLinkedDeductionTarget(linked) {
    if (!linked) return null;
    return (linked.isWitness && state.witnessMode === 'stopwatch') ? linked.parentBlock : linked.item;
}

export function getCurrentParentBlock() {
    return state.blocks[state.currentTeam] && state.blocks[state.currentTeam].find(b => b.id === state.currentBlockId);
}

// Stopwatch-mode witnesses have no time budget: they count up from zero
// instead of down. Timed Ruling Mode still links witness-to-witness in this
// mode (see getLinkedTimeable), but the actual deduction lands on the
// linked witness's parent block instead of the witness itself, since only
// the block has a real budget to take from (see showPauseButtons).
export function isCurrentStopwatch() {
    const block = getCurrentParentBlock();
    return !!(block && block.witnesses && block.witnesses.length && state.witnessMode === 'stopwatch');
}

export function getEntityValue(entity, stopwatch) {
    if (!entity) return 0;
    if (stopwatch) return entity.elapsedSeconds || 0;
    return entity.remainingSeconds !== null ? entity.remainingSeconds : parseTime(entity.time);
}

export function setEntityValue(entity, stopwatch, value) {
    if (!entity) return;
    if (stopwatch) entity.elapsedSeconds = value;
    else entity.remainingSeconds = value;
}
