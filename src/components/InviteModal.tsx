import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Users,
  Sparkles,
  MessageSquare,
  Send,
  Mail,
  Zap,
  Flame,
  Award,
  Trophy,
  ExternalLink
} from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl?: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, appUrl }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'discord' | 'email' | 'social'>('whatsapp');

  if (!isOpen) return null;

  const currentAppUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-jn2dfdgf5dsjcmqkfszlsv-119552282513.asia-southeast1.run.app');

  const templates = {
    whatsapp: {
      id: 'whatsapp',
      label: 'WhatsApp / SMS',
      icon: MessageSquare,
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
      badge: 'Short & Punchy',
      text: `🔥 Yo! Join our JEE Grind Arena squad on JEE Grind Arena! 

⚡ Track live study hours, log PYQ problem sets, battle in Raid Boss Arenas & climb the live leaderboards together!

🏆 Hop in here: ${currentAppUrl}

Let's crush JEE Mains & Advanced together! 💪📚`
    },
    discord: {
      id: 'discord',
      label: 'Discord / Telegram',
      icon: Send,
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20',
      badge: 'Group Channels',
      text: `🚀 **Calling all JEE Aspirants!** 🚀

We’ve set up a real-time competitive study workspace on **JEE Grind Arena** to keep each other accountable and boost our daily question-solving velocity!

**What you get on the Arena:**
⏱️ **Live Study Session Timer** with anti-distraction lock screen & focus mode
🎯 **Problem Solving & PYQ Logger** (Mains & Advanced difficulty Multipliers)
⚔️ **Raid Boss Battles & Squad Bounties** — convert study hours into boss damage
📊 **Percentile Predictor & Exam Logger** for mock tests
👑 **Live Leaderboard & Podium Standings** with streak shields & loot rewards

🔗 **Join the Arena Now:**
${currentAppUrl}

See you on the podium! 🏆`
    },
    email: {
      id: 'email',
      label: 'Email / Study Group',
      icon: Mail,
      color: 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20',
      badge: 'Formal & Detailed',
      subject: 'Invitation to join JEE Grind Arena - Live Study Tracker & Squad Leaderboard',
      text: `Subject: Join our JEE Grind Arena Competitive Study Group!

Hi everyone,

I'd like to invite you to join our study group on JEE Grind Arena—a real-time competitive tracker designed specifically for JEE Mains & Advanced preparation.

Key Features:
- Real-Time Stopwatch & Focus Timer: Track live study hours with subject tags (Physics, Chemistry, Math).
- PYQ & Question Velocity Logger: Auto-calculate XP weighted by Mains & Advanced difficulty tiers.
- Mock Exam & Percentile Logger: Track test marks, institute ranks, and percentiles over time.
- Raid Boss Arena & Squad Bounties: Earn loot crates and battle subject bosses as a squad.
- Live Leaderboard & Sprint Standings: Stay accountable with daily streaks, rest shields, and podium ranks.

You can create or claim your profile in seconds:
${currentAppUrl}

Looking forward to grinding together!

Best regards,
JEE Grind Arena Squad Member`
    },
    social: {
      id: 'social',
      label: 'Social Media / Post',
      icon: Sparkles,
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20',
      badge: 'Public Invite',
      text: `🎯 Preparing for JEE 2026/2027? Stop grinding alone in isolation!

Join our live JEE Grind Arena—a competitive study space where we track study hours, PYQ solve velocity, mock exam percentiles, and battle weekly Raid Bosses! ⚔️🔥

👉 Hop into the Arena: ${currentAppUrl}

#JEE2026 #JEE2027 #JEEMains #JEEAdvanced #StudyGrind #JEESquad`
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleNativeShare = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'JEE Grind Arena Invitation',
          text: text,
          url: currentAppUrl
        });
      } catch (e) {
        // user cancelled or share failed
      }
    } else {
      handleCopy('native', text);
    }
  };

  const activeTemplate = templates[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Invite Squad Members
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  Live Arena
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Share invitation messages to recruit study partners & compete on the live leaderboard.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Link Bar */}
        <div className="p-4 bg-zinc-950/40 border-b border-zinc-800/80 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 font-mono overflow-x-auto select-all">
            <ExternalLink className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="truncate">{currentAppUrl}</span>
          </div>
          <button
            onClick={() => handleCopy('link', currentAppUrl)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-400 text-slate-950 font-semibold text-xs hover:bg-sky-300 transition-colors shrink-0"
          >
            {copiedId === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedId === 'link' ? 'Copied Link!' : 'Copy Link'}
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center gap-2 p-3 border-b border-zinc-800 bg-zinc-900/50 overflow-x-auto">
          {(Object.keys(templates) as Array<keyof typeof templates>).map((key) => {
            const item = templates[key];
            const Icon = item.icon;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm shadow-sky-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Template Content Box */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              {activeTemplate.label} Draft
            </span>
            <span className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${activeTemplate.color}`}>
              {activeTemplate.badge}
            </span>
          </div>

          {'subject' in activeTemplate && (
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono">
              <span className="text-zinc-500">Subject: </span>
              {activeTemplate.subject}
            </div>
          )}

          <div className="relative group">
            <textarea
              readOnly
              rows={8}
              value={activeTemplate.text}
              className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono leading-relaxed resize-none focus:outline-none focus:border-sky-500/50"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-sky-400" />
            <span>Ready to send directly to your group chats</span>
          </div>

          <div className="flex items-center gap-2">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={() => handleNativeShare(activeTemplate.text)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share...</span>
              </button>
            )}

            <button
              onClick={() => handleCopy(activeTemplate.id, activeTemplate.text)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-sky-500/20 active:scale-95"
            >
              {copiedId === activeTemplate.id ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Draft</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
