// Session video recording ships in a later release. Until VITE_RECORDINGS=on is set at
// build time, every recording view shows "Coming soon"; assessment results are unaffected.
export const RECORDINGS_LIVE = import.meta.env.VITE_RECORDINGS === "on";
