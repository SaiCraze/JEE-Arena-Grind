export type LeaderboardPrankMode = 'auto_invert' | 'force_topper' | 'force_last' | 'off';

export interface PrankScholar {
  id: string;
  name: string;
  institute?: string;
  [key: string]: any;
}

export interface PrankTargetConfig {
  active: boolean;
  targetMemberId: string; // e.g. 'utham', 'nishchit', 'sriman', 'ALL', etc.
  targetMemberName?: string;
  leaderboardMode: LeaderboardPrankMode;
  fakeXpAmount?: number; // e.g. 999999
  customTitle?: string; // e.g. "👑 GOD-TIER OVERLORD (AIR 1)"
  
  // Annoying & Weird UI effects
  tiltedWorld: boolean; // Tilted screen rotation (2.2deg) + subtle wobble
  slipperyButtons: boolean; // Action buttons run away when cursor hovers
  comicSansMode: boolean; // Comic Sans font + neon disco borders + jitter
  clownCursor: boolean; // Clown cursor + floating emoji trail
  squeakyAudio: boolean; // Squeaky clown horn / duck quack / boing on clicks
  annoyingPopups: boolean; // Periodic hilarious anti-cheat discipline popups
  threatToasts: boolean; // Fake urgent alerts ("Ved just studied 48 hours in 10 mins!")
  fakeLagOnTabs: boolean; // Fake 56k dial-up spinner for 1.2s when changing tabs
  invertedTyping: boolean; // Funny clown suffixes or backward text in search/inputs
  
  // Secret escape hatch / reveal
  showAdminRevealBadge: boolean; // Show discrete banner: "You've been pranked by Admin! 🤡 Click to deactivate"
  prankNotes?: string;
  activatedAt?: number;
}

export const DEFAULT_PRANK_CONFIG: PrankTargetConfig = {
  active: false,
  targetMemberId: '',
  targetMemberName: '',
  leaderboardMode: 'auto_invert',
  fakeXpAmount: 999999,
  customTitle: '',
  tiltedWorld: true,
  slipperyButtons: true,
  comicSansMode: true,
  clownCursor: true,
  squeakyAudio: true,
  annoyingPopups: true,
  threatToasts: true,
  fakeLagOnTabs: false,
  invertedTyping: false,
  showAdminRevealBadge: false,
  prankNotes: 'Squad Admin Disciplinary Prank Protocol'
};
