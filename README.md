# Bailiff - Mock Trial Timer

Bailiff is a streamlined sequence management tool for mock trial timekeepers. Originally built for use at VLRE (Virginia Law Related Education) competitions, but it is flexible enough for any trial format. 

## Current Features
* **Team Identification:** Configure Plaintiff/Prosecution and Defense team names at the top of the interface during setup.
* **Trial Restructuring:** Add, name, and reorder segments via drag-and-drop before the round starts.
* **Pre-Trial Lock:** Structure is locked once the trial begins to prevent accidental deletions or reordering during high-pressure rounds.
* **Rapid Time Entry:** 4-digit auto-formatting (typing '0500' creates '05:00').
* **Segment Linking:** Pair Direct and Cross-Examination blocks to enable smart time compensation.
* **One-Tap Timers:** Individual countdowns for every segment.
* **Easy Time Controls:** Buttons to add, set, and remove any amount of time.
* **Advanced Objection Mode:** If enabled, when an objection occurs, the timekeeper chooses how time is recorded:
    * **Sustained:** Time counts against the Examining side.
    * **Overruled:** Time counts against the Opposing side (deducted from the linked segment).
    * **Bench:** Time is paused for both sides (used for pauses, bench conferences, or simple clock-stops).
    * **If disabled, time will always be paused for both sides**

## Planned Features (Live Mode)
* **Local Session Sync:** Host (Timekeeper) controls the clock while secondary devices act as digital timecards.

## Field Tested
Bailiff was used to timekeep for my school’s other two teams at the DC Regional on 1/25/2026, and it performed reliably throughout the round under live competition conditions.