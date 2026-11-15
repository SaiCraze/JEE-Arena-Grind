export type OffensiveActionType =
  | 'name_hijack'
  | 'ui_flashbang'
  | 'ui_curse'
  | 'audit_badge'
  | 'sound_horn'
  | 'quickdraw_duel'
  | 'robin_hood_ambush';

export interface AuditRecord {
  id: string;
  auditorId: string;
  auditorName: string;
  targetUserId: string;
  targetUserName: string;
  sessionId: string;
  sessionSubject: string;
  sessionDuration: number;
  sessionXp: number;
  costPaid?: number;
  createdAt: number;
  expiresAt: number; // createdAt + 10 mins
  status: 'pending' | 'defended' | 'verified' | 'stripped' | 'failed';
  proofImageUrl?: string;
  defenseNote?: string;
  resolvedAt?: number;
}

export interface QuickdrawDuel {
  id: string;
  challengerId: string;
  challengerName: string;
  opponentId: string;
  opponentName: string;
  durationMins: number;
  wagerXp: number;
  escrowPot: number; // 2x wagerXp
  createdAt: number;
  expiresAt?: number; // createdAt + 10 mins
  inviteExpiresAt?: number; // createdAt + 10 mins
  acceptedAt?: number;
  startedAt?: number;
  endedAt?: number;
  status: 'pending' | 'active' | 'completed' | 'declined' | 'expired' | 'forfeited';
  winnerId?: string;
  winnerName?: string;
  forfeitedById?: string;
  forfeitedByName?: string;
  winReason?: string;
  challengerStartedAt?: number;
  opponentStartedAt?: number;
  completedAt?: number;
}

export interface RobinHoodAmbush {
  id: string;
  dateKey: string; // YYYY-MM-DD
  ambusherId: string;
  ambusherName: string;
  kingId: string;
  kingName: string;
  entryFeeXp: number; // 50 XP
  createdAt: number;
  status: 'active' | 'ambusher_won' | 'king_defended' | 'won' | 'lost';
  ambusherMins?: number;
  kingMins?: number;
  xpSiphoned?: number;
  siphonedXp?: number;
  settledAt?: number;
  resolvedAt?: number;
}

export interface HostagePact {
  id: string;
  partnerAId?: string;
  partnerAName?: string;
  partnerBId?: string;
  partnerBName?: string;
  memberAId?: string;
  memberAName?: string;
  memberBId?: string;
  memberBName?: string;
  createdAt: number;
  startDateKey?: string; // YYYY-MM-DD
  startedAt?: number;
  expiresAt?: number;
  daysCompleted: number;
  targetDays?: number; // 5 days
  totalDays?: number; // 5 days
  dailyMinMinutes: number; // 120 mins (2 hours)
  multiplier: number; // 1.5x
  status: 'pending' | 'active' | 'completed' | 'broken' | 'broken_gulag';
  lastEvaluatedDateKey?: string;
  lastCheckedDateKey?: string;
  brokenReason?: string;
  brokenAt?: number;
}

export interface ArenaWarfareState {
  audits: AuditRecord[];
  duels: QuickdrawDuel[];
  ambushes: RobinHoodAmbush[];
  hostagePacts: HostagePact[];
  fridayVaultedXpByMember?: Record<string, number>;
  lastSaturdayRevealDateKey?: string;
  lastMidnightSettlementDateKey?: string;
  simulateFridayBlackout?: boolean;
}
