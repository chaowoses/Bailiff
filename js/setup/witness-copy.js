import { state, saveSetupSession } from './state.js';
import { witnessGroupLabel, renderWitnessSection } from './witnesses.js';
import { updateBlockTimeDisplay } from './blocks.js';

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
    state.blocks.forEach(b => {
        if (b.id !== state.currentEditingId && b.witnesses && b.witnesses.length) {
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
    const sourceBlock = state.blocks.find(b => b.id === witnessCopySourceBlockId);

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
    if (state.currentEditingId != null) openWitnessCopyDialog();
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
        const sourceBlock = state.blocks.find(b => b.id === witnessCopySourceBlockId);
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
    if (witnessCopySourceBlockId == null || witnessCopySelectedIds.size === 0 || state.currentEditingId == null) return;
    const sourceBlock = state.blocks.find(b => b.id === witnessCopySourceBlockId);
    const targetBlock = state.blocks.find(b => b.id === state.currentEditingId);
    if (!sourceBlock || !targetBlock) return;

    const opposing = witnessCopySideMode === 'opposing';
    if (!targetBlock.witnesses) targetBlock.witnesses = [];

    sourceBlock.witnesses.forEach(w => {
        if (!witnessCopySelectedIds.has(w.id)) return;
        const newId = state.nextId++;
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
