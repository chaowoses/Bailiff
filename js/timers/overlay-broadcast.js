import { countdown, currentBlockName, timeLabel, secondaryTimer } from './dom.js';
import { overlaySettings, onOverlaySettingsChange } from './overlay-settings.js';

// Mirrors the bench's display elements to overlay.html (an OBS Browser
// Source) over a BroadcastChannel. It watches the DOM rather than hooking
// each controls.js call site, so every existing display update is covered.
const channel = new BroadcastChannel('bailiff-overlay');

function snapshot() {
    return {
        block: currentBlockName.textContent,
        time: countdown.textContent,
        timeClass: countdown.className,
        label: timeLabel.textContent,
        secondary: secondaryTimer.textContent,
        secondaryClass: secondaryTimer.className,
        settings: overlaySettings
    };
}

let queued = false;
function broadcast() {
    if (queued) return;
    queued = true;
    // Coalesce the several mutations a single update makes into one message.
    queueMicrotask(() => {
        queued = false;
        channel.postMessage(snapshot());
    });
}

const observer = new MutationObserver(broadcast);
for (const el of [countdown, currentBlockName, timeLabel, secondaryTimer]) {
    observer.observe(el, { characterData: true, childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

onOverlaySettingsChange(broadcast);

// An overlay opened mid-round asks for the current state.
channel.onmessage = e => {
    if (e.data && e.data.hello) channel.postMessage(snapshot());
};

channel.postMessage(snapshot());
