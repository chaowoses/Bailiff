import { formatTime as formatTrialTime } from '../shared/time.js';
import { downloadBlob, slugify, canvasToPngBlob } from './export-utils.js';
import { buildInfographicCanvas } from './infographic.js';
// getSavedTrials/getPresets live in saved-trials.js/presets.js, which import
// openExportDialog/openPresetExportDialog from here — safe circular import,
// same reasoning as blocks.js/witnesses.js.
import { getSavedTrials } from './saved-trials.js';
import { getPresets } from './presets.js';

// ===== EXPORT SAVED TRIALS =====
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
        const trMode = t.timedRulingMode || t.advancedMode;

        lines.push((i + 1) + '. ' + (t.name || 'Untitled Trial'));
        if (t.id) lines.push('   ID: ' + t.id);
        if (t.savedAt) lines.push('   Saved: ' + new Date(t.savedAt).toLocaleString());
        if (t.plaintiff) lines.push('   Plaintiff: ' + t.plaintiff);
        if (t.defense) lines.push('   Defense: ' + t.defense);
        lines.push('   Timed Ruling Mode: ' + (trMode ? 'Yes' : 'No'));
        if (t.description) lines.push('   Description: ' + t.description);
        if (Array.isArray(t.blocks) && t.blocks.length > 0) {
            lines.push('   Schedule:');
            t.blocks.forEach(b => {
                lines.push('     - ' + b.name + ' (' + b.time + ')' + (trMode && b.linked ? ' [linked]' : ''));
                if (Array.isArray(b.witnesses) && b.witnesses.length > 0) {
                    const stopwatchMode = t.witnessMode === 'stopwatch';
                    b.witnesses.forEach(w => {
                        const witnessTime = stopwatchMode ? 'Stopwatch' : w.time;
                        lines.push('         • ' + w.name + ' (' + witnessTime + ')' + (trMode && w.linked ? ' [linked]' : ''));
                    });
                }
            });
        }

        const hasProgress = t.timerState && t.timerState.blocks &&
            (t.timerState.blocks.left || t.timerState.blocks.right);
        if (hasProgress) {
            ['left', 'right'].forEach(team => {
                const arr = t.timerState.blocks[team];
                if (!Array.isArray(arr) || arr.length === 0) return;
                const sideLabel = team === 'left' ? (t.plaintiff || 'Plaintiff') : (t.defense || 'Defense');
                lines.push('   ' + sideLabel + ' Progress:');
                arr.forEach(b => {
                    const hasWitnesses = Array.isArray(b.witnesses) && b.witnesses.length > 0;
                    if (hasWitnesses) {
                        const stopwatchMode = t.witnessMode === 'stopwatch';
                        const blockStatus = b.remainingSeconds == null
                            ? 'not started'
                            : 'remaining ' + formatTrialTime(b.remainingSeconds);
                        lines.push('     - ' + b.name + ' (' + blockStatus + '):');
                        b.witnesses.forEach(w => {
                            const isCurrent = t.timerState.currentTeam === team && t.timerState.currentBlockId === b.id &&
                                t.timerState.currentWitnessId === w.id;
                            let status;
                            if (stopwatchMode) {
                                status = 'elapsed ' + formatTrialTime(w.elapsedSeconds || 0);
                            } else {
                                status = w.remainingSeconds == null
                                    ? 'not started'
                                    : 'remaining ' + formatTrialTime(w.remainingSeconds);
                            }
                            lines.push('         • ' + w.name + ' — ' + status +
                                (isCurrent ? ' [current]' : '') + (trMode && w.linked ? ' [linked]' : ''));
                        });
                    } else {
                        const isCurrent = t.timerState.currentTeam === team && t.timerState.currentBlockId === b.id &&
                            !t.timerState.currentWitnessId;
                        const status = b.remainingSeconds == null
                            ? 'not started'
                            : 'remaining ' + formatTrialTime(b.remainingSeconds);
                        lines.push('     - ' + b.name + ' (' + b.time + ') — ' + status +
                            (isCurrent ? ' [current]' : '') + (trMode && b.linked ? ' [linked]' : ''));
                    }
                });
            });
        }

        lines.push('-'.repeat(40));
        lines.push("Exported from Bailiff Mock Trial Timer.");
        lines.push("https://chaowoses.dev/Bailiff")
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

function buildPresetJsonExport(presets) {
    return JSON.stringify({
        app: 'bailiff',
        type: 'presets',
        version: 1,
        exportedAt: new Date().toISOString(),
        presets: presets
    }, null, 2);
}

// 'trial' offers all three formats (Plain Text/JSON/Image); 'preset' only
// ever exports as JSON — a preset has no plaintiff/defense or progress to
// put in a readable summary or docket-poster image, just a block schedule.
let pendingExportKind = 'trial';
let pendingExportTrialId = null;
let pendingExportPresetId = null;

function currentExportFormat() {
    if (pendingExportKind === 'preset') return 'json';
    const checked = document.querySelector('input[name="export-format"]:checked');
    return checked ? checked.value : 'readable';
}

function currentExportText() {
    if (pendingExportKind === 'preset') {
        const preset = getPresets().find(p => p.id === pendingExportPresetId);
        return buildPresetJsonExport(preset ? [preset] : []);
    }
    const trial = getSavedTrials().find(t => t.id === pendingExportTrialId);
    const trials = trial ? [trial] : [];
    return currentExportFormat() === 'json' ? buildJsonExport(trials) : buildReadableExport(trials);
}

function setExportStatus(message, isError) {
    const el = document.getElementById('export-status');
    el.textContent = message;
    el.classList.toggle('error', !!isError);
}

export function openExportDialog(trialId) {
    const trial = getSavedTrials().find(t => t.id === trialId);
    if (!trial) return;
    pendingExportKind = 'trial';
    pendingExportTrialId = trialId;
    document.getElementById('export-dialog-title').textContent = 'Export "' + trial.name + '"';
    document.getElementById('export-dialog-desc').textContent = 'Choose a format, then download it as a file or copy it to your clipboard.';
    document.getElementById('export-format-toggle').classList.remove('hidden');
    setExportStatus('');
    document.getElementById('export-dialog-overlay').classList.remove('hidden');
}

export function openPresetExportDialog(presetId) {
    const preset = getPresets().find(p => p.id === presetId);
    if (!preset || preset.builtin) return;
    pendingExportKind = 'preset';
    pendingExportPresetId = presetId;
    document.getElementById('export-dialog-title').textContent = 'Export "' + preset.name + '"';
    document.getElementById('export-dialog-desc').textContent = 'Download it as a JSON file, or copy it to your clipboard.';
    document.getElementById('export-format-toggle').classList.add('hidden');
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
    const format = currentExportFormat();

    if (format === 'image') {
        setExportStatus('Rendering image…');
        try {
            const trial = getSavedTrials().find(t => t.id === pendingExportTrialId);
            if (!trial) throw new Error('Trial not found');
            const blob = await canvasToPngBlob(await buildInfographicCanvas(trial));
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            setExportStatus('Copied image to clipboard.');
        } catch {
            setExportStatus('Could not copy image to clipboard.', true);
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(currentExportText());
        setExportStatus('Copied to clipboard.');
    } catch {
        setExportStatus('Could not copy to clipboard.', true);
    }
});

document.getElementById('export-download-btn').addEventListener('click', async () => {
    const format = currentExportFormat();
    const isPreset = pendingExportKind === 'preset';
    const subject = isPreset
        ? getPresets().find(p => p.id === pendingExportPresetId)
        : getSavedTrials().find(t => t.id === pendingExportTrialId);
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = 'bailiff-' + (isPreset ? 'preset-' : '') + slugify(subject ? subject.name : (isPreset ? 'preset' : 'trial')) + '-' + stamp;

    if (format === 'image') {
        setExportStatus('Rendering image…');
        try {
            if (!trial) throw new Error('Trial not found');
            const blob = await canvasToPngBlob(await buildInfographicCanvas(trial));
            downloadBlob(blob, baseName + '.png');
            setExportStatus('Image downloaded.');
        } catch {
            setExportStatus('Could not render image.', true);
        }
        return;
    }

    const isJson = format === 'json';
    const blob = new Blob([currentExportText()], { type: isJson ? 'application/json' : 'text/plain' });
    downloadBlob(blob, baseName + (isJson ? '.json' : '.txt'));
    setExportStatus('File downloaded.');
});
