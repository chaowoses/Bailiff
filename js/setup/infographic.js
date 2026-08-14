import { parseTime as parseTimeStr, formatTime as formatTrialTime } from '../shared/time.js';

// ===== INFOGRAPHIC EXPORT =====
const INFO_COLORS = {
    ink: '#1a1410',
    panel: '#221c16',
    panel2: '#1e1712',
    border: '#3a2a20',
    borderSoft: '#2a2018',
    cream: '#f0e8d8',
    muted: '#8a7a6a',
    muted2: '#6a5a4a',
    gold: '#c9a84c',
    goldLight: '#e0bc5c',
    red: '#8b1a1a',
    redText: '#d08a8a'
};

const ICON_SCALES_PATHS_D = [
    'M7 20l10 0',
    'M6 6l6 -1l6 1',
    'M12 3l0 17',
    'M9 12l-3 -6l-3 6a3 3 0 0 0 6 0',
    'M21 12l-3 -6l-3 6a3 3 0 0 0 6 0'
];

function formatInfoDate(d) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function igRoundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function igDrawIcon(ctx, pathsD, x, y, size, color, strokeWidth) {
    ctx.save();
    ctx.translate(x, y);
    const scale = size / 24;
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    pathsD.forEach(d => ctx.stroke(new Path2D(d)));
    ctx.restore();
}

// Manually advances per-character so uppercase "tracked" labels look right
// regardless of whether the browser supports ctx.letterSpacing.
function igTrackedText(ctx, text, x, y, opts) {
    const { align = 'left', tracking = 0, font, color } = opts;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    const chars = [...text];
    const widths = chars.map(ch => ctx.measureText(ch).width);
    const totalWidth = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
    let cx = align === 'center' ? x - totalWidth / 2 : align === 'right' ? x - totalWidth : x;
    ctx.textAlign = 'left';
    chars.forEach((ch, i) => {
        ctx.fillText(ch, cx, y);
        cx += widths[i] + tracking;
    });
    return totalWidth;
}

// TextMetrics.actualBoundingBoxAscent/Descent give the real glyph extents
// (not the font's full line-height), which is what vertical-centering math
// needs. Falls back to rough font-size ratios if a browser lacks them.
function igGlyphAscent(ctx, text, font, fallbackSize) {
    ctx.font = font;
    const m = ctx.measureText(text);
    return typeof m.actualBoundingBoxAscent === 'number' ? m.actualBoundingBoxAscent : fallbackSize * 0.72;
}

function igGlyphDescent(ctx, text, font, fallbackSize) {
    ctx.font = font;
    const m = ctx.measureText(text);
    return typeof m.actualBoundingBoxDescent === 'number' ? m.actualBoundingBoxDescent : fallbackSize * 0.2;
}

function igEllipsize(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
        t = t.slice(0, -1);
    }
    return t.trim() + '…';
}

// Word-wraps to at most maxLines, ellipsizing the final line if content overflows.
function igWrapLines(ctx, text, maxWidth, maxLines) {
    const words = (text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    let i = 0;
    while (i < words.length) {
        const test = current ? current + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = '';
            if (lines.length === maxLines) break;
        } else {
            current = test;
            i++;
        }
    }
    if (lines.length < maxLines && current) {
        lines.push(current);
        i = words.length;
    }
    if (i < words.length && lines.length > 0) {
        lines[lines.length - 1] = igEllipsize(ctx, lines[lines.length - 1] + '…', maxWidth).replace(/…+$/, '…');
    }
    return lines;
}

function igHairline(ctx, x, y, w) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = INFO_COLORS.border;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.strokeStyle = INFO_COLORS.borderSoft;
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x + w, y + 3);
    ctx.stroke();
}

function igCornerBrackets(ctx, x, y, w, h, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy + size * dy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + size * dx, cy);
        ctx.stroke();
    });
    ctx.restore();
}

// Draws one "name / status / progress bar" row for a timeable item — a
// block, or (when the block has witnesses) a witness. Returns the new y.
// Shared by the plain-block and per-witness cases in the Record of
// Proceedings section so the untouched/current/overtime logic lives once.
function igDrawProgressRow(ctx, C, contentX, contentW, y, item, isCurrent) {
    const totalSecs = parseTimeStr(item.time);
    const remaining = item.remainingSeconds;
    // Selecting an item (even without starting it) sets remainingSeconds to
    // the full duration, so "not null" alone doesn't mean it ran — compare
    // against the total to tell untouched items from ones that ticked down.
    const untouched = remaining == null || (totalSecs > 0 && remaining >= totalSecs);
    const isOvertime = !untouched && remaining < 0;

    let fraction, statusText, barColor, textColor;
    if (untouched) {
        fraction = 1;
        statusText = 'Not started — ' + formatTrialTime(totalSecs) + ' left';
        barColor = C.gold;
        textColor = C.muted;
    } else if (isOvertime) {
        fraction = 1;
        statusText = formatTrialTime(Math.abs(remaining)) + ' overtime';
        barColor = C.red;
        textColor = C.redText;
    } else {
        fraction = totalSecs > 0 ? Math.min(1, Math.max(0, remaining / totalSecs)) : 0;
        statusText = formatTrialTime(remaining) + ' left';
        barColor = isCurrent ? C.goldLight : C.gold;
        textColor = C.muted;
    }

    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'left';
    const nameWidth = ctx.measureText(item.name || '').width;
    ctx.fillText(item.name || '', contentX, y);

    if (isCurrent) {
        ctx.font = '800 12px Inter, sans-serif';
        const flagText = 'CURRENT';
        const flagW = ctx.measureText(flagText).width + 16;
        const flagX = contentX + nameWidth + 14;
        const flagY = y - 15;
        igRoundRectPath(ctx, flagX, flagY, flagW, 20, 3);
        ctx.fillStyle = C.gold;
        ctx.fill();
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(flagText, flagX + 8, flagY + 10);
        ctx.textBaseline = 'alphabetic';
    }

    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.fillText(statusText, contentX + contentW, y);

    y += 18;

    igRoundRectPath(ctx, contentX, y, contentW, 14, 7);
    ctx.fillStyle = C.panel2;
    ctx.fill();
    ctx.strokeStyle = C.borderSoft;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (fraction > 0) {
        ctx.save();
        igRoundRectPath(ctx, contentX, y, contentW, 14, 7);
        ctx.clip();
        ctx.fillStyle = barColor;
        ctx.fillRect(contentX, y, contentW * fraction, 14);
        ctx.restore();
    }

    return y + 14 + 24;
}

// A Stopwatch-mode witness has no time budget to draw a bar against — just
// its name, an elapsed readout, and a CURRENT flag when it's the one being
// examined.
function igDrawStopwatchRow(ctx, C, contentX, contentW, y, item, isCurrent) {
    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'left';
    const nameWidth = ctx.measureText(item.name || '').width;
    ctx.fillText(item.name || '', contentX, y);

    if (isCurrent) {
        ctx.font = '800 12px Inter, sans-serif';
        const flagText = 'CURRENT';
        const flagW = ctx.measureText(flagText).width + 16;
        const flagX = contentX + nameWidth + 14;
        const flagY = y - 15;
        igRoundRectPath(ctx, flagX, flagY, flagW, 20, 3);
        ctx.fillStyle = C.gold;
        ctx.fill();
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(flagText, flagX + 8, flagY + 10);
        ctx.textBaseline = 'alphabetic';
    }

    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'right';
    ctx.fillText(formatTrialTime(item.elapsedSeconds || 0) + ' elapsed', contentX + contentW, y);

    return y + 30;
}

// Renders a saved trial as a "docket poster" — draws to an oversized canvas
// first since content height varies a lot (0-2 progress sides, N blocks),
// then crops to the actual content height at the end.
export async function buildInfographicCanvas(trial) {
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch {}
    }

    const C = INFO_COLORS;
    const W = 1200;
    const MAX_H = 2600;
    const OUTER = 22;
    const PANEL_X = OUTER;
    const PANEL_W = W - OUTER * 2;
    const PAD_X = 66;
    const contentX = PANEL_X + PAD_X;
    const contentW = PANEL_W - PAD_X * 2;
    const centerX = W / 2;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = MAX_H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = C.border;
    ctx.fillRect(0, 0, W, MAX_H);
    ctx.fillStyle = C.panel;
    ctx.fillRect(PANEL_X, OUTER, PANEL_W, MAX_H - OUTER * 2);

    const trMode = !!(trial.timedRulingMode || trial.advancedMode);
    let y = 108;

    igDrawIcon(ctx, ICON_SCALES_PATHS_D, centerX - 26, y - 26, 52, C.gold, 3);
    y += 42;
    igTrackedText(ctx, 'IN THE CIRCUIT COURT OF MORGAN COUNTY', centerX, y, {
        align: 'center', tracking: 2.2, font: '700 15px Inter, sans-serif', color: C.muted
    });
    y += 46;

    igHairline(ctx, contentX, y, contentW);
    y += 46;

    igTrackedText(ctx, 'IN THE MATTER OF', centerX, y, {
        align: 'center', tracking: 2.6, font: '700 14px Inter, sans-serif', color: C.muted2
    });
    y += 52;

    // "vs." is centered in the gap between the two party lines using actual
    // glyph bounding boxes, not a fixed baseline split — splitting the
    // baselines evenly reads as too low, since the big party text's visual
    // weight sits further above its own baseline than "vs." does above its.
    const plaintiffText = trial.plaintiff || 'Plaintiff';
    const defenseText = trial.defense || 'Defense';
    const partyFont = '700 52px "Playfair Display", Georgia, serif';
    const vsFont = 'italic 600 26px "Playfair Display", Georgia, serif';

    ctx.textAlign = 'center';
    ctx.fillStyle = C.cream;
    ctx.font = partyFont;
    ctx.fillText(plaintiffText, centerX, y);
    const plaintiffBottom = y + igGlyphDescent(ctx, plaintiffText, partyFont, 52);

    const defenseBaseline = y + 92;
    const defenseTop = defenseBaseline - igGlyphAscent(ctx, defenseText, partyFont, 52);

    const vsAscent = igGlyphAscent(ctx, 'vs.', vsFont, 26);
    const vsDescent = igGlyphDescent(ctx, 'vs.', vsFont, 26);
    const vsBaseline = (plaintiffBottom + defenseTop) / 2 + (vsAscent - vsDescent) / 2;

    ctx.font = vsFont;
    ctx.fillStyle = C.gold;
    ctx.fillText('vs.', centerX, vsBaseline);

    ctx.font = partyFont;
    ctx.fillStyle = C.cream;
    ctx.fillText(defenseText, centerX, defenseBaseline);

    y = defenseBaseline + 58;

    // Meta chips: saved date, and a Timed Ruling Mode badge if it applies
    const chips = [];
    if (trial.savedAt) chips.push({ text: 'SAVED ' + formatInfoDate(trial.savedAt).toUpperCase(), accent: false });
    if (trMode) chips.push({ text: 'TIMED RULING MODE', accent: true, icon: true });

    if (chips.length) {
        ctx.font = '700 15px Inter, sans-serif';
        const chipPad = 18, chipGap = 14, chipH = 40, iconSize = 14, iconGap = 8;
        const widths = chips.map(c => ctx.measureText(c.text).width + chipPad * 2 + (c.icon ? iconSize + iconGap : 0));
        const totalW = widths.reduce((a, b) => a + b, 0) + chipGap * (chips.length - 1);
        let cx = centerX - totalW / 2;
        chips.forEach((c, i) => {
            const w = widths[i];
            ctx.strokeStyle = c.accent ? C.gold : C.border;
            ctx.lineWidth = 1.5;
            igRoundRectPath(ctx, cx, y, w, chipH, 4);
            ctx.stroke();
            let tx = cx + chipPad;
            if (c.icon) {
                igDrawIcon(ctx, ICON_SCALES_PATHS_D, tx, y + chipH / 2 - iconSize / 2, iconSize, C.gold, 2);
                tx += iconSize + iconGap;
            }
            ctx.font = '700 15px Inter, sans-serif';
            ctx.fillStyle = c.accent ? C.gold : C.muted;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(c.text, tx, y + chipH / 2 + 1);
            ctx.textBaseline = 'alphabetic';
            cx += w + chipGap;
        });
        y += chipH + 30;
    }

    // Description
    if (trial.description) {
        ctx.font = 'italic 400 20px Inter, sans-serif';
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'center';
        const lines = igWrapLines(ctx, '“' + trial.description + '”', contentW * 0.86, 2);
        lines.forEach(line => {
            ctx.fillText(line, centerX, y);
            y += 28;
        });
        y += 12;
    }

    y += 8;
    igHairline(ctx, contentX, y, contentW);
    y += 50;

    // ===== SCHEDULE OF PROCEEDINGS =====
    const blocks = Array.isArray(trial.blocks) ? trial.blocks : [];
    if (blocks.length) {
        ctx.textAlign = 'left';
        ctx.font = '700 30px "Playfair Display", Georgia, serif';
        ctx.fillStyle = C.cream;
        ctx.fillText('Schedule of Proceedings', contentX, y);

        const totalSecs = blocks.reduce((s, b) => s + parseTimeStr(b.time), 0);
        ctx.font = '600 18px "JetBrains Mono", monospace';
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'right';
        ctx.fillText(formatTrialTime(totalSecs) + ' total', contentX + contentW, y);
        y += 34;

        const rowH = blocks.length > 8 ? 44 : 54;
        const idxColW = 52;
        const timeColW = 130;
        const tagColW = trMode ? 118 : 0;
        const nameColW = contentW - idxColW - timeColW - tagColW - 16;

        blocks.forEach((b, i) => {
            y += rowH;
            const baseline = y - rowH / 2 + 7;

            ctx.textAlign = 'left';
            ctx.font = '600 16px "JetBrains Mono", monospace';
            ctx.fillStyle = C.muted2;
            ctx.fillText(String(i + 1).padStart(2, '0'), contentX, baseline);

            ctx.font = '500 20px Inter, sans-serif';
            ctx.fillStyle = C.cream;
            ctx.fillText(igEllipsize(ctx, b.name || '', nameColW), contentX + idxColW, baseline);

            if (trMode && b.linked) {
                ctx.font = '700 12px Inter, sans-serif';
                const tagText = 'LINKED';
                const tagW = ctx.measureText(tagText).width + 20;
                const tagX = contentX + idxColW + nameColW + 16;
                const tagY = baseline - 20;
                ctx.strokeStyle = C.gold;
                ctx.lineWidth = 1.3;
                igRoundRectPath(ctx, tagX, tagY, tagW, 26, 4);
                ctx.stroke();
                ctx.fillStyle = C.gold;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(tagText, tagX + 10, tagY + 13);
                ctx.textBaseline = 'alphabetic';
            }

            ctx.font = '700 22px "JetBrains Mono", monospace';
            ctx.fillStyle = C.gold;
            ctx.textAlign = 'right';
            ctx.fillText(b.time || '', contentX + contentW, baseline + 1);

            if (i < blocks.length - 1) {
                ctx.strokeStyle = C.borderSoft;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(contentX, y + rowH * 0.3);
                ctx.lineTo(contentX + contentW, y + rowH * 0.3);
                ctx.stroke();
            }

            // Nested witnesses, indented under their parent block
            const witnesses = Array.isArray(b.witnesses) ? b.witnesses : [];
            if (witnesses.length) {
                const stopwatchMode = trial.witnessMode === 'stopwatch';
                const witIndentX = contentX + idxColW + 16;
                const witNameColW = contentW - (idxColW + 16) - timeColW - 16;
                const witRowH = 30;
                witnesses.forEach(w => {
                    y += witRowH;
                    ctx.textAlign = 'left';
                    ctx.font = '400 15px Inter, sans-serif';
                    ctx.fillStyle = C.muted;
                    ctx.fillText('– ' + igEllipsize(ctx, w.name || '', witNameColW), witIndentX, y);

                    ctx.font = '600 15px "JetBrains Mono", monospace';
                    ctx.fillStyle = C.muted;
                    ctx.textAlign = 'right';
                    ctx.fillText(stopwatchMode ? 'Stopwatch' : (w.time || ''), contentX + contentW, y);
                });
                y += 6;
            }
        });
        y += rowH * 0.4;
    }

    // ===== RECORD OF PROCEEDINGS (per-side progress, if this trial has any) =====
    const tsBlocks = trial.timerState && trial.timerState.blocks;
    const hasProgress = tsBlocks && ((Array.isArray(tsBlocks.left) && tsBlocks.left.length) || (Array.isArray(tsBlocks.right) && tsBlocks.right.length));

    if (hasProgress) {
        y += 34;
        igHairline(ctx, contentX, y, contentW);
        y += 50;

        ctx.textAlign = 'left';
        ctx.font = '700 30px "Playfair Display", Georgia, serif';
        ctx.fillStyle = C.cream;
        ctx.fillText('Record of Proceedings', contentX, y);
        y += 44;

        ['left', 'right'].forEach(team => {
            const arr = tsBlocks[team];
            if (!Array.isArray(arr) || arr.length === 0) return;

            const sideLabel = team === 'left' ? (trial.plaintiff || 'Plaintiff') : (trial.defense || 'Defense');
            igTrackedText(ctx, sideLabel.toUpperCase(), contentX, y, {
                align: 'left', tracking: 1.8, font: '700 15px Inter, sans-serif', color: C.muted
            });
            y += 30;

            arr.forEach(b => {
                const witnesses = Array.isArray(b.witnesses) ? b.witnesses : [];
                if (witnesses.length) {
                    // The block itself always has a real, independent
                    // progress value now (it ticks down ambiently whenever
                    // any witness runs), so it's worth a status readout
                    // alongside its name even though it's never "current".
                    const stopwatchMode = trial.witnessMode === 'stopwatch';
                    const blockTotal = parseTimeStr(b.time);
                    const blockRemaining = b.remainingSeconds != null ? b.remainingSeconds : blockTotal;
                    const blockStatus = formatTrialTime(blockRemaining) + (blockRemaining < 0 ? ' overtime' : ' left');

                    ctx.font = '600 15px Inter, sans-serif';
                    ctx.fillStyle = C.cream;
                    ctx.textAlign = 'left';
                    ctx.fillText(b.name || '', contentX, y);

                    ctx.font = '600 14px "JetBrains Mono", monospace';
                    ctx.fillStyle = blockRemaining < 0 ? C.redText : C.muted;
                    ctx.textAlign = 'right';
                    ctx.fillText(blockStatus, contentX + contentW, y);

                    y += 22;

                    const witIndent = 24;
                    witnesses.forEach(w => {
                        const isCurrent = trial.timerState.currentTeam === team && trial.timerState.currentBlockId === b.id &&
                            trial.timerState.currentWitnessId === w.id;
                        y = stopwatchMode
                            ? igDrawStopwatchRow(ctx, C, contentX + witIndent, contentW - witIndent, y, w, isCurrent)
                            : igDrawProgressRow(ctx, C, contentX + witIndent, contentW - witIndent, y, w, isCurrent);
                    });
                    y += 4;
                } else {
                    const isCurrent = trial.timerState.currentTeam === team && trial.timerState.currentBlockId === b.id &&
                        !trial.timerState.currentWitnessId;
                    y = igDrawProgressRow(ctx, C, contentX, contentW, y, b, isCurrent);
                }
            });

            y += 8;
        });
    }

    // ===== FOOTER =====
    y += 30;
    ctx.textAlign = 'left';
    igTrackedText(ctx, 'BAILIFF — MOCK TRIAL TIMER', contentX, y, {
        align: 'left', tracking: 1.6, font: '700 14px Inter, sans-serif', color: C.muted2
    });
    y += 28;
    igTrackedText(ctx, 'CHAOWOSES.DEV/BAILIFF', contentX, y, {
        align: 'left', tracking: 1.2, font: '600 13px Inter, sans-serif', color: C.muted2
    });
    igTrackedText(ctx, 'GENERATED ' + formatInfoDate(new Date()).toUpperCase(), contentX + contentW, y, {
        align: 'right', tracking: 1.2, font: '600 13px Inter, sans-serif', color: C.muted2
    });

    const panelBottom = y + 56;
    const finalH = panelBottom + OUTER;

    // Border + corner brackets, sized to the real content bounds now that we know them
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(PANEL_X + 1, OUTER + 1, PANEL_W - 2, (finalH - OUTER) - OUTER - 2);
    igCornerBrackets(ctx, PANEL_X + 16, OUTER + 16, PANEL_W - 32, (finalH - OUTER) - OUTER - 32, 16, C.gold);

    // The draft canvas's panel fill runs all the way to MAX_H (we don't know
    // the real content height until now), so cropping to finalH would leave
    // panel color showing through the bottom OUTER margin instead of a clean
    // border-color frame like the top has. Paint the frame color first, then
    // stamp only the real content (up to the bottom margin) on top of it.
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = W;
    finalCanvas.height = finalH;
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.fillStyle = C.border;
    finalCtx.fillRect(0, 0, W, finalH);
    finalCtx.drawImage(canvas, 0, 0, W, finalH - OUTER, 0, 0, W, finalH - OUTER);
    return finalCanvas;
}
