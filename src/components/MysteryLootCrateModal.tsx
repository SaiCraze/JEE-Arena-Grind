import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Zap, Shield, Crown, CheckCircle2, EyeOff, Crosshair, Flame, Lock, Layers } from 'lucide-react';
import { playVictoryFanfare, playLootTick } from '../utils/soundEffects';

export interface LootReward {
  id: string;
  type: 'xp' | 'title' | 'stealth' | 'xp_multiplier_next' | 'boss_orbital_strike' | 'rest_token_grant';
  label: string;
  sublabel: string;
  rarity: 'RARE' | 'EPIC' | 'MYTHIC' | 'SINGULARITY';
  value: number | string;
  crateClass: 'PHANTOM' | 'OVERCLOCK' | 'RELIC' | 'SOLARIS' | 'QUANTUM' | 'TITAN';
}

const LOOT_POOL: LootReward[] = [
  // PHANTOM VAULT
  {
    id: 'stealth_12h',
    type: 'stealth',
    label: '12h Bush Ambush Cloak',
    sublabel: 'Completely hides your records from Recent Study Sessions, History, Activity Feed & Leaderboard for 12 hours, then drops all accumulated XP at once.',
    rarity: 'SINGULARITY',
    value: 12,
    crateClass: 'PHANTOM',
  },
  {
    id: 'cryo_rest_pass',
    type: 'rest_token_grant',
    label: '+1 Cryo Rest Pass Shield',
    sublabel: 'Grants +1 extra 36-Hour Streak Protection Shield token to freeze decay without penalty.',
    rarity: 'MYTHIC',
    value: 1,
    crateClass: 'PHANTOM',
  },
  {
    id: 'title_ambush',
    type: 'title',
    label: 'Title: "Bush Ambush Predator"',
    sublabel: 'Exclusive covert operations badge displayed beside your name in the Arena.',
    rarity: 'SINGULARITY',
    value: 'Bush Ambush Predator',
    crateClass: 'PHANTOM',
  },

  // OVERCLOCK CACHE
  {
    id: 'overclock_15x',
    type: 'xp_multiplier_next',
    label: '1.5x Overclock Surge',
    sublabel: 'Supercharges your next verified study session with a 1.5x total XP multiplier.',
    rarity: 'MYTHIC',
    value: 1.5,
    crateClass: 'OVERCLOCK',
  },
  {
    id: 'orbital_strike_500',
    type: 'boss_orbital_strike',
    label: '500 HP Orbital Boss Strike',
    sublabel: 'Fires a kinetic orbital beam dealing 500 instant damage to the active Raid Boss + +20 Bonus XP.',
    rarity: 'SINGULARITY',
    value: 500,
    crateClass: 'OVERCLOCK',
  },
  {
    id: 'xp_35',
    type: 'xp',
    label: '+35 Singularity XP Drop',
    sublabel: 'Massive instant injection of verified Arena XP directly to your standing.',
    rarity: 'MYTHIC',
    value: 35,
    crateClass: 'OVERCLOCK',
  },
  {
    id: 'xp_20',
    type: 'xp',
    label: '+20 Quant Surge XP',
    sublabel: 'Instant Arena leaderboard telemetry boost.',
    rarity: 'EPIC',
    value: 20,
    crateClass: 'OVERCLOCK',
  },

  // OBSIDIAN RELIC
  {
    id: 'title_quant',
    type: 'title',
    label: 'Title: "The Ghost Quant"',
    sublabel: 'High-precision executive title displayed on your Arena profile card.',
    rarity: 'MYTHIC',
    value: 'The Ghost Quant',
    crateClass: 'RELIC',
  },
  {
    id: 'title_singularity',
    type: 'title',
    label: 'Title: "Singularity Architect"',
    sublabel: 'Apex strategic title unlocked via deep-work telemetry milestones.',
    rarity: 'MYTHIC',
    value: 'Singularity Architect',
    crateClass: 'RELIC',
  },
  {
    id: 'title_air1',
    type: 'title',
    label: 'Title: "Air-1 Trajectory"',
    sublabel: 'Rare precision rank badge for relentless syllabus execution.',
    rarity: 'EPIC',
    value: 'Air-1 Trajectory',
    crateClass: 'RELIC',
  },

  // SOLARIS SOLAR FLARE CORE
  {
    id: 'solar_overclock_2x',
    type: 'xp_multiplier_next',
    label: '2.0x Solar Flare Hyper-Drive',
    sublabel: 'Doubles all XP earned in your next verified deep-work study session.',
    rarity: 'SINGULARITY',
    value: 2.0,
    crateClass: 'SOLARIS',
  },
  {
    id: 'solar_flare_750',
    type: 'boss_orbital_strike',
    label: '750 HP Solar Flare Nova Strike',
    sublabel: 'Detonates a solar plasma blast for 750 direct Raid Boss damage + 30 XP.',
    rarity: 'SINGULARITY',
    value: 750,
    crateClass: 'SOLARIS',
  },
  {
    id: 'title_solar',
    type: 'title',
    label: 'Title: "Sun of JEE Advanced"',
    sublabel: 'Radiant golden executive title acknowledging relentless problem solving.',
    rarity: 'MYTHIC',
    value: 'Sun of JEE Advanced',
    crateClass: 'SOLARIS',
  },
  {
    id: 'xp_50',
    type: 'xp',
    label: '+50 Solar Core XP Infusion',
    sublabel: 'Direct solar telemetry injection to propel your Arena leaderboard standing.',
    rarity: 'MYTHIC',
    value: 50,
    crateClass: 'SOLARIS',
  },

  // QUANTUM PARADOX MATRIX
  {
    id: 'quantum_stealth_24h',
    type: 'stealth',
    label: '24-Hour Quantum Cloaking Veil',
    sublabel: 'Extended 24-hour bush ambush cloak hiding all study sessions from competitors until release.',
    rarity: 'SINGULARITY',
    value: 24,
    crateClass: 'QUANTUM',
  },
  {
    id: 'quantum_strike_650',
    type: 'boss_orbital_strike',
    label: '650 HP Quantum Entropy Collapse',
    sublabel: 'Shatters boss quantum defenses for 650 direct damage + 25 XP.',
    rarity: 'MYTHIC',
    value: 650,
    crateClass: 'QUANTUM',
  },
  {
    id: 'title_quantum',
    type: 'title',
    label: 'Title: "Quantum Matrix Grandmaster"',
    sublabel: 'Holographic cyber title for solving multi-concept physics & calculus dilemmas.',
    rarity: 'MYTHIC',
    value: 'Quantum Matrix Grandmaster',
    crateClass: 'QUANTUM',
  },
  {
    id: 'xp_40',
    type: 'xp',
    label: '+40 Quantum Flux XP',
    sublabel: 'Subatomic leaderboard energy boost.',
    rarity: 'EPIC',
    value: 40,
    crateClass: 'QUANTUM',
  },

  // TITAN'S COLOSSEUM ARMORY
  {
    id: 'titan_shields_3x',
    type: 'rest_token_grant',
    label: '3x Heavy Titanium Streak Shields',
    sublabel: 'Triple streak armor bundle granting 3 Cryo Rest Passes to preserve study streaks.',
    rarity: 'SINGULARITY',
    value: 3,
    crateClass: 'TITAN',
  },
  {
    id: 'titan_hammer_1000',
    type: 'boss_orbital_strike',
    label: '1,000 HP Cataclysmic Titan Strike',
    sublabel: 'Monumental warhammer smash obliterating 1,000 Raid Boss HP + 40 Bonus XP.',
    rarity: 'SINGULARITY',
    value: 1000,
    crateClass: 'TITAN',
  },
  {
    id: 'title_titan',
    type: 'title',
    label: 'Title: "Iron Titan of Kota"',
    sublabel: 'Indomitable warrior title earned through relentless mock exam grit.',
    rarity: 'MYTHIC',
    value: 'Iron Titan of Kota',
    crateClass: 'TITAN',
  },
  {
    id: 'xp_60',
    type: 'xp',
    label: '+60 Colosseum Triumph XP',
    sublabel: 'Monumental victor XP drop awarded from the ancient arena vault.',
    rarity: 'SINGULARITY',
    value: 60,
    crateClass: 'TITAN',
  },
];

const CRATE_ARCHETYPES = [
  {
    id: 'PHANTOM' as const,
    name: 'Phantom Ambush Vault',
    subtitle: 'High chance for 12h Bush Cloak & Cryo Shields',
    accent: 'emerald',
    border: 'border-emerald-500/35 hover:border-emerald-400/70',
    glow: 'from-emerald-500/20 via-teal-500/5 to-transparent',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: EyeOff,
  },
  {
    id: 'OVERCLOCK' as const,
    name: 'Singularity Surge Cache',
    subtitle: 'High chance for 1.5x Overclock, 500 HP Strike & +35 XP',
    accent: 'sky',
    border: 'border-sky-500/35 hover:border-sky-400/70',
    glow: 'from-sky-500/20 via-indigo-500/5 to-transparent',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    icon: Zap,
  },
  {
    id: 'RELIC' as const,
    name: 'Obsidian Executive Relic',
    subtitle: 'Guaranteed Mythic Titles, Quant XP & Prestige Perks',
    accent: 'violet',
    border: 'border-violet-500/35 hover:border-violet-400/70',
    glow: 'from-violet-500/20 via-fuchsia-500/5 to-transparent',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    icon: Crown,
  },
  {
    id: 'SOLARIS' as const,
    name: 'Solaris Solar Core',
    subtitle: 'High chance for 2.0x Double Overclock & 750 HP Flare',
    accent: 'amber',
    border: 'border-amber-500/35 hover:border-amber-400/70',
    glow: 'from-amber-500/20 via-orange-500/5 to-transparent',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: Flame,
  },
  {
    id: 'QUANTUM' as const,
    name: 'Quantum Paradox Matrix',
    subtitle: 'High chance for 24h Deep Veil & 650 HP Entropy Collapse',
    accent: 'cyan',
    border: 'border-cyan-500/35 hover:border-cyan-400/70',
    glow: 'from-cyan-500/20 via-sky-500/5 to-transparent',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: Layers,
  },
  {
    id: 'TITAN' as const,
    name: 'Titan Colosseum Armory',
    subtitle: 'High chance for 3x Shields & 1,000 HP Cataclysmic Strike',
    accent: 'rose',
    border: 'border-rose-500/35 hover:border-rose-400/70',
    glow: 'from-rose-500/20 via-red-500/5 to-transparent',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    icon: Shield,
  },
];

interface MysteryLootCrateModalProps {
  isOpen?: boolean;
  memberName?: string;
  sessionMinutes?: number;
  vaultsTotal?: number;
  vaultsRemaining?: number;
  onClaim?: (reward: LootReward) => void;
  onClaimReward?: (reward: LootReward) => void;
  onClose?: () => void;
  soundEnabled?: boolean;
}

export const MysteryLootCrateModal: React.FC<MysteryLootCrateModalProps> = ({
  isOpen = true,
  memberName,
  sessionMinutes,
  vaultsTotal,
  vaultsRemaining,
  onClaim,
  onClaimReward,
  onClose,
  soundEnabled = true,
}) => {
  const [selectedCrate, setSelectedCrate] = useState<LootReward['crateClass'] | null>(null);
  const [stage, setStage] = useState<'select' | 'decrypting' | 'revealed'>('select');
  const [reward, setReward] = useState<LootReward | null>(null);
  const [cycledLabel, setCycledLabel] = useState<string>('INITIALIZING QUANTUM LOCK...');

  const effectiveTotal = Math.max(1, vaultsTotal ?? Math.floor((sessionMinutes || 90) / 90));
  const effectiveRemaining = Math.max(1, vaultsRemaining ?? effectiveTotal);
  const currentVaultNumber = Math.min(effectiveTotal, Math.max(1, effectiveTotal - effectiveRemaining + 1));

  useEffect(() => {
    if (isOpen) {
      setSelectedCrate(null);
      setStage('select');
      setReward(null);
    }
  }, [isOpen, effectiveRemaining]);

  const handleSelectAndOpen = (crateType: LootReward['crateClass']) => {
    if (stage !== 'select') return;
    setSelectedCrate(crateType);
    setStage('decrypting');

    // Weight pool toward selected crate archetype (70% matching archetype, 30% any pool item)
    const matchingPool = LOOT_POOL.filter(r => r.crateClass === crateType);
    const useMatching = Math.random() < 0.72 && matchingPool.length > 0;
    const targetPool = useMatching ? matchingPool : LOOT_POOL;
    const picked = targetPool[Math.floor(Math.random() * targetPool.length)];

    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      if (soundEnabled) playLootTick();
      const randomPreview = LOOT_POOL[ticks % LOOT_POOL.length];
      setCycledLabel(randomPreview.label);

      if (ticks >= 14) {
        clearInterval(interval);
        setReward(picked);
        setStage('revealed');
        if (soundEnabled) playVictoryFanfare();
      }
    }, 85);
  };

  if (!isOpen) return null;

  const getRarityBadgeStyle = (rarity: LootReward['rarity']) => {
    switch (rarity) {
      case 'SINGULARITY':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]';
      case 'MYTHIC':
        return 'bg-violet-500/15 text-violet-300 border-violet-400/40 shadow-[0_0_20px_rgba(168,85,247,0.25)]';
      case 'EPIC':
        return 'bg-sky-500/15 text-sky-300 border-sky-400/40';
      default:
        return 'bg-zinc-800 text-zinc-300 border-white/15';
    }
  };

  const getRewardIcon = (type: LootReward['type']) => {
    switch (type) {
      case 'stealth':
        return <EyeOff className="w-10 h-10 text-emerald-400" />;
      case 'xp_multiplier_next':
        return <Flame className="w-10 h-10 text-sky-400" />;
      case 'boss_orbital_strike':
        return <Crosshair className="w-10 h-10 text-indigo-400" />;
      case 'rest_token_grant':
        return <Shield className="w-10 h-10 text-teal-400" />;
      case 'title':
        return <Crown className="w-10 h-10 text-violet-400" />;
      default:
        return <Zap className="w-10 h-10 text-sky-400" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl"
      >
        <motion.div
          initial={{ scale: 0.92, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 20, opacity: 0 }}
          className="relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto glass-card p-5 sm:p-7 text-center border border-white/15 shadow-[0_32px_90px_rgba(0,0,0,0.95)]"
        >
          {/* Ambient Top Gloss */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-zinc-200 text-[10px] font-mono uppercase tracking-[0.22em]">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                1 Vault Per 1h 30m (90m) Study Milestone
              </div>
              {effectiveTotal > 1 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-[0.18em] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <span>Vault {currentVaultNumber} of {effectiveTotal}</span>
                  <span className="text-emerald-400/70">•</span>
                  <span>{effectiveRemaining} Left</span>
                </div>
              )}
            </div>

            {stage === 'select' && (
              <>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight mb-2">
                  {effectiveTotal > 1
                    ? `Select Encrypted Vault (${currentVaultNumber} of ${effectiveTotal})`
                    : 'Select Your Encrypted Vault'}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mb-5 max-w-lg mx-auto">
                  {memberName ? `${memberName}'s ${sessionMinutes || 90}m` : `Verified ${sessionMinutes || 90}m`} deep focus unlocked{' '}
                  <span className="text-emerald-300 font-semibold">
                    {effectiveTotal} {effectiveTotal === 1 ? 'Supply Vault' : 'Supply Vaults'}
                  </span>{' '}
                  (1 vault per 90 mins). Choose a specialized vault below to decrypt your tactical reward.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 text-left">
                  {CRATE_ARCHETYPES.map((crate) => {
                    const IconComponent = crate.icon;
                    return (
                      <motion.button
                        key={crate.id}
                        whileHover={{ y: -4, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectAndOpen(crate.id)}
                        className={`group relative rounded-2xl p-4 bg-zinc-950/80 border ${crate.border} transition-all flex flex-col justify-between overflow-hidden shadow-lg`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${crate.glow} opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${crate.badge}`}>
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 px-2 py-0.5 rounded bg-white/[0.04] border border-white/10">
                              TIER IV
                            </span>
                          </div>
                          <h3 className="text-sm font-display font-bold text-white mb-1 group-hover:text-sky-200 transition-colors">
                            {crate.name}
                          </h3>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            {crate.subtitle}
                          </p>
                        </div>

                        <div className="relative z-10 mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-300 group-hover:text-white">
                            Decrypt Vault
                          </span>
                          <Lock className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Possible Drop Matrix Preview */}
                <div className="rounded-xl bg-black/40 border border-white/[0.07] p-3.5 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      Possible Tactical Drops Inside Vaults
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">100% Verified Drop</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      12h Bush Ambush Cloak (Hides Log + XP)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20">
                      1.5x Next Session Overclock
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      500 HP Orbital Boss Strike
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      +1 Cryo Rest Pass Shield
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20">
                      +35 Singularity XP & Mythic Titles
                    </span>
                  </div>
                </div>
              </>
            )}

            {stage === 'decrypting' && (
              <div className="py-10 flex flex-col items-center justify-center">
                <motion.div
                  animate={{
                    rotate: [0, 90, 180, 270, 360],
                    scale: [1, 1.08, 0.96, 1.05, 1],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="w-24 h-24 rounded-3xl bg-gradient-to-br from-sky-500/25 via-indigo-500/15 to-emerald-500/25 border border-white/25 flex items-center justify-center shadow-[0_0_50px_rgba(56,189,248,0.3)] mb-6"
                >
                  <Sparkles className="w-10 h-10 text-white animate-pulse" />
                </motion.div>
                <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-sky-400 mb-2">
                  Decrypting {selectedCrate} Telemetry...
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-mono font-semibold text-white min-w-[260px]">
                  {cycledLabel}
                </div>
              </div>
            )}

            {stage === 'revealed' && reward && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-4"
              >
                <div className="flex justify-center mb-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-[0.2em] border ${getRarityBadgeStyle(reward.rarity)}`}>
                    {reward.rarity} CLASS DROP
                  </span>
                </div>

                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/[0.05] border border-white/15 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_15px_35px_rgba(0,0,0,0.6)]">
                  {getRewardIcon(reward.type)}
                </div>

                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight mb-2">
                  {reward.label}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 max-w-md mx-auto leading-relaxed mb-6">
                  {reward.sublabel}
                </p>

                <button
                  onClick={() => {
                    if (onClaim) onClaim(reward);
                    if (onClaimReward) onClaimReward(reward);
                    if (effectiveRemaining <= 1 && onClose) onClose();
                  }}
                  className="w-full max-w-sm mx-auto py-3.5 px-6 rounded-xl font-display font-bold text-sm text-zinc-950 bg-gradient-to-r from-white via-zinc-100 to-zinc-300 hover:from-white hover:to-white transition-all shadow-[0_10px_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-zinc-900" />
                  {effectiveRemaining > 1
                    ? `Claim & Open Next Vault (${effectiveRemaining - 1} Left)`
                    : 'Equip & Claim Tactical Drop'}
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
