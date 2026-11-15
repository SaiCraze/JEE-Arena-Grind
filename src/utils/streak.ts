export interface StreakMemberLike {
  id: string;
  lastLoginDate?: string | null;
  restShieldUntil?: number | null;
  streakCount?: number | null;
}

export interface StreakSessionLike {
  memberId?: string;
  sessionType?: string;
  date?: string;
  timestamp?: number | string;
}

export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseLocalDateStr(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Computes a member's consecutive active day streak.
 * - Counts non-BREAK study sessions and the member's recorded lastLoginDate.
 * - Grants today as a grace period if they haven't logged today yet (checks yesterday backward).
 * - Bridges missed calendar days ONLY if covered by an active 36h Rest Shield window
 *   ([restShieldUntil - 36h, restShieldUntil], up to 2 calendar days covered by that 36h span).
 * - Never inflates broken streaks using stale m.streakCount values; returns 0 when inactive.
 */
export function computeMemberStreak(
  m: StreakMemberLike | null | undefined,
  memberSessions: StreakSessionLike[] = [],
  customToday?: string | Date
): number {
  if (!m || !m.id) return 0;
  const todayStr = customToday instanceof Date
    ? getLocalDateString(customToday)
    : (customToday || getLocalDateString());
  const activeDates = new Set<string>();

  for (const s of memberSessions) {
    if (!s || s.memberId !== m.id) continue;
    if (s.sessionType === 'BREAK') continue;
    if (s.date && /^\d{4}-\d{2}-\d{2}$/.test(String(s.date))) {
      activeDates.add(String(s.date));
    } else if (s.timestamp) {
      const tsMs = Number(s.timestamp);
      if (Number.isFinite(tsMs) && tsMs > 0) {
        activeDates.add(getLocalDateString(new Date(tsMs)));
      }
    }
  }

  if (m.lastLoginDate && /^\d{4}-\d{2}-\d{2}$/.test(String(m.lastLoginDate))) {
    activeDates.add(String(m.lastLoginDate));
  }

  const today = parseLocalDateStr(todayStr);
  const cur = new Date(today.getTime());
  const todayDateStr = getLocalDateString(cur);

  // Grace period: if today doesn't have activity yet, start lookback from yesterday
  if (!activeDates.has(todayDateStr)) {
    cur.setDate(cur.getDate() - 1);
  }

  const shieldEnd = Number(m.restShieldUntil) || 0;
  const shieldStart = shieldEnd > 0 ? shieldEnd - 36 * 3600 * 1000 : 0;
  const dayOverlapsShield = (dayMidnight: Date): boolean => {
    if (!shieldEnd || shieldEnd <= 0) return false;
    const dayStart = dayMidnight.getTime();
    const dayEnd = dayStart + 24 * 3600 * 1000 - 1;
    return shieldEnd >= dayStart && shieldStart <= dayEnd;
  };

  let streak = 0;
  let shieldBridgedDays = 0;

  for (let dayStep = 0; dayStep < 365; dayStep++) {
    const curStr = getLocalDateString(cur);
    if (activeDates.has(curStr)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      if (shieldBridgedDays < 2 && dayOverlapsShield(cur)) {
        shieldBridgedDays++;
        cur.setDate(cur.getDate() - 1);
        continue;
      }
      break;
    }
  }

  return streak;
}
