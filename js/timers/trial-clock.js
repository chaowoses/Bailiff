import { state, saveTimerSession } from './state.js';

// AMTA Rule: "all-loss time" is 180 minutes after start time — elapsed
// turns red at that threshold as a visual warning.
const ALL_LOSS_SECONDS = 180 * 60;

const startBtn = document.getElementById('trial-clock-start');
const currentEl = document.getElementById('trial-clock-current');
const elapsedEl = document.getElementById('trial-clock-elapsed');
const overlay = document.getElementById('start-time-overlay');
const hhInput = document.getElementById('start-time-hh');
const mmInput = document.getElementById('start-time-mm');
const ampmSelect = document.getElementById('start-time-ampm');
const cancelBtn = document.getElementById('start-time-cancel');
const confirmBtn = document.getElementById('start-time-confirm');
const confirmOverlay = document.getElementById('start-time-confirm-overlay');
const confirmValueEl = document.getElementById('start-time-confirm-value');
const confirmCancelBtn = document.getElementById('start-time-confirm-cancel');
const confirmConfirmBtn = document.getElementById('start-time-confirm-confirm');

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatClock(date, withSeconds) {
    let h = date.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const base = pad2(h) + ':' + pad2(date.getMinutes());
    return (withSeconds ? base + ':' + pad2(date.getSeconds()) : base) + ' ' + ampm;
}

function formatElapsed(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return pad2(h) + ':' + pad2(m) + ':' + pad2(sec);
}

function isYesterday(date) {
    return date.toDateString() !== new Date().toDateString();
}

function renderStartButton() {
    if (state.startTime) {
        const d = new Date(state.startTime);
        startBtn.textContent = formatClock(d, false) + (isYesterday(d) ? ' (prev. day)' : '');
        startBtn.disabled = true;
        startBtn.classList.add('trial-clock-locked');
    } else {
        startBtn.textContent = 'Not Set — Click to Set';
        startBtn.disabled = false;
        startBtn.classList.remove('trial-clock-locked');
    }
}

function tick() {
    const now = new Date();
    currentEl.textContent = formatClock(now, true);

    if (!state.startTime) {
        elapsedEl.textContent = 'No start time set';
        elapsedEl.classList.remove('trial-clock-overtime');
        return;
    }

    const elapsedSeconds = (now.getTime() - state.startTime) / 1000;
    elapsedEl.textContent = formatElapsed(elapsedSeconds);
    elapsedEl.classList.toggle('trial-clock-overtime', elapsedSeconds >= ALL_LOSS_SECONDS);
}

// Clamps digits as they're typed rather than rejecting after the fact with
// an error message — the field simply can't hold an out-of-range value.
function clampDigitInput(input, max) {
    let value = input.value.replace(/\D/g, '').slice(0, 2);
    if (value.length === 2 && parseInt(value, 10) > max) {
        value = String(max);
    }
    input.value = value;
}

// Reads the dialog's fields into a Date, or null while they're
// incomplete/out of range (shouldn't happen given the input clamping, but
// guards the empty-field case e.g. right after the user clears a box). A
// start time can never be in the future, so a clock reading that hasn't
// happened yet today (e.g. it's just past midnight and the judges actually
// arrived at 11 PM) is assumed to mean yesterday instead of being rejected.
function composedDate() {
    const hh = parseInt(hhInput.value, 10);
    const mm = parseInt(mmInput.value, 10);
    if (!Number.isInteger(hh) || hh < 1 || hh > 12 || !Number.isInteger(mm) || mm < 0 || mm > 59) {
        return null;
    }
    let hour24 = hh % 12;
    if (ampmSelect.value === 'PM') hour24 += 12;
    const d = new Date();
    d.setHours(hour24, mm, 0, 0);
    if (d.getTime() > Date.now()) {
        d.setDate(d.getDate() - 1);
    }
    return d;
}

function updateConfirmAvailability() {
    confirmBtn.disabled = !composedDate();
}

function openStartTimeDialog() {
    if (state.startTime) return;
    const now = new Date();
    let h12 = now.getHours() % 12;
    if (h12 === 0) h12 = 12;
    hhInput.value = pad2(h12);
    mmInput.value = pad2(now.getMinutes());
    ampmSelect.value = now.getHours() >= 12 ? 'PM' : 'AM';
    updateConfirmAvailability();
    overlay.classList.remove('hidden');
    hhInput.focus();
}

function closeStartTimeDialog() {
    overlay.classList.add('hidden');
}

[hhInput, mmInput].forEach(input => {
    input.addEventListener('input', () => {
        clampDigitInput(input, input === hhInput ? 12 : 59);
        updateConfirmAvailability();
    });
});
ampmSelect.addEventListener('change', updateConfirmAvailability);

startBtn.addEventListener('click', openStartTimeDialog);
cancelBtn.addEventListener('click', closeStartTimeDialog);
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeStartTimeDialog();
});

// Committing a start time is a two-step confirmation: this button only
// stages the value and hands off to a second, dedicated confirm dialog —
// it never writes state.startTime directly.
let pendingStartDate = null;

confirmBtn.addEventListener('click', () => {
    const d = composedDate();
    if (!d) return;
    pendingStartDate = d;
    confirmValueEl.textContent = formatClock(d, false) + (isYesterday(d) ? ' (previous day)' : '');
    overlay.classList.add('hidden');
    confirmOverlay.classList.remove('hidden');
});

function backOutToStartTimeDialog() {
    confirmOverlay.classList.add('hidden');
    pendingStartDate = null;
    overlay.classList.remove('hidden');
}

confirmCancelBtn.addEventListener('click', backOutToStartTimeDialog);
confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) backOutToStartTimeDialog();
});

confirmConfirmBtn.addEventListener('click', () => {
    if (!pendingStartDate) return;
    state.startTime = pendingStartDate.getTime();
    pendingStartDate = null;
    confirmOverlay.classList.add('hidden');
    closeStartTimeDialog();
    renderStartButton();
    tick();
    saveTimerSession();
});

renderStartButton();
tick();
setInterval(tick, 1000);
