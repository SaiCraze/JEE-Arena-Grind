// Central Blackout Protocol & Scheduled Sprint Reset Service

// Monday, November 2, 2026 Cycle 4 boundary (exact Sprint 3 -> Sprint 4 transition)
export const CYCLE_4_START_MS = 1793577600000;

// Sunday, November 8, 2026 Cycle 5 boundary (exact Sprint 4 -> Sprint 5 transition)
// All players' active sprint XP resets to 0 starting at this exact timestamp,
// while preserving all prior XP in Sprint 1, Sprint 2, Sprint 3, and Sprint 4!
export const CYCLE_5_START_MS = 1794163000000;

function toDate(input: Date | number | string = new Date()): Date {
  if (input instanceof Date) return input;
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Checks whether the given timestamp is at the Friday 11:59 PM Blackout trigger window
 * (Friday 23:59:00 to 23:59:59).
 * Friday is day 5 in JavaScript Date.prototype.getDay().
 */
export function isBlackoutDay(date: Date | number | string = new Date()): boolean {
  const d = toDate(date);
  return d.getDay() === 5 && d.getHours() === 23 && d.getMinutes() >= 59;
}

/**
 * Checks if Friday Blackout simulation is toggled by Admin.
 * Note: The live Blackout lock starts on Friday at 11:59 PM via arenaSettings.leaderboardHidden
 * and remains locked until the Admin manually reveals it.
 */
export function isFridayBlackoutActive(
  _date: Date | number | string = new Date(),
  adminSimulateFriday = false
): boolean {
  return Boolean(adminSimulateFriday);
}

/**
 * Checks if Cycle 4 (starting Monday 11/2/2026) has begun.
 */
export function isMondayResetActive(now: Date | number | string = Date.now()): boolean {
  const ts = typeof now === 'number' ? now : toDate(now).getTime();
  return ts >= CYCLE_4_START_MS;
}

/**
 * Checks if Cycle 5 (starting Sunday 11/8/2026) has begun.
 */
export function isCycle5ResetActive(now: Date | number | string = Date.now()): boolean {
  const ts = typeof now === 'number' ? now : toDate(now).getTime();
  return ts >= CYCLE_5_START_MS;
}

/**
 * Returns the Friday 11:59 PM (23:59:00.000) Blackout start timestamp for the current week.
 */
export function getCurrentWeekFridayBounds(now: Date | number | string = new Date()): {
  fridayStartMs: number;
  fridayEndMs: number;
  saturdayRevealMs: number;
} {
  const d = toDate(now);
  const day = d.getDay(); // 0=Sun .. 5=Fri .. 6=Sat
  const diffToFriday = 5 - day;
  const fridayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToFriday, 23, 59, 0, 0);
  const fridayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToFriday, 23, 59, 59, 999);
  const saturdayReveal = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToFriday + 2, 22, 0, 0, 0);
  return {
    fridayStartMs: fridayStart.getTime(),
    fridayEndMs: fridayEnd.getTime(),
    saturdayRevealMs: saturdayReveal.getTime()
  };
}

/**
 * Study sessions are NEVER subtracted or concealed from a scholar's own XP calculation.
 * During Blackout (starting Friday 11:59 PM until Admin Reveal), each scholar sees their own
 * real-time XP and Boss Damage while all other scholars' XP, damage, and analytics remain locked.
 */
export function isSessionConcealedByFridayBlackout(
  _sessionTimestamp: number,
  _now: Date | number | string = new Date(),
  _adminSimulateFriday = false
): boolean {
  return false;
}

/**
 * Formats a status string for Blackout Lock until Admin Reveal.
 */
export function getTimeUntilSaturdayReveal(_now: Date | number | string = new Date()): string {
  return 'UNTIL ADMIN REVEAL';
}

export const BLACKOUT_TOOLTIP_MESSAGE = 'The Black Market & Arena Sabotages are disabled during Blackout until Admin Reveal.';
export const BLACKOUT_SHOP_MESSAGE = 'The Black Market is closed during Blackout until the Admin reveals the standings.';
export const BLACKOUT_SHOP_DISABLED_MSG = 'The Black Market is closed during Blackout.';
export const BLACKOUT_BANNER_TEXT = 'BLACKOUT PROTOCOL IN EFFECT - Standings Locked Until Admin Reveal.';
export const BLACKOUT_LEADERBOARD_PLACEHOLDER = 'CLASSIFIED / IN THE DARK';
