// blocks/nextId/globalWitnessMode start empty — main.js always overwrites
// them before the first render, either from a restored session or (with
// nothing to restore) by loading the VLRE preset, so there's no scaffold
// left sitting here to fall out of sync with either of those.
export const state = {
    blocks: [],
    // Blocks AND witnesses share this one counter (not just blocks) — a
    // witness's `linked` id needs to be resolved without knowing in advance
    // whether it points at a block or a witness, so the two id spaces must
    // never collide.
    nextId: 1,
    globalWitnessMode: 'allocated',
    currentEditingId: null
};

const SS_SESSION_KEY = 'bailiff_setup_session';

export function saveSetupSession() {
    try {
        sessionStorage.setItem(SS_SESSION_KEY, JSON.stringify({
            blocks: state.blocks, nextId: state.nextId, witnessMode: state.globalWitnessMode
        }));
    } catch {}
}

export function restoreSetupSession() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(SS_SESSION_KEY));
        if (saved) {
            state.blocks = saved.blocks;
            state.nextId = saved.nextId != null ? saved.nextId : (saved.nextBlockId || 1);
            state.globalWitnessMode = saved.witnessMode || 'allocated';
            return true;
        }
    } catch {}
    return false;
}

export function clearSetupSession() {
    sessionStorage.removeItem(SS_SESSION_KEY);
}

export function highestUsedId(blockArr) {
    let max = 0;
    blockArr.forEach(b => {
        if (b.id > max) max = b.id;
        (b.witnesses || []).forEach(w => { if (w.id > max) max = w.id; });
    });
    return max;
}
