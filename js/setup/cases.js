// Case names live in ./cases.json — grouped loosely by theme there (AP Gov
// staples, school cases, media/defamation, celebrity, tech, Trump, weird
// government-vs-object forfeiture cases, etc.), though the JSON itself
// doesn't carry section labels. Top-level await here means every importer
// (case-library.js, and transitively main.js) only resumes evaluating once
// this has resolved, so FAMOUS_CASES is always populated by the time it's
// read — no separate async plumbing needed at the call sites.
const res = await fetch(new URL('./cases.json', import.meta.url));
export const FAMOUS_CASES = await res.json();
