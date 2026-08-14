import { escapeHtml } from '../shared/dom-utils.js';
import { ICON_SCALES, ICON_INFO } from './icons.js';
import { timedRulingToggle } from './dom.js';
import { state, saveSetupSession, highestUsedId } from './state.js';
import { renderBlocks } from './blocks.js';
import { showDeleteConfirm } from './dialogs.js';
// presets.js and export.js import from each other (this needs
// openPresetExportDialog, export.js needs getPresets) — safe circular
// import, same reasoning as blocks.js/witnesses.js.
import { openPresetExportDialog } from './export.js';

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
export function getPresets() {
    const presets = [VLRE_PRESET];
    try {
        const saved = JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
        saved.forEach(p => presets.push(p));
    } catch {}
    return presets;
}

export function savePresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.filter(p => !p.builtin)));
}

export function openSavePresetDialog(editPreset) {
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
            existing.witnessMode = state.globalWitnessMode;
            existing.blocks = JSON.parse(JSON.stringify(state.blocks));
            existing.savedAt = new Date().toISOString();
        }
    } else {
        presets.push({
            id: 'preset-' + Date.now(),
            name: name,
            description: desc,
            savedAt: new Date().toISOString(),
            advancedMode: trMode,
            witnessMode: state.globalWitnessMode,
            blocks: JSON.parse(JSON.stringify(state.blocks))
        });
    }

    savePresets(presets);
    document.getElementById('preset-dialog-overlay').classList.add('hidden');
    renderPresets();
}

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

export function loadPreset(presetId) {
    const presets = getPresets();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    state.blocks = JSON.parse(JSON.stringify(preset.blocks));
    state.nextId = highestUsedId(state.blocks) + 1;
    state.globalWitnessMode = preset.witnessMode || 'allocated';
    document.querySelectorAll('#witness-mode-toggle .witness-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === state.globalWitnessMode);
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

export function deletePreset(presetId) {
    if (presetId === 'preset-vlre') return;
    let presets = getPresets();
    presets = presets.filter(p => p.id !== presetId);
    savePresets(presets);
    renderPresets();
}

export function renderPresets() {
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
                        preset.blocks = JSON.parse(JSON.stringify(state.blocks));
                        preset.advancedMode = timedRulingToggle.checked;
                        preset.witnessMode = state.globalWitnessMode;
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
    openPresetExportDialog(presetId);
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
