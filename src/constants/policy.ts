// Fallback values only. The live rules come from the `app_policy` table
// (admin → Manage → Rules) and the database enforces them; use usePolicy().
export const SESSION_SECONDS = 60 * 60;      // 60 min
export const BREAK_MINUTES = 15;
export const LOW_TIME_THRESHOLD = 15 * 60;
export const DOT_COUNT = 60;
export const RESERVATION_SECONDS = 5 * 60;   // 5 min scan window
