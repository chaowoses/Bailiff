# Bailiff — Mock Trial Timer

A streamlined timer and sequence management tool for mock trial timekeepers. Originally built for VLRE (Virginia Law Related Education) competitions, flexible enough for any trial format. Dark courtroom theme, works in the browser.

## Features

- **Team Setup**: Name the plaintiff/prosecution and defense sides. Random famous case names appear as placeholders.
- **Block Management**: Add, name, reorder (drag-and-drop), and delete trial segments (opening, direct, cross, closing, etc.). Each block has a name and duration.
- **Rapid Time Entry**: Type 4 digits (e.g., `0500`) and it auto-formats to `MM:SS`.
- **Timed Ruling Mode**: Link blocks between sides (e.g., Direct Examination → Cross Examination). When an objection pauses the timer, choose how time is deducted:
  - *Sustain*: time counts against the examining side.
  - *Overrule*: time counts against the opposing side (deducted from the linked block).
  - *Bench*: pause for both sides (no deduction).
  - *Disabled*: time always pauses for both sides.
- **Live Timer**: Start, pause, stop, restart. Quick +/-15s and +/-30s buttons. Custom time add/set/subtract. Countdown color-codes to warning (amber), critical (red pulse), and overtime.
- **Next Block**: Advance to the next segment without leaving the timer.
- **Saved Trials**: Save progress mid-round, resume later. Autosaves every 30s during a trial. Edit descriptions, delete individual trials, or clear all.
- **Presets**: Save block configurations as reusable presets with a name and description. Built-in VLRE preset included. Drag-and-drop to reorder custom presets.
- **Reload Resilience**: Timer and setup state survive accidental page reloads via sessionStorage.
- **Save & Exit**: Save the full trial state (teams, blocks, timer progress) and return to the lobby.
- **Mobile Responsive**: Adapts layout for smaller screens. Timer sidebars collapse and stack on phones.
- **Dark Courtroom Theme**: Mahogany/gold aesthetic with Playfair Display headings, courtroom seal, and legal-filing document styling.

## Field Tested

**v1.0.0** was used to timekeep at the DC Regional on 1/25/2026 and performed reliably under live competition conditions.

**v2.0.0** contains many improvements, but has not yet been tested in a live round.
