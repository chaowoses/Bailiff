// A color picker styled to match the site, used by the OBS Overlay dialog
// instead of the browser's own picker (which can't be themed). A swatch button
// opens a popover with a saturation/brightness square, a hue bar, a hex field
// and a row of theme colors.
const PRESETS = ['#f0e8d8', '#b0a190', '#7a6a5a', '#c9a84c', '#e0a030', '#d49000', '#e05050', '#cc3333', '#4fb477', '#5aa0e0', '#ffffff', '#000000'];

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    let h = 0;
    if (d) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }
    return [h, max ? d / max : 0, max];
}

function hsvToRgb(h, s, v) {
    const f = n => {
        const k = (n + h / 60) % 6;
        return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
    };
    return [f(5), f(3), f(1)];
}

let openPicker = null;
export function closeColorPickers() {
    if (openPicker) openPicker.close();
}

export function createColorPicker(initial, onInput) {
    let hue = 0, sat = 0, val = 0;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cp-button';
    const chip = document.createElement('span');
    chip.className = 'cp-chip';
    button.append(chip);

    const pop = document.createElement('div');
    pop.className = 'cp-pop';
    pop.hidden = true;
    pop.innerHTML = '<div class="cp-sv"><div class="cp-thumb"></div></div>' +
        '<div class="cp-hue"><div class="cp-thumb"></div></div>' +
        '<input type="text" class="cp-hex-input" maxlength="7" spellcheck="false" autocomplete="off">' +
        '<div class="cp-presets"></div>';
    const svEl = pop.querySelector('.cp-sv');
    const svThumb = svEl.firstChild;
    const hueEl = pop.querySelector('.cp-hue');
    const hueThumb = hueEl.firstChild;
    const hexInput = pop.querySelector('.cp-hex-input');
    const presetsEl = pop.querySelector('.cp-presets');

    const currentHex = () => rgbToHex(...hsvToRgb(hue, sat, val));

    function paint() {
        const hex = currentHex();
        chip.style.background = hex;
        svEl.style.setProperty('--cp-hue', `hsl(${hue}, 100%, 50%)`);
        svThumb.style.left = sat * 100 + '%';
        svThumb.style.top = (1 - val) * 100 + '%';
        hueThumb.style.left = hue / 360 * 100 + '%';
        if (document.activeElement !== hexInput) hexInput.value = hex;
    }

    function emit() {
        paint();
        onInput(currentHex());
    }

    function drag(el, update) {
        el.addEventListener('pointerdown', e => {
            el.setPointerCapture(e.pointerId);
            const move = ev => {
                const r = el.getBoundingClientRect();
                update(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
                emit();
            };
            move(e);
            el.addEventListener('pointermove', move);
            const stop = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', stop); };
            el.addEventListener('pointerup', stop);
        });
    }
    drag(svEl, (x, y) => { sat = x; val = 1 - y; });
    drag(hueEl, x => { hue = x * 360; });

    function setHex(hex) {
        [hue, sat, val] = rgbToHsv(...hexToRgb(hex));
    }

    hexInput.addEventListener('input', () => {
        let text = hexInput.value.trim();
        if (!text.startsWith('#')) text = '#' + text;
        if (/^#[0-9a-f]{6}$/i.test(text)) {
            setHex(text.toLowerCase());
            emit();
        }
    });
    hexInput.addEventListener('blur', paint);

    for (const hex of PRESETS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cp-preset';
        b.style.background = hex;
        b.title = hex;
        b.addEventListener('click', () => { setHex(hex); emit(); });
        presetsEl.append(b);
    }

    function place() {
        const r = button.getBoundingClientRect();
        const h = pop.offsetHeight;
        const w = pop.offsetWidth;
        const below = r.bottom + 6 + h <= window.innerHeight - 8;
        pop.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - 6 - h)) + 'px';
        pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    }

    const api = {
        button,
        set(value) { setHex(value); paint(); },
        setDisabled(disabled) { button.disabled = disabled; if (disabled) api.close(); },
        close() {
            pop.hidden = true;
            if (openPicker === api) openPicker = null;
            document.removeEventListener('pointerdown', outside, true);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('scroll', api.close, true);
            window.removeEventListener('resize', api.close);
        }
    };

    function outside(e) {
        if (!pop.contains(e.target) && !button.contains(e.target)) api.close();
    }
    function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); api.close(); }
    }

    button.addEventListener('click', () => {
        if (!pop.hidden) { api.close(); return; }
        closeColorPickers();
        // On <body>, not in the dialog, so the dialog's scrolling and animation can't clip or offset it.
        if (!pop.isConnected) document.body.append(pop);
        pop.hidden = false;
        place();
        openPicker = api;
        document.addEventListener('pointerdown', outside, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('scroll', api.close, true);
        window.addEventListener('resize', api.close);
    });

    api.set(initial);
    return api;
}
