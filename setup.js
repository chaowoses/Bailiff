let blocks = [
    { id: 1, name: "Opening Statement", time: "05:00", linked: null, witnesses: [] },
    { id: 2, name: "Direct Examination", time: "25:00", linked: 3, witnesses: [] },
    { id: 3, name: "Cross Examination", time: "20:00", linked: 2, witnesses: [] },
    { id: 4, name: "Closing Argument", time: "05:00", linked: null, witnesses: [] }
];

const blockList = document.getElementById("block-list");
const editPanel = document.getElementById("block-edit-panel");
const editNameInput = document.getElementById("edit-block-name");
const editTimeInput = document.getElementById("edit-block-time");
const editLinkSelect = document.getElementById("edit-block-link");
const linkLabel = document.getElementById("link-label");
const saveBtn = document.getElementById("save-block-btn");
const cancelBtn = document.getElementById("cancel-edit-btn");
const timedRulingToggle = document.getElementById("timed-ruling-toggle");
const pNameInput = document.getElementById("p-name");
const dNameInput = document.getElementById("d-name");
let currentEditingId = null;
// Blocks AND witnesses share this one counter (not just blocks) — a
// witness's `linked` id needs to be resolved without knowing in advance
// whether it points at a block or a witness, so the two id spaces must
// never collide.
let nextId = 5;

const SS_SESSION_KEY = 'bailiff_setup_session';

function saveSetupSession() {
    try {
        sessionStorage.setItem(SS_SESSION_KEY, JSON.stringify({
            blocks, nextId, witnessMode: globalWitnessMode
        }));
    } catch {}
}

function restoreSetupSession() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(SS_SESSION_KEY));
        if (saved) {
            blocks = saved.blocks;
            nextId = saved.nextId != null ? saved.nextId : (saved.nextBlockId || 1);
            globalWitnessMode = saved.witnessMode || 'allocated';
            return true;
        }
    } catch {}
    return false;
}

function highestUsedId(blockArr) {
    let max = 0;
    blockArr.forEach(b => {
        if (b.id > max) max = b.id;
        (b.witnesses || []).forEach(w => { if (w.id > max) max = w.id; });
    });
    return max;
}

const placeholder = document.createElement("div");
placeholder.className = "block-placeholder";

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const ICON_LINK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="link-svg"><path d="M7 20l10 0"/><path d="M6 6l6 -1l6 1"/><path d="M12 3l0 17"/><path d="M9 12l-3 -6l-3 6a3 3 0 0 0 6 0"/><path d="M21 12l-3 -6l-3 6a3 3 0 0 0 6 0"/></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/></svg>`;
const ICON_CHEVRON_UP = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6 -6l6 6"/></svg>`;
const ICON_CHEVRON_DOWN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6l6 -6"/></svg>`;
const ICON_SCALES = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M7 20l10 0"/><path d="M6 6l6 -1l6 1"/><path d="M12 3l0 17"/><path d="M9 12l-3 -6l-3 6a3 3 0 0 0 6 0"/><path d="M21 12l-3 -6l-3 6a3 3 0 0 0 6 0"/></svg>`;
const ICON_INFO = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
const ICON_WITNESS = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/></svg>`;

function updateLinkVisibility() {
    linkLabel.style.display = timedRulingToggle.checked ? 'flex' : 'none';
}

timedRulingToggle.addEventListener('change', () => {
    timedRulingToggle.closest('.schedule-toggle').classList.toggle('schedule-toggle--active', timedRulingToggle.checked);
    updateLinkVisibility();
    renderBlocks();
    saveSetupSession();
});

function buildBlockBadges(block) {
    let html = '';
    if (timedRulingToggle.checked) {
        const hasWitnesses = block.witnesses && block.witnesses.length;
        if (hasWitnesses) {
            // Linking lives on the individual witnesses now, not the block's
            // own `.linked` — so the superblock badge reflects that instead.
            const linkedCount = block.witnesses.filter(w => w.linked != null).length;
            if (linkedCount > 0) {
                const label = linkedCount + ' Linked Witness' + (linkedCount !== 1 ? 'es' : '');
                html += `<span class="block-linked-badge">${ICON_SCALES} ${label}<span class="badge-info-icon">${ICON_INFO}</span></span>`;
            }
        } else if (block.linked) {
            const linkedBlock = blocks.find(b => b.id === block.linked);
            if (linkedBlock) {
                html += `<span class="block-linked-badge">${ICON_SCALES} ${escapeHtml(linkedBlock.name)}<span class="badge-info-icon">${ICON_INFO}</span></span>`;
            }
        }
    }
    if (block.witnesses && block.witnesses.length) {
        html += `<span class="block-witness-badge">${ICON_WITNESS}${block.witnesses.length}</span>`;
    }
    return html;
}

function updateBlockTimeDisplay(block) {
    const card = document.querySelector(`.block-card[data-id="${block.id}"]`);
    if (!card) return;
    const timeSpan = card.querySelector('.block-time');
    if (timeSpan) timeSpan.textContent = block.time;
    const nameSpan = card.querySelector('.block-name');
    if (nameSpan) nameSpan.innerHTML = escapeHtml(block.name) + buildBlockBadges(block);
}

function createBlockElement(block, index) {
    const div = document.createElement("div");
    div.className = "block-card";
    div.dataset.id = block.id;
    div.setAttribute("draggable", "true");

    const badgeHtml = buildBlockBadges(block);

    div.innerHTML = `
        <div class="block-main-content" data-index="${index + 1}">
            <span class="block-name">${escapeHtml(block.name)}${badgeHtml}</span>
            <span class="block-time">${escapeHtml(block.time)}</span>
        </div>
        <div class="block-controls">
            <button class="block-move block-move-up" title="Move Up"${index === 0 ? ' disabled' : ''}>${ICON_CHEVRON_UP}</button>
            <button class="block-move block-move-down" title="Move Down"${index === blocks.length - 1 ? ' disabled' : ''}>${ICON_CHEVRON_DOWN}</button>
            <button class="block-delete" title="Delete Block">${ICON_TRASH}</button>
        </div>`;

    div.addEventListener('dragstart', () => {
        div._dragActive = true;
        closeEditPanel();
        setTimeout(() => div.classList.add('dragging'), 0);
    });

    div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        if (placeholder.parentNode) {
            placeholder.replaceWith(div);
        }
        placeholder.remove();
        syncArrayOrder();
        setTimeout(() => { div._dragActive = false; }, 0);
    });

    return div;
}

function updateBlockIndices() {
    const cards = blockList.querySelectorAll('.block-card:not(.removing)');
    cards.forEach((card, i) => {
        const content = card.querySelector('.block-main-content');
        if (content) content.dataset.index = i + 1;

        const upBtn = card.querySelector('.block-move-up');
        const downBtn = card.querySelector('.block-move-down');
        if (upBtn) upBtn.disabled = i === 0;
        if (downBtn) downBtn.disabled = i === cards.length - 1;
    });
}

function formatTimeInputValue(inputEl) {
    let v = inputEl.value.replace(/\D/g, '');
    if (v.length > 4) v = v.slice(0, 4);
    if (v.length >= 3) v = v.slice(0, v.length - 2) + ':' + v.slice(v.length - 2);
    inputEl.value = v;
}

editTimeInput.addEventListener('input', () => formatTimeInputValue(editTimeInput));

function openEditPanel(id) {
    if (currentEditingId === id) return closeEditPanel();
    const block = blocks.find(b => b.id === id);
    const card = document.querySelector(`.block-card[data-id="${id}"]`);

    currentEditingId = id;
    editNameInput.value = block.name;
    editTimeInput.value = block.time;

    editLinkSelect.innerHTML = '<option value="">None</option>';
    blocks.forEach(b => {
        if (b.id !== id) {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            if (block.linked === b.id) opt.selected = true;
            editLinkSelect.appendChild(opt);
        }
    });

    updateLinkVisibility();
    card.after(editPanel);
    editPanel.classList.remove("hidden");
    renderWitnessSection(block);
}

function saveBlockChanges() {
    const block = blocks.find(b => b.id === currentEditingId);
    if (!block) return;

    block.name = editNameInput.value;
    block.time = editTimeInput.value.length < 3 ? "01:00" : editTimeInput.value;
    const linkValue = editLinkSelect.value ? parseInt(editLinkSelect.value) : null;
    block.linked = linkValue !== null && blocks.some(b => b.id === linkValue) ? linkValue : null;

    renderBlocks();
    closeEditPanel();
}

function closeEditPanel() {
    editPanel.classList.add("hidden");
    currentEditingId = null;
}

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
let globalWitnessMode = 'allocated';

function unlinkWitnessEverywhere(witnessId) {
    blocks.forEach(b => {
        (b.witnesses || []).forEach(w => {
            if (w.linked === witnessId) w.linked = null;
        });
    });
}

function findWitnessById(id) {
    for (const b of blocks) {
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
function setWitnessLink(witness, targetId) {
    witness.linked = targetId;
}

// A witness can only link to someone on the opposing side of a DIFFERENT
// block — same-block witnesses aren't an adversarial Direct/Cross pairing,
// and same-side witnesses would deduct from your own team instead of
// theirs.
function eligibleLinkTargets(witness, ownerBlock) {
    const result = [];
    blocks.forEach(b => {
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
function openWitnessLinkDialog(witness, ownerBlock) {
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

function closeWitnessLinkDialog() {
    document.getElementById('witness-link-overlay').classList.add('hidden');
}

document.getElementById('witness-link-cancel').addEventListener('click', closeWitnessLinkDialog);

document.getElementById('witness-link-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('witness-link-overlay')) closeWitnessLinkDialog();
});

// Sum of "mm:ss" witness times, formatted the same way. Used to drive the
// block's own time field in Allocated mode (see renderWitnessSection).
function sumWitnessTimes(witnesses) {
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
function syncAllocatedBlockTime(block) {
    if (globalWitnessMode !== 'allocated' || !block.witnesses || !block.witnesses.length) return;
    block.time = sumWitnessTimes(block.witnesses);
    if (currentEditingId === block.id) editTimeInput.value = block.time;
    updateBlockTimeDisplay(block);
}

// Recomputes every witness-bearing block's derived Time when the global
// mode switches into Allocated (Total Time's block time is a real,
// user-set budget and is left untouched).
function applyGlobalWitnessMode() {
    if (globalWitnessMode !== 'allocated') return;
    blocks.forEach(b => {
        if (b.witnesses && b.witnesses.length) {
            b.time = sumWitnessTimes(b.witnesses);
        }
    });
}

function witnessSideName(side) {
    return side === 'left' ? (pNameInput.value || 'Plaintiff') : (dNameInput.value || 'Defense');
}

function witnessGroupLabel(side) {
    return witnessSideName(side) + ' Witnesses';
}

function renderWitnessSection(block) {
    const witnesses = block.witnesses || [];
    const hasWitnesses = witnesses.length > 0;
    const derivedTime = globalWitnessMode === 'allocated' && hasWitnesses;

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

function renderWitnessGroup(block, side, listEl) {
    const isAllocated = globalWitnessMode === 'allocated';
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
function moveWitness(block, witnessId, direction) {
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

function addWitness(block, side) {
    if (!block.witnesses) block.witnesses = [];
    const count = block.witnesses.filter(w => w.side === side).length;
    const name = witnessSideName(side) + ' Witness ' + (count + 1);
    block.witnesses.push({ id: nextId++, name, time: '05:00', linked: null, side });
    renderWitnessSection(block);
    updateBlockTimeDisplay(block);
    saveSetupSession();
}

function deleteWitness(block, witnessId) {
    block.witnesses = (block.witnesses || []).filter(w => w.id !== witnessId);
    unlinkWitnessEverywhere(witnessId);
    renderBlocks();
    saveSetupSession();
}

function clearWitnesses(block) {
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
        const block = blocks.find(b => b.id === currentEditingId);
        if (block) addWitness(block, btn.dataset.side);
    });
});

document.getElementById('clear-witnesses-btn').addEventListener('click', () => {
    const block = blocks.find(b => b.id === currentEditingId);
    if (block) clearWitnesses(block);
});

document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (globalWitnessMode === btn.dataset.mode) return;
        globalWitnessMode = btn.dataset.mode;
        document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === globalWitnessMode);
        });
        applyGlobalWitnessMode();
        renderBlocks();
        saveSetupSession();
    });
});

[pNameInput, dNameInput].forEach(input => {
    input.addEventListener('input', () => {
        if (currentEditingId == null) return;
        const block = blocks.find(b => b.id === currentEditingId);
        if (block) renderWitnessSection(block);
    });
});

// ===== COPY WITNESSES =====
// Pick a source block, hand-pick which of its witnesses to bring in (or
// "Select All" per side), then choose whether the copies land on the same
// side as their source or the opposing side. Opposing-side copies are the
// Direct->Cross adversarial pairing and get linked bidirectionally for
// Timed Ruling Mode; same-side copies are just a data-entry shortcut and
// aren't linked.
let witnessCopySourceBlockId = null;
let witnessCopySelectedIds = new Set();
let witnessCopySideMode = 'opposing';

function openWitnessCopyDialog() {
    witnessCopySourceBlockId = null;
    witnessCopySelectedIds = new Set();
    witnessCopySideMode = 'opposing';

    const sourceSelect = document.getElementById('witness-copy-source-select');
    sourceSelect.innerHTML = '<option value="">Select a block…</option>';
    blocks.forEach(b => {
        if (b.id !== currentEditingId && b.witnesses && b.witnesses.length) {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name + ' (' + b.witnesses.length + ')';
            sourceSelect.appendChild(opt);
        }
    });

    document.getElementById('witness-copy-picker').classList.add('hidden');
    document.querySelectorAll('.witness-copy-side-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sideMode === 'opposing');
    });
    document.getElementById('witness-copy-confirm').disabled = true;
    document.getElementById('witness-copy-overlay').classList.remove('hidden');
}

function closeWitnessCopyDialog() {
    document.getElementById('witness-copy-overlay').classList.add('hidden');
}

function updateWitnessCopyConfirmState() {
    document.getElementById('witness-copy-confirm').disabled = witnessCopySelectedIds.size === 0;
}

function renderWitnessCopyPicker() {
    const picker = document.getElementById('witness-copy-picker');
    if (witnessCopySourceBlockId == null) {
        picker.classList.add('hidden');
        updateWitnessCopyConfirmState();
        return;
    }
    picker.classList.remove('hidden');
    const sourceBlock = blocks.find(b => b.id === witnessCopySourceBlockId);

    ['left', 'right'].forEach(side => {
        document.getElementById('witness-copy-title-' + side).textContent = witnessGroupLabel(side);

        const listEl = document.getElementById('witness-copy-checklist-' + side);
        listEl.innerHTML = '';
        const sideWitnesses = (sourceBlock.witnesses || []).filter(w => w.side === side);
        if (sideWitnesses.length === 0) {
            listEl.innerHTML = '<div class="witness-copy-checklist-empty">None</div>';
            return;
        }
        sideWitnesses.forEach(w => {
            const row = document.createElement('div');
            row.className = 'witness-copy-pick-row';
            row.classList.toggle('selected', witnessCopySelectedIds.has(w.id));

            const nameSpan = document.createElement('span');
            nameSpan.textContent = w.name;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'witness-copy-row-time';
            timeSpan.textContent = w.time;

            row.appendChild(nameSpan);
            row.appendChild(timeSpan);
            row.addEventListener('click', () => {
                if (witnessCopySelectedIds.has(w.id)) witnessCopySelectedIds.delete(w.id);
                else witnessCopySelectedIds.add(w.id);
                renderWitnessCopyPicker();
            });
            listEl.appendChild(row);
        });
    });

    updateWitnessCopyConfirmState();
}

document.getElementById('witness-copy-btn').addEventListener('click', () => {
    if (currentEditingId != null) openWitnessCopyDialog();
});

document.getElementById('witness-copy-cancel').addEventListener('click', closeWitnessCopyDialog);

document.getElementById('witness-copy-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('witness-copy-overlay')) closeWitnessCopyDialog();
});

document.getElementById('witness-copy-source-select').addEventListener('change', (e) => {
    witnessCopySourceBlockId = e.target.value ? parseInt(e.target.value) : null;
    witnessCopySelectedIds = new Set();
    renderWitnessCopyPicker();
});

document.querySelectorAll('.witness-copy-select-all').forEach(btn => {
    btn.addEventListener('click', () => {
        if (witnessCopySourceBlockId == null) return;
        const side = btn.dataset.side;
        const sourceBlock = blocks.find(b => b.id === witnessCopySourceBlockId);
        (sourceBlock.witnesses || []).filter(w => w.side === side).forEach(w => witnessCopySelectedIds.add(w.id));
        renderWitnessCopyPicker();
    });
});

document.querySelectorAll('.witness-copy-side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        witnessCopySideMode = btn.dataset.sideMode;
        document.querySelectorAll('.witness-copy-side-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
});

document.getElementById('witness-copy-confirm').addEventListener('click', () => {
    if (witnessCopySourceBlockId == null || witnessCopySelectedIds.size === 0 || currentEditingId == null) return;
    const sourceBlock = blocks.find(b => b.id === witnessCopySourceBlockId);
    const targetBlock = blocks.find(b => b.id === currentEditingId);
    if (!sourceBlock || !targetBlock) return;

    const opposing = witnessCopySideMode === 'opposing';
    if (!targetBlock.witnesses) targetBlock.witnesses = [];

    sourceBlock.witnesses.forEach(w => {
        if (!witnessCopySelectedIds.has(w.id)) return;
        const newId = nextId++;
        const copySide = opposing ? (w.side === 'left' ? 'right' : 'left') : w.side;
        targetBlock.witnesses.push({ id: newId, name: w.name, time: w.time, side: copySide, linked: opposing ? w.id : null });
        if (opposing) w.linked = newId;
    });

    renderWitnessSection(targetBlock);
    updateBlockTimeDisplay(targetBlock);
    updateBlockTimeDisplay(sourceBlock);
    saveSetupSession();
    closeWitnessCopyDialog();
});

function adjacentBlockCard(card, direction) {
    let el = direction === -1 ? card.previousElementSibling : card.nextElementSibling;
    while (el && !el.classList.contains('block-card')) {
        el = direction === -1 ? el.previousElementSibling : el.nextElementSibling;
    }
    return el;
}

// Swaps two adjacent cards in place and FLIP-animates the shift, so an
// arrow click on mobile visibly slides the block into its new spot instead
// of the whole list silently re-rendering.
function animateBlockSwap(card, sibling, direction) {
    const cardBefore = card.getBoundingClientRect().top;
    const siblingBefore = sibling.getBoundingClientRect().top;

    if (direction === -1) blockList.insertBefore(card, sibling);
    else blockList.insertBefore(sibling, card);

    updateBlockIndices();
    saveSetupSession();

    [[card, cardBefore], [sibling, siblingBefore]].forEach(([el, before]) => {
        const delta = before - el.getBoundingClientRect().top;
        if (!delta) return;
        el.style.transition = 'none';
        el.style.transform = `translateY(${delta}px)`;
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.transform = '';
            el.addEventListener('transitionend', () => {
                el.style.transition = '';
            }, { once: true });
        });
    });
}

function moveBlock(id, direction) {
    const index = blocks.findIndex(b => b.id === id);
    if (index === -1) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    if (currentEditingId === id) closeEditPanel();
    [blocks[index], blocks[newIndex]] = [blocks[newIndex], blocks[index]];

    const card = blockList.querySelector(`.block-card[data-id="${id}"]`);
    const sibling = card && adjacentBlockCard(card, direction);
    if (card && sibling) {
        animateBlockSwap(card, sibling, direction);
    } else {
        renderBlocks();
    }
}

function deleteBlock(id) {
    const card = document.querySelector(`.block-card[data-id="${id}"]`);
    if (!card) return;

    if (currentEditingId === id) closeEditPanel();

    card.classList.add("removing");
    setTimeout(() => {
        card.remove();
        const block = blocks.find(b => b.id === id);
        // Any witness elsewhere that was copied from this block and links
        // back to one of its witnesses shouldn't be left pointing at nothing.
        if (block && block.witnesses) {
            block.witnesses.forEach(w => unlinkWitnessEverywhere(w.id));
        }
        blocks = blocks.filter(b => b.id !== id);
        blocks.forEach(b => { if (b.linked === id) b.linked = null; });
        syncArrayOrder();
    }, 400);
}

function renderBlocks() {
    // #block-edit-panel gets inserted as a sibling of the cards (via
    // `card.after(editPanel)` in openEditPanel), so it lives inside
    // blockList while open — wiping blockList.innerHTML would silently
    // destroy it out from under an in-progress edit (e.g. toggling Timed
    // Ruling Mode while a block is open). Detach it first, then reopen the
    // same block afterward so editing state survives the re-render.
    const wasEditingId = currentEditingId;
    if (editPanel.parentNode === blockList) editPanel.remove();

    blockList.innerHTML = '';
    blocks.forEach((b, i) => blockList.appendChild(createBlockElement(b, i)));

    if (wasEditingId != null && blocks.some(b => b.id === wasEditingId)) {
        currentEditingId = null;
        openEditPanel(wasEditingId);
    }
    saveSetupSession();
}

blockList.addEventListener("click", e => {
    const card = e.target.closest(".block-card");
    if (!card || e.target.closest('#block-edit-panel') || card.classList.contains('removing')) return;
    if (card._dragActive) return;
    if (e.target.closest('.badge-info-icon')) return;
    
    const deleteBtn = e.target.closest(".block-delete");
    const moveUpBtn = e.target.closest(".block-move-up");
    const moveDownBtn = e.target.closest(".block-move-down");
    if (deleteBtn) {
        deleteBlock(parseInt(card.dataset.id));
    } else if (moveUpBtn) {
        if (!moveUpBtn.disabled) moveBlock(parseInt(card.dataset.id), -1);
    } else if (moveDownBtn) {
        if (!moveDownBtn.disabled) moveBlock(parseInt(card.dataset.id), 1);
    } else {
        openEditPanel(parseInt(card.dataset.id));
    }
});

document.getElementById("add-block-btn").addEventListener("click", () => {
    const newB = { id: nextId++, name: "New Block", time: "01:00", linked: null, witnesses: [] };
    blocks.push(newB);
    blockList.appendChild(createBlockElement(newB, blocks.length - 1));
    updateBlockIndices();
    saveSetupSession();
});

saveBtn.addEventListener("click", saveBlockChanges);
cancelBtn.addEventListener("click", closeEditPanel);

blockList.addEventListener('drop', e => e.preventDefault());

blockList.addEventListener('dragover', e => {
    e.preventDefault();
    const dragging = document.querySelector('.dragging');
    if (!dragging) return;

    const afterElement = getDragAfterElement(blockList, e.clientY);
    const isAtEnd = afterElement == null && dragging === blockList.lastElementChild;
    const isBeforeSelf = afterElement === dragging;
    const isAfterSelf = afterElement === dragging.nextElementSibling;

    if (isAtEnd || isBeforeSelf || isAfterSelf) {
        placeholder.remove();
    } else {
        if (afterElement == null) {
            blockList.appendChild(placeholder);
        } else {
            blockList.insertBefore(placeholder, afterElement);
        }
    }
});

function getDragAfterElement(container, y) {
    const draggables = [...container.querySelectorAll('.block-card:not(.dragging):not(.block-placeholder):not(.removing)')];
    return draggables.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function syncArrayOrder() {
    blocks = [...blockList.querySelectorAll('.block-card:not(.removing)')].map(c => 
        blocks.find(b => b.id === parseInt(c.dataset.id))
    );
    updateBlockIndices();
    saveSetupSession();
}

// ===== CONSTANTS =====
const DEFAULT_BLOCKS = [
    { id: 1, name: "Opening Statement", time: "05:00", linked: null },
    {
        id: 2, name: "Direct Examination", time: "25:00", linked: null,
        witnesses: [
            { id: 5, name: "Plaintiff Witness 1", time: "05:00", linked: null, side: "left" },
            { id: 6, name: "Plaintiff Witness 2", time: "05:00", linked: null, side: "left" },
            { id: 7, name: "Plaintiff Witness 3", time: "05:00", linked: null, side: "left" },
            { id: 8, name: "Defense Witness 1", time: "05:00", linked: null, side: "right" },
            { id: 9, name: "Defense Witness 2", time: "05:00", linked: null, side: "right" },
            { id: 10, name: "Defense Witness 3", time: "05:00", linked: null, side: "right" }
        ]
    },
    { id: 3, name: "Cross Examination", time: "20:00", linked: null },
    { id: 4, name: "Closing Argument", time: "05:00", linked: null }
];

const PRESETS_KEY = 'bailiff_presets';
const SAVED_TRIALS_KEY = 'bailiff_saved_trials';

// Unlinked (no block or witness carries a `.linked` — Timed Ruling Mode is
// off by default anyway) and Total Time mode, matching how VLRE actually
// runs: witnesses count up on their own while the block itself carries the
// real, user-set budget.
const VLRE_PRESET = {
    id: 'preset-vlre',
    name: 'VLRE',
    description: 'For VLRE (Virginia Law-Related Education) competitions.',
    savedAt: null,
    builtin: true,
    advancedMode: false,
    timedRulingMode: false,
    witnessMode: 'stopwatch',
    blocks: JSON.parse(JSON.stringify(DEFAULT_BLOCKS))
};

// ===== PRESETS =====
function getPresets() {
    const presets = [VLRE_PRESET];
    try {
        const saved = JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
        saved.forEach(p => presets.push(p));
    } catch {}
    return presets;
}

function savePresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.filter(p => !p.builtin)));
}

function openSavePresetDialog(editPreset) {
    document.getElementById('preset-name-input').value = editPreset ? editPreset.name : '';
    document.getElementById('preset-desc-input').value = editPreset ? (editPreset.description || '') : '';
    document.getElementById('preset-dialog-overlay').classList.remove('hidden');
    if (editPreset) {
        document.getElementById('preset-dialog-overlay').dataset.editId = editPreset.id;
    } else {
        delete document.getElementById('preset-dialog-overlay').dataset.editId;
    }
    document.getElementById('preset-name-input').focus();
}

function savePresetFromDialog(overwriteId) {
    const name = document.getElementById('preset-name-input').value.trim();
    if (!name) return;

    const presets = getPresets();
    const desc = document.getElementById('preset-desc-input').value.trim();

    const trMode = timedRulingToggle.checked;

    if (overwriteId) {
        const existing = presets.find(p => p.id === overwriteId);
        if (existing) {
            existing.name = name;
            existing.description = desc;
            existing.advancedMode = trMode;
            existing.witnessMode = globalWitnessMode;
            existing.blocks = JSON.parse(JSON.stringify(blocks));
            existing.savedAt = new Date().toISOString();
        }
    } else {
        presets.push({
            id: 'preset-' + Date.now(),
            name: name,
            description: desc,
            savedAt: new Date().toISOString(),
            advancedMode: trMode,
            witnessMode: globalWitnessMode,
            blocks: JSON.parse(JSON.stringify(blocks))
        });
    }

    savePresets(presets);
    document.getElementById('preset-dialog-overlay').classList.add('hidden');
    renderPresets();
}

// Check for name conflict when saving, prompt overwrite
document.getElementById('preset-dialog-save').addEventListener('click', () => {
    const name = document.getElementById('preset-name-input').value.trim();
    if (!name) return;

    const presetOverlay = document.getElementById('preset-dialog-overlay');
    const editId = presetOverlay.dataset.editId;
    const restoreDialog = () => { presetOverlay.classList.remove('hidden'); };

    if (editId) {
        const presets = getPresets();
        const existing = presets.find(p => p.name.toLowerCase() === name.toLowerCase() && !p.builtin && p.id !== editId);
        if (existing) {
            presetOverlay.classList.add('hidden');
            showDeleteConfirm(
                'Overwrite "' + existing.name + '"?',
                'A preset with this name already exists. Replacing it will update its blocks and description.',
                () => { savePresetFromDialog(existing.id); },
                'Replace',
                restoreDialog,
                'confirm-save'
            );
        } else {
            savePresetFromDialog(editId);
        }
        return;
    }

    const presets = getPresets();
    const existing = presets.find(p => p.name.toLowerCase() === name.toLowerCase() && !p.builtin);
    if (existing) {
        presetOverlay.classList.add('hidden');
        showDeleteConfirm(
            'Overwrite "' + existing.name + '"?',
            'A preset with this name already exists. Replacing it will update its blocks and description.',
            () => { savePresetFromDialog(existing.id); },
            'Replace',
            restoreDialog,
            'confirm-save'
        );
    } else {
        savePresetFromDialog();
    }
});

function loadPreset(presetId) {
    const presets = getPresets();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    blocks = JSON.parse(JSON.stringify(preset.blocks));
    nextId = highestUsedId(blocks) + 1;
    globalWitnessMode = preset.witnessMode || 'allocated';
    document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === globalWitnessMode);
    });
    renderBlocks();

    // Restore the timed ruling mode toggle
    if (preset.timedRulingMode || preset.advancedMode) {
        timedRulingToggle.checked = true;
    } else {
        timedRulingToggle.checked = false;
    }
    timedRulingToggle.dispatchEvent(new Event('change'));
}

function deletePreset(presetId) {
    if (presetId === 'preset-vlre') return;
    let presets = getPresets();
    presets = presets.filter(p => p.id !== presetId);
    savePresets(presets);
    renderPresets();
}

function renderPresets() {
    const list = document.getElementById('presets-list');
    const presets = getPresets();

    function presetBlockInfo(blocks) {
        if (!blocks || blocks.length === 0) return '';
        const totalSecs = blocks.reduce((sum, b) => {
            const parts = (b.time || '00:00').split(':').map(Number);
            return sum + (parts[0] || 0) * 60 + (parts[1] || 0);
        }, 0);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        return blocks.length + ' block' + (blocks.length !== 1 ? 's' : '') + ' &middot; ' + timeStr;
    }

    let html = presets.map(p => {
        const isBuiltin = p.builtin;
        const desc = p.description || '';

        const infoStr = presetBlockInfo(p.blocks);

        const actions = isBuiltin
            ? '<button class="saved-trial-load" data-id="' + p.id + '">Load Preset</button>'
            : '<button class="saved-trial-load" data-id="' + p.id + '">Load</button>' +
              '<button class="saved-trial-edit preset-edit-btn" data-id="' + p.id + '">Edit</button>' +
              '<button class="saved-trial-edit preset-overwrite-btn" data-id="' + p.id + '">Overwrite</button>' +
              '<button class="saved-trial-edit preset-export-btn" data-id="' + p.id + '">Export</button>' +
              '<button class="saved-trial-delete preset-delete-btn" data-id="' + p.id + '">Delete</button>';

        const nameHtml = isBuiltin
            ? '<div class="saved-trial-name">' + escapeHtml(p.name) + ' <span class="saved-trial-badge">Built-In</span></div>'
            : '<div class="saved-trial-name">' + escapeHtml(p.name) + ((p.timedRulingMode || p.advancedMode) ? '<span class="saved-trial-badge tr-mode-badge">' + ICON_SCALES + 'Timed Ruling Mode<span class="badge-info-icon">' + ICON_INFO + '</span></span>' : '') + '</div>';

        const dateHtml = isBuiltin
            ? '<div class="saved-trial-date">' + escapeHtml(desc) + '</div>'
            : '<div class="saved-trial-date">' + (desc ? escapeHtml(desc) + ' &middot; ' : '') + new Date(p.savedAt).toLocaleDateString() + '</div>';

        const draggableAttr = isBuiltin ? '' : ' draggable="true"';
        return '<div class="saved-trial-card' + (isBuiltin ? ' saved-trial-preset' : '') + '"' + draggableAttr + ' data-id="' + p.id + '">' +
            '<div class="saved-trial-info">' + nameHtml + dateHtml +
                (infoStr ? '<div class="preset-block-info">' + infoStr + '</div>' : '') +
            '</div>' +
            '<div class="saved-trial-actions">' + actions + '</div>' +
        '</div>';
    }).join('');

    if (presets.every(p => p.builtin)) {
        html += '<div class="saved-trials-empty" style="margin-top:6px;">No custom presets yet. Save your block configuration as a preset to reuse it later.</div>';
    }

    list.innerHTML = html;

    // Setup drag-and-drop for preset cards
    list.querySelectorAll('.saved-trial-card[draggable]').forEach(card => {
        card.addEventListener('dragstart', () => {
            dragPresetId = card.dataset.id;
            setTimeout(() => card.classList.add('dragging'), 0);
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            dragPresetId = null;
        });
    });

    list.querySelectorAll('.saved-trial-load').forEach(btn => {
        btn.addEventListener('click', () => loadPreset(btn.dataset.id));
    });
    list.querySelectorAll('.preset-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const presets = getPresets();
            const preset = presets.find(p => p.id === btn.dataset.id);
            if (preset) openSavePresetDialog(preset);
        });
    });
    list.querySelectorAll('.preset-overwrite-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showDeleteConfirm(
                'Overwrite this preset?',
                'This will replace its blocks and settings with the current configuration.',
                () => {
                    const presets = getPresets();
                    const preset = presets.find(p => p.id === btn.dataset.id);
                    if (preset) {
                        preset.blocks = JSON.parse(JSON.stringify(blocks));
                        preset.advancedMode = timedRulingToggle.checked;
                        preset.witnessMode = globalWitnessMode;
                        preset.savedAt = new Date().toISOString();
                        savePresets(presets);
                        renderPresets();
                    }
                },
                'Overwrite',
                null,
                'confirm-save'
            );
        });
    });
    list.querySelectorAll('.preset-export-btn').forEach(btn => {
        btn.addEventListener('click', () => exportPreset(btn.dataset.id));
    });
    list.querySelectorAll('.preset-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => showDeleteConfirm('Delete this preset?', 'This preset will be permanently removed.', () => deletePreset(btn.dataset.id)));
    });
}

function exportPreset(presetId) {
    const preset = getPresets().find(p => p.id === presetId);
    if (!preset || preset.builtin) return;
    const payload = {
        app: 'bailiff',
        type: 'presets',
        version: 1,
        exportedAt: new Date().toISOString(),
        presets: [preset]
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, 'bailiff-preset-' + slugify(preset.name) + '-' + stamp + '.json');
}

// Registered once (not inside renderPresets) — #presets-list is a persistent
// element, and re-registering on every render would stack listeners forever.
let dragPresetId = null;
const presetsListEl = document.getElementById('presets-list');

presetsListEl.addEventListener('dragover', e => {
    e.preventDefault();
    const dragging = presetsListEl.querySelector('.dragging');
    if (!dragging) return;
    const afterEl = getDragAfterElementPreset(presetsListEl, e.clientY);
    // Prevent dragging before the first (builtin) card
    if (afterEl === presetsListEl.firstElementChild && presetsListEl.firstElementChild.classList.contains('saved-trial-preset')) {
        return;
    }
    if (afterEl == null) {
        presetsListEl.appendChild(dragging);
    } else {
        presetsListEl.insertBefore(dragging, afterEl);
    }
});

presetsListEl.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragPresetId) return;
    const newOrder = [...presetsListEl.querySelectorAll('.saved-trial-card[data-id]')].map(c => c.dataset.id)
        .filter(id => id !== 'preset-vlre');
    let savedPresets = JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
    savedPresets.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
    localStorage.setItem(PRESETS_KEY, JSON.stringify(savedPresets));
    renderPresets();
});

function getDragAfterElementPreset(container, y) {
    const draggables = [...container.querySelectorAll('.saved-trial-card:not(.dragging)')];
    return draggables.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ===== SAVED TRIALS =====
function getSavedTrials() {
    try {
        return JSON.parse(localStorage.getItem(SAVED_TRIALS_KEY)) || [];
    } catch { return []; }
}

function saveSavedTrials(trials) {
    localStorage.setItem(SAVED_TRIALS_KEY, JSON.stringify(trials));
}

function launchTrial(trialId) {
    const trials = getSavedTrials();
    const trial = trials.find(t => t.id === trialId);
    if (!trial || !trial.timerState) return;

    localStorage.setItem('bailiff_resume', JSON.stringify(trial));
    window.location.href = 'timers.html?resume=' + trialId;
}

// Autosave launch also preserves sessionId
// (handled inline in renderSavedTrials)

function deleteSavedTrial(trialId) {
    let trials = getSavedTrials();
    trials = trials.filter(t => t.id !== trialId);
    saveSavedTrials(trials);
    renderSavedTrials();
}

function clearAllSavedTrials() {
    saveSavedTrials([]);
    localStorage.removeItem('bailiff_autosave');
    renderSavedTrials();
}

let pendingDescEditId = null;

function editSavedTrialDescription(trialId) {
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

function renderSavedTrials() {
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

// ===== DELETE CONFIRMATION =====
let pendingDelete = null;
let pendingRestore = null;

function showDeleteConfirm(title, text, onConfirm, confirmLabel, onCancel, confirmClass) {
    document.getElementById('delete-confirm-title').textContent = title;
    document.getElementById('delete-confirm-text').textContent = text;
    const btn = document.getElementById('delete-confirm-confirm');
    btn.textContent = confirmLabel || 'Delete';
    btn.className = 'confirm-btn ' + (confirmClass || 'confirm-leave');
    pendingDelete = onConfirm;
    pendingRestore = onCancel || null;
    document.getElementById('delete-confirm-overlay').classList.remove('hidden');
}

document.getElementById('delete-confirm-cancel').addEventListener('click', () => {
    if (pendingRestore) pendingRestore();
    pendingDelete = null;
    pendingRestore = null;
    document.getElementById('delete-confirm-overlay').classList.add('hidden');
});

document.getElementById('delete-confirm-confirm').addEventListener('click', () => {
    if (pendingDelete) pendingDelete();
    pendingDelete = null;
    pendingRestore = null;
    document.getElementById('delete-confirm-overlay').classList.add('hidden');
});

document.getElementById('delete-confirm-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('delete-confirm-overlay')) {
        if (pendingRestore) pendingRestore();
        pendingDelete = null;
        pendingRestore = null;
        document.getElementById('delete-confirm-overlay').classList.add('hidden');
    }
});

// ===== PRESET DIALOG EVENTS =====
document.getElementById('save-preset-btn').addEventListener('click', () => openSavePresetDialog());

document.getElementById('preset-dialog-cancel').addEventListener('click', () => {
    document.getElementById('preset-dialog-overlay').classList.add('hidden');
});

document.getElementById('preset-dialog-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('preset-dialog-overlay')) {
        document.getElementById('preset-dialog-overlay').classList.add('hidden');
    }
});

// Preset name Enter key support
document.getElementById('preset-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('preset-dialog-save').click();
    }
});

document.getElementById("start-trial-btn").addEventListener("click", () => {
    if (blocks.length === 0) {
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
        witnessMode: globalWitnessMode,
        blocks: encodeURIComponent(JSON.stringify(blocks))
    });
    
    sessionStorage.removeItem(SS_SESSION_KEY);
    sessionStorage.removeItem('bailiff_timer_session');
    window.location.href = `timers.html?${params.toString()}`;
});

// ===== EXPORT SAVED TRIALS =====
function formatTrialTime(secs) {
    const absSecs = Math.abs(secs);
    const mins = Math.floor(absSecs / 60);
    const s = absSecs % 60;
    return (secs < 0 ? '-' : '') + String(mins).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function buildReadableExport(trials) {
    const lines = [];
    lines.push('Bailiff — Saved Trials Export');
    lines.push('Exported: ' + new Date().toLocaleString());
    lines.push('='.repeat(40));
    lines.push('');

    if (trials.length === 0) {
        lines.push('No saved trials.');
        return lines.join('\n');
    }

    trials.forEach((t, i) => {
        const trMode = t.timedRulingMode || t.advancedMode;

        lines.push((i + 1) + '. ' + (t.name || 'Untitled Trial'));
        if (t.id) lines.push('   ID: ' + t.id);
        if (t.savedAt) lines.push('   Saved: ' + new Date(t.savedAt).toLocaleString());
        if (t.plaintiff) lines.push('   Plaintiff: ' + t.plaintiff);
        if (t.defense) lines.push('   Defense: ' + t.defense);
        lines.push('   Timed Ruling Mode: ' + (trMode ? 'Yes' : 'No'));
        if (t.description) lines.push('   Description: ' + t.description);
        if (Array.isArray(t.blocks) && t.blocks.length > 0) {
            lines.push('   Schedule:');
            t.blocks.forEach(b => {
                lines.push('     - ' + b.name + ' (' + b.time + ')' + (trMode && b.linked ? ' [linked]' : ''));
                if (Array.isArray(b.witnesses) && b.witnesses.length > 0) {
                    const stopwatchMode = t.witnessMode === 'stopwatch';
                    b.witnesses.forEach(w => {
                        const witnessTime = stopwatchMode ? 'Stopwatch' : w.time;
                        lines.push('         • ' + w.name + ' (' + witnessTime + ')' + (trMode && w.linked ? ' [linked]' : ''));
                    });
                }
            });
        }

        const hasProgress = t.timerState && t.timerState.blocks &&
            (t.timerState.blocks.left || t.timerState.blocks.right);
        if (hasProgress) {
            ['left', 'right'].forEach(team => {
                const arr = t.timerState.blocks[team];
                if (!Array.isArray(arr) || arr.length === 0) return;
                const sideLabel = team === 'left' ? (t.plaintiff || 'Plaintiff') : (t.defense || 'Defense');
                lines.push('   ' + sideLabel + ' Progress:');
                arr.forEach(b => {
                    const hasWitnesses = Array.isArray(b.witnesses) && b.witnesses.length > 0;
                    if (hasWitnesses) {
                        const stopwatchMode = t.witnessMode === 'stopwatch';
                        const blockStatus = b.remainingSeconds == null
                            ? 'not started'
                            : 'remaining ' + formatTrialTime(b.remainingSeconds);
                        lines.push('     - ' + b.name + ' (' + blockStatus + '):');
                        b.witnesses.forEach(w => {
                            const isCurrent = t.timerState.currentTeam === team && t.timerState.currentBlockId === b.id &&
                                t.timerState.currentWitnessId === w.id;
                            let status;
                            if (stopwatchMode) {
                                status = 'elapsed ' + formatTrialTime(w.elapsedSeconds || 0);
                            } else {
                                status = w.remainingSeconds == null
                                    ? 'not started'
                                    : 'remaining ' + formatTrialTime(w.remainingSeconds);
                            }
                            lines.push('         • ' + w.name + ' — ' + status +
                                (isCurrent ? ' [current]' : '') + (trMode && w.linked ? ' [linked]' : ''));
                        });
                    } else {
                        const isCurrent = t.timerState.currentTeam === team && t.timerState.currentBlockId === b.id &&
                            !t.timerState.currentWitnessId;
                        const status = b.remainingSeconds == null
                            ? 'not started'
                            : 'remaining ' + formatTrialTime(b.remainingSeconds);
                        lines.push('     - ' + b.name + ' (' + b.time + ') — ' + status +
                            (isCurrent ? ' [current]' : '') + (trMode && b.linked ? ' [linked]' : ''));
                    }
                });
            });
        }

        lines.push('-'.repeat(40));
        lines.push("Exported from Bailiff Mock Trial Timer.");
        lines.push("https://chaowoses.dev/Bailiff")
    });

    return lines.join('\n');
}

function buildJsonExport(trials) {
    return JSON.stringify({
        app: 'bailiff',
        type: 'saved-trials',
        version: 1,
        exportedAt: new Date().toISOString(),
        trials: trials
    }, null, 2);
}

// ===== INFOGRAPHIC EXPORT =====
const INFO_COLORS = {
    ink: '#1a1410',
    panel: '#221c16',
    panel2: '#1e1712',
    border: '#3a2a20',
    borderSoft: '#2a2018',
    cream: '#f0e8d8',
    muted: '#8a7a6a',
    muted2: '#6a5a4a',
    gold: '#c9a84c',
    goldLight: '#e0bc5c',
    red: '#8b1a1a',
    redText: '#d08a8a'
};

const ICON_SCALES_PATHS_D = [
    'M7 20l10 0',
    'M6 6l6 -1l6 1',
    'M12 3l0 17',
    'M9 12l-3 -6l-3 6a3 3 0 0 0 6 0',
    'M21 12l-3 -6l-3 6a3 3 0 0 0 6 0'
];

function parseTimeStr(t) {
    const parts = (t || '00:00').split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function formatInfoDate(d) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function igRoundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function igDrawIcon(ctx, pathsD, x, y, size, color, strokeWidth) {
    ctx.save();
    ctx.translate(x, y);
    const scale = size / 24;
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    pathsD.forEach(d => ctx.stroke(new Path2D(d)));
    ctx.restore();
}

// Manually advances per-character so uppercase "tracked" labels look right
// regardless of whether the browser supports ctx.letterSpacing.
function igTrackedText(ctx, text, x, y, opts) {
    const { align = 'left', tracking = 0, font, color } = opts;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    const chars = [...text];
    const widths = chars.map(ch => ctx.measureText(ch).width);
    const totalWidth = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
    let cx = align === 'center' ? x - totalWidth / 2 : align === 'right' ? x - totalWidth : x;
    ctx.textAlign = 'left';
    chars.forEach((ch, i) => {
        ctx.fillText(ch, cx, y);
        cx += widths[i] + tracking;
    });
    return totalWidth;
}

// TextMetrics.actualBoundingBoxAscent/Descent give the real glyph extents
// (not the font's full line-height), which is what vertical-centering math
// needs. Falls back to rough font-size ratios if a browser lacks them.
function igGlyphAscent(ctx, text, font, fallbackSize) {
    ctx.font = font;
    const m = ctx.measureText(text);
    return typeof m.actualBoundingBoxAscent === 'number' ? m.actualBoundingBoxAscent : fallbackSize * 0.72;
}

function igGlyphDescent(ctx, text, font, fallbackSize) {
    ctx.font = font;
    const m = ctx.measureText(text);
    return typeof m.actualBoundingBoxDescent === 'number' ? m.actualBoundingBoxDescent : fallbackSize * 0.2;
}

function igEllipsize(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
        t = t.slice(0, -1);
    }
    return t.trim() + '…';
}

// Word-wraps to at most maxLines, ellipsizing the final line if content overflows.
function igWrapLines(ctx, text, maxWidth, maxLines) {
    const words = (text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    let i = 0;
    while (i < words.length) {
        const test = current ? current + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = '';
            if (lines.length === maxLines) break;
        } else {
            current = test;
            i++;
        }
    }
    if (lines.length < maxLines && current) {
        lines.push(current);
        i = words.length;
    }
    if (i < words.length && lines.length > 0) {
        lines[lines.length - 1] = igEllipsize(ctx, lines[lines.length - 1] + '…', maxWidth).replace(/…+$/, '…');
    }
    return lines;
}

function igHairline(ctx, x, y, w) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = INFO_COLORS.border;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.strokeStyle = INFO_COLORS.borderSoft;
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x + w, y + 3);
    ctx.stroke();
}

function igCornerBrackets(ctx, x, y, w, h, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy + size * dy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + size * dx, cy);
        ctx.stroke();
    });
    ctx.restore();
}

// Draws one "name / status / progress bar" row for a timeable item — a
// block, or (when the block has witnesses) a witness. Returns the new y.
// Shared by the plain-block and per-witness cases in the Record of
// Proceedings section so the untouched/current/overtime logic lives once.
function igDrawProgressRow(ctx, C, contentX, contentW, y, item, isCurrent) {
    const totalSecs = parseTimeStr(item.time);
    const remaining = item.remainingSeconds;
    // Selecting an item (even without starting it) sets remainingSeconds to
    // the full duration, so "not null" alone doesn't mean it ran — compare
    // against the total to tell untouched items from ones that ticked down.
    const untouched = remaining == null || (totalSecs > 0 && remaining >= totalSecs);
    const isOvertime = !untouched && remaining < 0;

    let fraction, statusText, barColor, textColor;
    if (untouched) {
        fraction = 1;
        statusText = 'Not started — ' + formatTrialTime(totalSecs) + ' left';
        barColor = C.gold;
        textColor = C.muted;
    } else if (isOvertime) {
        fraction = 1;
        statusText = formatTrialTime(Math.abs(remaining)) + ' overtime';
        barColor = C.red;
        textColor = C.redText;
    } else {
        fraction = totalSecs > 0 ? Math.min(1, Math.max(0, remaining / totalSecs)) : 0;
        statusText = formatTrialTime(remaining) + ' left';
        barColor = isCurrent ? C.goldLight : C.gold;
        textColor = C.muted;
    }

    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'left';
    const nameWidth = ctx.measureText(item.name || '').width;
    ctx.fillText(item.name || '', contentX, y);

    if (isCurrent) {
        ctx.font = '800 12px Inter, sans-serif';
        const flagText = 'CURRENT';
        const flagW = ctx.measureText(flagText).width + 16;
        const flagX = contentX + nameWidth + 14;
        const flagY = y - 15;
        igRoundRectPath(ctx, flagX, flagY, flagW, 20, 3);
        ctx.fillStyle = C.gold;
        ctx.fill();
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(flagText, flagX + 8, flagY + 10);
        ctx.textBaseline = 'alphabetic';
    }

    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.fillText(statusText, contentX + contentW, y);

    y += 18;

    igRoundRectPath(ctx, contentX, y, contentW, 14, 7);
    ctx.fillStyle = C.panel2;
    ctx.fill();
    ctx.strokeStyle = C.borderSoft;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (fraction > 0) {
        ctx.save();
        igRoundRectPath(ctx, contentX, y, contentW, 14, 7);
        ctx.clip();
        ctx.fillStyle = barColor;
        ctx.fillRect(contentX, y, contentW * fraction, 14);
        ctx.restore();
    }

    return y + 14 + 24;
}

// A Stopwatch-mode witness has no time budget to draw a bar against — just
// its name, an elapsed readout, and a CURRENT flag when it's the one being
// examined.
function igDrawStopwatchRow(ctx, C, contentX, contentW, y, item, isCurrent) {
    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'left';
    const nameWidth = ctx.measureText(item.name || '').width;
    ctx.fillText(item.name || '', contentX, y);

    if (isCurrent) {
        ctx.font = '800 12px Inter, sans-serif';
        const flagText = 'CURRENT';
        const flagW = ctx.measureText(flagText).width + 16;
        const flagX = contentX + nameWidth + 14;
        const flagY = y - 15;
        igRoundRectPath(ctx, flagX, flagY, flagW, 20, 3);
        ctx.fillStyle = C.gold;
        ctx.fill();
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(flagText, flagX + 8, flagY + 10);
        ctx.textBaseline = 'alphabetic';
    }

    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'right';
    ctx.fillText(formatTrialTime(item.elapsedSeconds || 0) + ' elapsed', contentX + contentW, y);

    return y + 30;
}

// Renders a saved trial as a "docket poster" — draws to an oversized canvas
// first since content height varies a lot (0-2 progress sides, N blocks),
// then crops to the actual content height at the end.
async function buildInfographicCanvas(trial) {
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch {}
    }

    const C = INFO_COLORS;
    const W = 1200;
    const MAX_H = 2600;
    const OUTER = 22;
    const PANEL_X = OUTER;
    const PANEL_W = W - OUTER * 2;
    const PAD_X = 66;
    const contentX = PANEL_X + PAD_X;
    const contentW = PANEL_W - PAD_X * 2;
    const centerX = W / 2;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = MAX_H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = C.border;
    ctx.fillRect(0, 0, W, MAX_H);
    ctx.fillStyle = C.panel;
    ctx.fillRect(PANEL_X, OUTER, PANEL_W, MAX_H - OUTER * 2);

    const trMode = !!(trial.timedRulingMode || trial.advancedMode);
    let y = 108;

    igDrawIcon(ctx, ICON_SCALES_PATHS_D, centerX - 26, y - 26, 52, C.gold, 3);
    y += 42;
    igTrackedText(ctx, 'IN THE CIRCUIT COURT OF MORGAN COUNTY', centerX, y, {
        align: 'center', tracking: 2.2, font: '700 15px Inter, sans-serif', color: C.muted
    });
    y += 46;

    igHairline(ctx, contentX, y, contentW);
    y += 46;

    igTrackedText(ctx, 'IN THE MATTER OF', centerX, y, {
        align: 'center', tracking: 2.6, font: '700 14px Inter, sans-serif', color: C.muted2
    });
    y += 52;

    // "vs." is centered in the gap between the two party lines using actual
    // glyph bounding boxes, not a fixed baseline split — splitting the
    // baselines evenly reads as too low, since the big party text's visual
    // weight sits further above its own baseline than "vs." does above its.
    const plaintiffText = trial.plaintiff || 'Plaintiff';
    const defenseText = trial.defense || 'Defense';
    const partyFont = '700 52px "Playfair Display", Georgia, serif';
    const vsFont = 'italic 600 26px "Playfair Display", Georgia, serif';

    ctx.textAlign = 'center';
    ctx.fillStyle = C.cream;
    ctx.font = partyFont;
    ctx.fillText(plaintiffText, centerX, y);
    const plaintiffBottom = y + igGlyphDescent(ctx, plaintiffText, partyFont, 52);

    const defenseBaseline = y + 92;
    const defenseTop = defenseBaseline - igGlyphAscent(ctx, defenseText, partyFont, 52);

    const vsAscent = igGlyphAscent(ctx, 'vs.', vsFont, 26);
    const vsDescent = igGlyphDescent(ctx, 'vs.', vsFont, 26);
    const vsBaseline = (plaintiffBottom + defenseTop) / 2 + (vsAscent - vsDescent) / 2;

    ctx.font = vsFont;
    ctx.fillStyle = C.gold;
    ctx.fillText('vs.', centerX, vsBaseline);

    ctx.font = partyFont;
    ctx.fillStyle = C.cream;
    ctx.fillText(defenseText, centerX, defenseBaseline);

    y = defenseBaseline + 58;

    // Meta chips: saved date, and a Timed Ruling Mode badge if it applies
    const chips = [];
    if (trial.savedAt) chips.push({ text: 'SAVED ' + formatInfoDate(trial.savedAt).toUpperCase(), accent: false });
    if (trMode) chips.push({ text: 'TIMED RULING MODE', accent: true, icon: true });

    if (chips.length) {
        ctx.font = '700 15px Inter, sans-serif';
        const chipPad = 18, chipGap = 14, chipH = 40, iconSize = 14, iconGap = 8;
        const widths = chips.map(c => ctx.measureText(c.text).width + chipPad * 2 + (c.icon ? iconSize + iconGap : 0));
        const totalW = widths.reduce((a, b) => a + b, 0) + chipGap * (chips.length - 1);
        let cx = centerX - totalW / 2;
        chips.forEach((c, i) => {
            const w = widths[i];
            ctx.strokeStyle = c.accent ? C.gold : C.border;
            ctx.lineWidth = 1.5;
            igRoundRectPath(ctx, cx, y, w, chipH, 4);
            ctx.stroke();
            let tx = cx + chipPad;
            if (c.icon) {
                igDrawIcon(ctx, ICON_SCALES_PATHS_D, tx, y + chipH / 2 - iconSize / 2, iconSize, C.gold, 2);
                tx += iconSize + iconGap;
            }
            ctx.font = '700 15px Inter, sans-serif';
            ctx.fillStyle = c.accent ? C.gold : C.muted;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(c.text, tx, y + chipH / 2 + 1);
            ctx.textBaseline = 'alphabetic';
            cx += w + chipGap;
        });
        y += chipH + 30;
    }

    // Description
    if (trial.description) {
        ctx.font = 'italic 400 20px Inter, sans-serif';
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'center';
        const lines = igWrapLines(ctx, '“' + trial.description + '”', contentW * 0.86, 2);
        lines.forEach(line => {
            ctx.fillText(line, centerX, y);
            y += 28;
        });
        y += 12;
    }

    y += 8;
    igHairline(ctx, contentX, y, contentW);
    y += 50;

    // ===== SCHEDULE OF PROCEEDINGS =====
    const blocks = Array.isArray(trial.blocks) ? trial.blocks : [];
    if (blocks.length) {
        ctx.textAlign = 'left';
        ctx.font = '700 30px "Playfair Display", Georgia, serif';
        ctx.fillStyle = C.cream;
        ctx.fillText('Schedule of Proceedings', contentX, y);

        const totalSecs = blocks.reduce((s, b) => s + parseTimeStr(b.time), 0);
        ctx.font = '600 18px "JetBrains Mono", monospace';
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'right';
        ctx.fillText(formatTrialTime(totalSecs) + ' total', contentX + contentW, y);
        y += 34;

        const rowH = blocks.length > 8 ? 44 : 54;
        const idxColW = 52;
        const timeColW = 130;
        const tagColW = trMode ? 118 : 0;
        const nameColW = contentW - idxColW - timeColW - tagColW - 16;

        blocks.forEach((b, i) => {
            y += rowH;
            const baseline = y - rowH / 2 + 7;

            ctx.textAlign = 'left';
            ctx.font = '600 16px "JetBrains Mono", monospace';
            ctx.fillStyle = C.muted2;
            ctx.fillText(String(i + 1).padStart(2, '0'), contentX, baseline);

            ctx.font = '500 20px Inter, sans-serif';
            ctx.fillStyle = C.cream;
            ctx.fillText(igEllipsize(ctx, b.name || '', nameColW), contentX + idxColW, baseline);

            if (trMode && b.linked) {
                ctx.font = '700 12px Inter, sans-serif';
                const tagText = 'LINKED';
                const tagW = ctx.measureText(tagText).width + 20;
                const tagX = contentX + idxColW + nameColW + 16;
                const tagY = baseline - 20;
                ctx.strokeStyle = C.gold;
                ctx.lineWidth = 1.3;
                igRoundRectPath(ctx, tagX, tagY, tagW, 26, 4);
                ctx.stroke();
                ctx.fillStyle = C.gold;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(tagText, tagX + 10, tagY + 13);
                ctx.textBaseline = 'alphabetic';
            }

            ctx.font = '700 22px "JetBrains Mono", monospace';
            ctx.fillStyle = C.gold;
            ctx.textAlign = 'right';
            ctx.fillText(b.time || '', contentX + contentW, baseline + 1);

            if (i < blocks.length - 1) {
                ctx.strokeStyle = C.borderSoft;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(contentX, y + rowH * 0.3);
                ctx.lineTo(contentX + contentW, y + rowH * 0.3);
                ctx.stroke();
            }

            // Nested witnesses, indented under their parent block
            const witnesses = Array.isArray(b.witnesses) ? b.witnesses : [];
            if (witnesses.length) {
                const stopwatchMode = trial.witnessMode === 'stopwatch';
                const witIndentX = contentX + idxColW + 16;
                const witNameColW = contentW - (idxColW + 16) - timeColW - 16;
                const witRowH = 30;
                witnesses.forEach(w => {
                    y += witRowH;
                    ctx.textAlign = 'left';
                    ctx.font = '400 15px Inter, sans-serif';
                    ctx.fillStyle = C.muted;
                    ctx.fillText('– ' + igEllipsize(ctx, w.name || '', witNameColW), witIndentX, y);

                    ctx.font = '600 15px "JetBrains Mono", monospace';
                    ctx.fillStyle = C.muted;
                    ctx.textAlign = 'right';
                    ctx.fillText(stopwatchMode ? 'Stopwatch' : (w.time || ''), contentX + contentW, y);
                });
                y += 6;
            }
        });
        y += rowH * 0.4;
    }

    // ===== RECORD OF PROCEEDINGS (per-side progress, if this trial has any) =====
    const tsBlocks = trial.timerState && trial.timerState.blocks;
    const hasProgress = tsBlocks && ((Array.isArray(tsBlocks.left) && tsBlocks.left.length) || (Array.isArray(tsBlocks.right) && tsBlocks.right.length));

    if (hasProgress) {
        y += 34;
        igHairline(ctx, contentX, y, contentW);
        y += 50;

        ctx.textAlign = 'left';
        ctx.font = '700 30px "Playfair Display", Georgia, serif';
        ctx.fillStyle = C.cream;
        ctx.fillText('Record of Proceedings', contentX, y);
        y += 44;

        ['left', 'right'].forEach(team => {
            const arr = tsBlocks[team];
            if (!Array.isArray(arr) || arr.length === 0) return;

            const sideLabel = team === 'left' ? (trial.plaintiff || 'Plaintiff') : (trial.defense || 'Defense');
            igTrackedText(ctx, sideLabel.toUpperCase(), contentX, y, {
                align: 'left', tracking: 1.8, font: '700 15px Inter, sans-serif', color: C.muted
            });
            y += 30;

            arr.forEach(b => {
                const witnesses = Array.isArray(b.witnesses) ? b.witnesses : [];
                if (witnesses.length) {
                    // The block itself always has a real, independent
                    // progress value now (it ticks down ambiently whenever
                    // any witness runs), so it's worth a status readout
                    // alongside its name even though it's never "current".
                    const stopwatchMode = trial.witnessMode === 'stopwatch';
                    const blockTotal = parseTimeStr(b.time);
                    const blockRemaining = b.remainingSeconds != null ? b.remainingSeconds : blockTotal;
                    const blockStatus = formatTrialTime(blockRemaining) + (blockRemaining < 0 ? ' overtime' : ' left');

                    ctx.font = '600 15px Inter, sans-serif';
                    ctx.fillStyle = C.cream;
                    ctx.textAlign = 'left';
                    ctx.fillText(b.name || '', contentX, y);

                    ctx.font = '600 14px "JetBrains Mono", monospace';
                    ctx.fillStyle = blockRemaining < 0 ? C.redText : C.muted;
                    ctx.textAlign = 'right';
                    ctx.fillText(blockStatus, contentX + contentW, y);

                    y += 22;

                    const witIndent = 24;
                    witnesses.forEach(w => {
                        const isCurrent = trial.timerState.currentTeam === team && trial.timerState.currentBlockId === b.id &&
                            trial.timerState.currentWitnessId === w.id;
                        y = stopwatchMode
                            ? igDrawStopwatchRow(ctx, C, contentX + witIndent, contentW - witIndent, y, w, isCurrent)
                            : igDrawProgressRow(ctx, C, contentX + witIndent, contentW - witIndent, y, w, isCurrent);
                    });
                    y += 4;
                } else {
                    const isCurrent = trial.timerState.currentTeam === team && trial.timerState.currentBlockId === b.id &&
                        !trial.timerState.currentWitnessId;
                    y = igDrawProgressRow(ctx, C, contentX, contentW, y, b, isCurrent);
                }
            });

            y += 8;
        });
    }

    // ===== FOOTER =====
    y += 30;
    ctx.textAlign = 'left';
    igTrackedText(ctx, 'BAILIFF — MOCK TRIAL TIMER', contentX, y, {
        align: 'left', tracking: 1.6, font: '700 14px Inter, sans-serif', color: C.muted2
    });
    y += 28;
    igTrackedText(ctx, 'CHAOWOSES.DEV/BAILIFF', contentX, y, {
        align: 'left', tracking: 1.2, font: '600 13px Inter, sans-serif', color: C.muted2
    });
    igTrackedText(ctx, 'GENERATED ' + formatInfoDate(new Date()).toUpperCase(), contentX + contentW, y, {
        align: 'right', tracking: 1.2, font: '600 13px Inter, sans-serif', color: C.muted2
    });

    const panelBottom = y + 56;
    const finalH = panelBottom + OUTER;

    // Border + corner brackets, sized to the real content bounds now that we know them
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(PANEL_X + 1, OUTER + 1, PANEL_W - 2, (finalH - OUTER) - OUTER - 2);
    igCornerBrackets(ctx, PANEL_X + 16, OUTER + 16, PANEL_W - 32, (finalH - OUTER) - OUTER - 32, 16, C.gold);

    // The draft canvas's panel fill runs all the way to MAX_H (we don't know
    // the real content height until now), so cropping to finalH would leave
    // panel color showing through the bottom OUTER margin instead of a clean
    // border-color frame like the top has. Paint the frame color first, then
    // stamp only the real content (up to the bottom margin) on top of it.
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = W;
    finalCanvas.height = finalH;
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.fillStyle = C.border;
    finalCtx.fillRect(0, 0, W, finalH);
    finalCtx.drawImage(canvas, 0, 0, W, finalH - OUTER, 0, 0, W, finalH - OUTER);
    return finalCanvas;
}

function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not render PNG')), 'image/png');
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function currentExportFormat() {
    const checked = document.querySelector('input[name="export-format"]:checked');
    return checked ? checked.value : 'readable';
}

let pendingExportTrialId = null;

function currentExportText() {
    const trial = getSavedTrials().find(t => t.id === pendingExportTrialId);
    const trials = trial ? [trial] : [];
    return currentExportFormat() === 'json' ? buildJsonExport(trials) : buildReadableExport(trials);
}

function slugify(text) {
    return (text || 'trial').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trial';
}

function setExportStatus(message, isError) {
    const el = document.getElementById('export-status');
    el.textContent = message;
    el.classList.toggle('error', !!isError);
}

function openExportDialog(trialId) {
    const trial = getSavedTrials().find(t => t.id === trialId);
    if (!trial) return;
    pendingExportTrialId = trialId;
    document.getElementById('export-dialog-title').textContent = 'Export "' + trial.name + '"';
    setExportStatus('');
    document.getElementById('export-dialog-overlay').classList.remove('hidden');
}

document.getElementById('export-dialog-cancel').addEventListener('click', () => {
    document.getElementById('export-dialog-overlay').classList.add('hidden');
});

document.getElementById('export-dialog-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('export-dialog-overlay')) {
        document.getElementById('export-dialog-overlay').classList.add('hidden');
    }
});

document.querySelectorAll('input[name="export-format"]').forEach(input => {
    input.addEventListener('change', () => {
        document.querySelectorAll('.export-format-option').forEach(opt => {
            opt.classList.toggle('active', opt.querySelector('input').checked);
        });
        setExportStatus('');
    });
});

document.getElementById('export-copy-btn').addEventListener('click', async () => {
    const format = currentExportFormat();

    if (format === 'image') {
        setExportStatus('Rendering image…');
        try {
            const trial = getSavedTrials().find(t => t.id === pendingExportTrialId);
            if (!trial) throw new Error('Trial not found');
            const blob = await canvasToPngBlob(await buildInfographicCanvas(trial));
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            setExportStatus('Copied image to clipboard.');
        } catch {
            setExportStatus('Could not copy image to clipboard.', true);
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(currentExportText());
        setExportStatus('Copied to clipboard.');
    } catch {
        setExportStatus('Could not copy to clipboard.', true);
    }
});

document.getElementById('export-download-btn').addEventListener('click', async () => {
    const format = currentExportFormat();
    const trial = getSavedTrials().find(t => t.id === pendingExportTrialId);
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = 'bailiff-' + slugify(trial ? trial.name : 'trial') + '-' + stamp;

    if (format === 'image') {
        setExportStatus('Rendering image…');
        try {
            if (!trial) throw new Error('Trial not found');
            const blob = await canvasToPngBlob(await buildInfographicCanvas(trial));
            downloadBlob(blob, baseName + '.png');
            setExportStatus('Image downloaded.');
        } catch {
            setExportStatus('Could not render image.', true);
        }
        return;
    }

    const isJson = format === 'json';
    const blob = new Blob([currentExportText()], { type: isJson ? 'application/json' : 'text/plain' });
    downloadBlob(blob, baseName + (isJson ? '.json' : '.txt'));
    setExportStatus('File downloaded.');
});

// ===== IMPORT SAVED TRIALS =====
function setImportTab(tab) {
    document.getElementById('import-tab-upload').classList.toggle('active', tab === 'upload');
    document.getElementById('import-tab-paste').classList.toggle('active', tab === 'paste');
    document.getElementById('import-panel-upload').classList.toggle('hidden', tab !== 'upload');
    document.getElementById('import-panel-paste').classList.toggle('hidden', tab !== 'paste');
    document.getElementById('import-paste-btn').classList.toggle('hidden', tab !== 'paste');
}

document.getElementById('import-tab-upload').addEventListener('click', () => setImportTab('upload'));
document.getElementById('import-tab-paste').addEventListener('click', () => setImportTab('paste'));

function showImportError(message) {
    const el = document.getElementById('import-error');
    el.textContent = message;
    el.classList.remove('hidden');
}

function clearImportError() {
    document.getElementById('import-error').classList.add('hidden');
}

// Shared by both trial and preset import validation — checks that each
// block's nested witnesses (if any) are at least shaped like witnesses.
function validateBlocksShape(entryLabel, blocksArr) {
    for (let bi = 0; bi < blocksArr.length; bi++) {
        const b = blocksArr[bi];
        if (b && b.witnesses !== undefined) {
            if (!Array.isArray(b.witnesses)) {
                return entryLabel + ', block ' + (bi + 1) + ' has an invalid "witnesses" field.';
            }
            for (let wi = 0; wi < b.witnesses.length; wi++) {
                const w = b.witnesses[wi];
                if (!w || typeof w !== 'object' || Array.isArray(w) || typeof w.name !== 'string' || !w.name.trim()) {
                    return entryLabel + ', block ' + (bi + 1) + ', witness ' + (wi + 1) + ' is missing a name.';
                }
            }
        }
    }
    return null;
}

// Accepts either the wrapped export format ({ trials: [...] }) or a bare array of trials.
function extractTrialsArray(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.trials)) return parsed.trials;
    return null;
}

function validateAndParseImport(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { error: 'That file isn\'t valid JSON.' };
    }

    const rawTrials = extractTrialsArray(parsed);
    if (rawTrials === null) {
        return { error: 'Unrecognized format. Expected a Bailiff saved trials export.' };
    }
    if (rawTrials.length === 0) {
        return { error: 'No trials found in this file.' };
    }

    const trials = [];
    for (let i = 0; i < rawTrials.length; i++) {
        const t = rawTrials[i];
        if (!t || typeof t !== 'object' || Array.isArray(t)) {
            return { error: 'Entry ' + (i + 1) + ' is not a valid trial object.' };
        }
        if (typeof t.name !== 'string' || !t.name.trim()) {
            return { error: 'Entry ' + (i + 1) + ' is missing a name.' };
        }
        if (t.blocks !== undefined && !Array.isArray(t.blocks)) {
            return { error: 'Entry ' + (i + 1) + ' has an invalid "blocks" field.' };
        }
        if (Array.isArray(t.blocks)) {
            const err = validateBlocksShape('Entry ' + (i + 1), t.blocks);
            if (err) return { error: err };
        }
        trials.push(t);
    }

    return { trials };
}

function importTrials(text) {
    const result = validateAndParseImport(text);
    if (result.error) {
        showImportError(result.error);
        return;
    }

    const existing = getSavedTrials();
    const imported = result.trials.map((t, i) => ({
        ...t,
        id: 'trial-' + Date.now() + '-' + i,
        savedAt: (t.savedAt && !isNaN(new Date(t.savedAt))) ? t.savedAt : new Date().toISOString()
    }));

    saveSavedTrials(existing.concat(imported));
    renderSavedTrials();
    clearImportError();
    document.getElementById('import-dialog-overlay').classList.add('hidden');
}

// Accepts either the wrapped export format ({ presets: [...] }) or a bare array of presets.
function extractPresetsArray(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.presets)) return parsed.presets;
    return null;
}

function validateAndParsePresetImport(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { error: 'That file isn\'t valid JSON.' };
    }

    const rawPresets = extractPresetsArray(parsed);
    if (rawPresets === null) {
        return { error: 'Unrecognized format. Expected a Bailiff presets export.' };
    }
    if (rawPresets.length === 0) {
        return { error: 'No presets found in this file.' };
    }

    const presets = [];
    for (let i = 0; i < rawPresets.length; i++) {
        const p = rawPresets[i];
        if (!p || typeof p !== 'object' || Array.isArray(p)) {
            return { error: 'Entry ' + (i + 1) + ' is not a valid preset object.' };
        }
        if (typeof p.name !== 'string' || !p.name.trim()) {
            return { error: 'Entry ' + (i + 1) + ' is missing a name.' };
        }
        if (p.blocks !== undefined && !Array.isArray(p.blocks)) {
            return { error: 'Entry ' + (i + 1) + ' has an invalid "blocks" field.' };
        }
        if (Array.isArray(p.blocks)) {
            const err = validateBlocksShape('Entry ' + (i + 1), p.blocks);
            if (err) return { error: err };
        }
        presets.push(p);
    }

    return { presets };
}

function importPresets(text) {
    const result = validateAndParsePresetImport(text);
    if (result.error) {
        showImportError(result.error);
        return;
    }

    // The built-in VLRE preset is reserved — an imported entry can't
    // masquerade as it, and savePresets() strips builtin entries anyway.
    const existing = getPresets().filter(p => !p.builtin);
    const imported = result.presets.map((p, i) => ({
        ...p,
        id: 'preset-' + Date.now() + '-' + i,
        builtin: false,
        savedAt: (p.savedAt && !isNaN(new Date(p.savedAt))) ? p.savedAt : new Date().toISOString()
    }));

    savePresets(existing.concat(imported));
    renderPresets();
    clearImportError();
    document.getElementById('import-dialog-overlay').classList.add('hidden');
}

// Which list an open import dialog is targeting — set by whichever
// "Import from JSON" button opened it, read by the upload/paste handlers.
let pendingImportType = 'trials';

function openImportDialog(type) {
    pendingImportType = type;
    clearImportError();
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-paste-input').value = '';
    document.getElementById('import-dialog-title').textContent = type === 'presets' ? 'Import Presets' : 'Import Saved Trials';
    setImportTab('upload');
    document.getElementById('import-dialog-overlay').classList.remove('hidden');
}

function performImport(text) {
    if (pendingImportType === 'presets') importPresets(text);
    else importTrials(text);
}

document.getElementById('import-trials-btn').addEventListener('click', () => openImportDialog('trials'));
document.getElementById('import-presets-btn').addEventListener('click', () => openImportDialog('presets'));

document.getElementById('import-dialog-cancel').addEventListener('click', () => {
    document.getElementById('import-dialog-overlay').classList.add('hidden');
});

document.getElementById('import-dialog-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('import-dialog-overlay')) {
        document.getElementById('import-dialog-overlay').classList.add('hidden');
    }
});

function readImportFile(file) {
    if (!file) return;
    if (!/\.json$/i.test(file.name) && file.type && file.type !== 'application/json') {
        showImportError('Please choose a .json file.');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => performImport(String(reader.result || ''));
    reader.onerror = () => showImportError('Could not read that file.');
    reader.readAsText(file);
}

const importDropzone = document.getElementById('import-dropzone');
const importFileInput = document.getElementById('import-file-input');

importDropzone.addEventListener('click', () => importFileInput.click());
importDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        importFileInput.click();
    }
});

importFileInput.addEventListener('change', () => {
    readImportFile(importFileInput.files[0]);
});

importDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    importDropzone.classList.add('dragover');
});

importDropzone.addEventListener('dragleave', () => {
    importDropzone.classList.remove('dragover');
});

importDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    importDropzone.classList.remove('dragover');
    readImportFile(e.dataTransfer.files[0]);
});

document.getElementById('import-paste-btn').addEventListener('click', () => {
    const text = document.getElementById('import-paste-input').value.trim();
    if (!text) {
        showImportError('Paste some JSON first.');
        return;
    }
    performImport(text);
});

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

restoreSetupSession();
document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === globalWitnessMode);
});
updateLinkVisibility();
renderBlocks();
renderSavedTrials();
renderPresets();

function setPlaceholderCase() {
    if (FAMOUS_CASES.length === 0) return;
    const randomCase = FAMOUS_CASES[Math.floor(Math.random() * FAMOUS_CASES.length)];
    pNameInput.placeholder = randomCase.p;
    dNameInput.placeholder = randomCase.d;
}

setPlaceholderCase();