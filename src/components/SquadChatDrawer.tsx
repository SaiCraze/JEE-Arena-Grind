import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Trash2,
  Edit3,
  Search,
  Trophy,
  Clock,
  Swords,
  CheckCircle2,
  Maximize2,
  Minimize2,
  CornerDownRight,
  Bookmark,
  Sparkles,
  Camera,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  Award,
  Check
} from 'lucide-react';
import { compressImageFile } from '../utils/image';

export type DoubtDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export const DOUBT_DIFFICULTY_CONFIG: Record<
  DoubtDifficulty,
  { label: string; shortLabel: string; defaultXp: number; minXp: number; maxXp: number; desc: string; badgeClass: string }
> = {
  easy: {
    label: 'Easy • Concept / Formula',
    shortLabel: 'Easy',
    defaultXp: 2,
    minXp: 1,
    maxXp: 3,
    desc: 'Quick formula check, sign convention, or 1-step conceptual doubt',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/35'
  },
  medium: {
    label: 'Medium • JEE Mains Level',
    shortLabel: 'Medium',
    defaultXp: 5,
    minXp: 4,
    maxXp: 6,
    desc: 'Standard JEE Mains numerical or multi-step application',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/35'
  },
  hard: {
    label: 'Hard • JEE Advanced Level',
    shortLabel: 'Hard',
    defaultXp: 8,
    minXp: 7,
    maxXp: 9,
    desc: 'Tricky multi-concept JEE Advanced problem or mechanism',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/35'
  },
  extreme: {
    label: 'Extreme • Boss / Olympiad',
    shortLabel: 'Extreme',
    defaultXp: 10,
    minXp: 10,
    maxXp: 10,
    desc: 'Pathfinder / Irodov / Black Book / Rank-decider brainteaser',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-400/35'
  }
};

export interface DoubtSolutionPayload {
  doubtMsgId: string;
  doubtSenderId: string;
  doubtSenderName: string;
  subject: 'Physics' | 'Chemistry' | 'Math';
  difficulty: DoubtDifficulty;
  bountyXp: number;
  coreTrick: string;
  roughSteps: string;
  commonTrap?: string;
  handwrittenImageUrl?: string | null;
  honorPledgeSigned: boolean;
  typedNaturally: boolean;
  pasteAttemptsBlocked?: number;
}

export interface ChatCardPayload {
  type: 'grind_stats' | 'exam_score' | 'duel_callout';
  title: string;
  subtitle?: string;
  metrics: Array<{ label: string; value: string; accent?: string }>;
}

export interface ChatReplyPreview {
  id: string;
  senderName: string;
  text: string;
}

export interface EnhancedChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'student' | 'teacher' | 'admin';
  recipientId: 'ALL' | string;
  recipientName: string;
  text: string;
  timestamp: number;
  channelTag?: 'general' | 'doubts' | 'warfare';
  replyTo?: ChatReplyPreview | null;
  reactions?: Record<string, string[]>;
  pinned?: boolean;
  editedAt?: number | null;
  doubtSubject?: 'Physics' | 'Chemistry' | 'Math' | null;
  doubtDifficulty?: DoubtDifficulty | null;
  doubtBountyXp?: number | null;
  doubtImageUrl?: string | null;
  doubtWhatITried?: string | null;
  doubtResolved?: boolean;
  doubtResolvedBy?: string | null;
  doubtResolvedById?: string | null;
  doubtAwardedXp?: number | null;
  doubtSolutionMsgId?: string | null;
  doubtSolutionPayload?: DoubtSolutionPayload | null;
  cardPayload?: ChatCardPayload | null;
}

export interface ResolveDoubtAwardOptions {
  doubtMsgId: string;
  nextResolved: boolean;
  resolverMemberId?: string | null;
  resolverName?: string | null;
  xpReward?: number;
  solutionMsgId?: string | null;
}

interface SquadChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: EnhancedChatMessage[];
  activeChannel: 'ALL' | 'DMS' | string;
  onSelectChannel: (chanId: 'ALL' | 'DMS' | string) => void;
  currentIdentity: { id: string; name: string; type: 'student' | 'teacher' | 'admin' };
  activeMemberId: string | null;
  isAdminUnlocked: boolean;
  members: any[];
  teachers: any[];
  leaderboardStats: any[];
  exams: any[];
  chatChannelLastReadMap: Record<string, number>;
  chatLastReadTimestamp: number;
  onMarkChannelRead: (chanId: string) => void;
  onSendMessage: (payload: {
    text: string;
    recipientId: string;
    channelTag?: 'general' | 'doubts' | 'warfare';
    replyTo?: ChatReplyPreview | null;
    doubtSubject?: 'Physics' | 'Chemistry' | 'Math' | null;
    doubtDifficulty?: DoubtDifficulty | null;
    doubtBountyXp?: number | null;
    doubtImageUrl?: string | null;
    doubtWhatITried?: string | null;
    doubtSolutionPayload?: DoubtSolutionPayload | null;
    cardPayload?: ChatCardPayload | null;
  }) => Promise<void>;
  onDeleteMessage: (msgId: string) => Promise<void>;
  onEditMessage: (msgId: string, newText: string) => Promise<void>;
  onToggleReaction: (msgId: string, emoji: string) => Promise<void>;
  onTogglePin: (msgId: string, nextPinned: boolean) => Promise<void>;
  onToggleDoubtResolved: (
    msgId: string,
    nextResolved: boolean,
    options?: ResolveDoubtAwardOptions
  ) => Promise<void>;
  initialSubChannel?: 'ALL_TOPICS' | 'general' | 'doubts' | 'warfare' | null;
  initialFocusDoubtId?: string | null;
  onClearInitialFocus?: () => void;
  formatDuration: (mins: number) => string;
  timeAgo: (ts: number) => string;
}

const REACTION_EMOJIS = ['🔥', '💯', '⚡', '🎯', '🧠', '👑'];

/**
 * Lightweight, non-intrusive detector for obvious AI / Google copy-paste patterns.
 * Instead of locking the browser, we give a friendly peer nudge to explain in their own words
 * or attach a quick photo of their rough notebook.
 */
function detectAiOrSearchCopyPatterns(text: string): string | null {
  const clean = text.trim();
  if (!clean) return null;

  if (/certainly!|here is the step-by-step|as an ai|let's break this down step by step/i.test(clean)) {
    return 'Looks like AI-generated intro phrasing ("Here is the step-by-step..."). Write it casually like you are explaining to a squadmate!';
  }
  if (/\\frac\{|\\int_|\$\$|\\begin\{align/i.test(clean)) {
    return 'Detected raw LaTeX code blocks from an AI/solver tool. Type plain rough math (like mv^2/2 or 1/2 kx^2) or snap your notebook!';
  }
  if ((clean.match(/^#{1,4}\s/gm) || []).length >= 1 || (clean.match(/\*\*Step \d+/gi) || []).length >= 2) {
    return 'Detected AI markdown headings ("**Step 1:** ..."). Keep it natural in your own words without textbook formatting.';
  }
  if (/therefore,\s+the\s+(correct\s+option|final\s+answer)\s+is/i.test(clean) && clean.length > 220) {
    return 'This reads like a copied textbook/AI conclusion. Summarize the actual trick in your own words!';
  }
  return null;
}

export const SquadChatDrawer: React.FC<SquadChatDrawerProps> = ({
  isOpen,
  onClose,
  chatMessages,
  activeChannel,
  onSelectChannel,
  currentIdentity,
  activeMemberId,
  isAdminUnlocked,
  members,
  teachers,
  leaderboardStats,
  exams,
  chatChannelLastReadMap,
  chatLastReadTimestamp,
  onMarkChannelRead,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleReaction,
  onTogglePin,
  onToggleDoubtResolved,
  initialSubChannel,
  initialFocusDoubtId,
  onClearInitialFocus,
  formatDuration,
  timeAgo
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [publicSubChannel, setPublicSubChannel] = useState<'ALL_TOPICS' | 'general' | 'doubts' | 'warfare'>('ALL_TOPICS');
  const [replyingTo, setReplyingTo] = useState<ChatReplyPreview | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Doubt Question Posting States (1-10 XP by difficulty)
  const [doubtSubjectTag, setDoubtSubjectTag] = useState<'Physics' | 'Chemistry' | 'Math' | null>(null);
  const [doubtDifficulty, setDoubtDifficulty] = useState<DoubtDifficulty>('medium');
  const [doubtBountyXp, setDoubtBountyXp] = useState<number>(5);
  const [doubtWhatITried, setDoubtWhatITried] = useState<string>('');
  const [doubtImageUrl, setDoubtImageUrl] = useState<string | null>(null);
  const [isCompressingDoubtImg, setIsCompressingDoubtImg] = useState(false);

  // Organic Anti-AI Doubt Solution Builder States
  const [solvingDoubtMsg, setSolvingDoubtMsg] = useState<EnhancedChatMessage | null>(null);
  const [solCoreTrick, setSolCoreTrick] = useState('');
  const [solRoughSteps, setSolRoughSteps] = useState('');
  const [solCommonTrap, setSolCommonTrap] = useState('');
  const [solHandwrittenImg, setSolHandwrittenImg] = useState<string | null>(null);
  const [solHonorPledge, setSolHonorPledge] = useState(false);
  const [solPasteAttempts, setSolPasteAttempts] = useState(0);
  const [solAntiAiNudge, setSolAntiAiNudge] = useState<string | null>(null);
  const [isCompressingSolImg, setIsCompressingSolImg] = useState(false);

  // Doubt Resolution & XP Award Picker State
  const [resolvingDoubtId, setResolvingDoubtId] = useState<string | null>(null);
  const [selectedResolverId, setSelectedResolverId] = useState<string>('');
  const [selectedAwardXp, setSelectedAwardXp] = useState<number>(5);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'pinned' | 'unresolved_doubts'>('all');
  const [showPinnedBanner, setShowPinnedBanner] = useState(true);
  const [isExpandedWidth, setIsExpandedWidth] = useState(false);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const doubtFileInputRef = useRef<HTMLInputElement | null>(null);
  const solFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUserId = currentIdentity.id;

  const activeMems = useMemo(() => {
    return (members || []).filter(
      m => m.approvalStatus !== 'pending' && m.approvalStatus !== 'rejected'
    );
  }, [members]);

  const activeTeachs = useMemo(() => teachers || [], [teachers]);

  // Handle deep-linking to #doubts or a specific doubt from the Tasks/Arena view
  useEffect(() => {
    if (!isOpen) return;
    if (initialSubChannel) {
      setPublicSubChannel(initialSubChannel);
    }
    if (initialFocusDoubtId) {
      setPublicSubChannel('doubts');
      const targetMsg = chatMessages.find(m => m.id === initialFocusDoubtId);
      if (targetMsg && !targetMsg.doubtResolved && targetMsg.senderId !== currentUserId) {
        setSolvingDoubtMsg(targetMsg);
      }
      setTimeout(() => {
        const el = document.getElementById(`chat-msg-${initialFocusDoubtId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-violet-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-violet-400'), 2200);
        }
        onClearInitialFocus?.();
      }, 150);
    } else if (initialSubChannel) {
      onClearInitialFocus?.();
    }
  }, [isOpen, initialSubChannel, initialFocusDoubtId]);

  const handleSelectDifficultyPreset = (diff: DoubtDifficulty) => {
    setDoubtDifficulty(diff);
    setDoubtBountyXp(DOUBT_DIFFICULTY_CONFIG[diff].defaultXp);
  };

  const handleSelectCustomBountyXp = (xp: number) => {
    const clamped = Math.min(10, Math.max(1, xp));
    setDoubtBountyXp(clamped);
    if (clamped <= 3) setDoubtDifficulty('easy');
    else if (clamped <= 6) setDoubtDifficulty('medium');
    else if (clamped <= 9) setDoubtDifficulty('hard');
    else setDoubtDifficulty('extreme');
  };

  const handleDoubtQuestionImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingDoubtImg(true);
    try {
      const compressed = await compressImageFile(file, 900, 0.65);
      setDoubtImageUrl(compressed);
    } catch (err) {
      console.error('Failed to compress doubt image:', err);
    } finally {
      setIsCompressingDoubtImg(false);
      e.target.value = '';
    }
  };

  const handleSolutionNotebookImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingSolImg(true);
    try {
      const compressed = await compressImageFile(file, 900, 0.65);
      setSolHandwrittenImg(compressed);
      setSolAntiAiNudge(null);
    } catch (err) {
      console.error('Failed to compress solution image:', err);
    } finally {
      setIsCompressingSolImg(false);
      e.target.value = '';
    }
  };

  // Friendly, non-blocking paste interceptor on the solution fields
  const handleSolutionPaste = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text') || '';
    const aiPatternMsg = detectAiOrSearchCopyPatterns(pasted);
    if (pasted.length > 65 || aiPatternMsg) {
      e.preventDefault();
      setSolPasteAttempts(prev => prev + 1);
      setSolAntiAiNudge(
        aiPatternMsg ||
          'Hold up! Pasting long answers from AI or Google is disabled for Doubt Bounties. Just type the rough steps in your own words like you are explaining to a friend, or snap a photo of your rough notebook!'
      );
    }
  };

  const openSolveDoubtModal = (doubtMsg: EnhancedChatMessage) => {
    setSolvingDoubtMsg(doubtMsg);
    setSolCoreTrick('');
    setSolRoughSteps('');
    setSolCommonTrap('');
    setSolHandwrittenImg(null);
    setSolHonorPledge(false);
    setSolPasteAttempts(0);
    setSolAntiAiNudge(null);
  };

  const handleSubmitOrganicDoubtSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solvingDoubtMsg || isSending) return;

    const trick = solCoreTrick.trim();
    const steps = solRoughSteps.trim();
    const trap = solCommonTrap.trim();
    const bounty = Math.min(10, Math.max(1, Number(solvingDoubtMsg.doubtBountyXp) || 5));
    const diff: DoubtDifficulty = solvingDoubtMsg.doubtDifficulty || (bounty <= 3 ? 'easy' : bounty <= 6 ? 'medium' : bounty <= 9 ? 'hard' : 'extreme');

    if (trick.length < 8) {
      setSolAntiAiNudge('Write a quick 1-line core trick or formula intuition first (at least a few words in your own voice).');
      return;
    }
    if (!solHandwrittenImg && steps.length < 15) {
      setSolAntiAiNudge('Either type your rough calculation steps OR attach a photo of your handwritten notebook page.');
      return;
    }
    if (bounty >= 4 && !solHandwrittenImg && trap.length < 5) {
      setSolAntiAiNudge('For 4-10 XP doubts, add a quick 1-liner on what common trap or sign mistake to watch out for (or attach a handwritten notebook photo).');
      return;
    }

    const aiWarning = detectAiOrSearchCopyPatterns(`${trick}\n${steps}\n${trap}`);
    if (aiWarning) {
      setSolAntiAiNudge(aiWarning);
      return;
    }

    if (!solHonorPledge) {
      setSolAntiAiNudge('Tick the Squad Honor Check below to confirm you solved this without AI or Google.');
      return;
    }

    const solutionPayload: DoubtSolutionPayload = {
      doubtMsgId: solvingDoubtMsg.id,
      doubtSenderId: solvingDoubtMsg.senderId,
      doubtSenderName: solvingDoubtMsg.senderName,
      subject: solvingDoubtMsg.doubtSubject || 'Physics',
      difficulty: diff,
      bountyXp: bounty,
      coreTrick: trick,
      roughSteps: steps || 'See attached handwritten rough notebook work.',
      commonTrap: trap || undefined,
      handwrittenImageUrl: solHandwrittenImg || null,
      honorPledgeSigned: true,
      typedNaturally: solPasteAttempts === 0,
      pasteAttemptsBlocked: solPasteAttempts
    };

    const summaryText = `💡 Core Trick: ${trick}${steps ? ` | ✍️ Steps: ${steps}` : ''}${trap ? ` | ⚠️ Trap: ${trap}` : ''}`;

    setIsSending(true);
    try {
      await onSendMessage({
        text: summaryText,
        recipientId: 'ALL',
        channelTag: 'doubts',
        replyTo: {
          id: solvingDoubtMsg.id,
          senderName: solvingDoubtMsg.senderName,
          text: `[${solvingDoubtMsg.doubtSubject || 'Doubt'} • +${bounty} XP] ${solvingDoubtMsg.text.slice(0, 70)}`
        },
        doubtSolutionPayload: solutionPayload
      });
      setSolvingDoubtMsg(null);
      setSolCoreTrick('');
      setSolRoughSteps('');
      setSolCommonTrap('');
      setSolHandwrittenImg(null);
      setSolHonorPledge(false);
    } finally {
      setIsSending(false);
    }
  };

  // Compute unread counts per channel
  const getUnreadForChannel = (chanId: string) => {
    const lastRead = chatChannelLastReadMap[chanId] || chatLastReadTimestamp;
    if (chanId === 'ALL') {
      return chatMessages.filter(
        m => m.recipientId === 'ALL' && m.senderId !== currentUserId && m.timestamp > lastRead
      ).length;
    }
    if (chanId === 'DMS') {
      return chatMessages.filter(m => {
        if (m.recipientId === 'ALL' || m.senderId === currentUserId) return false;
        const isForMe =
          m.recipientId === currentUserId ||
          (isAdminUnlocked && m.recipientId === 'admin');
        const senderRead = chatChannelLastReadMap[m.senderId] || chatLastReadTimestamp;
        return isForMe && m.timestamp > senderRead;
      }).length;
    }
    return chatMessages.filter(m => {
      const isForMe =
        m.recipientId === currentUserId ||
        (isAdminUnlocked && m.recipientId === 'admin');
      return m.senderId === chanId && isForMe && m.timestamp > lastRead;
    }).length;
  };

  const hasDmHistoryWith = (partnerId: string) => {
    return chatMessages.some(
      m =>
        m.recipientId !== 'ALL' &&
        ((m.senderId === currentUserId && m.recipientId === partnerId) ||
          (m.senderId === partnerId && m.recipientId === currentUserId) ||
          ((activeMemberId === 'admin' || isAdminUnlocked) &&
            ((m.senderId === 'admin' && m.recipientId === partnerId) ||
              (m.senderId === partnerId && m.recipientId === 'admin'))))
    );
  };

  // Filter messages for the current view
  const channelMessages = useMemo(() => {
    return chatMessages.filter(m => {
      if (activeChannel === 'ALL') {
        if (m.recipientId !== 'ALL') return false;
        if (publicSubChannel === 'doubts') {
          return m.channelTag === 'doubts' || Boolean(m.doubtSubject) || Boolean(m.doubtSolutionPayload);
        }
        if (publicSubChannel === 'warfare') {
          return m.channelTag === 'warfare' || m.cardPayload?.type === 'duel_callout';
        }
        if (publicSubChannel === 'general') {
          return !m.channelTag || m.channelTag === 'general';
        }
        return true;
      }
      if (activeChannel === 'DMS') {
        if (m.recipientId === 'ALL') return false;
        const involvesMe = m.senderId === currentUserId || m.recipientId === currentUserId;
        const involvesAdmin =
          (activeMemberId === 'admin' || isAdminUnlocked) &&
          (m.senderId === 'admin' || m.recipientId === 'admin');
        return involvesMe || involvesAdmin;
      }
      const directMatch =
        (m.senderId === currentUserId && m.recipientId === activeChannel) ||
        (m.senderId === activeChannel && m.recipientId === currentUserId);
      const adminAliasMatch =
        (activeMemberId === 'admin' || isAdminUnlocked) &&
        activeChannel !== 'admin' &&
        ((m.senderId === 'admin' && m.recipientId === activeChannel) ||
          (m.senderId === activeChannel && m.recipientId === 'admin'));
      return directMatch || adminAliasMatch;
    });
  }, [chatMessages, activeChannel, publicSubChannel, currentUserId, activeMemberId, isAdminUnlocked]);

  const displayedMessages = useMemo(() => {
    return channelMessages.filter(m => {
      if (filterMode === 'pinned' && !m.pinned) return false;
      if (filterMode === 'unresolved_doubts' && (!m.doubtSubject || m.doubtResolved)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inText = (m.text || '').toLowerCase().includes(q);
        const inSender = (m.senderName || '').toLowerCase().includes(q);
        const inSubj = (m.doubtSubject || '').toLowerCase().includes(q);
        const inCard = (m.cardPayload?.title || '').toLowerCase().includes(q);
        return inText || inSender || inSubj || inCard;
      }
      return true;
    });
  }, [channelMessages, filterMode, searchQuery]);

  const pinnedInChannel = useMemo(() => {
    return channelMessages.filter(m => m.pinned);
  }, [channelMessages]);

  const unresolvedDoubtsList = useMemo(() => {
    return chatMessages.filter(m => m.recipientId === 'ALL' && m.doubtSubject && !m.doubtResolved);
  }, [chatMessages]);

  const unresolvedDoubtsCount = unresolvedDoubtsList.length;

  const totalOpenDoubtXp = useMemo(() => {
    return unresolvedDoubtsList.reduce((sum, m) => sum + (Number(m.doubtBountyXp) || 5), 0);
  }, [unresolvedDoubtsList]);

  // Auto-scroll on new messages or channel switch
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    }, 50);
    return () => clearTimeout(t);
  }, [isOpen, activeChannel, publicSubChannel, channelMessages.length]);

  if (!isOpen) return null;

  const myStats = leaderboardStats.find(s => s.id === currentUserId) || leaderboardStats[0];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    const effectiveTag: 'general' | 'doubts' | 'warfare' =
      doubtSubjectTag
        ? 'doubts'
        : publicSubChannel === 'doubts'
        ? 'doubts'
        : publicSubChannel === 'warfare'
        ? 'warfare'
        : 'general';

    setIsSending(true);
    setInputText('');
    const currentReply = replyingTo;
    const currentDoubtSubj = doubtSubjectTag;
    const currentDiff = currentDoubtSubj ? doubtDifficulty : null;
    const currentBounty = currentDoubtSubj ? doubtBountyXp : null;
    const currentTried = currentDoubtSubj && doubtWhatITried.trim() ? doubtWhatITried.trim() : null;
    const currentImg = currentDoubtSubj ? doubtImageUrl : null;

    setReplyingTo(null);
    setDoubtSubjectTag(null);
    setDoubtWhatITried('');
    setDoubtImageUrl(null);

    try {
      await onSendMessage({
        text: trimmed,
        recipientId: activeChannel,
        channelTag: activeChannel === 'ALL' ? effectiveTag : undefined,
        replyTo: currentReply,
        doubtSubject: currentDoubtSubj,
        doubtDifficulty: currentDiff,
        doubtBountyXp: currentBounty,
        doubtWhatITried: currentTried,
        doubtImageUrl: currentImg,
        cardPayload: null
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleShareGrindStatsCard = async () => {
    if (!myStats || isSending) return;
    const todayMins = myStats.studyTimeframes?.['1d']?.mins ?? 0;
    const weekMins = myStats.studyTimeframes?.['7d']?.mins ?? myStats.weekStudyMins ?? 0;
    const weekQs = myStats.studyTimeframes?.['7d']?.questions ?? myStats.weekQuestions ?? 0;
    const streak = myStats.streakCount || 1;
    const cycleXp = Math.round(myStats.displayXp || myStats.weekXp || 0);

    const cardPayload: ChatCardPayload = {
      type: 'grind_stats',
      title: `${myStats.name}'s Live Grind Telemetry`,
      subtitle: myStats.isGrinding
        ? `Currently Grinding ${myStats.grindingSubject || 'PCM'}`
        : `Cycle Standing & Study Volume`,
      metrics: [
        { label: 'TODAY (1D)', value: formatDuration(todayMins), accent: 'text-emerald-300' },
        { label: '7-DAY STUDY', value: formatDuration(weekMins), accent: 'text-sky-300' },
        { label: '7D SOLVED', value: `${weekQs} Qs`, accent: 'text-amber-300' },
        { label: 'CYCLE XP / STREAK', value: `${cycleXp} XP • ${streak}d 🔥`, accent: 'text-violet-300' }
      ]
    };

    setIsSending(true);
    try {
      await onSendMessage({
        text: `Shared live study telemetry (${formatDuration(todayMins)} today • ${formatDuration(weekMins)} in 7D • ${weekQs} Qs solved).`,
        recipientId: activeChannel,
        channelTag: activeChannel === 'ALL' ? 'general' : undefined,
        cardPayload
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleShareLatestExamCard = async () => {
    if (isSending) return;
    const myExams = (exams || [])
      .filter(ex => ex.memberId === currentUserId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latest = myExams[0] || (exams || [])[0];
    if (!latest) return;

    const pct = Number(latest.overallPercentile || 0).toFixed(1);
    const cardPayload: ChatCardPayload = {
      type: 'exam_score',
      title: `Mock Report: ${latest.title || latest.examType || 'JEE Mock'}`,
      subtitle: `${latest.examType || 'JEE Mains'} • Logged on ${latest.date || 'Recent'}`,
      metrics: [
        { label: 'PERCENTILE', value: `${pct}%ile`, accent: 'text-amber-300' },
        { label: 'SCORE', value: `${latest.marks ?? '-'}/${latest.maxMarks ?? 300}`, accent: 'text-sky-300' },
        { label: 'AIR / RANK', value: latest.rank ? `#${latest.rank}` : 'Verified', accent: 'text-emerald-300' },
        { label: 'EXAM XP', value: `+${Math.round(Number(latest.xpEarned) || 0)} XP`, accent: 'text-violet-300' }
      ]
    };

    setIsSending(true);
    try {
      await onSendMessage({
        text: `Shared mock exam scorecard: ${latest.title || latest.examType} (${pct}%ile).`,
        recipientId: activeChannel,
        channelTag: activeChannel === 'ALL' ? 'general' : undefined,
        cardPayload
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleShareWarfareCallout = async () => {
    if (isSending) return;
    const rival = leaderboardStats.find(s => s.id !== currentUserId) || leaderboardStats[0];
    const myXp = Math.round(myStats?.displayXp || 0);
    const rivalXp = Math.round(rival?.displayXp || 0);
    const diff = Math.abs(myXp - rivalXp);

    const cardPayload: ChatCardPayload = {
      type: 'duel_callout',
      title: `Arena Sprint Callout: ${currentIdentity.name} vs. Squad`,
      subtitle: `90-Minute Focus Sprint Challenge`,
      metrics: [
        { label: 'CHALLENGER', value: `${currentIdentity.name} (${myXp} XP)`, accent: 'text-sky-300' },
        { label: 'TARGET RIVAL', value: `${rival?.name || 'Squad'} (${rivalXp} XP)`, accent: 'text-rose-300' },
        { label: 'XP GAP', value: `${diff} XP Delta`, accent: 'text-amber-300' },
        { label: 'STAKES', value: '90m Grind + 30 Qs', accent: 'text-emerald-300' }
      ]
    };

    setIsSending(true);
    try {
      await onSendMessage({
        text: `Issued a 90-minute focus sprint callout! Who is locking in right now?`,
        recipientId: activeChannel,
        channelTag: activeChannel === 'ALL' ? 'warfare' : undefined,
        cardPayload
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveEdit = async (msgId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    setEditingMsgId(null);
    setEditingText('');
    await onEditMessage(msgId, trimmed);
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`chat-msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-sky-400');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-sky-400');
      }, 1800);
    }
  };

  const handleOpenResolvePicker = (doubtMsg: EnhancedChatMessage) => {
    if (doubtMsg.doubtResolved) {
      // Unresolve if clicked by asker or admin/teacher
      if (
        doubtMsg.senderId === currentUserId ||
        currentIdentity.type === 'teacher' ||
        currentIdentity.type === 'admin' ||
        isAdminUnlocked
      ) {
        onToggleDoubtResolved(doubtMsg.id, false, {
          doubtMsgId: doubtMsg.id,
          nextResolved: false
        });
      }
      return;
    }

    // Find anyone who replied or submitted a solution to this doubt
    const candidateSolutions = chatMessages.filter(
      m =>
        (m.doubtSolutionPayload?.doubtMsgId === doubtMsg.id || m.replyTo?.id === doubtMsg.id) &&
        m.senderId !== doubtMsg.senderId
    );
    const latestSolver = candidateSolutions[candidateSolutions.length - 1];
    const defaultSolverId =
      latestSolver?.senderId ||
      (currentUserId !== doubtMsg.senderId ? currentUserId : activeMems.find(m => m.id !== doubtMsg.senderId)?.id || '');

    setResolvingDoubtId(doubtMsg.id);
    setSelectedResolverId(defaultSolverId);
    setSelectedAwardXp(Math.min(10, Math.max(1, Number(doubtMsg.doubtBountyXp) || 5)));
  };

  const handleConfirmResolveWithAward = async (doubtMsg: EnhancedChatMessage) => {
    const resolverMem = activeMems.find(m => m.id === selectedResolverId);
    const isSelfSolved = !selectedResolverId || selectedResolverId === doubtMsg.senderId;
    const finalXp = isSelfSolved ? 0 : Math.min(10, Math.max(1, Number(selectedAwardXp) || 5));
    const resolverName = isSelfSolved ? `${doubtMsg.senderName} (Self)` : resolverMem?.name || 'Squadmate';

    setResolvingDoubtId(null);
    await onToggleDoubtResolved(doubtMsg.id, true, {
      doubtMsgId: doubtMsg.id,
      nextResolved: true,
      resolverMemberId: isSelfSolved ? null : selectedResolverId,
      resolverName,
      xpReward: finalXp
    });
  };

  const unreadAll = getUnreadForChannel('ALL');
  const unreadDmsTotal = getUnreadForChannel('DMS');

  const activeRecipientObj =
    activeMems.find(m => m.id === activeChannel) ||
    activeTeachs.find(t => t.id === activeChannel) ||
    (activeChannel === 'admin' ? { id: 'admin', name: 'Admin', isAdmin: true } : null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        className={`w-full ${
          isExpandedWidth ? 'max-w-3xl' : 'max-w-lg'
        } h-full surface-card border-l border-white/15 flex flex-col justify-between p-3.5 sm:p-5 animate-modal transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-950 flex items-center justify-center font-bold shadow-sm shrink-0">
              <MessageSquare className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-white font-display truncate">
                  Squad Comms &amp; Doubt Bounties
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/35 text-[10px] font-mono-num text-sky-300 font-bold">
                  {currentIdentity.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
                <span>•</span>
                <span>Resolve Peer Doubts for +1-10 XP (Organic No-AI)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowSearchBar(prev => !prev)}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                showSearchBar || searchQuery
                  ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                  : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Search & filter messages"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsExpandedWidth(prev => !prev)}
              className="hidden sm:flex p-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title={isExpandedWidth ? 'Compact drawer width' : 'Expand drawer width'}
            >
              {isExpandedWidth ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 transition-all cursor-pointer"
              title="Close chat drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SEARCH & FILTER BAR (COLLAPSIBLE) */}
        {showSearchBar && (
          <div className="py-2 border-b border-white/10 flex flex-wrap items-center gap-1.5 animate-view">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages, @scholar, or subject..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {([
                { id: 'all' as const, label: 'All' },
                { id: 'pinned' as const, label: `Pinned (${pinnedInChannel.length})` },
                { id: 'unresolved_doubts' as const, label: `Open Doubts (${unresolvedDoubtsCount})` }
              ]).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    filterMode === tab.id
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CHANNEL & DIRECT MESSAGE SELECTOR */}
        <div className="py-2.5 space-y-2 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Channels &amp; Direct Threads
            </span>
            {activeChannel === 'ALL' ? (
              <div className="flex items-center gap-1">
                {([
                  { id: 'ALL_TOPICS' as const, label: 'All Feed' },
                  { id: 'general' as const, label: '#general' },
                  { id: 'doubts' as const, label: `#doubts${unresolvedDoubtsCount > 0 ? ` (${unresolvedDoubtsCount})` : ''}` },
                  { id: 'warfare' as const, label: '#warfare' }
                ]).map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setPublicSubChannel(sub.id)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      publicSubChannel === sub.id
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'bg-white/[0.05] text-slate-400 hover:text-white'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[10px] font-bold text-sky-300 flex items-center gap-1">
                <span>Private 1-on-1 Encryption</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => {
                onSelectChannel('ALL');
                onMarkChannelRead('ALL');
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeChannel === 'ALL'
                  ? 'bg-sky-400 text-slate-950 shadow-sm'
                  : 'bg-zinc-900/90 text-slate-300 border border-white/10 hover:text-white'
              }`}
            >
              <span>📢 Squad Public</span>
              {unreadAll > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-sky-300 text-[9px] font-extrabold font-mono-num">
                  {unreadAll}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectChannel('DMS');
                onMarkChannelRead('DMS');
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeChannel === 'DMS'
                  ? 'bg-sky-400 text-slate-950 shadow-sm'
                  : 'bg-zinc-900/90 text-slate-300 border border-white/10 hover:text-white'
              }`}
            >
              <span>✉️ All DMs</span>
              {unreadDmsTotal > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold font-mono-num">
                  {unreadDmsTotal}
                </span>
              )}
            </button>

            {activeMems
              .filter(m => m.id !== currentUserId)
              .map(m => {
                const unreadCount = getUnreadForChannel(m.id);
                const hasHistory = hasDmHistoryWith(m.id);
                const isGrindingNow = Boolean(m.isGrinding);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelectChannel(m.id);
                      onMarkChannelRead(m.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeChannel === m.id
                        ? 'bg-sky-400 text-slate-950 font-bold shadow-sm'
                        : unreadCount > 0
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50 hover:bg-sky-500/30'
                        : hasHistory
                        ? 'bg-zinc-900 text-slate-200 border border-white/15 hover:text-white'
                        : 'bg-zinc-900/70 text-slate-400 border border-white/10 hover:text-white'
                    }`}
                    title={
                      isGrindingNow
                        ? `${m.name} is currently grinding ${m.grindingSubject || 'PCM'}`
                        : `Direct message ${m.name}`
                    }
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isGrindingNow
                          ? 'bg-emerald-400 animate-pulse'
                          : hasHistory
                          ? 'bg-sky-400'
                          : 'bg-slate-600'
                      }`}
                    />
                    <span>{m.name}</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold font-mono-num">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}

            {activeTeachs
              .filter(t => t.id !== currentUserId)
              .map(t => {
                const unreadCount = getUnreadForChannel(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectChannel(t.id);
                      onMarkChannelRead(t.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeChannel === t.id
                        ? 'bg-sky-400 text-slate-950 font-bold shadow-sm'
                        : 'bg-zinc-900/80 text-slate-300 border border-white/10 hover:text-white'
                    }`}
                  >
                    <span>🎓 {t.name}</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold font-mono-num">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}

            {currentUserId !== 'admin' && (
              <button
                type="button"
                onClick={() => {
                  onSelectChannel('admin');
                  onMarkChannelRead('admin');
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeChannel === 'admin'
                    ? 'bg-sky-400 text-slate-950 font-bold shadow-sm'
                    : 'bg-zinc-900/80 text-slate-300 border border-white/10 hover:text-white'
                }`}
              >
                <span>👑 Admin</span>
                {getUnreadForChannel('admin') > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold font-mono-num">
                    {getUnreadForChannel('admin')}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* OPEN DOUBT BOUNTY BANNER (WHEN IN #DOUBTS OR WHEN UNRESOLVED DOUBTS EXIST) */}
        {activeChannel === 'ALL' && (publicSubChannel === 'doubts' || unresolvedDoubtsCount > 0) && (
          <div className="px-3 py-2 my-1 rounded-xl bg-gradient-to-r from-violet-950/60 via-slate-900 to-amber-950/40 border border-violet-400/35 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-400/40 flex items-center justify-center text-violet-300 shrink-0">
                <Lightbulb className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white truncate flex items-center gap-1.5">
                  <span>Peer Doubt Bounties (1-10 XP)</span>
                  {unresolvedDoubtsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-mono-num font-extrabold">
                      {unresolvedDoubtsCount} Open • +{totalOpenDoubtXp} XP Available
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Explain in your own words or snap your rough notebook - no AI/Google copy-paste!
                </div>
              </div>
            </div>
            {publicSubChannel !== 'doubts' ? (
              <button
                type="button"
                onClick={() => setPublicSubChannel('doubts')}
                className="px-2.5 py-1 rounded-lg bg-violet-400 text-slate-950 text-[10px] font-extrabold shrink-0 cursor-pointer"
              >
                View #doubts
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!doubtSubjectTag) setDoubtSubjectTag('Physics');
                  inputRef.current?.focus();
                }}
                className="px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-200 text-[10px] font-bold shrink-0 cursor-pointer"
              >
                + Ask Doubt
              </button>
            )}
          </div>
        )}

        {/* ACTIVE RECIPIENT STATUS BANNER (FOR 1-ON-1 DM) */}
        {activeChannel !== 'ALL' && activeChannel !== 'DMS' && activeRecipientObj && (
          <div className="px-3 py-2 my-1 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 font-bold shrink-0">
                {activeRecipientObj.name?.[0] || 'U'}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white truncate flex items-center gap-1.5">
                  <span>{activeRecipientObj.name}</span>
                  {activeRecipientObj.institute && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({activeRecipientObj.institute})
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {activeRecipientObj.isGrinding
                    ? `🟢 Currently Grinding ${activeRecipientObj.grindingSubject || 'PCM'} Live`
                    : activeRecipientObj.streakCount
                    ? `🔥 ${activeRecipientObj.streakCount}-Day Active Streak • Direct Thread`
                    : 'Direct 1-on-1 Message Thread'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setInputText(`Hey @${activeRecipientObj.name}, up for a 60m study sprint? `);
                inputRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-[10px] font-bold text-sky-300 shrink-0 cursor-pointer"
            >
              ⚡ Ping Sprint
            </button>
          </div>
        )}

        {/* PINNED MESSAGES BANNER */}
        {pinnedInChannel.length > 0 && showPinnedBanner && (
          <div className="px-3 py-2 my-1 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => scrollToMessage(pinnedInChannel[pinnedInChannel.length - 1].id)}
              className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                  Pinned ({pinnedInChannel.length}) • {pinnedInChannel[pinnedInChannel.length - 1].senderName}
                </div>
                <div className="text-xs text-slate-200 truncate">
                  {pinnedInChannel[pinnedInChannel.length - 1].text}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setShowPinnedBanner(false)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
              title="Hide pinned banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MESSAGES FEED */}
        <div
          ref={feedRef}
          className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 my-1"
          onClick={() => setActiveReactionPickerMsgId(null)}
        >
          {displayedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2.5 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-500">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-300">
                {searchQuery
                  ? `No messages matching "${searchQuery}"`
                  : filterMode !== 'all'
                  ? 'No messages match the selected filter.'
                  : activeChannel === 'ALL'
                  ? 'No messages in this channel yet.'
                  : activeChannel === 'DMS'
                  ? 'No direct messages yet.'
                  : `Start a private conversation with ${activeRecipientObj?.name || 'this scholar'}.`}
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Post a Physics/Chem/Math doubt with a 1-10 XP bounty, share your live grind telemetry, or message a squadmate below.
              </p>
            </div>
          ) : (
            displayedMessages.map(msg => {
              const isMe =
                msg.senderId === currentUserId ||
                ((activeMemberId === 'admin' || isAdminUnlocked) &&
                  msg.senderId === 'admin' &&
                  activeChannel !== 'admin');
              const canModify = isMe || activeMemberId === 'admin' || isAdminUnlocked;
              const otherPartyId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
              const senderMember = activeMems.find(m => m.id === msg.senderId);
              const reactionsMap = msg.reactions || {};
              const reactionEntries = Object.entries(reactionsMap).filter(
                ([, users]) => Array.isArray(users) && users.length > 0
              );

              const doubtBounty = Math.min(10, Math.max(1, Number(msg.doubtBountyXp) || 5));
              const doubtDiff: DoubtDifficulty =
                msg.doubtDifficulty ||
                (doubtBounty <= 3 ? 'easy' : doubtBounty <= 6 ? 'medium' : doubtBounty <= 9 ? 'hard' : 'extreme');
              const diffCfg = DOUBT_DIFFICULTY_CONFIG[doubtDiff];

              // Check if this message is an Organic Peer Doubt Solution linked to a parent doubt
              const parentDoubt = msg.doubtSolutionPayload
                ? chatMessages.find(m => m.id === msg.doubtSolutionPayload!.doubtMsgId)
                : null;
              const isParentDoubtResolved = Boolean(parentDoubt?.doubtResolved);
              const canAcceptThisSolution =
                msg.doubtSolutionPayload &&
                parentDoubt &&
                !parentDoubt.doubtResolved &&
                msg.senderId !== parentDoubt.senderId &&
                (currentUserId === parentDoubt.senderId ||
                  currentIdentity.type === 'teacher' ||
                  currentIdentity.type === 'admin' ||
                  isAdminUnlocked ||
                  currentUserId === msg.senderId);

              return (
                <div
                  id={`chat-msg-${msg.id}`}
                  key={msg.id}
                  className={`group flex flex-col ${
                    isMe ? 'items-end' : 'items-start'
                  } text-xs space-y-1 rounded-2xl transition-all`}
                >
                  {/* Sender & Meta Line */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
                    {senderMember?.isGrinding && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                        title={`Grinding ${senderMember.grindingSubject || 'PCM'}`}
                      />
                    )}
                    <span className="font-bold text-slate-200">
                      {msg.senderId === currentUserId ? 'You' : msg.senderName}
                    </span>
                    {msg.senderType === 'teacher' && (
                      <span className="px-1.5 py-0.2 rounded bg-sky-400/20 text-sky-300 font-bold text-[9px]">
                        FACULTY
                      </span>
                    )}
                    {msg.senderType === 'admin' && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold text-[9px]">
                        ADMIN
                      </span>
                    )}
                    {msg.channelTag === 'doubts' && !msg.doubtSubject && !msg.doubtSolutionPayload && (
                      <span className="px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 font-bold text-[9px]">
                        #DOUBT
                      </span>
                    )}
                    {msg.doubtSubject && (
                      <>
                        <span
                          className={`px-1.5 py-0.2 rounded font-bold text-[9px] border ${
                            msg.doubtResolved
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                          }`}
                        >
                          {msg.doubtSubject.toUpperCase()} DOUBT {msg.doubtResolved ? '✓ SOLVED' : '• OPEN'}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded font-extrabold text-[9px] border font-mono-num ${diffCfg.badgeClass}`}>
                          {diffCfg.shortLabel.toUpperCase()} • +{ msg.doubtAwardedXp ?? doubtBounty } XP
                        </span>
                      </>
                    )}
                    {msg.doubtSolutionPayload && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 font-bold text-[9px] flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        ORGANIC PEER SOLUTION
                      </span>
                    )}
                    {msg.pinned && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[9px] flex items-center gap-0.5">
                        <Bookmark className="w-2.5 h-2.5" /> PINNED
                      </span>
                    )}
                    {msg.recipientId !== 'ALL' && (
                      <span className="text-sky-400 font-semibold">
                        → {msg.recipientId === currentUserId ? 'You' : msg.recipientName}
                      </span>
                    )}
                    <span>•</span>
                    <span>{timeAgo(msg.timestamp)}</span>
                    {msg.editedAt && <span className="text-[9px] text-slate-500 italic">(edited)</span>}

                    {/* Quick Action Buttons on Hover / Tap */}
                    <div className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 transition-opacity ml-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReactionPickerMsgId(prev => (prev === msg.id ? null : msg.id));
                        }}
                        className="px-1 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.15] text-slate-300 text-[10px] cursor-pointer"
                        title="Add reaction"
                      >
                        😀
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo({
                            id: msg.id,
                            senderName: msg.senderName,
                            text: msg.text.slice(0, 90)
                          });
                          inputRef.current?.focus();
                        }}
                        className="px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.15] text-slate-300 hover:text-sky-300 text-[9.5px] font-semibold cursor-pointer"
                        title="Reply to message"
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => onTogglePin(msg.id, !msg.pinned)}
                        className={`px-1 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.15] text-[9.5px] cursor-pointer ${
                          msg.pinned ? 'text-amber-300' : 'text-slate-400 hover:text-amber-300'
                        }`}
                        title={msg.pinned ? 'Unpin message' : 'Pin message'}
                      >
                        <Bookmark className="w-3 h-3" />
                      </button>
                      {isMe && !msg.doubtSolutionPayload && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMsgId(msg.id);
                            setEditingText(msg.text);
                          }}
                          className="px-1 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.15] text-slate-400 hover:text-white cursor-pointer"
                          title="Edit message"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                      {canModify && (
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          className="px-1 py-0.5 rounded bg-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Emoji Reaction Picker Popover */}
                  {activeReactionPickerMsgId === msg.id && (
                    <div
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-900 border border-white/20 shadow-xl z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {REACTION_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            onToggleReaction(msg.id, emoji);
                            setActiveReactionPickerMsgId(null);
                          }}
                          className="hover:scale-125 transition-transform px-1 text-sm cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quoted Reply Block */}
                  {msg.replyTo && (
                    <button
                      type="button"
                      onClick={() => scrollToMessage(msg.replyTo!.id)}
                      className="max-w-[85%] px-2.5 py-1 rounded-xl bg-white/[0.05] border-l-2 border-sky-400 text-left text-[10px] text-slate-300 flex items-center gap-1.5 hover:bg-white/[0.09] transition-all cursor-pointer"
                    >
                      <CornerDownRight className="w-3 h-3 text-sky-400 shrink-0" />
                      <span className="font-bold text-sky-300 shrink-0">{msg.replyTo.senderName}:</span>
                      <span className="truncate text-slate-400">{msg.replyTo.text}</span>
                    </button>
                  )}

                  {/* Rich Shared Telemetry / Exam / Callout Card */}
                  {msg.cardPayload && (
                    <div
                      className={`w-full max-w-[90%] rounded-2xl p-3 border shadow-md space-y-2 ${
                        msg.cardPayload.type === 'grind_stats'
                          ? 'bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-900 border-sky-400/40'
                          : msg.cardPayload.type === 'exam_score'
                          ? 'bg-gradient-to-br from-slate-900 via-amber-950/35 to-slate-900 border-amber-400/40'
                          : 'bg-gradient-to-br from-slate-900 via-rose-950/35 to-slate-900 border-rose-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                        <div>
                          <div className="text-xs font-extrabold text-white font-display">
                            {msg.cardPayload.title}
                          </div>
                          {msg.cardPayload.subtitle && (
                            <div className="text-[10px] text-slate-400">{msg.cardPayload.subtitle}</div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                          {msg.cardPayload.type === 'grind_stats'
                            ? 'LIVE TELEMETRY'
                            : msg.cardPayload.type === 'exam_score'
                            ? 'MOCK SCORECARD'
                            : 'SPRINT CALLOUT'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {msg.cardPayload.metrics.map((metric, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-black/45 border border-white/[0.07]"
                          >
                            <div className="text-[9px] text-slate-400 font-bold uppercase">
                              {metric.label}
                            </div>
                            <div
                              className={`text-xs font-extrabold font-mono-num mt-0.5 ${
                                metric.accent || 'text-white'
                              }`}
                            >
                              {metric.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ORGANIC PEER DOUBT SOLUTION CARD */}
                  {msg.doubtSolutionPayload ? (
                    <div className="w-full max-w-[92%] rounded-2xl p-3.5 bg-gradient-to-br from-emerald-950/45 via-slate-900 to-slate-950 border border-emerald-400/35 shadow-lg space-y-2.5">
                      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 text-[9.5px] font-extrabold">
                            {msg.doubtSolutionPayload.subject.toUpperCase()} SOLUTION
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/35 text-amber-300 text-[9.5px] font-mono-num font-extrabold">
                            Bounty: +{msg.doubtSolutionPayload.bountyXp} XP
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[9px] font-semibold text-slate-300 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          {msg.doubtSolutionPayload.handwrittenImageUrl
                            ? '✍️ Handwritten Notebook'
                            : '🧠 Typed Own Words (No AI)'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="p-2 rounded-xl bg-black/40 border border-emerald-400/20">
                          <div className="text-[9.5px] font-bold text-emerald-300 uppercase tracking-wider">
                            💡 1-Line Core Trick / Intuition
                          </div>
                          <div className="text-slate-100 font-semibold mt-0.5 leading-relaxed">
                            {msg.doubtSolutionPayload.coreTrick}
                          </div>
                        </div>

                        {msg.doubtSolutionPayload.roughSteps && (
                          <div className="p-2 rounded-xl bg-black/35 border border-white/[0.07]">
                            <div className="text-[9.5px] font-bold text-sky-300 uppercase tracking-wider">
                              ✍️ Rough Calculation &amp; Steps
                            </div>
                            <div className="text-slate-200 mt-0.5 whitespace-pre-line leading-relaxed">
                              {msg.doubtSolutionPayload.roughSteps}
                            </div>
                          </div>
                        )}

                        {msg.doubtSolutionPayload.commonTrap && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/25">
                            <div className="text-[9.5px] font-bold text-amber-300 uppercase tracking-wider">
                              ⚠️ Watch Out For This Trap
                            </div>
                            <div className="text-amber-100 mt-0.5 leading-relaxed">
                              {msg.doubtSolutionPayload.commonTrap}
                            </div>
                          </div>
                        )}

                        {msg.doubtSolutionPayload.handwrittenImageUrl && (
                          <div className="pt-1">
                            <div className="text-[9.5px] font-bold text-slate-400 uppercase mb-1">
                              📷 Attached Handwritten Notebook Working:
                            </div>
                            <button
                              type="button"
                              onClick={() => setLightboxImageUrl(msg.doubtSolutionPayload!.handwrittenImageUrl!)}
                              className="block rounded-xl overflow-hidden border border-white/15 hover:border-emerald-400/60 transition-all cursor-pointer max-w-[260px]"
                            >
                              <img
                                src={msg.doubtSolutionPayload.handwrittenImageUrl}
                                alt="Handwritten rough solution"
                                className="w-full max-h-48 object-cover"
                              />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Accept & Award XP Bar on the Solution Card */}
                      <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Squad Honor Pledge Signed by {msg.senderName}</span>
                        </span>

                        {isParentDoubtResolved && parentDoubt?.doubtResolvedById === msg.senderId ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-amber-300" />
                            <span>Accepted • +{parentDoubt.doubtAwardedXp || msg.doubtSolutionPayload.bountyXp} XP Awarded!</span>
                          </span>
                        ) : canAcceptThisSolution ? (
                          <button
                            type="button"
                            onClick={() =>
                              onToggleDoubtResolved(parentDoubt!.id, true, {
                                doubtMsgId: parentDoubt!.id,
                                nextResolved: true,
                                resolverMemberId: msg.senderId,
                                resolverName: msg.senderName,
                                xpReward: msg.doubtSolutionPayload!.bountyXp,
                                solutionMsgId: msg.id
                              })
                            }
                            className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-extrabold text-[10.5px] flex items-center gap-1 shadow-sm hover:brightness-110 transition-all cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>
                              {currentUserId === msg.senderId
                                ? `Claim Solved (+${msg.doubtSolutionPayload.bountyXp} XP)`
                                : `Accept & Award +${msg.doubtSolutionPayload.bountyXp} XP to ${msg.senderName}`}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : editingMsgId === msg.id ? (
                    <div className="w-full max-w-[88%] flex items-center gap-1.5 bg-zinc-900 border border-sky-400/50 rounded-xl p-1.5">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(msg.id);
                          if (e.key === 'Escape') setEditingMsgId(null);
                        }}
                        className="flex-1 bg-transparent text-xs text-white px-2 py-1 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(msg.id)}
                        className="px-2 py-1 rounded-lg bg-sky-400 text-slate-950 font-bold text-[10px] cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMsgId(null)}
                        className="px-2 py-1 rounded-lg bg-white/10 text-slate-300 text-[10px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`p-3 rounded-2xl max-w-[88%] leading-relaxed break-words space-y-2 ${
                        isMe
                          ? 'bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-semibold rounded-tr-none shadow-md'
                          : msg.doubtSubject && !msg.doubtResolved
                          ? 'bg-amber-500/10 text-slate-100 border border-amber-400/35 rounded-tl-none'
                          : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none'
                      }`}
                    >
                      <div>{msg.text}</div>
                      {msg.doubtWhatITried && (
                        <div
                          className={`text-[10.5px] px-2.5 py-1.5 rounded-xl ${
                            isMe
                              ? 'bg-slate-950/15 text-slate-900'
                              : 'bg-black/40 text-amber-200/90 border border-white/10'
                          }`}
                        >
                          <span className="font-bold">Where I got stuck / tried: </span>
                          {msg.doubtWhatITried}
                        </div>
                      )}
                      {msg.doubtImageUrl && (
                        <button
                          type="button"
                          onClick={() => setLightboxImageUrl(msg.doubtImageUrl!)}
                          className="block rounded-xl overflow-hidden border border-black/20 max-w-[240px] cursor-pointer"
                        >
                          <img
                            src={msg.doubtImageUrl}
                            alt="Doubt attachment"
                            className="w-full max-h-44 object-cover"
                          />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Doubt Resolution & Organic Solution Action Bar */}
                  {msg.doubtSubject && (
                    <div className="w-full max-w-[92%] flex flex-col gap-1.5 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {!msg.doubtResolved && msg.senderId !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => openSolveDoubtModal(msg)}
                            className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-400 text-slate-950 font-extrabold text-[10px] flex items-center gap-1 shadow-sm hover:brightness-110 transition-all cursor-pointer"
                          >
                            <Lightbulb className="w-3 h-3" />
                            <span>Solve Doubt (+{doubtBounty} XP • No AI)</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenResolvePicker(msg)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            msg.doubtResolved
                              ? 'bg-emerald-500/15 border border-emerald-400/35 text-emerald-300'
                              : 'bg-amber-500/15 hover:bg-emerald-500/20 border border-amber-400/35 text-amber-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            {msg.doubtResolved
                              ? `Resolved${msg.doubtResolvedBy ? ` by ${msg.doubtResolvedBy}` : ''}${
                                  msg.doubtAwardedXp ? ` (+${msg.doubtAwardedXp} XP)` : ''
                                }`
                              : `Mark Resolved & Award +${doubtBounty} XP`}
                          </span>
                        </button>
                      </div>

                      {/* Inline Resolver & XP Picker when marking a doubt resolved */}
                      {resolvingDoubtId === msg.id && !msg.doubtResolved && (
                        <div className="p-3 rounded-2xl bg-zinc-950 border border-emerald-400/40 space-y-2.5 shadow-xl animate-view">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                              Award Doubt Resolution Bounty (1-10 XP)
                            </span>
                            <button
                              type="button"
                              onClick={() => setResolvingDoubtId(null)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9.5px] text-slate-400 font-bold block mb-1">
                                Who resolved this doubt? (No AI used)
                              </label>
                              <select
                                value={selectedResolverId}
                                onChange={(e) => setSelectedResolverId(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
                              >
                                {activeMems
                                  .filter(m => m.id !== msg.senderId)
                                  .map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.institute || 'Squad'})
                                    </option>
                                  ))}
                                <option value={msg.senderId}>
                                  Solved it myself (0 XP - closes doubt)
                                </option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[9.5px] text-slate-400 font-bold block mb-1">
                                Difficulty XP Reward (1-10 XP)
                              </label>
                              <div className="flex items-center gap-1 flex-wrap">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(xpVal => (
                                  <button
                                    key={xpVal}
                                    type="button"
                                    disabled={selectedResolverId === msg.senderId}
                                    onClick={() => setSelectedAwardXp(xpVal)}
                                    className={`w-6 h-6 rounded-lg text-[10px] font-mono-num font-extrabold border transition-all cursor-pointer ${
                                      selectedResolverId === msg.senderId
                                        ? 'opacity-40 bg-zinc-900 border-white/10 text-slate-500'
                                        : selectedAwardXp === xpVal
                                        ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                                        : 'bg-zinc-900 text-slate-300 border-white/10 hover:border-white/30'
                                    }`}
                                  >
                                    {xpVal}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-[10px] text-slate-400">
                              {selectedResolverId === msg.senderId
                                ? 'Self-resolving closes the doubt without awarding XP.'
                                : `Credits +${selectedAwardXp} XP to ${
                                    activeMems.find(m => m.id === selectedResolverId)?.name || 'Scholar'
                                  }'s live Sprint & Career XP.`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleConfirmResolveWithAward(msg)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-400 text-slate-950 font-extrabold text-[10.5px] flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                {selectedResolverId === msg.senderId
                                  ? 'Close Doubt (0 XP)'
                                  : `Confirm & Award +${selectedAwardXp} XP`}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Existing Emoji Reactions */}
                  {reactionEntries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {reactionEntries.map(([emoji, userIds]) => {
                        const hasReacted = userIds.includes(currentUserId);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => onToggleReaction(msg.id, emoji)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              hasReacted
                                ? 'bg-sky-500/25 border border-sky-400/50 text-sky-200'
                                : 'bg-white/[0.05] border border-white/10 text-slate-300 hover:bg-white/[0.1]'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-mono-num">{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Jump to DM Thread Link when viewing Unified DMs */}
                  {msg.recipientId !== 'ALL' &&
                    activeChannel === 'DMS' &&
                    otherPartyId &&
                    otherPartyId !== currentUserId && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectChannel(otherPartyId);
                          onMarkChannelRead(otherPartyId);
                        }}
                        className="text-[10px] text-sky-400 hover:underline font-semibold cursor-pointer"
                      >
                        Open 1-on-1 thread with{' '}
                        {msg.senderId === currentUserId ? msg.recipientName : msg.senderName} →
                      </button>
                    )}
                </div>
              );
            })
          )}
        </div>

        {/* ORGANIC PEER DOUBT SOLUTION BUILDER (ANTI-AI / OWN-WORDS COMPOSER) */}
        {solvingDoubtMsg && (
          <form
            onSubmit={handleSubmitOrganicDoubtSolution}
            className="p-3.5 my-1 rounded-2xl bg-gradient-to-b from-violet-950/80 via-zinc-950 to-zinc-950 border border-violet-400/45 space-y-2.5 shadow-2xl max-h-[62vh] overflow-y-auto animate-view"
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-violet-500/25 border border-violet-400/40 text-violet-200 text-[9.5px] font-extrabold uppercase">
                    Solving {solvingDoubtMsg.senderName}&apos;s {solvingDoubtMsg.doubtSubject} Doubt
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9.5px] font-mono-num font-extrabold">
                    +{Math.min(10, Math.max(1, Number(solvingDoubtMsg.doubtBountyXp) || 5))} XP Bounty
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                  &ldquo;{solvingDoubtMsg.text}&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSolvingDoubtMsg(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Friendly Anti-AI Nudge Banner */}
            {solAntiAiNudge ? (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-start gap-2 text-[11px] text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300">Keep It Real (Zero AI / Google): </span>
                  {solAntiAiNudge}
                </div>
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] text-slate-300 flex items-center justify-between gap-2">
                <span>
                  🧠 <strong>Peer Style Only:</strong> No need for textbook grammar - explain the trick like you&apos;re at the study table, or snap your rough notebook!
                </span>
              </div>
            )}

            {/* Step 1: 1-Line Core Trick */}
            <div>
              <label className="text-[10px] font-bold text-emerald-300 block mb-1">
                1. What&apos;s the 1-line core trick or formula intuition? *
              </label>
              <input
                type="text"
                value={solCoreTrick}
                onPaste={handleSolutionPaste}
                onChange={(e) => {
                  setSolCoreTrick(e.target.value);
                  if (solAntiAiNudge) setSolAntiAiNudge(null);
                }}
                placeholder="e.g., Conserve angular momentum about the bottom hinge because normal impulse passes through it"
                className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Step 2: Rough Working OR Notebook Photo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-bold text-sky-300">
                  2. Your rough steps OR snap your handwritten rough notebook *
                </label>
                <div>
                  <input
                    ref={solFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSolutionNotebookImageChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => solFileInputRef.current?.click()}
                    disabled={isCompressingSolImg}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3 text-emerald-300" />
                    <span>
                      {isCompressingSolImg
                        ? 'Processing...'
                        : solHandwrittenImg
                        ? 'Change Notebook Photo'
                        : 'Snap Handwritten Notebook'}
                    </span>
                  </button>
                </div>
              </div>

              {solHandwrittenImg && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30">
                  <img
                    src={solHandwrittenImg}
                    alt="Handwritten preview"
                    className="w-14 h-14 rounded-lg object-cover border border-white/20"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10.5px] font-bold text-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Handwritten Rough Work Attached!
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Pen-on-paper proof automatically verifies organic problem-solving.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSolHandwrittenImg(null)}
                    className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <textarea
                rows={2}
                value={solRoughSteps}
                onPaste={handleSolutionPaste}
                onChange={(e) => {
                  setSolRoughSteps(e.target.value);
                  if (solAntiAiNudge) setSolAntiAiNudge(null);
                }}
                placeholder="Type your rough calculation steps in your own words (copy-pasting from AI/Google is blocked)..."
                className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400 resize-none"
              />
            </div>

            {/* Step 3: Common Trap / Mistake to Watch Out For */}
            <div>
              <label className="text-[10px] font-bold text-amber-300 block mb-1">
                3. Where do people usually get trapped in this question? (Peer Warning)
              </label>
              <input
                type="text"
                value={solCommonTrap}
                onPaste={handleSolutionPaste}
                onChange={(e) => setSolCommonTrap(e.target.value)}
                placeholder="e.g., Don't forget to take moment of inertia about the end (ML^2/3), not COM!"
                className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Step 4: Squad Honor Check & Submit */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/10">
              <label className="flex items-center gap-2 text-[10.5px] text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={solHonorPledge}
                  onChange={(e) => {
                    setSolHonorPledge(e.target.checked);
                    if (e.target.checked && solAntiAiNudge) setSolAntiAiNudge(null);
                  }}
                  className="rounded border-white/30 bg-black text-emerald-400 focus:ring-0"
                />
                <span>
                  <strong>Squad Honor:</strong> Solved from my own brain / rough notebook (zero AI or Google)
                </span>
              </label>

              <button
                type="submit"
                disabled={isSending}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 transition-all cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  Post Organic Solution (+{Math.min(10, Math.max(1, Number(solvingDoubtMsg.doubtBountyXp) || 5))} XP)
                </span>
              </button>
            </div>
          </form>
        )}

        {/* RICH COMPOSER TOOLBAR: SHARE CARDS + DOUBT TAGS + QUICK PHRASES */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          {/* Active Reply Banner */}
          {replyingTo && (
            <div className="px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-400/35 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <CornerDownRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[10px] font-bold text-sky-300 shrink-0">
                  Replying to {replyingTo.senderName}:
                </span>
                <span className="text-[11px] text-slate-300 truncate">{replyingTo.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* DOUBT DIFFICULTY & 1-10 XP BOUNTY CONFIGURATOR (WHEN POSTING A DOUBT) */}
          {doubtSubjectTag && (
            <div className="p-2.5 rounded-2xl bg-violet-950/40 border border-violet-400/35 space-y-2 animate-view">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-violet-300" />
                  <span className="text-[10.5px] font-extrabold text-violet-200 uppercase tracking-wider">
                    {doubtSubjectTag} Doubt • Set Difficulty &amp; XP Bounty (1-10 XP)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDoubtSubjectTag(null);
                    setDoubtImageUrl(null);
                    setDoubtWhatITried('');
                  }}
                  className="text-slate-400 hover:text-white text-[10px] flex items-center gap-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Cancel Doubt Tag
                </button>
              </div>

              {/* 4 Difficulty Tier Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(['easy', 'medium', 'hard', 'extreme'] as DoubtDifficulty[]).map(diffKey => {
                  const cfg = DOUBT_DIFFICULTY_CONFIG[diffKey];
                  const active = doubtDifficulty === diffKey;
                  return (
                    <button
                      key={diffKey}
                      type="button"
                      onClick={() => handleSelectDifficultyPreset(diffKey)}
                      className={`px-2 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-violet-400 text-slate-950 border-violet-200 font-extrabold shadow-sm'
                          : 'bg-black/50 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span>{cfg.shortLabel}</span>
                        <span className="font-mono-num font-extrabold">+{cfg.defaultXp} XP</span>
                      </div>
                      <div className={`text-[8.5px] truncate ${active ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                        {cfg.minXp === cfg.maxXp ? `${cfg.maxXp} XP` : `${cfg.minXp}-${cfg.maxXp} XP`}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Exact 1-10 XP Fine-Tuner + Photo Upload + "What I tried" */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9.5px] font-bold text-slate-400 mr-1">Exact XP:</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(xpNum => (
                    <button
                      key={xpNum}
                      type="button"
                      onClick={() => handleSelectCustomBountyXp(xpNum)}
                      className={`w-5 h-5 rounded-md text-[9.5px] font-mono-num font-extrabold transition-all cursor-pointer ${
                        doubtBountyXp === xpNum
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'bg-black/60 text-slate-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      {xpNum}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    ref={doubtFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleDoubtQuestionImageChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => doubtFileInputRef.current?.click()}
                    disabled={isCompressingDoubtImg}
                    className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[10px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3 text-violet-300" />
                    <span>{isCompressingDoubtImg ? 'Loading...' : doubtImageUrl ? 'Photo Added ✓' : 'Attach Question Photo'}</span>
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={doubtWhatITried}
                onChange={(e) => setDoubtWhatITried(e.target.value)}
                placeholder="Optional: What did you already try / which step are you stuck on?"
                className="w-full px-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white focus:outline-none focus:border-violet-400"
              />
            </div>
          )}

          {/* Action Strip: Share Live Cards & Tag Doubt */}
          <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleShareGrindStatsCard}
                disabled={isSending}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-[10px] font-bold text-emerald-200 flex items-center gap-1 shrink-0 cursor-pointer"
                title="Post your live study duration, questions solved & streak card"
              >
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>Share My Grind</span>
              </button>

              <button
                type="button"
                onClick={handleShareLatestExamCard}
                disabled={isSending}
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-[10px] font-bold text-amber-200 flex items-center gap-1 shrink-0 cursor-pointer"
                title="Share your latest mock exam percentile scorecard"
              >
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>Share Mock Score</span>
              </button>

              <button
                type="button"
                onClick={handleShareWarfareCallout}
                disabled={isSending}
                className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-[10px] font-bold text-rose-200 flex items-center gap-1 shrink-0 cursor-pointer"
                title="Challenge the squad to a 90-minute focus sprint"
              >
                <Swords className="w-3 h-3 text-rose-400" />
                <span>90m Callout</span>
              </button>
            </div>

            {/* Doubt Subject Tag Selector */}
            <div className="flex items-center gap-1 shrink-0">
              {(['Physics', 'Chemistry', 'Math'] as const).map(subj => {
                const isSelected = doubtSubjectTag === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setDoubtSubjectTag(prev => (prev === subj ? null : subj))}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-violet-400 text-slate-950 border-violet-300 shadow-sm'
                        : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white'
                    }`}
                    title={`Tag message as a ${subj} Doubt with a 1-10 XP bounty`}
                  >
                    ? {subj.slice(0, 4)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Preset Phrases */}
          <div className="flex gap-1.5 overflow-x-auto text-[10px] no-scrollbar">
            {[
              'Locking in for a 90m Physics block right now ⚡',
              'Anyone free in Combined Study Lounge? 👥',
              'Posted a doubt in #doubts - +5 XP bounty up for grabs! 🧠',
              'Finished today’s target problem set! 🎯'
            ].map((phrase, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputText(phrase);
                  inputRef.current?.focus();
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/10 text-slate-400 hover:text-white shrink-0 cursor-pointer"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Message Input Form */}
          <form onSubmit={handleFormSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder={
                doubtSubjectTag
                  ? `Ask your ${doubtSubjectTag} doubt (+${doubtBountyXp} XP bounty for organic solution)...`
                  : activeChannel === 'ALL'
                  ? `Message ${
                      publicSubChannel === 'ALL_TOPICS' ? 'Squad Public' : `#${publicSubChannel}`
                    }...`
                  : activeChannel === 'DMS'
                  ? 'Reply to your latest DM or pick a scholar above...'
                  : `Direct message ${activeRecipientObj?.name || 'scholar'}...`
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="btn-primary px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <span>
                {isSending
                  ? 'Sending...'
                  : doubtSubjectTag
                  ? `Post (+${doubtBountyXp} XP)`
                  : 'Send'}
              </span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* LIGHTBOX FOR VIEWING DOUBT / HANDWRITTEN NOTEBOOK PHOTOS */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[88vh]">
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-zinc-900 border border-white/20 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Full size attachment"
              className="max-w-full max-h-[85vh] rounded-2xl border border-white/15 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
