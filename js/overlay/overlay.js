const overlayEl = document.getElementById('overlay');
const blockEl = document.getElementById('ov-block');
const timeEl = document.getElementById('ov-time');
const labelEl = document.getElementById('ov-label');
const secondaryEl = document.getElementById('ov-secondary');

// The timer page's classes are 'countdown warning' etc. and
// 'secondary-timer visible'; keep only the modifier classes.
function modifiers(className, base) {
    return className.split(/\s+/).filter(c => c && c !== base).join(' ');
}

// Sizes and colors are chosen in the timer page's OBS Overlay dialog and arrive with each snapshot.
function applySettings(s) {
    const root = document.documentElement.style;
    for (const key of ['block', 'time', 'warning', 'critical', 'paused', 'label', 'secondary']) {
        root.setProperty('--c-' + key, s[key]);
    }
    root.setProperty('--z-block', s.sizeBlock / 100);
    root.setProperty('--z-time', s.sizeTime / 100);
    root.setProperty('--z-label', s.sizeLabel / 100);
    root.setProperty('--z-secondary', s.sizeSecondary / 100);
    secondaryEl.hidden = !s.showSecondary;
    document.body.style.background = s.bgTransparent ? 'transparent' : s.bg;
}

// Blank space between a text line's box edge and its visible glyphs, so the
// overlay can be cropped to the ink rather than to the line boxes.
const inkCache = new Map();
const measureCtx = document.createElement('canvas').getContext('2d');

function inkInsets(el, sample) {
    const cs = getComputedStyle(el);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = cs.textTransform === 'uppercase' ? sample.toUpperCase() : sample;
    const key = font + '|' + text;
    let m = inkCache.get(key);
    if (!m) {
        measureCtx.font = font;
        const t = measureCtx.measureText(text);
        m = {
            fontAscent: t.fontBoundingBoxAscent, fontDescent: t.fontBoundingBoxDescent,
            inkAscent: t.actualBoundingBoxAscent, inkDescent: t.actualBoundingBoxDescent
        };
        inkCache.set(key, m);
    }
    const lineHeight = el.offsetHeight;
    const baseline = (lineHeight - (m.fontAscent + m.fontDescent)) / 2 + m.fontAscent;
    return { top: baseline - m.inkAscent, bottom: lineHeight - (baseline + m.inkDescent) };
}

// Scale the content up or down to fill whatever size the OBS source is set to,
// cropped top and bottom to the first and last lines' visible text and pinned
// to the top edge. If the source is a different shape than the text, the extra
// space goes to the sides (centered) or the bottom.
function fit() {
    overlayEl.style.transform = 'translateX(-50%)';
    const w = overlayEl.offsetWidth;
    const h = overlayEl.offsetHeight;
    const trimTop = Math.max(0, inkInsets(blockEl, blockEl.textContent).top);
    // The pause timer keeps its space while hidden (so the size doesn't jump), unless it's turned off.
    const lastIsSecondary = !secondaryEl.hidden;
    const trimBottom = Math.max(0, lastIsSecondary ? inkInsets(secondaryEl, '00:00').bottom : inkInsets(labelEl, 'Time Remaining').bottom);
    const inkHeight = h - trimTop - trimBottom;
    const scale = Math.min(window.innerWidth / w, window.innerHeight / inkHeight);
    overlayEl.style.transform = `translateX(-50%) scale(${scale}) translateY(${-trimTop}px)`;

}
window.addEventListener('resize', fit);

const channel = new BroadcastChannel('bailiff-overlay');
channel.onmessage = e => {
    const s = e.data;
    if (!s || s.hello) return;
    blockEl.textContent = s.block;
    timeEl.textContent = s.time;
    timeEl.className = 'ov-time ' + modifiers(s.timeClass, 'countdown');
    labelEl.textContent = s.label;
    secondaryEl.textContent = s.secondary;
    secondaryEl.className = 'ov-secondary ' + modifiers(s.secondaryClass, 'secondary-timer');
    if (s.settings) applySettings(s.settings);
    fit();
};

// Ask a running timer page for its current state.
channel.postMessage({ hello: true });

fit();
document.fonts.ready.then(() => { inkCache.clear(); fit(); });
