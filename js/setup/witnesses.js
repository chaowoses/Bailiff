import { ICON_CHEVRON_UP, ICON_CHEVRON_DOWN, ICON_TRASH } from './icons.js';
import { pNameInput, dNameInput, timedRulingToggle, editTimeInput, editLinkSelect } from './dom.js';
import { state, saveSetupSession } from './state.js';
import { formatTimeInputValue } from './time-input.js';
// See blocks.js for why this circular import (blocks.js <-> witnesses.js) is safe.
import { renderBlocks, updateBlockTimeDisplay } from './blocks.js';
import { showDeleteConfirm } from './dialogs.js';

// ===== WITNESSES =====
// Witnesses are edited live against the block object (no separate draft/
// commit step) — add/delete/copy/clear all take effect immediately.

// Allocated/Total Time is a single global choice for the whole trial (not
// per block), set before the trial starts (no mid-trial toggle):
//   'allocated' ("Allocated Time") — each witness gets its own time and
//                 counts down on its own. The block's own Time is derived
//                 (sum of witness times) and not directly editable — see
//                 renderWitnessSection.
//   'stopwatch' ("Total Time") — witnesses have no time budget and just
//                 count up while selected; the block's own Time is the
//                 real, user-set budget.
// A witness belongs to a side ('left'/'right'), set by which of the two
// group "+ Add Witness" buttons created it — see the P/D groups below.
// Witnesses link to each other via `.linked` (set by the Copy Witnesses
// dialog) for Timed Ruling Mode; an unlinked witness just doesn't get an
// "Overrule Objection" option at trial time (Sustain still works, same as
// an unlinked plain block today).

export function unlinkWitnessEverywhere(witnessId) {
    state.blocks.forEach(b => {
        (b.witnesses || []).forEach(w => {
            if (w.linked === witnessId) w.linked = null;
        });
    });
}

export function findWitnessById(id) {
    for (const b of state.blocks) {
        const w = (b.witnesses || []).find(w2 => w2.id === id);
        if (w) return w;
    }
    return null;
}

// Links don't need to be bidirectional — a witness's own `.linked` is all
// that matters when it's the one on the clock (see getLinkedTimeable in
// timers.js). Copy Witnesses sets both sides at once as a one-time
// convenience when copying; editing a link by hand here only ever touches
// this one witness, same as the block-level "Link to" field.
export function setWitnessLink(witness, targetId) {
    witness.linked = targetId;
}

// A witness can only link to someone on the opposing side of a DIFFERENT
// block — same-block witnesses aren't an adversarial Direct/Cross pairing,
// and same-side witnesses would deduct from your own team instead of
// theirs.
export function eligibleLinkTargets(witness, ownerBlock) {
    const result = [];
    state.blocks.forEach(b => {
        if (ownerBlock && b.id === ownerBlock.id) return;
        (b.witnesses || []).forEach(other => {
            if (other.side === witness.side) return;
            result.push({ witness: other, block: b });
        });
    });
    return result;
}

// Its own popup rather than an inline dropdown — a witness-to-witness link
// is a bigger, more deliberate choice (it drives Timed Ruling Mode
// deductions) than fits comfortably in a cramped per-row select.
export function openWitnessLinkDialog(witness, ownerBlock) {
    document.getElementById('witness-link-name').textContent = witness.name || 'this witness';

    const listEl = document.getElementById('witness-link-list');
    listEl.innerHTML = '';

    const noneRow = document.createElement('div');
    noneRow.className = 'witness-copy-pick-row';
    noneRow.classList.toggle('selected', witness.linked == null);
    noneRow.textContent = 'Not Linked';
    noneRow.addEventListener('click', () => {
        setWitnessLink(witness, null);
        renderBlocks();
        saveSetupSession();
        closeWitnessLinkDialog();
    });
    listEl.appendChild(noneRow);

    const eligible = eligibleLinkTargets(witness, ownerBlock);
    if (eligible.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'witness-copy-checklist-empty';
        empty.textContent = 'No eligible witnesses on the opposing side yet.';
        listEl.appendChild(empty);
        document.getElementById('witness-link-overlay').classList.remove('hidden');
        return;
    }

    const buildRow = ({ witness: other, block: b }) => {
        const row = document.createElement('div');
        row.className = 'witness-copy-pick-row';
        row.classList.toggle('selected', witness.linked === other.id);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = other.name;
        const blockSpan = document.createElement('span');
        blockSpan.className = 'witness-copy-row-time';
        blockSpan.textContent = b.name;
        row.appendChild(nameSpan);
        row.appendChild(blockSpan);

        row.addEventListener('click', () => {
            setWitnessLink(witness, other.id);
            renderBlocks();
            saveSetupSession();
            closeWitnessLinkDialog();
        });
        return row;
    };

    // Same name (case-insensitive) almost always means the same real
    // person testifying on both sides — surface that match first instead
    // of making the user hunt for it.
    const ownName = (witness.name || '').trim().toLowerCase();
    const suggested = eligible.filter(e => ownName && (e.witness.name || '').trim().toLowerCase() === ownName);
    const rest = eligible.filter(e => !suggested.includes(e));

    if (suggested.length > 0) {
        const heading = document.createElement('div');
        heading.className = 'witness-copy-checklist-heading';
        heading.textContent = 'Suggested';
        listEl.appendChild(heading);
        suggested.forEach(entry => listEl.appendChild(buildRow(entry)));

        const restHeading = document.createElement('div');
        restHeading.className = 'witness-copy-checklist-heading';
        restHeading.textContent = 'All Witnesses';
        listEl.appendChild(restHeading);
    }
    rest.forEach(entry => listEl.appendChild(buildRow(entry)));

    document.getElementById('witness-link-overlay').classList.remove('hidden');
}

export function closeWitnessLinkDialog() {
    document.getElementById('witness-link-overlay').classList.add('hidden');
}

document.getElementById('witness-link-cancel').addEventListener('click', closeWitnessLinkDialog);

document.getElementById('witness-link-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('witness-link-overlay')) closeWitnessLinkDialog();
});

// Sum of "mm:ss" witness times, formatted the same way. Used to drive the
// block's own time field in Allocated mode (see renderWitnessSection).
export function sumWitnessTimes(witnesses) {
    const totalSecs = (witnesses || []).reduce((sum, w) => {
        const parts = (w.time || '00:00').split(':').map(Number);
        return sum + (parts[0] || 0) * 60 + (parts[1] || 0);
    }, 0);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

// Keeps the block's own time in sync with its witnesses in Allocated mode,
// without a full renderWitnessSection() re-render — used from the witness
// time input's own 'input' handler, where rebuilding the list would steal
// focus mid-keystroke.
export function syncAllocatedBlockTime(block) {
    if (state.globalWitnessMode !== 'allocated' || !block.witnesses || !block.witnesses.length) return;
    block.time = sumWitnessTimes(block.witnesses);
    if (state.currentEditingId === block.id) editTimeInput.value = block.time;
    updateBlockTimeDisplay(block);
}

// Recomputes every witness-bearing block's derived Time when the global
// mode switches into Allocated (Total Time's block time is a real,
// user-set budget and is left untouched).
export function applyGlobalWitnessMode() {
    if (state.globalWitnessMode !== 'allocated') return;
    state.blocks.forEach(b => {
        if (b.witnesses && b.witnesses.length) {
            b.time = sumWitnessTimes(b.witnesses);
        }
    });
}

export function witnessSideName(side) {
    return side === 'left' ? (pNameInput.value || 'Plaintiff') : (dNameInput.value || 'Defense');
}

export function witnessGroupLabel(side) {
    return witnessSideName(side) + ' Witnesses';
}

export function renderWitnessSection(block) {
    const witnesses = block.witnesses || [];
    const hasWitnesses = witnesses.length > 0;
    const derivedTime = state.globalWitnessMode === 'allocated' && hasWitnesses;

    // Allocated Time: the block's own time is derived (sum of witness
    // times) and not directly editable. Total Time: the block's own time
    // is the real, user-set budget, and witnesses just track elapsed time
    // against it — so it stays editable.
    editTimeInput.disabled = derivedTime;
    if (derivedTime) {
        block.time = sumWitnessTimes(witnesses);
        editTimeInput.value = block.time;
    }

    // A witness-bearing block links per-witness now (see the witness rows'
    // own Link… button), not at the block level — gray the block's own
    // Link To field out so it doesn't look like it still does anything.
    editLinkSelect.disabled = hasWitnesses;

    document.getElementById('witness-group-title-left').textContent = witnessGroupLabel('left');
    document.getElementById('witness-group-title-right').textContent = witnessGroupLabel('right');
    renderWitnessGroup(block, 'left', document.getElementById('witness-list-left'));
    renderWitnessGroup(block, 'right', document.getElementById('witness-list-right'));

    document.getElementById('clear-witnesses-btn').classList.toggle('hidden', !hasWitnesses);
}

export function renderWitnessGroup(block, side, listEl) {
    const isAllocated = state.globalWitnessMode === 'allocated';
    const witnesses = (block.witnesses || []).filter(w => w.side === side);
    listEl.innerHTML = '';

    if (witnesses.length === 0) {
        listEl.innerHTML = '<div class="witness-empty">No witnesses yet.</div>';
        return;
    }

    witnesses.forEach((w, i) => {
        const row = document.createElement('div');
        row.className = 'witness-row';
        row.dataset.id = w.id;

        const moveUpBtn = document.createElement('button');
        moveUpBtn.type = 'button';
        moveUpBtn.className = 'witness-move witness-move-up';
        moveUpBtn.title = 'Move Up';
        moveUpBtn.innerHTML = ICON_CHEVRON_UP;
        moveUpBtn.disabled = i === 0;
        moveUpBtn.addEventListener('click', () => moveWitness(block, w.id, -1));

        const moveDownBtn = document.createElement('button');
        moveDownBtn.type = 'button';
        moveDownBtn.className = 'witness-move witness-move-down';
        moveDownBtn.title = 'Move Down';
        moveDownBtn.innerHTML = ICON_CHEVRON_DOWN;
        moveDownBtn.disabled = i === witnesses.length - 1;
        moveDownBtn.addEventListener('click', () => moveWitness(block, w.id, 1));

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'witness-name-input';
        nameInput.autocomplete = 'off';
        nameInput.placeholder = 'Witness name';
        nameInput.value = w.name;
        nameInput.addEventListener('input', () => {
            w.name = nameInput.value;
            saveSetupSession();
        });

        const timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.className = 'witness-time-input';
        timeInput.autocomplete = 'off';
        timeInput.placeholder = isAllocated ? '05:00' : 'Stopwatch';
        timeInput.value = isAllocated ? w.time : '';
        timeInput.disabled = !isAllocated;
        timeInput.addEventListener('input', () => {
            formatTimeInputValue(timeInput);
            w.time = timeInput.value;
            syncAllocatedBlockTime(block);
            saveSetupSession();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'witness-delete';
        deleteBtn.title = 'Remove Witness';
        deleteBtn.innerHTML = ICON_TRASH;
        deleteBtn.addEventListener('click', () => deleteWitness(block, w.id));

        row.appendChild(nameInput);

        // Linking only matters while Timed Ruling Mode is on — matches the
        // block-level "Link to" field, which is hidden the same way.
        if (timedRulingToggle.checked) {
            const linkBtn = document.createElement('button');
            linkBtn.type = 'button';
            linkBtn.className = 'witness-link-btn';
            const linkedWitness = w.linked != null ? findWitnessById(w.linked) : null;
            linkBtn.classList.toggle('linked', !!linkedWitness);
            linkBtn.textContent = linkedWitness ? linkedWitness.name : 'Link…';
            linkBtn.title = 'Link for Timed Ruling Mode';
            linkBtn.addEventListener('click', () => openWitnessLinkDialog(w, block));
            row.appendChild(linkBtn);
        }

        row.appendChild(timeInput);

        const moveGroup = document.createElement('div');
        moveGroup.className = 'witness-move-group';
        moveGroup.appendChild(moveUpBtn);
        moveGroup.appendChild(moveDownBtn);
        row.appendChild(moveGroup);

        row.appendChild(deleteBtn);
        listEl.appendChild(row);
    });
}

// Reorders only within the witness's own side — the two groups are
// rendered and numbered independently, so movement shouldn't cross between
// them. Order matters beyond display: it's the sequence witnesses are
// examined in during the trial (see nextBlock() in timers.js).
export function moveWitness(block, witnessId, direction) {
    const witness = (block.witnesses || []).find(w => w.id === witnessId);
    if (!witness) return;
    const sideIds = block.witnesses.filter(w => w.side === witness.side).map(w => w.id);
    const idx = sideIds.indexOf(witnessId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sideIds.length) return;

    const fullIdxA = block.witnesses.findIndex(w => w.id === witnessId);
    const fullIdxB = block.witnesses.findIndex(w => w.id === sideIds[newIdx]);
    [block.witnesses[fullIdxA], block.witnesses[fullIdxB]] = [block.witnesses[fullIdxB], block.witnesses[fullIdxA]];

    renderWitnessSection(block);
    saveSetupSession();
}

export function addWitness(block, side) {
    if (!block.witnesses) block.witnesses = [];
    const count = block.witnesses.filter(w => w.side === side).length;
    const name = witnessSideName(side) + ' Witness ' + (count + 1);
    block.witnesses.push({ id: state.nextId++, name, time: '05:00', linked: null, side });
    renderWitnessSection(block);
    updateBlockTimeDisplay(block);
    saveSetupSession();
}

export function deleteWitness(block, witnessId) {
    block.witnesses = (block.witnesses || []).filter(w => w.id !== witnessId);
    unlinkWitnessEverywhere(witnessId);
    renderBlocks();
    saveSetupSession();
}

export function clearWitnesses(block) {
    if (!block.witnesses || block.witnesses.length === 0) return;
    showDeleteConfirm(
        'Clear all witnesses?',
        'This will remove every witness from "' + block.name + '" and revert it to a single timed block.',
        () => {
            block.witnesses.forEach(w => unlinkWitnessEverywhere(w.id));
            block.witnesses = [];
            renderBlocks();
            saveSetupSession();
        },
        'Clear Witnesses'
    );
}

document.querySelectorAll('.witness-group-add').forEach(btn => {
    btn.addEventListener('click', () => {
        const block = state.blocks.find(b => b.id === state.currentEditingId);
        if (block) addWitness(block, btn.dataset.side);
    });
});

document.getElementById('clear-witnesses-btn').addEventListener('click', () => {
    const block = state.blocks.find(b => b.id === state.currentEditingId);
    if (block) clearWitnesses(block);
});

document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (state.globalWitnessMode === btn.dataset.mode) return;
        state.globalWitnessMode = btn.dataset.mode;
        document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === state.globalWitnessMode);
        });
        applyGlobalWitnessMode();
        renderBlocks();
        saveSetupSession();
    });
});

[pNameInput, dNameInput].forEach(input => {
    input.addEventListener('input', () => {
        if (state.currentEditingId == null) return;
        const block = state.blocks.find(b => b.id === state.currentEditingId);
        if (block) renderWitnessSection(block);
    });
});
