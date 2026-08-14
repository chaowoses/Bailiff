import { escapeHtml } from '../shared/dom-utils.js';
import { ICON_TRASH } from './icons.js';
import { pNameInput, dNameInput } from './dom.js';
import { FAMOUS_CASES } from './cases.js';
// case-library.js and import.js/export.js import from each other (this needs
// openImportDialog/openCustomCasesExportDialog, they need getCustomCases/
// saveCustomCases) — safe circular import, same reasoning as
// blocks.js/witnesses.js and presets.js/export.js.
import { openImportDialog } from './import.js';
import { openCustomCasesExportDialog } from './export.js';
import { showDeleteConfirm } from './dialogs.js';

const CUSTOM_CASES_KEY = 'bailiff_custom_cases';
const DISABLED_FAMOUS_KEY = 'bailiff_disabled_famous_cases';

// ===== CUSTOM CASES =====
export function getCustomCases() {
    try {
        const arr = JSON.parse(localStorage.getItem(CUSTOM_CASES_KEY));
        return Array.isArray(arr) ? arr : [];
    } catch { return []; }
}

export function saveCustomCases(cases) {
    localStorage.setItem(CUSTOM_CASES_KEY, JSON.stringify(cases));
}

// ===== FAMOUS CASE ENABLE/DISABLE =====
// Disabled famous cases are tracked by index into FAMOUS_CASES rather than by
// name — simpler than deriving a stable text key, and the list only changes
// between app releases, not at runtime.
function getDisabledFamousIndexes() {
    try {
        const arr = JSON.parse(localStorage.getItem(DISABLED_FAMOUS_KEY));
        return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
}

function saveDisabledFamousIndexes(set) {
    localStorage.setItem(DISABLED_FAMOUS_KEY, JSON.stringify([...set]));
}

function getEnabledFamousCases() {
    const disabled = getDisabledFamousIndexes();
    return FAMOUS_CASES.filter((c, i) => !disabled.has(i));
}

// ===== PLACEHOLDER =====
export function updateCasePlaceholder() {
    const pool = getEnabledFamousCases().concat(getCustomCases());
    if (pool.length === 0) {
        pNameInput.placeholder = 'Plaintiff';
        dNameInput.placeholder = 'Defense';
        return;
    }
    const picked = pool[Math.floor(Math.random() * pool.length)];
    pNameInput.placeholder = picked.p;
    dNameInput.placeholder = picked.d;
}

// ===== DIALOG RENDERING =====
// Reset whenever the dialog is freshly opened (not on every re-render, so a
// background refresh — e.g. after importing custom cases — doesn't clobber
// an in-progress search).
let famousSearchQuery = '';

function famousCaseMatches(c, query) {
    if (!query) return true;
    return (c.p + ' ' + c.d).toLowerCase().includes(query);
}

// Indexes into FAMOUS_CASES for whatever the current search query matches —
// what's actually on screen, so Enable All / Disable All can act on just
// that subset instead of the whole list.
function visibleFamousIndexes() {
    const query = famousSearchQuery.trim().toLowerCase();
    return FAMOUS_CASES
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => famousCaseMatches(c, query))
        .map(({ i }) => i);
}

function renderFamousCasesList() {
    const disabled = getDisabledFamousIndexes();
    const list = document.getElementById('famous-cases-list');
    const rows = visibleFamousIndexes().map(i => ({ c: FAMOUS_CASES[i], i }));

    if (rows.length === 0) {
        list.innerHTML = '<div class="case-lib-empty">No matching cases found.</div>';
        return;
    }

    list.innerHTML = rows.map(({ c, i }) =>
        '<div class="case-lib-row' + (disabled.has(i) ? '' : ' selected') + '" data-idx="' + i + '">' +
            '<span class="case-lib-row-text">' + escapeHtml(c.p) + ' <span class="case-lib-row-vs">v.</span> ' + escapeHtml(c.d) + '</span>' +
        '</div>'
    ).join('');

    list.querySelectorAll('.case-lib-row').forEach(row => {
        row.addEventListener('click', () => {
            const idx = Number(row.dataset.idx);
            const disabledSet = getDisabledFamousIndexes();
            if (disabledSet.has(idx)) disabledSet.delete(idx); else disabledSet.add(idx);
            saveDisabledFamousIndexes(disabledSet);
            row.classList.toggle('selected');
            updateCasePlaceholder();
        });
    });
}

function renderCustomCasesList() {
    const cases = getCustomCases();
    const list = document.getElementById('custom-cases-list');

    if (cases.length === 0) {
        list.innerHTML = '<div class="case-lib-empty">No custom cases yet. Add one below, or import a list.</div>';
        return;
    }

    list.innerHTML = cases.map(c =>
        '<div class="case-lib-custom-row" data-id="' + c.id + '">' +
            '<span class="case-lib-row-text">' + escapeHtml(c.p) + ' <span class="case-lib-row-vs">v.</span> ' + escapeHtml(c.d) + '</span>' +
            '<button type="button" class="case-lib-remove-btn" data-id="' + c.id + '" title="Remove Case" aria-label="Remove Case">' + ICON_TRASH + '</button>' +
        '</div>'
    ).join('');

    list.querySelectorAll('.case-lib-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            saveCustomCases(getCustomCases().filter(c => c.id !== btn.dataset.id));
            renderCustomCasesList();
            updateCasePlaceholder();
        });
    });
}

export function renderCaseLibraryDialog() {
    renderFamousCasesList();
    renderCustomCasesList();
}

// Scoped to whatever the search currently shows — with no query that's
// every case, matching the old "affects everything" behavior.
function setAllFamousEnabled(enabled) {
    const disabledSet = getDisabledFamousIndexes();
    visibleFamousIndexes().forEach(i => {
        if (enabled) disabledSet.delete(i); else disabledSet.add(i);
    });
    saveDisabledFamousIndexes(disabledSet);
    renderFamousCasesList();
    updateCasePlaceholder();
}

function addCustomCaseFromInputs() {
    const pInput = document.getElementById('custom-case-p-input');
    const dInput = document.getElementById('custom-case-d-input');
    const p = pInput.value.trim();
    const d = dInput.value.trim();
    if (!p || !d) return;

    const cases = getCustomCases();
    cases.push({ id: 'case-' + Date.now(), p, d });
    saveCustomCases(cases);

    pInput.value = '';
    dInput.value = '';
    renderCustomCasesList();
    updateCasePlaceholder();
    pInput.focus();
}

function clearAllCustomCases() {
    if (getCustomCases().length === 0) return;
    showDeleteConfirm(
        'Clear All Custom Cases?',
        'This will permanently remove every custom case name suggestion you\'ve added.',
        () => {
            saveCustomCases([]);
            renderCustomCasesList();
            updateCasePlaceholder();
        },
        'Clear All'
    );
}

// ===== WIRING =====
document.getElementById('case-library-btn').addEventListener('click', () => {
    famousSearchQuery = '';
    document.getElementById('famous-cases-search').value = '';
    renderCaseLibraryDialog();
    document.getElementById('case-library-overlay').classList.remove('hidden');
});

document.getElementById('famous-cases-search').addEventListener('input', (e) => {
    famousSearchQuery = e.target.value;
    renderFamousCasesList();
});

document.getElementById('case-library-close').addEventListener('click', () => {
    document.getElementById('case-library-overlay').classList.add('hidden');
});

document.getElementById('case-library-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('case-library-overlay')) {
        document.getElementById('case-library-overlay').classList.add('hidden');
    }
});

document.getElementById('famous-cases-enable-all').addEventListener('click', () => setAllFamousEnabled(true));
document.getElementById('famous-cases-disable-all').addEventListener('click', () => setAllFamousEnabled(false));

document.getElementById('custom-case-add-btn').addEventListener('click', addCustomCaseFromInputs);
['custom-case-p-input', 'custom-case-d-input'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCustomCaseFromInputs();
        }
    });
});

document.getElementById('custom-cases-import-btn').addEventListener('click', () => openImportDialog('cases'));
document.getElementById('custom-cases-export-btn').addEventListener('click', () => openCustomCasesExportDialog());
document.getElementById('custom-cases-clear-all').addEventListener('click', clearAllCustomCases);
