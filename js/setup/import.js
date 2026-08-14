import { getSavedTrials, saveSavedTrials, renderSavedTrials } from './saved-trials.js';
import { getPresets, savePresets, renderPresets } from './presets.js';

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
