// The OBS Overlay dialog: copy the overlay address, setup instructions, and
// sizes and colors for each part of the overlay. Settings are saved to
// localStorage and sent to overlay.html with each broadcast snapshot (see
// overlay-broadcast.js).
import { createColorPicker, closeColorPickers } from './color-picker.js';

// _v3: the defaults changed (colors, block name size, pause timer off), so older saved sets are ignored.
const SETTINGS_KEY = 'bailiff_overlay_settings_v3';

// Default colors are light, so the text reads over video; sizes are
// percentages of the timer page's sizes.
const DEFAULTS = {
    block: '#f0e8d8',
    time: '#e3bd57',
    warning: '#f59e0b',
    critical: '#ff5252',
    paused: '#bfa56a',
    label: '#d8cdb8',
    secondary: '#d8cdb8',
    bg: '#1a1410',
    bgTransparent: true,
    sizeBlock: 250,
    sizeTime: 100,
    sizeLabel: 100,
    sizeSecondary: 100,
    showSecondary: false
};

const COLOR_ROWS = [
    ['block', 'Block name'],
    ['time', 'Countdown'],
    ['warning', 'Countdown, last 30 seconds'],
    ['critical', 'Countdown, last 10 seconds and overtime'],
    ['paused', 'Countdown, paused'],
    ['label', 'Time label'],
    ['secondary', 'Pause timer']
];

const SIZE_ROWS = [
    ['sizeBlock', 'Block name'],
    ['sizeTime', 'Countdown'],
    ['sizeLabel', 'Time label'],
    ['sizeSecondary', 'Pause timer']
];

export const overlaySettings = { ...DEFAULTS };
try {
    Object.assign(overlaySettings, JSON.parse(localStorage.getItem(SETTINGS_KEY)));
} catch {}

const listeners = [];
export function onOverlaySettingsChange(cb) { listeners.push(cb); }

function save() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(overlaySettings)); } catch {}
    listeners.forEach(cb => cb());
}

const dialog = document.getElementById('overlay-settings-overlay');
const urlEl = document.getElementById('overlay-url');
const sizesEl = document.getElementById('ovs-sizes');
const colorsEl = document.getElementById('ovs-colors');
const overlayUrl = new URL('overlay.html', window.location.href).href;
const colorPickers = {};
const colorHexes = {};
const sizeInputs = {};
const sizeReadouts = {};

function addRow(container, labelContent, control) {
    const label = document.createElement('span');
    label.append(labelContent);
    container.append(label, control);
}

// The pause timer's row has a checkbox in front of its name to turn it on or off.
const showSecondaryEl = document.createElement('input');
showSecondaryEl.type = 'checkbox';
showSecondaryEl.addEventListener('change', () => {
    overlaySettings.showSecondary = showSecondaryEl.checked;
    syncSecondaryRow();
    save();
});
const secondaryLabel = document.createElement('label');
secondaryLabel.className = 'ovs-toggle-label';
secondaryLabel.append(showSecondaryEl, 'Pause timer');
function syncSecondaryRow() {
    sizeInputs.sizeSecondary.disabled = !showSecondaryEl.checked;
    sizesEl.classList.toggle('ovs-secondary-off', !showSecondaryEl.checked);
}

function colorControl(initial, onInput) {
    const wrap = document.createElement('div');
    wrap.className = 'ovs-color-ctl';
    const hex = document.createElement('span');
    hex.className = 'ovs-hex';
    const picker = createColorPicker(initial, value => { hex.textContent = value; onInput(value); });
    wrap.append(picker.button, hex);
    return { wrap, picker, hex };
}

for (const [key, text] of SIZE_ROWS) {
    const wrap = document.createElement('div');
    wrap.className = 'ovs-size-ctl';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = 40;
    input.max = 250;
    input.step = 5;
    const readout = document.createElement('span');
    readout.className = 'ovs-hex';
    input.addEventListener('input', () => {
        overlaySettings[key] = Number(input.value);
        readout.textContent = input.value + '%';
        save();
    });
    sizeInputs[key] = input;
    sizeReadouts[key] = readout;
    wrap.append(input, readout);
    addRow(sizesEl, key === 'sizeSecondary' ? secondaryLabel : text, wrap);
}

for (const [key, text] of COLOR_ROWS) {
    const ctl = colorControl(overlaySettings[key], value => { overlaySettings[key] = value; save(); });
    colorPickers[key] = ctl.picker;
    colorHexes[key] = ctl.hex;
    addRow(colorsEl, text, ctl.wrap);
}

const bgCtl = colorControl(overlaySettings.bg, value => { overlaySettings.bg = value; save(); });
const bgTransparent = document.createElement('input');
bgTransparent.type = 'checkbox';
const bgTransparentLabel = document.createElement('label');
bgTransparentLabel.append(bgTransparent, 'Transparent');
bgCtl.wrap.append(bgTransparentLabel);
bgTransparent.addEventListener('change', () => {
    overlaySettings.bgTransparent = bgTransparent.checked;
    bgCtl.picker.setDisabled(bgTransparent.checked);
    save();
});
addRow(colorsEl, 'Background', bgCtl.wrap);

function syncInputs() {
    for (const [key] of SIZE_ROWS) {
        sizeInputs[key].value = overlaySettings[key];
        sizeReadouts[key].textContent = overlaySettings[key] + '%';
    }
    for (const [key] of COLOR_ROWS) {
        colorPickers[key].set(overlaySettings[key]);
        colorHexes[key].textContent = overlaySettings[key];
    }
    showSecondaryEl.checked = overlaySettings.showSecondary;
    syncSecondaryRow();
    bgCtl.picker.set(overlaySettings.bg);
    bgCtl.hex.textContent = overlaySettings.bg;
    bgTransparent.checked = overlaySettings.bgTransparent;
    bgCtl.picker.setDisabled(overlaySettings.bgTransparent);
}

document.getElementById('overlay-settings-btn').addEventListener('click', () => {
    urlEl.value = overlayUrl;
    syncInputs();
    dialog.classList.remove('hidden');
});

const close = () => { closeColorPickers(); dialog.classList.add('hidden'); };
document.getElementById('ovs-close').addEventListener('click', close);
dialog.addEventListener('click', e => { if (e.target === dialog) close(); });

document.getElementById('ovs-reset').addEventListener('click', () => {
    closeColorPickers();
    Object.assign(overlaySettings, DEFAULTS);
    syncInputs();
    save();
});

// navigator.clipboard is unavailable in some embedded browsers (OBS docks)
// and on non-secure addresses, so fall back to selecting the text and
// using the older copy command.
async function copyUrl() {
    try {
        await navigator.clipboard.writeText(overlayUrl);
        return true;
    } catch {}
    urlEl.focus();
    urlEl.select();
    try {
        return document.execCommand('copy');
    } catch {
        return false;
    }
}

const copyBtn = document.getElementById('ovs-copy');
copyBtn.addEventListener('click', async () => {
    copyBtn.textContent = (await copyUrl()) ? 'Copied' : 'Copy failed';
    setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 1500);
});
