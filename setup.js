let blocks = [
    { id: 1, name: "Opening Statement", time: "05:00", linked: null },
    { id: 2, name: "Direct Examination", time: "25:00", linked: 3 },
    { id: 3, name: "Cross Examination", time: "20:00", linked: 2 },
    { id: 4, name: "Closing Argument", time: "05:00", linked: null }
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
let nextBlockId = 5;

const SS_SESSION_KEY = 'bailiff_setup_session';

function saveSetupSession() {
    try {
        sessionStorage.setItem(SS_SESSION_KEY, JSON.stringify({
            blocks, nextBlockId
        }));
    } catch {}
}

function restoreSetupSession() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(SS_SESSION_KEY));
        if (saved) {
            blocks = saved.blocks;
            nextBlockId = saved.nextBlockId;
            return true;
        }
    } catch {}
    return false;
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

function updateLinkVisibility() {
    linkLabel.style.display = timedRulingToggle.checked ? 'flex' : 'none';
}

timedRulingToggle.addEventListener('change', () => {
    timedRulingToggle.closest('.schedule-toggle').classList.toggle('schedule-toggle--active', timedRulingToggle.checked);
    updateLinkVisibility();
    renderBlocks();
    saveSetupSession();
});

function createBlockElement(block, index) {
    const div = document.createElement("div");
    div.className = "block-card";
    div.dataset.id = block.id;
    div.setAttribute("draggable", "true");

    let badgeHtml = '';
    if (block.linked && timedRulingToggle.checked) {
        const linkedBlock = blocks.find(b => b.id === block.linked);
        if (linkedBlock) {
            badgeHtml = `<span class="block-linked-badge">${ICON_SCALES} ${escapeHtml(linkedBlock.name)}<span class="badge-info-icon">${ICON_INFO}</span></span>`;
        }
    }

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

editTimeInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 4) v = v.slice(0, 4);
    if (v.length >= 3) v = v.slice(0, v.length - 2) + ':' + v.slice(v.length - 2);
    e.target.value = v;
});

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
        blocks = blocks.filter(b => b.id !== id);
        blocks.forEach(b => { if (b.linked === id) b.linked = null; });
        syncArrayOrder();
    }, 400);
}

function renderBlocks() {
    blockList.innerHTML = '';
    blocks.forEach((b, i) => blockList.appendChild(createBlockElement(b, i)));
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
    const newB = { id: nextBlockId++, name: "New Block", time: "01:00", linked: null };
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
    { id: 2, name: "Direct Examination", time: "25:00", linked: 3 },
    { id: 3, name: "Cross Examination", time: "20:00", linked: 2 },
    { id: 4, name: "Closing Argument", time: "05:00", linked: null }
];

const PRESETS_KEY = 'bailiff_presets';
const SAVED_TRIALS_KEY = 'bailiff_saved_trials';

const VLRE_PRESET = {
    id: 'preset-vlre',
    name: 'VLRE',
    description: 'For VLRE (Virginia Law-Related Education) competitions.',
    savedAt: null,
    builtin: true,
    advancedMode: false,
    timedRulingMode: false,
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
    nextBlockId = blocks.length > 0 ? Math.max(...blocks.map(b => b.id), 0) + 1 : 1;
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
    list.querySelectorAll('.preset-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => showDeleteConfirm('Delete this preset?', 'This preset will be permanently removed.', () => deletePreset(btn.dataset.id)));
    });
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
                    const secs = block.remainingSeconds != null ? block.remainingSeconds : 0;
                    const absSecs = Math.abs(secs);
                    const mins = Math.floor(absSecs / 60);
                    const secsDisplay = absSecs % 60;
                    const prefix = secs < 0 ? '-' : '';
                    const timeStr = prefix + String(mins).padStart(2, '0') + ':' + String(secsDisplay).padStart(2, '0');
                    const sideLabel = team === 'left' ? (t.plaintiff || 'Plaintiff') : (t.defense || 'Defense');
                    progressHtml = '<div class="saved-trial-progress">' + escapeHtml(sideLabel) + ' &mdash; ' + escapeHtml(block.name) + ' &middot; ' + timeStr + '</div>';
                }
            }
        }

        const descHtml = t.description ? '<div class="saved-trial-desc">' + escapeHtml(t.description) + '</div>' : '';
        const trBadge = (t.timedRulingMode || t.advancedMode) ? '<span class="saved-trial-badge tr-mode-badge">' + ICON_SCALES + 'Timed Ruling Mode<span class="badge-info-icon">' + ICON_INFO + '</span></span>' : '';
        html += '<div class="saved-trial-card">' +
            '<div class="saved-trial-info">' +
                '<div class="saved-trial-name">' + escapeHtml(t.name) + trBadge + '</div>' +
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
        lines.push((i + 1) + '. ' + (t.name || 'Untitled Trial'));
        if (t.savedAt) lines.push('   Saved: ' + new Date(t.savedAt).toLocaleString());
        if (t.plaintiff) lines.push('   Plaintiff: ' + t.plaintiff);
        if (t.defense) lines.push('   Defense: ' + t.defense);
        lines.push('   Timed Ruling Mode: ' + ((t.timedRulingMode || t.advancedMode) ? 'Yes' : 'No'));
        if (t.description) lines.push('   Description: ' + t.description);
        if (Array.isArray(t.blocks) && t.blocks.length > 0) {
            const trMode = t.timedRulingMode || t.advancedMode;
            lines.push('   Blocks:');
            t.blocks.forEach(b => {
                lines.push('     - ' + b.name + ' (' + b.time + ')' + (trMode && b.linked ? ' [linked]' : ''));
            });
        }
        if (t.timerState && t.timerState.currentBlockId && t.timerState.currentTeam) {
            const team = t.timerState.currentTeam;
            const blockArr = t.timerState.blocks ? t.timerState.blocks[team] : null;
            const block = blockArr ? blockArr.find(b => b.id === t.timerState.currentBlockId) : null;
            if (block) {
                const sideLabel = team === 'left' ? (t.plaintiff || 'Plaintiff') : (t.defense || 'Defense');
                lines.push('   Progress: ' + sideLabel + ' — ' + block.name + ' · ' + formatTrialTime(block.remainingSeconds || 0));
            }
        }
        lines.push('-'.repeat(40));
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
    try {
        await navigator.clipboard.writeText(currentExportText());
        setExportStatus('Copied to clipboard.');
    } catch {
        setExportStatus('Could not copy to clipboard.', true);
    }
});

document.getElementById('export-download-btn').addEventListener('click', () => {
    const format = currentExportFormat();
    const isJson = format === 'json';
    const trial = getSavedTrials().find(t => t.id === pendingExportTrialId);
    const blob = new Blob([currentExportText()], { type: isJson ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'bailiff-' + slugify(trial ? trial.name : 'trial') + '-' + stamp + (isJson ? '.json' : '.txt');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

document.getElementById('import-trials-btn').addEventListener('click', () => {
    clearImportError();
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-paste-input').value = '';
    setImportTab('upload');
    document.getElementById('import-dialog-overlay').classList.remove('hidden');
});

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
    reader.onload = () => importTrials(String(reader.result || ''));
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
    importTrials(text);
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

// Delegate badge info clicks (badges are re-rendered)
document.addEventListener('click', (e) => {
    const badgeInfo = e.target.closest('.badge-info-icon');
    if (badgeInfo) {
        trModeOverlay.classList.remove('hidden');
    }
});

restoreSetupSession();
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

loadFamousCases();