export const state = {
    blocks: [
        { id: 1, name: "Opening Statement", time: "05:00", linked: null, witnesses: [] },
        { id: 2, name: "Direct Examination", time: "25:00", linked: 3, witnesses: [] },
        { id: 3, name: "Cross Examination", time: "20:00", linked: 2, witnesses: [] },
        { id: 4, name: "Closing Argument", time: "05:00", linked: null, witnesses: [] }
    ],
    // Blocks AND witnesses share this one counter (not just blocks) — a
    // witness's `linked` id needs to be resolved without knowing in advance
    // whether it points at a block or a witness, so the two id spaces must
    // never collide.
    nextId: 5,
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
