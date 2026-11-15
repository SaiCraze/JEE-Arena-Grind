import React, { useState, useEffect, useRef } from 'react';
import { PrankTargetConfig } from '../types/prank';
import { playClownHorn, playRandomPrankSound, playSadTrombone, playBoingSound } from '../utils/prankAudio';
import { Crown, AlertTriangle, Sparkles, X, HelpCircle, Flame, ShieldAlert } from 'lucide-react';

interface PrankChaosOverlayProps {
  config: PrankTargetConfig;
  targetScholarName: string;
  isTopperPrank: boolean;
  isLastPlacePrank: boolean;
  onDeactivate?: () => void;
  isAdminPreview?: boolean;
}

interface EmojiParticle {
  id: number;
  x: number;
  y: number;
  emoji: string;
}

const EMOJI_POOL = ['🤡', '🎈', '🥔', '🦆', '💩', '🦄', '🍌', '🎪'];

const POPUP_CHALLENGES = [
  {
    title: '🚨 NTA & CBSE ACADEMIC DISCIPLINE COMMITTEE',
    subtitle: 'URGENT BIOMETRIC VERIFICATION REQUIRED',
    body: 'Our AI camera tracking detected your gaze drifted 1.8 inches away from the NCERT Chemistry textbook. Solve immediately to prevent rank collapse:',
    question: 'What is 7 × 8?',
    correctAnswer: '56',
    options: ['42', '56', '64', 'Potato'],
    rewardMsg: 'Correct! You have been granted 60 seconds of study immunity. Keep grinding, clown! 🤡'
  },
  {
    title: '⚠️ RIZZ DEFICIT WARNING (NTA CIRCULAR #404)',
    subtitle: 'ACADEMIC DANGER LEVEL: CRITICAL',
    body: 'Warning Scholar! Your solving speed indicates dangerously high chemistry rizz. Cooling fans have been activated on your phone.',
    question: 'Which element is most likely to steal your rank?',
    correctAnswer: 'Unobtainium',
    options: ['Unobtainium', 'Helium (too light)', 'Potassium 🥔', 'Vedium'],
    rewardMsg: 'Warning bypassed! Admin has noted your submission. 💨'
  },
  {
    title: '🥔 CHAIR ERGONOMICS RE-CALIBRATION NOTICE',
    subtitle: 'OFFICIAL JEE SQUAD AUDIT',
    body: 'Your chair squeak frequency has triggered squad anti-sloth sensors. Confirm you are not sleeping with eyes open.',
    question: 'Are you currently an Academic Weapon or a Mashed Potato?',
    correctAnswer: 'Certified Weapon',
    options: ['Certified Weapon', 'Mashed Potato 🥔', 'Need Chai ☕', 'Ask Admin'],
    rewardMsg: 'Ergonomic check passed! Proceed with extreme caution.'
  }
];

export const PrankChaosOverlay: React.FC<PrankChaosOverlayProps> = ({
  config,
  targetScholarName,
  isTopperPrank,
  isLastPlacePrank,
  onDeactivate,
  isAdminPreview
}) => {
  const [particles, setParticles] = useState<EmojiParticle[]>([]);
  const [showDisciplineModal, setShowDisciplineModal] = useState<boolean>(false);
  const [currentChallenge, setCurrentChallenge] = useState(POPUP_CHALLENGES[0]);
  const [challengeFeedback, setChallengeFeedback] = useState<string>('');
  const [threatToast, setThreatToast] = useState<{ title: string; body: string } | null>(null);
  const [dodgeNotice, setDodgeNotice] = useState<{ x: number; y: number; text: string } | null>(null);

  const particleIdRef = useRef(0);
  const lastSoundTimeRef = useRef(0);
  const dodgeCountRef = useRef<Record<string, number>>({});

  // 1. Mouse trail effect when clownCursor is active
  useEffect(() => {
    if (!config.clownCursor) return;

    let lastSpawn = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastSpawn < 70) return; // limit particle spawn rate
      lastSpawn = now;

      const randomEmoji = EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
      const newParticle: EmojiParticle = {
        id: ++particleIdRef.current,
        x: e.clientX,
        y: e.clientY,
        emoji: randomEmoji
      };

      setParticles((prev) => [...prev.slice(-14), newParticle]);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [config.clownCursor]);

  // Clean up emoji particles over time
  useEffect(() => {
    if (particles.length === 0) return;
    const t = setTimeout(() => {
      setParticles((prev) => prev.slice(1));
    }, 600);
    return () => clearTimeout(t);
  }, [particles]);

  // 2. Global Squeaky sound on clicks
  useEffect(() => {
    if (!config.squeakyAudio) return;

    const handleClick = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastSoundTimeRef.current < 250) return; // debounce sounds
      lastSoundTimeRef.current = now;

      // Play funny sound
      playRandomPrankSound();
    };

    window.addEventListener('click', handleClick, { passive: true });
    return () => window.removeEventListener('click', handleClick);
  }, [config.squeakyAudio]);

  // 3. Slippery Runaway Buttons physics
  useEffect(() => {
    if (!config.slipperyButtons) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Target action buttons or anything marked with prank-dodge
      const button = target.closest(
        'button:not([data-prank-exempt="true"]):not(.exempt-dodge), .prank-dodge-target'
      ) as HTMLElement | null;

      if (!button) return;

      const btnId = button.id || button.innerText.slice(0, 15) || 'btn';
      const count = dodgeCountRef.current[btnId] || 0;

      // Dodge 2 times before letting them click!
      if (count < 2) {
        dodgeCountRef.current[btnId] = count + 1;
        playBoingSound();

        const randX = (Math.random() > 0.5 ? 1 : -1) * (45 + Math.random() * 45);
        const randY = (Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 30);

        button.style.transition = 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)';
        button.style.transform = `translate(${randX}px, ${randY}px)`;

        const rect = button.getBoundingClientRect();
        setDodgeNotice({
          x: rect.left + rect.width / 2,
          y: Math.max(20, rect.top - 25),
          text: count === 0 ? 'Too slow! 🏃💨' : 'Whoops! Missed me! 🤡'
        });

        setTimeout(() => {
          setDodgeNotice(null);
        }, 800);

        setTimeout(() => {
          button.style.transform = '';
        }, 1200);
      } else {
        // Reset count after letting them click so it works next time
        dodgeCountRef.current[btnId] = 0;
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    return () => document.removeEventListener('mouseover', handleMouseOver);
  }, [config.slipperyButtons]);

  // 4. Periodic Annoying Discipline Popups
  useEffect(() => {
    if (!config.annoyingPopups) return;

    // Trigger first popup after 18 seconds, then every 75 seconds
    const firstTimer = setTimeout(() => {
      const challenge = POPUP_CHALLENGES[Math.floor(Math.random() * POPUP_CHALLENGES.length)];
      setCurrentChallenge(challenge);
      setChallengeFeedback('');
      setShowDisciplineModal(true);
      playClownHorn();
    }, 18000);

    const interval = setInterval(() => {
      const challenge = POPUP_CHALLENGES[Math.floor(Math.random() * POPUP_CHALLENGES.length)];
      setCurrentChallenge(challenge);
      setChallengeFeedback('');
      setShowDisciplineModal(true);
      playClownHorn();
    }, 85000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [config.annoyingPopups]);

  // 5. Periodic Fake Urgent Threat Toasts
  useEffect(() => {
    if (!config.threatToasts) return;

    const THREAT_MSGS = [
      {
        title: '🚨 INTEL LEAK: Ved Just Speedran 100 Qs!',
        body: 'Ved logged 4.5 hours in the last 12 minutes and is closing in on your rank with a 2.0x Overclock!'
      },
      {
        title: '⚠️ Sriman Launched Tactical XP Missile!',
        body: 'Sriman has locked onto your position! Study 30 more minutes to activate defensive countermeasures.'
      },
      {
        title: '🥔 ACADEMIC GRAVITY ALERT',
        body: 'Your study chair has detected a high procrastination vortex. Blowing virtual cold air into your room...'
      },
      {
        title: '🏆 SUPREME ARENA BROADCAST',
        body: `All scholars in the JEE Grind Arena are currently whispering about ${targetScholarName || 'you'}!`
      }
    ];

    const interval = setInterval(() => {
      const msg = THREAT_MSGS[Math.floor(Math.random() * THREAT_MSGS.length)];
      setThreatToast(msg);
      playClownHorn();

      setTimeout(() => {
        setThreatToast(null);
      }, 5500);
    }, 45000);

    return () => clearInterval(interval);
  }, [config.threatToasts, targetScholarName]);

  const handleChallengeAnswer = (answer: string) => {
    if (answer === currentChallenge.correctAnswer) {
      setChallengeFeedback(currentChallenge.rewardMsg);
      playBoingSound();
      setTimeout(() => {
        setShowDisciplineModal(false);
      }, 1200);
    } else {
      setChallengeFeedback('❌ INCORRECT! Your chair has been penalized 100 potato points! Try again! 🥔');
      playSadTrombone();
    }
  };

  return (
    <>
      {/* Dynamic CSS Injection for Tilted World & Comic Sans / Neon Disco Theme */}
      <style>{`
        ${
          config.clownCursor
            ? `
          body, html, button, a, input, [role="button"] {
            cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><text y='26' font-size='24'>🤡</text></svg>"), auto !important;
          }
        `
            : ''
        }

        ${
          config.tiltedWorld
            ? `
          #root {
            transform: rotate(1.8deg) !important;
            transform-origin: 50% 25% !important;
            transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1) !important;
            animation: prankWobbleAnim 14s ease-in-out infinite alternate !important;
          }
          @keyframes prankWobbleAnim {
            0% { transform: rotate(1.8deg) scale(0.992); }
            35% { transform: rotate(-1.5deg) scale(0.996); }
            70% { transform: rotate(1.2deg) scale(0.994); }
            100% { transform: rotate(-1.9deg) scale(0.99); }
          }
        `
            : ''
        }

        ${
          config.comicSansMode
            ? `
          body, html, * {
            font-family: "Comic Sans MS", "Comic Neue", cursive, sans-serif !important;
          }
          h1, h2, h3, .font-display {
            background: linear-gradient(90deg, #ff007f, #ffff00, #00ffea, #ff007f) !important;
            -webkit-background-clip: text !important;
            -webkit-text-fill-color: transparent !important;
            animation: prankRainbowShift 4s linear infinite !important;
          }
          @keyframes prankRainbowShift {
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(360deg); }
          }
          .surface-card, .surface-elevated {
            border-color: #39ff14 !important;
            box-shadow: 0 0 20px rgba(57, 255, 20, 0.35), inset 0 0 12px rgba(255, 0, 128, 0.15) !important;
          }
        `
            : ''
        }

        @keyframes prankConfettiFloat {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-70px) scale(1.4) rotate(45deg); opacity: 0; }
        }
      `}</style>

      {/* Floating Mouse Cursor Emoji Trail */}
      {config.clownCursor && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute select-none text-2xl"
              style={{
                left: `${p.x}px`,
                top: `${p.y}px`,
                animation: 'prankConfettiFloat 0.7s forwards ease-out'
              }}
            >
              {p.emoji}
            </div>
          ))}
        </div>
      )}

      {/* Slippery Dodge Floating Notice */}
      {dodgeNotice && (
        <div
          className="fixed pointer-events-none z-[10000] px-2.5 py-1 rounded-full bg-amber-400 text-zinc-950 font-black text-xs shadow-xl animate-bounce"
          style={{
            left: `${dodgeNotice.x}px`,
            top: `${dodgeNotice.y}px`,
            transform: 'translateX(-50%)'
          }}
        >
          {dodgeNotice.text}
        </div>
      )}

      {/* TOP PRANK STATUS BANNER */}
      <div className="sticky top-0 z-[60] w-full shadow-2xl transition-all">
        {isTopperPrank && (
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 border-b-2 border-yellow-200 text-zinc-950 px-4 py-2.5 text-center shadow-lg relative overflow-hidden">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm font-black">
              <span className="flex items-center gap-1.5 animate-pulse bg-zinc-950/20 px-2 py-0.5 rounded-full">
                <Crown className="w-4 h-4 text-zinc-950 shrink-0 fill-current" />
                <span>👑 AIR-1 ASCENDED OVERLORD</span>
              </span>
              <span>
                Congratulations {targetScholarName}! You are the undisputed #1 Champion of the JEE Arena (999,999 XP)!
              </span>
              <span className="bg-zinc-950 text-amber-300 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
                LEAD: +998,394 XP
              </span>
              {isAdminPreview && (
                <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                  [ADMIN PREVIEW MODE]
                </span>
              )}
            </div>
          </div>
        )}

        {isLastPlacePrank && (
          <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700 border-b-2 border-rose-400 text-white px-4 py-2.5 text-center shadow-lg">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm font-black">
              <span className="flex items-center gap-1.5 bg-black/40 px-2.5 py-0.5 rounded-full text-rose-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <span>🥔 DISCIPLINARY ACADEMIC DEMOTION</span>
              </span>
              <span>
                Attention {targetScholarName}: Your rank has collapsed to DEAD LAST (#16 of 16) with 0 XP! 99.8% Backlog Detected!
              </span>
              <span className="bg-black/50 text-amber-300 px-2 py-0.5 rounded-full text-[11px] font-mono">
                RANK: 16/16 (POTATO CLASS)
              </span>
              {isAdminPreview && (
                <span className="bg-sky-400 text-zinc-950 px-2 py-0.5 rounded text-[10px] font-bold">
                  [ADMIN PREVIEW MODE]
                </span>
              )}
            </div>
          </div>
        )}

        {/* Optional discrete escape hatch badge if Admin enabled it */}
        {(config.showAdminRevealBadge || isAdminPreview) && (
          <div className="bg-zinc-900/95 border-b border-zinc-700 px-4 py-1.5 flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="text-base">🤡</span>
              <span className="font-semibold">
                {isAdminPreview ? 'Admin Prank Preview Active' : 'You are currently experiencing the Squad Admin Prank!'}
              </span>
            </div>
            {onDeactivate && (
              <button
                type="button"
                data-prank-exempt="true"
                onClick={onDeactivate}
                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-[11px] cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>{isAdminPreview ? 'Exit Preview' : 'Deactivate Prank'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* FAKE URGENT THREAT TOAST */}
      {threatToast && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-zinc-950 border-2 border-amber-400/80 rounded-2xl p-4 shadow-2xl animate-bounce">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚨</span>
              <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">{threatToast.title}</h4>
            </div>
            <button
              type="button"
              data-prank-exempt="true"
              onClick={() => setThreatToast(null)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-200 font-medium leading-relaxed">{threatToast.body}</p>
          <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>RADAR: LIVE THREAT</span>
            <span className="text-amber-400 font-bold">DEFENSE STATUS: CLOWN 🤡</span>
          </div>
        </div>
      )}

      {/* RIDICULOUS ANTI-CHEAT / DISCIPLINE POPUP MODAL */}
      {showDisciplineModal && (
        <div className="fixed inset-0 z-[10001] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border-2 border-rose-500 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
                <div>
                  <h3 className="text-sm font-black text-white font-display tracking-tight">{currentChallenge.title}</h3>
                  <p className="text-[10px] text-rose-300/90 font-mono">{currentChallenge.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                data-prank-exempt="true"
                onClick={() => {
                  playBoingSound();
                  setShowDisciplineModal(false);
                }}
                className="text-zinc-500 hover:text-white p-1"
                title="Forgive me"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-medium">{currentChallenge.body}</p>

            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-amber-300 text-center font-mono">
                {currentChallenge.question}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {currentChallenge.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    data-prank-exempt="true"
                    onClick={() => handleChallengeAnswer(opt)}
                    className="p-2.5 rounded-xl bg-zinc-800/90 hover:bg-amber-400 hover:text-zinc-950 text-white font-bold text-xs transition-all border border-zinc-700/60 cursor-pointer text-center"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {challengeFeedback && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-center text-xs font-bold text-rose-200">
                {challengeFeedback}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-400">
              <span className="font-mono text-zinc-500">Security Clearance: Lv.0</span>
              <button
                type="button"
                data-prank-exempt="true"
                onClick={() => {
                  playSadTrombone();
                  setChallengeFeedback('Admin has graciously forgiven your transgression! 🤡');
                  setTimeout(() => setShowDisciplineModal(false), 1000);
                }}
                className="text-sky-400 hover:underline cursor-pointer font-semibold"
              >
                Apologize to Admin &amp; Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
