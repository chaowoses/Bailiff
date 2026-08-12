# Bailiff — Mock Trial Timer

A streamlined timer and sequence management tool for mock trial timekeepers. Originally built for VLRE (Virginia Law Related Education) competitions, flexible enough for any trial format. Dark courtroom theme, works in the browser, no login, no install.

## Features

<details>
<summary><b>Team Setup</b></summary>

Name the plaintiff/prosecution and defense sides. Random famous case names appear as placeholders.
</details>

<details>
<summary><b>Block Management</b></summary>

Add, name, reorder (drag-and-drop), and delete trial segments (opening, direct, cross, closing, etc.). Each block has a name and a duration.
</details>

<details>
<summary><b>Rapid Time Entry</b></summary>

Type 4 digits (e.g., `0500`) while setting up a block and it auto-formats to `MM:SS`: no fumbling with time pickers.
</details>

<details>
<summary><b>Timed Ruling Mode</b></summary>

An optional toggle that lets you link blocks between sides (e.g., Direct Examination ↔ Cross Examination) so that objections during a paused timer can be scored against either side. See [Advanced Objection Mode](#advanced-objection-mode-timed-ruling-mode) below for the full breakdown.
</details>

<details>
<summary><b>Live Timer</b></summary>

Start, pause, stop, and restart each block. Quick +15s/+30s and -15s/-30s adjustment buttons, plus a custom time field to add, set, subtract, or clear time on the fly. A Reset button restores the block to its originally configured time. The countdown color-codes to warning (amber, ≤30s), critical (red pulse, ≤10s), and overtime (keeps counting past zero) states.
</details>

<details>
<summary><b>Next Block</b></summary>

Advance to the next segment without leaving the timer screen.
</details>

<details>
<summary><b>Saved Trials</b></summary>

Save progress mid-round and resume later. Autosaves every 30 seconds during a trial. Edit descriptions, delete individual trials, or clear all. Trials saved with Timed Ruling Mode enabled are marked with a badge so you can tell at a glance.
</details>

<details>
<summary><b>Presets</b></summary>

Save block configurations as reusable presets with a name and description. Comes with a built-in VLRE preset. Drag-and-drop to reorder your custom presets.
</details>

<details>
<summary><b>Reload Resilience</b></summary>

Timer and setup state survive an accidental page reload via sessionStorage — you won't lose your place mid-round.
</details>

<details>
<summary><b>Save & Exit</b></summary>

Save the full trial state (teams, blocks, timer progress) and return to the atrium to pick it back up later.
</details>

<details>
<summary><b>Mobile Responsive</b></summary>

Adapts layout for smaller screens. Timer sidebars collapse and stack on phones, with agenda tabs to switch which team's block list you're viewing (this only changes what's displayed, it doesn't affect which team's timer is actually running).
</details>

## Advanced Objection Mode (Timed Ruling Mode)

Timed Ruling Mode is a setup-screen toggle that changes how pausing a block behaves, to simulate the effect of objections during examination.

**Linking blocks.** With the toggle on, each block gets a "Link to:" option in setup. Linking one block to another (e.g., Direct Examination → Cross Examination) pairs them across sides. At trial start, that link automatically applies to the matching block on the opposing team, so you don't have to configure each team separately. If a linked block is later deleted, anything pointing to it is automatically unlinked.

**What happens on pause.** Pausing a block doesn't just stop the clock, it also starts a separate, independent count-up timer that tracks how long the pause lasts (i.e., how long the objection/argument takes). That elapsed pause time is what gets deducted when you choose a ruling.

**The three outcomes when resuming:**
- **Sustain**: the elapsed pause time is deducted from the *current speaker's own block*. Use this when the objection was sustained against the person currently speaking.
- **Overrule**: the elapsed pause time is deducted from the *linked block on the opposing side* instead, and the current speaker's time is left untouched. Use this when the objection is overruled, effectively costing the objecting side their own time.
- **Resume**: always available, deducts nothing from anywhere, and simply continues the clock. This is the only option available when Timed Ruling Mode is off, or when a block has no link configured (Overrule won't appear without a valid link).

**Example:** Cross-Examination is linked to Direct-Examination. During Cross, the questioner is paused. If the objection is *sustained*, time comes off Cross-Examination's own clock. If it's *overruled*, time comes off Direct-Examination's clock instead — because a good, valid objection during cross shouldn't cost the cross-examiner time.

Linked blocks are marked with a small scales icon in setup, and with a link icon plus a highlight on the opposing team's live timer widget while the paired block is active, so both sides can see the connection during a round.

## Field Tested

**v1.0.0** was tested to timekeep at the DC Regional on 1/25/2026 and performed reliably under live competition conditions.

**v2.x** contains many improvements, but has not yet been tested in a live round.

## License

MIT. See [LICENSE](LICENSE).
