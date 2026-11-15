import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Play,
  Pause,
  Check,
  X,
  Flame,
  Clock,
  Sparkles,
  Bell,
  Target,
  Minimize2,
  Maximize2,
  BookOpen,
  Zap,
  Trophy,
  Swords,
  Crown,
  RotateCcw,
  QrCode,
  Bluetooth,
  Wifi,
  Camera,
  Copy,
  Radio,
  Smartphone,
  Share2
} from 'lucide-react';
import { sendWebRTCSignal, getServerSyncedNow } from '../firebase';

export interface CombinedStudyParticipant {
  id: string;
  name: string;
  institute: string;
  isGrinding: boolean;
  grindingSubject: string;
  grindingStartedAt: number | null;
  grindingAccumulatedSeconds: number;
  weeklyXp?: number;
  lastActiveAt?: number | null;
  isOnline?: boolean;
}

export interface CombinedStudyInvite {
  id: string;
  fromMemberId: string;
  fromMemberName: string;
  fromInstitute: string;
  targetMemberId: string;
  targetMemberName: string;
  roomTitle: string;
  mode: 'POMODORO_50' | 'POMODORO_25' | 'DEEP_90' | 'OPEN_MARATHON';
  durationMins: number;
  subject: string;
  challengeEnabled: boolean;
  challengeTitle: string;
  challengeBonusXp: number;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: number;
  sharedStartedAt?: number | null;
}

export interface CombinedParticipantLane {
  memberId: string;
  subject: string;
  difficulty: 'easy' | 'mains' | 'hard' | 'adv';
  solvedQuestions: string;
  attemptedQuestions: string;
  notes: string;
}

export type CombinedChallengeRule =
  | 'most_question_xp'
  | 'most_solved'
  | 'highest_accuracy'
  | 'manual';

export interface CombinedStudyRoomState {
  active: boolean;
  roomTitle: string;
  mode: 'POMODORO_50' | 'POMODORO_25' | 'DEEP_90' | 'OPEN_MARATHON';
  sharedBlockStartedAt: number | null;
  sharedBlockDurationMins: number;
  hostName?: string;
  selectedMemberIds?: string[];
  lanes?: Record<string, CombinedParticipantLane>;
  challengeEnabled?: boolean;
  challengeTitle?: string;
  challengeRule?: CombinedChallengeRule;
  challengeBonusXp?: number;
  challengeWagerMode?: boolean;
  manualWinnerId?: string | null;
  participantGoals?: Record<string, string>;
  invites?: CombinedStudyInvite[];
  recentPings?: Array<{
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
  }>;
  pairingCode?: string;
  sharedTimerStatus?: 'RUNNING' | 'PAUSED' | 'IDLE';
  sharedAccumulatedSeconds?: number;
}

export interface CombinedSessionSettlementPayload {
  durationMins: number;
  participants: Array<{
    memberId: string;
    memberName: string;
    subject: string;
    difficulty: 'easy' | 'mains' | 'hard' | 'adv';
    solvedQuestions: number;
    attemptedQuestions: number;
    notes: string;
  }>;
  challenge: {
    enabled: boolean;
    title: string;
    rule: CombinedChallengeRule;
    bonusXp: number;
    wagerMode: boolean;
    winnerMemberId: string | null;
    winnerName: string | null;
  };
}

interface CombinedStudyRoomModalProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
  currentMember: {
    id: string;
    name: string;
    institute: string;
  } | null;
  allMembers: CombinedStudyParticipant[];
  roomState: CombinedStudyRoomState;
  timerRunning: boolean;
  timerSeconds: number;
  timerSubject: string;
  initialDurationMins?: number;
  subjectOptions: Array<{ id: string; label: string; short: string }>;
  onSelectSubject: (subjectId: string) => void;
  onStartOrResumeTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer?: () => void;
  onFinishAndLog: () => void;
  onSaveCombinedSession: (payload: CombinedSessionSettlementPayload) => Promise<void>;
  onUpdateRoomState: (next: Partial<CombinedStudyRoomState>) => Promise<void>;
  onBroadcastInviteToSquad: (roomTitle: string, modeLabel: string) => Promise<void>;
  onSendStudyInvite?: (targetMemberId: string, durationMins: number, subject: string, challenge: any) => Promise<void>;
  onCancelStudyInvite?: (inviteId: string) => Promise<void>;
  onAcceptStudyInvite?: (invite: CombinedStudyInvite) => Promise<void>;
  onDeclineStudyInvite?: (inviteId: string) => Promise<void>;
  pendingInvites?: CombinedStudyInvite[];
}

const DIFFICULTY_META: Array<{
  id: 'easy' | 'mains' | 'hard' | 'adv';
  label: string;
  short: string;
  solvedMult: number;
  attemptMult: number;
  badgeClass: string;
}> = [
  {
    id: 'easy',
    label: 'Easy / NCERT',
    short: 'Easy (0.5x)',
    solvedMult: 0.5,
    attemptMult: 0.2,
    badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
  },
  {
    id: 'mains',
    label: 'JEE Mains',
    short: 'Mains (1.0x)',
    solvedMult: 1.0,
    attemptMult: 0.4,
    badgeClass: 'border-sky-400/40 bg-sky-500/15 text-sky-300'
  },
  {
    id: 'hard',
    label: 'Hard Mains',
    short: 'Hard (1.5x)',
    solvedMult: 1.5,
    attemptMult: 0.6,
    badgeClass: 'border-amber-400/40 bg-amber-500/15 text-amber-300'
  },
  {
    id: 'adv',
    label: 'JEE Advanced',
    short: 'Adv (2.5x)',
    solvedMult: 2.5,
    attemptMult: 1.0,
    badgeClass: 'border-rose-400/40 bg-rose-500/15 text-rose-300'
  }
];

const CHALLENGE_PRESETS: Array<{
  id: CombinedChallengeRule;
  label: string;
  desc: string;
  defaultTitle: string;
}> = [
  {
    id: 'most_question_xp',
    label: '⚡ Problem Blitz (Question XP)',
    desc: 'Whoever earns the highest difficulty-weighted Question XP in this session wins!',
    defaultTitle: 'Problem Blitz Showdown'
  },
  {
    id: 'most_solved',
    label: '🎯 Speed Solver (Most Solved Qs)',
    desc: 'Whoever completely solves the most questions during the shared timer wins!',
    defaultTitle: 'Speed Solver Sprint'
  },
  {
    id: 'highest_accuracy',
    label: '🔥 Precision Duel (Best Solve %)',
    desc: 'Highest solve accuracy percentage (minimum 5 total questions) wins!',
    defaultTitle: 'High-Precision Accuracy Duel'
  },
  {
    id: 'manual',
    label: '🏆 Custom Challenge / Pick Winner',
    desc: 'Set any custom study dare or chapter race and crown the winner when logging!',
    defaultTitle: 'Custom Chapter Race'
  }
];

function formatLiveHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = String(Math.floor(safe / 3600)).padStart(2, '0');
  const mins = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const secs = String(safe % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function calcLaneQuestionXp(
  solved: number,
  attempted: number,
  difficulty: 'easy' | 'mains' | 'hard' | 'adv'
): number {
  const tier = DIFFICULTY_META.find(d => d.id === difficulty) || DIFFICULTY_META[1];
  return Math.round(solved * tier.solvedMult + attempted * tier.attemptMult);
}

export const CombinedStudyRoomModal: React.FC<CombinedStudyRoomModalProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onToggleMinimize,
  currentMember,
  allMembers,
  roomState,
  timerRunning,
  timerSeconds,
  timerSubject,
  initialDurationMins,
  subjectOptions,
  onSelectSubject,
  onStartOrResumeTimer,
  onPauseTimer,
  onResetTimer,
  onSaveCombinedSession,
  onUpdateRoomState,
  onBroadcastInviteToSquad,
  onSendStudyInvite,
  onCancelStudyInvite,
  onAcceptStudyInvite,
  onDeclineStudyInvite,
  pendingInvites = []
}) => {
  // Default selected participants: current user is always host; rivals join ONLY when an active shared study block is running
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const myId = currentMember?.id || allMembers[0]?.id || 'sai';
    const now = getServerSyncedNow();
    const blockStart = Number(roomState.sharedBlockStartedAt) || 0;
    const isFreshActiveSession =
      roomState.sharedTimerStatus === 'RUNNING' &&
      blockStart > 0 &&
      blockStart !== 1793539644377 &&
      now - blockStart < 4 * 3600 * 1000 &&
      Array.isArray(roomState.selectedMemberIds) &&
      roomState.selectedMemberIds.length > 1 &&
      roomState.selectedMemberIds.includes(myId);
    if (isFreshActiveSession) {
      return roomState.selectedMemberIds!;
    }
    return [myId];
  });

  // Timing source: 'live_timer' uses the shared stopwatch; 'manual_mins' lets them type shared duration directly
  const [durationMode, setDurationMode] = useState<'live_timer' | 'manual_mins'>('live_timer');
  const [manualDurationInput, setManualDurationInput] = useState<string>(
    initialDurationMins && initialDurationMins > 0 ? String(initialDurationMins) : '60'
  );

  // Per-scholar independent Subject, Difficulty, Solved Qs, Attempted Qs, and Notes
  const [lanesByMember, setLanesByMember] = useState<Record<string, CombinedParticipantLane>>(() => {
    const map: Record<string, CombinedParticipantLane> = {};
    allMembers.forEach((m, idx) => {
      const defaultSubj =
        currentMember?.id === m.id
          ? timerSubject || 'Physics'
          : idx % 3 === 0
          ? 'Physics'
          : idx % 3 === 1
          ? 'Math'
          : 'Chemistry';
      map[m.id] = roomState.lanes?.[m.id] || {
        memberId: m.id,
        subject: defaultSubj,
        difficulty: 'mains',
        solvedQuestions: '',
        attemptedQuestions: '',
        notes: ''
      };
    });
    return map;
  });

  // Challenge State
  const [challengeEnabled, setChallengeEnabled] = useState<boolean>(
    roomState.challengeEnabled !== undefined ? roomState.challengeEnabled : true
  );
  const [challengeRule, setChallengeRule] = useState<CombinedChallengeRule>(
    roomState.challengeRule || 'most_question_xp'
  );
  const [challengeTitle, setChallengeTitle] = useState<string>(
    roomState.challengeTitle || 'Problem Blitz Showdown'
  );
  const [challengeBonusXp, setChallengeBonusXp] = useState<number>(
    roomState.challengeBonusXp || 50
  );
  const [challengeWagerMode, setChallengeWagerMode] = useState<boolean>(
    Boolean(roomState.challengeWagerMode)
  );
  const [manualWinnerId, setManualWinnerId] = useState<string | null>(
    roomState.manualWinnerId || null
  );
  const [isInviting, setIsInviting] = useState<boolean>(false);
  const [isSubmittingCombined, setIsSubmittingCombined] = useState<boolean>(false);

  // Proximity & P2P Pairing States: QR Code ("Scan to Grind Together"), WebRTC P2P DataChannel, Web Bluetooth
  const [showProximityHub, setShowProximityHub] = useState<boolean>(true);
  const [proximityTab, setProximityTab] = useState<'qr' | 'webrtc' | 'bluetooth'>('qr');
  const [pairingCodeInput, setPairingCodeInput] = useState<string>('');
  const [copiedQrLink, setCopiedQrLink] = useState<boolean>(false);
  const [isScanningCameraQr, setIsScanningCameraQr] = useState<boolean>(false);
  const [cameraScanError, setCameraScanError] = useState<string>('');
  const videoScanRef = React.useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);

  // WebRTC Peer-to-Peer state
  const [webrtcStatus, setWebrtcStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [webrtcLatencyMs, setWebrtcLatencyMs] = useState<number | null>(null);
  const [webrtcPeerName, setWebrtcPeerName] = useState<string>('');
  const peerConnRef = React.useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = React.useRef<RTCDataChannel | null>(null);
  const processedSignalIdsRef = React.useRef<Set<string>>(new Set());

  // Web Bluetooth state
  const [btStatus, setBtStatus] = useState<'idle' | 'scanning' | 'connected' | 'unsupported'>('idle');
  const [btDeviceName, setBtDeviceName] = useState<string>('');
  const [btStatusMessage, setBtStatusMessage] = useState<string>('');

  // Deterministic 6-digit Room Pairing Code
  const activePairingCode = useMemo(() => {
    if (roomState.pairingCode) return roomState.pairingCode;
    const hostId = (currentMember?.id || 'SAI').toUpperCase().slice(0, 3);
    const timeDigits = String(roomState.sharedBlockStartedAt || 482).slice(-3).padStart(3, '0');
    return `${hostId}-${timeDigits}`;
  }, [roomState.pairingCode, roomState.sharedBlockStartedAt, currentMember?.id]);

  // Shareable Instant-Pair URL for QR Code ("Scan to Grind Together")
  const qrPairingUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://jee-grind-arena.app';
    const hostId = encodeURIComponent(currentMember?.id || 'sai');
    const hostName = encodeURIComponent(currentMember?.name || 'Scholar');
    const code = encodeURIComponent(activePairingCode);
    const dur = encodeURIComponent(String(roomState.sharedBlockDurationMins || 50));
    const startTs = encodeURIComponent(String(roomState.sharedBlockStartedAt || getServerSyncedNow()));
    return `${origin}/?joinStudyRoom=${code}&hostId=${hostId}&hostName=${hostName}&dur=${dur}&startTs=${startTs}`;
  }, [activePairingCode, currentMember?.id, currentMember?.name, roomState.sharedBlockDurationMins, roomState.sharedBlockStartedAt]);

  // Keep selectedIds and lanes synchronized when another device updates roomState in Firestore
  useEffect(() => {
    const myId = currentMember?.id || allMembers[0]?.id || 'sai';
    const now = getServerSyncedNow();
    const blockStart = Number(roomState.sharedBlockStartedAt) || 0;
    const isFreshActiveSession =
      roomState.sharedTimerStatus === 'RUNNING' &&
      blockStart > 0 &&
      blockStart !== 1793539644377 &&
      now - blockStart < 4 * 3600 * 1000 &&
      Array.isArray(roomState.selectedMemberIds) &&
      roomState.selectedMemberIds.length > 1 &&
      roomState.selectedMemberIds.includes(myId);

    if (isFreshActiveSession) {
      setSelectedIds(prev => {
        const same =
          prev.length === roomState.selectedMemberIds!.length &&
          prev.every(id => roomState.selectedMemberIds!.includes(id));
        return same ? prev : roomState.selectedMemberIds!;
      });
    } else if (!roomState.sharedBlockStartedAt || roomState.sharedTimerStatus === 'IDLE' || !Array.isArray(roomState.selectedMemberIds) || roomState.selectedMemberIds.length === 0) {
      setSelectedIds(prev => (prev.length === 1 && prev[0] === myId ? prev : [myId]));
    }
  }, [roomState.selectedMemberIds, roomState.sharedBlockStartedAt, roomState.sharedTimerStatus, currentMember?.id]);

  useEffect(() => {
    if (roomState.lanes && Object.keys(roomState.lanes).length > 0) {
      setLanesByMember(prev => ({
        ...prev,
        ...roomState.lanes
      }));
    }
  }, [roomState.lanes]);

  // Broadcast P2P Timer Action over WebRTC DataChannel + SSE Signal
  const broadcastP2PTimerControl = (action: 'START' | 'PAUSE' | 'RESET', startTimestamp?: number) => {
    const payload = {
      type: 'P2P_TIMER_CONTROL',
      action,
      senderId: currentMember?.id || 'sai',
      senderName: currentMember?.name || 'Scholar',
      startTimestamp: startTimestamp || getServerSyncedNow(),
      timerSeconds,
      sentAt: getServerSyncedNow()
    };
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify(payload));
      } catch (_e) {
        // ignore channel send error
      }
    }
    sendWebRTCSignal({
      type: 'p2p_timer_sync',
      fromId: currentMember?.id || 'sai',
      fromName: currentMember?.name || 'Scholar',
      action,
      startTimestamp: payload.startTimestamp,
      timerSeconds
    }).catch(() => {});
  };

  // Setup WebRTC PeerConnection & DataChannel for ultra-low-latency (<10ms) direct phone-to-phone sync
  const initWebRTCPeer = (isInitiator: boolean) => {
    try {
      if (peerConnRef.current) {
        peerConnRef.current.close();
      }
      setWebrtcStatus('connecting');
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnRef.current = pc;

      const setupDataChannel = (channel: RTCDataChannel) => {
        dataChannelRef.current = channel;
        channel.onopen = () => {
          setWebrtcStatus('connected');
          channel.send(
            JSON.stringify({
              type: 'PING',
              senderId: currentMember?.id || 'sai',
              senderName: currentMember?.name || 'Scholar',
              sentAt: Date.now()
            })
          );
        };
        channel.onclose = () => {
          setWebrtcStatus('disconnected');
        };
        channel.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.senderName) setWebrtcPeerName(msg.senderName);
            if (msg.type === 'PING') {
              channel.send(
                JSON.stringify({
                  type: 'PONG',
                  senderId: currentMember?.id || 'sai',
                  senderName: currentMember?.name || 'Scholar',
                  pingSentAt: msg.sentAt
                })
              );
            } else if (msg.type === 'PONG' && msg.pingSentAt) {
              setWebrtcLatencyMs(Math.max(1, Date.now() - Number(msg.pingSentAt)));
            } else if (msg.type === 'P2P_TIMER_CONTROL') {
              if (msg.action === 'START') {
                onStartOrResumeTimer();
              } else if (msg.action === 'PAUSE') {
                onPauseTimer();
              } else if (msg.action === 'RESET' && onResetTimer) {
                onResetTimer();
              }
            }
          } catch (_e) {
            // ignore malformed message
          }
        };
      };

      if (isInitiator) {
        const dc = pc.createDataChannel('jee-study-sync', { ordered: true });
        setupDataChannel(dc);
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel);
        };
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebRTCSignal({
            type: 'ice-candidate',
            fromId: currentMember?.id || 'sai',
            fromName: currentMember?.name || 'Scholar',
            candidate: event.candidate.toJSON()
          }).catch(() => {});
        }
      };

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription) {
              sendWebRTCSignal({
                type: 'offer',
                fromId: currentMember?.id || 'sai',
                fromName: currentMember?.name || 'Scholar',
                sdp: pc.localDescription
              }).catch(() => {});
            }
          })
          .catch(() => {
            setWebrtcStatus('disconnected');
          });
      }

      return pc;
    } catch (_e) {
      setWebrtcStatus('disconnected');
      return null;
    }
  };

  // Listen for incoming WebRTC signaling & QR instant-join signals
  useEffect(() => {
    const handleSignalEvent = async (ev: Event) => {
      const sig = (ev as CustomEvent).detail;
      if (!sig || !sig.id || processedSignalIdsRef.current.has(sig.id)) return;
      processedSignalIdsRef.current.add(sig.id);

      const myId = currentMember?.id || 'sai';
      if (sig.fromId === myId) return;

      if (sig.fromName) {
        setWebrtcPeerName(sig.fromName);
      }

      if (sig.type === 'qr_instant_join' && sig.memberId) {
        setSelectedIds(prev => {
          const next = Array.from(new Set([...prev, myId, sig.memberId]));
          onUpdateRoomState({
            active: true,
            selectedMemberIds: next,
            sharedBlockStartedAt: sig.sharedStartedAt || roomState.sharedBlockStartedAt || getServerSyncedNow(),
            sharedTimerStatus: 'RUNNING'
          }).catch(() => {});
          return next;
        });
        if (!timerRunning) {
          onStartOrResumeTimer();
        }
        return;
      }

      if (sig.type === 'p2p_timer_sync') {
        if (sig.action === 'START' && !timerRunning) {
          onStartOrResumeTimer();
        } else if (sig.action === 'PAUSE' && timerRunning) {
          onPauseTimer();
        } else if (sig.action === 'RESET' && onResetTimer) {
          onResetTimer();
        }
        return;
      }

      try {
        if (sig.type === 'offer' && sig.sdp) {
          const pc = initWebRTCPeer(false);
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (pc.localDescription) {
            await sendWebRTCSignal({
              type: 'answer',
              fromId: myId,
              fromName: currentMember?.name || 'Scholar',
              sdp: pc.localDescription
            });
          }
        } else if (sig.type === 'answer' && sig.sdp && peerConnRef.current) {
          if (peerConnRef.current.signalingState === 'have-local-offer') {
            await peerConnRef.current.setRemoteDescription(new RTCSessionDescription(sig.sdp));
            setWebrtcStatus('connected');
          }
        } else if (sig.type === 'ice-candidate' && sig.candidate && peerConnRef.current) {
          await peerConnRef.current.addIceCandidate(new RTCIceCandidate(sig.candidate));
        }
      } catch (_e) {
        // Ignore transient WebRTC negotiation error
      }
    };

    window.addEventListener('jee-webrtc-signal', handleSignalEvent);
    return () => {
      window.removeEventListener('jee-webrtc-signal', handleSignalEvent);
    };
  }, [currentMember?.id, currentMember?.name, timerRunning, roomState.sharedBlockStartedAt]);

  // Stop camera stream on unmount or modal close
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  const stopQrCameraScanner = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setIsScanningCameraQr(false);
  };

  const handleJoinByCodeOrQrPayload = async (rawInput: string) => {
    const cleaned = rawInput.trim();
    if (!cleaned) return;
    let hostId = '';
    let code = cleaned.toUpperCase();

    try {
      if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.includes('joinStudyRoom=')) {
        const urlObj = new URL(cleaned.startsWith('http') ? cleaned : `https://jee.app/${cleaned}`);
        code = (urlObj.searchParams.get('joinStudyRoom') || code).toUpperCase();
        hostId = urlObj.searchParams.get('hostId') || '';
      }
    } catch (_e) {
      // treat as direct code
    }

    const prefix = code.split('-')[0]?.toLowerCase() || '';
    const matchedHost =
      allMembers.find(m => m.id.toLowerCase() === hostId.toLowerCase()) ||
      allMembers.find(m => m.id.toLowerCase().startsWith(prefix) || m.name.toLowerCase().startsWith(prefix));

    const myId = currentMember?.id || allMembers[0]?.id || 'sai';
    const nextIds = Array.from(
      new Set([...selectedIds, myId, ...(matchedHost ? [matchedHost.id] : [])])
    );

    const syncedStart = roomState.sharedBlockStartedAt || getServerSyncedNow();
    setSelectedIds(nextIds);
    await onUpdateRoomState({
      active: true,
      pairingCode: code,
      selectedMemberIds: nextIds,
      sharedBlockStartedAt: syncedStart,
      sharedTimerStatus: 'RUNNING'
    });

    await sendWebRTCSignal({
      type: 'qr_instant_join',
      fromId: myId,
      fromName: currentMember?.name || 'Scholar',
      memberId: myId,
      pairingCode: code,
      sharedStartedAt: syncedStart
    });

    initWebRTCPeer(true);
    if (!timerRunning) {
      onStartOrResumeTimer();
    }
    setPairingCodeInput('');
    stopQrCameraScanner();
  };

  const startQrCameraScanner = async () => {
    setCameraScanError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraScanError('Camera API unavailable on this browser. Enter the 6-digit code below to pair.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      cameraStreamRef.current = stream;
      setIsScanningCameraQr(true);
      setTimeout(() => {
        if (videoScanRef.current) {
          videoScanRef.current.srcObject = stream;
          videoScanRef.current.play().catch(() => {});
        }
      }, 80);

      // Use native BarcodeDetector if supported on Android Chrome / iOS Safari
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (BarcodeDetectorCtor) {
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const scanLoop = async () => {
          if (!cameraStreamRef.current || !videoScanRef.current) return;
          try {
            const barcodes = await detector.detect(videoScanRef.current);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              await handleJoinByCodeOrQrPayload(barcodes[0].rawValue);
              return;
            }
          } catch (_e) {
            // continue scanning
          }
          if (cameraStreamRef.current) {
            requestAnimationFrame(scanLoop);
          }
        };
        requestAnimationFrame(scanLoop);
      } else {
        setCameraScanError('Point camera at QR or type the 6-digit code shown on your friend’s screen.');
      }
    } catch (_err) {
      setCameraScanError('Camera permission denied. Type the 6-digit Room Code below to pair instantly!');
      setIsScanningCameraQr(false);
    }
  };

  // Web Bluetooth Nearby Discovery ("Scan for Nearby Phone / Tablet")
  const handleScanWebBluetoothNearby = async () => {
    const navBt = (navigator as any).bluetooth;
    if (!navBt || typeof navBt.requestDevice !== 'function') {
      setBtStatus('unsupported');
      setBtStatusMessage('Web Bluetooth requires Chrome on Android/Desktop. Linking via WebRTC P2P fallback...');
      initWebRTCPeer(true);
      return;
    }
    try {
      setBtStatus('scanning');
      setBtStatusMessage('Scanning nearby Bluetooth LE devices...');
      const device = await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information', 'generic_access']
      });
      const foundName = device?.name || 'Nearby Study Partner Phone';
      setBtDeviceName(foundName);
      setBtStatus('connected');
      setBtStatusMessage(`Paired with ${foundName}! Synchronizing shared study timer...`);

      // Match squadmate if device name contains their name, otherwise sync with online squadmate
      const matchedMember =
        allMembers.find(m => m.id !== currentMember?.id && foundName.toLowerCase().includes(m.name.toLowerCase())) ||
        allMembers.find(m => m.id !== currentMember?.id && (m.isOnline || m.isGrinding));

      const myId = currentMember?.id || 'sai';
      const nextIds = Array.from(
        new Set([...selectedIds, myId, ...(matchedMember ? [matchedMember.id] : [])])
      );
      const syncedStart = roomState.sharedBlockStartedAt || getServerSyncedNow();
      setSelectedIds(nextIds);
      await onUpdateRoomState({
        active: true,
        selectedMemberIds: nextIds,
        sharedBlockStartedAt: syncedStart,
        sharedTimerStatus: 'RUNNING'
      });
      initWebRTCPeer(true);
      if (!timerRunning) {
        onStartOrResumeTimer();
      }
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        setBtStatus('idle');
        setBtStatusMessage('Bluetooth scan cancelled.');
      } else {
        setBtStatus('idle');
        setBtStatusMessage('Bluetooth pairing finished - WebRTC P2P direct channel armed.');
        initWebRTCPeer(true);
      }
    }
  };

  useEffect(() => {
    if (initialDurationMins && initialDurationMins > 0) {
      setManualDurationInput(prev => (prev === String(initialDurationMins) ? prev : String(initialDurationMins)));
    }
  }, [initialDurationMins]);

  const effectiveDurationMins = useMemo(() => {
    if (durationMode === 'manual_mins') {
      return Math.max(1, Math.round(Number(manualDurationInput) || 1));
    }
    const fromLive = Math.round(timerSeconds / 60);
    if (fromLive > 0) return fromLive;
    return Math.max(1, Math.round(Number(manualDurationInput) || 30));
  }, [durationMode, manualDurationInput, timerSeconds]);

  const baseTimeXp = useMemo(() => {
    return Math.round((effectiveDurationMins / 30) * 10);
  }, [effectiveDurationMins]);

  const toggleParticipant = (memberId: string) => {
    setSelectedIds(prev => {
      const next = prev.includes(memberId)
        ? prev.length > 1
          ? prev.filter(id => id !== memberId)
          : prev
        : [...prev, memberId];
      onUpdateRoomState({ selectedMemberIds: next }).catch(() => {});
      return next;
    });
  };

  const updateLane = (memberId: string, patch: Partial<CombinedParticipantLane>) => {
    setLanesByMember(prev => {
      const existing = prev[memberId] || {
        memberId,
        subject: 'Physics',
        difficulty: 'mains',
        solvedQuestions: '',
        attemptedQuestions: '',
        notes: ''
      };
      const updated = {
        ...prev,
        [memberId]: { ...existing, ...patch }
      };
      if (currentMember?.id === memberId && patch.subject) {
        onSelectSubject(patch.subject);
      }
      onUpdateRoomState({ lanes: updated }).catch(() => {});
      return updated;
    });
  };

  // Compute live stats for each selected participant
  const participantStandings = useMemo(() => {
    return selectedIds
      .map(id => {
        const mem = allMembers.find(m => m.id === id);
        if (!mem) return null;
        const lane = lanesByMember[id] || {
          memberId: id,
          subject: 'Physics',
          difficulty: 'mains' as const,
          solvedQuestions: '',
          attemptedQuestions: '',
          notes: ''
        };
        const solved = Math.max(0, parseInt(lane.solvedQuestions || '0', 10) || 0);
        const attempted = Math.max(0, parseInt(lane.attemptedQuestions || '0', 10) || 0);
        const totalQs = solved + attempted;
        const solveRate = totalQs > 0 ? Math.round((solved / totalQs) * 100) : 0;
        const qXp = calcLaneQuestionXp(solved, attempted, lane.difficulty);
        const sessionXpBeforeChallenge = baseTimeXp + qXp;

        return {
          member: mem,
          lane,
          solved,
          attempted,
          totalQs,
          solveRate,
          qXp,
          sessionXpBeforeChallenge
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [selectedIds, allMembers, lanesByMember, baseTimeXp]);

  // Determine Challenge Winner live
  const computedWinner = useMemo(() => {
    if (!challengeEnabled || participantStandings.length < 2) return null;

    if (challengeRule === 'manual') {
      if (manualWinnerId && selectedIds.includes(manualWinnerId)) {
        return participantStandings.find(p => p.member.id === manualWinnerId) || null;
      }
      return null;
    }

    if (challengeRule === 'most_question_xp') {
      const sorted = [...participantStandings].sort((a, b) => {
        if (b.qXp !== a.qXp) return b.qXp - a.qXp;
        return b.solved - a.solved;
      });
      if (sorted[0] && sorted[0].qXp > 0 && sorted[0].qXp > (sorted[1]?.qXp ?? -1)) {
        return sorted[0];
      }
      return null;
    }

    if (challengeRule === 'most_solved') {
      const sorted = [...participantStandings].sort((a, b) => {
        if (b.solved !== a.solved) return b.solved - a.solved;
        return b.qXp - a.qXp;
      });
      if (sorted[0] && sorted[0].solved > 0 && sorted[0].solved > (sorted[1]?.solved ?? -1)) {
        return sorted[0];
      }
      return null;
    }

    if (challengeRule === 'highest_accuracy') {
      const eligible = participantStandings.filter(p => p.totalQs >= 5);
      const sorted = [...eligible].sort((a, b) => {
        if (b.solveRate !== a.solveRate) return b.solveRate - a.solveRate;
        return b.solved - a.solved;
      });
      if (sorted[0] && sorted[0].solveRate > (sorted[1]?.solveRate ?? -1)) {
        return sorted[0];
      }
      return null;
    }

    return null;
  }, [challengeEnabled, participantStandings, challengeRule, manualWinnerId, selectedIds]);

  const handleSettleAndLogAll = async () => {
    if (isSubmittingCombined || participantStandings.length === 0) return;
    setIsSubmittingCombined(true);
    try {
      const winnerObj = computedWinner;
      await onSaveCombinedSession({
        durationMins: effectiveDurationMins,
        participants: participantStandings.map(p => ({
          memberId: p.member.id,
          memberName: p.member.name,
          subject: p.lane.subject,
          difficulty: p.lane.difficulty,
          solvedQuestions: p.solved,
          attemptedQuestions: p.attempted,
          notes: p.lane.notes.trim()
        })),
        challenge: {
          enabled: challengeEnabled && participantStandings.length >= 2,
          title: challengeTitle.trim() || 'Combined Study Challenge',
          rule: challengeRule,
          bonusXp: challengeBonusXp,
          wagerMode: challengeWagerMode,
          winnerMemberId: winnerObj ? winnerObj.member.id : null,
          winnerName: winnerObj ? winnerObj.member.name : null
        }
      });
    } finally {
      setIsSubmittingCombined(false);
    }
  };

  if (!isOpen) return null;

  // Minimized Floating Co-op Pill (allows browsing leaderboard/tasks while shared timer runs)
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 lg:bottom-6 left-4 z-[175] w-[92vw] max-w-md surface-card rounded-2xl p-3.5 border-2 border-emerald-400/60 shadow-[0_18px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 animate-modal">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 relative">
            <Users className="w-4 h-4" />
            {timerRunning && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-white truncate flex items-center gap-1.5">
              <span>
                Studying: {participantStandings.map(p => p.member.name).join(' + ')}
              </span>
            </div>
            <div className="text-[11px] font-mono-num text-emerald-300 font-bold truncate">
              Shared Timer: {formatLiveHMS(timerSeconds)} •{' '}
              {computedWinner ? `👑 ${computedWinner.member.name} Leading` : `${challengeBonusXp} XP Challenge`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={timerRunning ? onPauseTimer : onStartOrResumeTimer}
            className={`p-2 rounded-xl text-xs font-bold cursor-pointer ${
              timerRunning
                ? 'bg-amber-400/20 border border-amber-400/40 text-amber-300'
                : 'bg-emerald-500 text-slate-950'
            }`}
            title={timerRunning ? 'Pause Shared Timer' : 'Start / Resume Shared Timer'}
          >
            {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={onToggleMinimize}
            className="p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-white cursor-pointer"
            title="Expand Combined Study & Challenge Hub"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[190] bg-[#04070E]/90 backdrop-blur-xl flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-5xl surface-card rounded-3xl border border-emerald-500/40 shadow-[0_24px_80px_rgba(0,0,0,0.92)] overflow-hidden flex flex-col max-h-[94dvh] animate-modal">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/15 via-sky-500/10 to-amber-500/10 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/45 flex items-center justify-center text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Shared Timer • Independent Subjects • Live XP Challenge</span>
                </span>
                <span className="text-[11px] font-mono-num text-amber-300 font-bold">
                  {participantStandings.map(p => p.member.name).join(' × ')}
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-white font-display tracking-tight mt-0.5">
                Combined Study Session &amp; Live Challenge Hub
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isInviting}
              onClick={async () => {
                setIsInviting(true);
                try {
                  await onBroadcastInviteToSquad(
                    challengeTitle.trim() || 'Combined Study & Challenge Session',
                    `${participantStandings.map(p => p.member.name).join(' + ')} (+${challengeBonusXp} XP Challenge)`
                  );
                } finally {
                  setIsInviting(false);
                }
              }}
              className="px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              title="Notify squad members that a Combined Study & Challenge Session is live"
            >
              <Bell className="w-3.5 h-3.5 text-sky-400" />
              <span>{isInviting ? 'Pinging...' : 'Summon Squad'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleMinimize}
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Minimize into floating bar while shared timer keeps running"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Minimize</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content (Focused Element: Shared Timer + Scholar Selector + Challenge Thrower + Per-Scholar Subject/Question Lanes) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-gradient-to-b from-[#070B14] to-[#05070C]">
          {/* INCOMING STUDY INVITATION BANNER (If current member has pending requests) */}
          {(() => {
            const myPendingInvites = pendingInvites.filter(
              inv => inv.targetMemberId === currentMember?.id && inv.status === 'pending'
            );
            if (myPendingInvites.length === 0) return null;
            return (
              <div className="space-y-2">
                {myPendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-sky-500/15 to-amber-500/15 border-2 border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.25)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-modal"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-white">
                            Study Request from {inv.fromMemberName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            {inv.fromInstitute}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 truncate">
                          Invited you to a synchronized <strong className="text-white font-mono-num">{inv.durationMins}m</strong> study session ({inv.subject || 'JEE Focus'}).
                          {inv.challengeEnabled && (
                            <span className="text-amber-300 font-bold ml-1">
                              ⚡ +{inv.challengeBonusXp} XP {inv.challengeTitle}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onAcceptStudyInvite && (
                        <button
                          type="button"
                          onClick={() => onAcceptStudyInvite(inv)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Accept &amp; Sync Timer</span>
                        </button>
                      )}
                      {onDeclineStudyInvite && (
                        <button
                          type="button"
                          onClick={() => onDeclineStudyInvite(inv.id)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-slate-400 hover:text-white text-xs font-bold cursor-pointer transition-all"
                        >
                          Decline
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ROW 1: WHO IS STUDYING TOGETHER + SHARED MASTER TIMER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 6 Cols: Select Who Is Studying Together (Online Squadmates Only) */}
            <div className="lg:col-span-6 p-4 rounded-2xl bg-zinc-950/90 border border-white/10 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>1. Online Squadmates &amp; Real-Time Sync</span>
                  </span>
                  <span className="text-[10px] font-mono-num text-slate-400 font-semibold">
                    {selectedIds.length} in Active Session
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  You can only invite squadmates who are currently <strong>online</strong>. Sending an invite gives them a prompt to accept and synchronize their timer with yours.
                </p>
              </div>

              {/* Scholar Cards with Live Online Presence Badges */}
              <div className="space-y-2 pt-1">
                {allMembers.map((m) => {
                  const isMe = currentMember?.id === m.id;
                  const isSelected = selectedIds.includes(m.id);
                  const isOnline = Boolean(isMe || m.isOnline || m.isGrinding);
                  const outgoingPending = pendingInvites.find(
                    inv =>
                      inv.fromMemberId === currentMember?.id &&
                      inv.targetMemberId === m.id &&
                      inv.status === 'pending'
                  );

                  return (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                        isMe
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-white'
                          : isSelected
                          ? 'bg-sky-500/15 border-sky-400/40 text-white'
                          : isOnline
                          ? 'bg-zinc-900/80 border-white/10 hover:border-white/20'
                          : 'bg-zinc-950/60 border-zinc-800/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            isMe
                              ? 'bg-emerald-400 text-slate-950'
                              : isSelected
                              ? 'bg-sky-400 text-slate-950'
                              : isOnline
                              ? 'bg-zinc-800 text-slate-300'
                              : 'bg-zinc-900 text-zinc-600'
                          }`}
                        >
                          {m.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">{m.name}</span>
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400">
                              {m.institute}
                            </span>
                            {isMe && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 font-bold">
                                You (Host)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {isOnline ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>{m.isGrinding ? `Studying ${m.grindingSubject || 'JEE'}` : 'Online in Arena'}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-500 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                <span>Offline (Cannot invite)</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isMe ? (
                          <span className="text-[10.5px] font-mono-num text-emerald-300 font-bold px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                            Host Lane
                          </span>
                        ) : isSelected ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-sky-300 px-2 py-1 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center gap-1">
                              <Check className="w-3 h-3 text-sky-400" />
                              <span>Synced</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleParticipant(m.id)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                              title="Remove from current session"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : outgoingPending ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-amber-300 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              <span>Request Sent...</span>
                            </span>
                            {onCancelStudyInvite && (
                              <button
                                type="button"
                                onClick={() => onCancelStudyInvite(outgoingPending.id)}
                                className="px-1.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-slate-300 hover:text-white cursor-pointer"
                                title="Cancel pending request"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ) : isOnline ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (onSendStudyInvite) {
                                await onSendStudyInvite(
                                  m.id,
                                  effectiveDurationMins,
                                  lanesByMember[currentMember?.id || '']?.subject || timerSubject || 'Physics',
                                  {
                                    challengeEnabled,
                                    challengeTitle: challengeTitle.trim() || 'Combined Study Challenge',
                                    challengeBonusXp
                                  }
                                );
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            title={`Send a study invitation to ${m.name}`}
                          >
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span>Send Request</span>
                          </button>
                        ) : (
                          <span
                            className="text-[10px] text-zinc-500 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800"
                            title="Cannot invite offline scholars"
                          >
                            Offline
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 6 Cols: Shared Master Stopwatch OR Quick Duration Input */}
            <div className="lg:col-span-6 p-4 rounded-2xl bg-zinc-950/90 border border-white/10 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>2. Shared Session Clock (Applies to All Selected)</span>
                </span>

                <div className="inline-flex p-0.5 rounded-xl bg-zinc-900 border border-white/10 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDurationMode('live_timer')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      durationMode === 'live_timer'
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Stopwatch
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationMode('manual_mins')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      durationMode === 'manual_mins'
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Enter Mins
                  </button>
                </div>
              </div>

              {durationMode === 'live_timer' ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div>
                    <div className="text-2xl sm:text-3xl font-black font-mono-num text-white tracking-tight">
                      {formatLiveHMS(timerSeconds)}
                    </div>
                    <div className="text-[10.5px] text-slate-400">
                      Settling logs <strong className="text-emerald-300 font-mono-num">{effectiveDurationMins}m</strong> (+{baseTimeXp} Base Time XP) for each scholar
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!timerRunning ? (
                      <button
                        type="button"
                        onClick={() => {
                          const startTs = getServerSyncedNow();
                          onStartOrResumeTimer();
                          broadcastP2PTimerControl('START', startTs);
                          onUpdateRoomState({
                            active: true,
                            sharedBlockStartedAt: startTs,
                            sharedTimerStatus: 'RUNNING',
                            selectedMemberIds: selectedIds
                          }).catch(() => {});
                        }}
                        className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{timerSeconds > 0 ? 'Resume Shared Timer' : 'Start Shared Timer'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onPauseTimer();
                          broadcastP2PTimerControl('PAUSE');
                          onUpdateRoomState({
                            sharedTimerStatus: 'PAUSED',
                            sharedAccumulatedSeconds: timerSeconds
                          }).catch(() => {});
                        }}
                        className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause</span>
                      </button>
                    )}

                    {timerSeconds > 0 && onResetTimer && (
                      <button
                        type="button"
                        onClick={() => {
                          onResetTimer();
                          broadcastP2PTimerControl('RESET');
                          onUpdateRoomState({
                            sharedBlockStartedAt: null,
                            sharedTimerStatus: 'IDLE',
                            sharedAccumulatedSeconds: 0,
                            selectedMemberIds: []
                          }).catch(() => {});
                        }}
                        className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-rose-500/20 border border-white/10 hover:border-rose-400/40 text-slate-300 hover:text-rose-200 cursor-pointer"
                        title="Reset Shared Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={manualDurationInput}
                      onChange={(e) => setManualDurationInput(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl bg-zinc-900 border border-sky-400/40 text-white font-mono-num font-black text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-300 font-semibold">
                      shared minutes (+{baseTimeXp} Time XP each)
                    </span>
                    <div className="flex flex-wrap gap-1 ml-auto">
                      {[30, 45, 60, 90, 120].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setManualDurationInput(String(m))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-num font-bold border cursor-pointer ${
                            Number(manualDurationInput) === m
                              ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                              : 'bg-zinc-900 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ROW 1.5: NEARBY P2P & INSTANT PAIRING HUB (QR "SCAN TO GRIND TOGETHER" • WEBRTC P2P • WEB BLUETOOTH) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-indigo-500/10 border border-emerald-400/35 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/45 flex items-center justify-center text-emerald-300">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-extrabold text-white font-display">
                      Nearby Device Pairing: Scan to Grind Together • WebRTC P2P • Bluetooth
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border flex items-center gap-1 ${
                        webrtcStatus === 'connected'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : webrtcStatus === 'connecting'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          webrtcStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-sky-400'
                        }`}
                      />
                      <span>
                        {webrtcStatus === 'connected'
                          ? `P2P Linked${webrtcPeerName ? ` (${webrtcPeerName})` : ''}${
                              webrtcLatencyMs ? ` • ${webrtcLatencyMs}ms` : ''
                            }`
                          : webrtcStatus === 'connecting'
                          ? 'Negotiating P2P...'
                          : 'Zero-Lag P2P Ready'}
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Two phones nearby? Scan the QR code, connect directly via WebRTC Peer-to-Peer, or discover nearby phones via Web Bluetooth.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {(['qr', 'webrtc', 'bluetooth'] as const).map((tabId) => (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => {
                      setProximityTab(tabId);
                      setShowProximityHub(true);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border cursor-pointer flex items-center gap-1 transition-all ${
                      showProximityHub && proximityTab === tabId
                        ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-sm'
                        : 'bg-zinc-900/90 text-slate-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {tabId === 'qr' && <QrCode className="w-3.5 h-3.5" />}
                    {tabId === 'webrtc' && <Wifi className="w-3.5 h-3.5" />}
                    {tabId === 'bluetooth' && <Bluetooth className="w-3.5 h-3.5" />}
                    <span>
                      {tabId === 'qr' ? 'QR Pair' : tabId === 'webrtc' ? 'WebRTC P2P' : 'Bluetooth'}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowProximityHub(prev => !prev)}
                  className="px-2 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[10px] font-bold text-slate-300 cursor-pointer"
                >
                  {showProximityHub ? 'Hide' : 'Expand'}
                </button>
              </div>
            </div>

            {showProximityHub && (
              <div className="pt-1">
                {proximityTab === 'qr' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-black/50 p-3.5 rounded-2xl border border-white/10">
                    {/* Left: Scannable QR Code Matrix */}
                    <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-950 border border-emerald-400/30 space-y-2">
                      <div className="p-2 rounded-xl bg-[#070B14] border border-emerald-400/40 shadow-[0_0_25px_rgba(16,185,129,0.18)]">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=070B14&color=34d399&margin=4&data=${encodeURIComponent(
                            qrPairingUrl
                          )}`}
                          alt="Scan to Grind Together QR"
                          className="w-36 h-36 rounded-lg object-contain"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                          Room Pairing Code
                        </div>
                        <div className="text-base font-black font-mono-num text-emerald-300 tracking-wider">
                          {activePairingCode}
                        </div>
                      </div>
                    </div>

                    {/* Right: Scan Friend's QR or Enter 6-Digit Room Code */}
                    <div className="md:col-span-8 space-y-3">
                      <div className="space-y-1">
                        <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-emerald-400" />
                          <span>Scan to Grind Together (Instant Dual-Phone Lock-In)</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Hold your friend&apos;s phone camera over this QR code or scan theirs below. Both stopwatches and Pomodoro blocks immediately lock to the exact same hardware millisecond.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!isScanningCameraQr ? (
                          <button
                            type="button"
                            onClick={startQrCameraScanner}
                            className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Scan Friend&apos;s QR with Camera</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopQrCameraScanner}
                            className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Close Camera Scanner</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(qrPairingUrl).catch(() => {});
                            setCopiedQrLink(true);
                            setTimeout(() => setCopiedQrLink(false), 2500);
                          }}
                          className="px-3 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-sky-400" />
                          <span>{copiedQrLink ? 'Copied Instant-Pair Link!' : 'Copy Pair Link'}</span>
                        </button>

                        {typeof navigator !== 'undefined' && (navigator as any).share && (
                          <button
                            type="button"
                            onClick={() => {
                              (navigator as any)
                                .share({
                                  title: 'Join My JEE Grind Arena Study Room',
                                  text: `Scan or tap to sync our study timers live (Code: ${activePairingCode})`,
                                  url: qrPairingUrl
                                })
                                .catch(() => {});
                            }}
                            className="px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-bold text-sky-200 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-sky-300" />
                            <span>Share via AirDrop / Nearby</span>
                          </button>
                        )}
                      </div>

                      {isScanningCameraQr && (
                        <div className="p-2.5 rounded-xl bg-zinc-950 border border-emerald-400/40 space-y-2">
                          <video
                            ref={videoScanRef}
                            className="w-full max-h-44 rounded-lg bg-black object-cover"
                            playsInline
                            muted
                          />
                          <div className="text-[10.5px] text-emerald-300 font-semibold text-center">
                            Point camera at your squadmate&apos;s QR code to auto-sync...
                          </div>
                        </div>
                      )}

                      {cameraScanError && (
                        <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/30 px-3 py-1.5 rounded-xl">
                          {cameraScanError}
                        </div>
                      )}

                      {/* Manual 6-Digit Room Code Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={pairingCodeInput}
                          onChange={(e) => setPairingCodeInput(e.target.value)}
                          placeholder="Or enter friend's 6-digit Room Code (e.g. SAI-482)..."
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-xs text-white font-mono-num focus:outline-none focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleJoinByCodeOrQrPayload(pairingCodeInput)}
                          className="px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-xs cursor-pointer shrink-0"
                        >
                          Sync Now
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {proximityTab === 'webrtc' && (
                  <div className="p-4 rounded-2xl bg-black/50 border border-sky-400/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <Radio className="w-4 h-4 text-sky-400" />
                          <span>WebRTC Peer-to-Peer Direct DataChannel (Sub-10ms Local Wi-Fi Sync)</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Establishes a direct encrypted RTCPeerConnection + RTCDataChannel between your phones/laptops so Start, Pause, and Reset fire simultaneously without cloud lag.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => initWebRTCPeer(true)}
                        className="px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
                      >
                        <Wifi className="w-3.5 h-3.5" />
                        <span>
                          {webrtcStatus === 'connected'
                            ? 'Reconnect P2P Channel'
                            : webrtcStatus === 'connecting'
                            ? 'Connecting Peers...'
                            : 'Establish P2P Direct Link'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/10">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">DataChannel State</div>
                        <div className="font-mono-num font-extrabold text-emerald-300 mt-0.5 uppercase">
                          {webrtcStatus}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/10">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Connected Peer</div>
                        <div className="font-extrabold text-white mt-0.5">
                          {webrtcPeerName || 'Waiting for peer handshake...'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/10">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Round-Trip Latency</div>
                        <div className="font-mono-num font-extrabold text-sky-300 mt-0.5">
                          {webrtcLatencyMs !== null ? `${webrtcLatencyMs} ms (Direct P2P)` : '< 15 ms (SSE + P2P)'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {proximityTab === 'bluetooth' && (
                  <div className="p-4 rounded-2xl bg-black/50 border border-indigo-400/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <Bluetooth className="w-4 h-4 text-indigo-400" />
                          <span>Web Bluetooth Proximity Discovery (Physical Room Verification)</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Sitting at the same library table or coaching bench? Scan for your study partner&apos;s device over Bluetooth LE to pair and lock timers together.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleScanWebBluetoothNearby}
                        className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
                      >
                        <Bluetooth className="w-3.5 h-3.5" />
                        <span>
                          {btStatus === 'scanning'
                            ? 'Scanning Bluetooth...'
                            : btStatus === 'connected'
                            ? `Paired: ${btDeviceName}`
                            : 'Scan Nearby Bluetooth Devices'}
                        </span>
                      </button>
                    </div>

                    {btStatusMessage && (
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-indigo-400/30 text-xs text-indigo-200 flex items-center justify-between">
                        <span>{btStatusMessage}</span>
                        {btDeviceName && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono-num text-[10px] font-bold">
                            BLE Verified
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ROW 2: THROW A SESSION CHALLENGE (ANYTIME DUEL / QUESTION BLITZ FOR BONUS XP) */}
          <div
            className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
              challengeEnabled
                ? 'bg-gradient-to-r from-amber-500/12 via-yellow-500/8 to-zinc-950 border-amber-400/40'
                : 'bg-zinc-950/70 border-white/10'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/45 flex items-center justify-center text-amber-300">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-white font-display">
                      3. Throw a Live Session Challenge (Winner Gets Bonus XP!)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase">
                      {challengeWagerMode
                        ? `${challengeBonusXp * Math.max(1, participantStandings.length)} XP Pot`
                        : `+${challengeBonusXp} XP Winner Bonus`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Even if you study different subjects, compete on questions solved, question XP, accuracy, or a custom dare!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !challengeEnabled;
                  setChallengeEnabled(next);
                  onUpdateRoomState({ challengeEnabled: next }).catch(() => {});
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                  challengeEnabled
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                    : 'bg-zinc-900 text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {challengeEnabled ? '⚡ Challenge Active' : 'Enable Challenge'}
              </button>
            </div>

            {challengeEnabled && (
              <div className="space-y-3 pt-1">
                {/* Challenge Rule Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {CHALLENGE_PRESETS.map((preset) => {
                    const active = challengeRule === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setChallengeRule(preset.id);
                          setChallengeTitle(preset.defaultTitle);
                          onUpdateRoomState({
                            challengeRule: preset.id,
                            challengeTitle: preset.defaultTitle
                          }).catch(() => {});
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          active
                            ? 'bg-amber-400/20 border-amber-400 text-white shadow-sm'
                            : 'bg-black/45 hover:bg-black/65 border-white/10 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-extrabold text-white">{preset.label}</div>
                        <div className="text-[10px] text-slate-300 leading-snug mt-1">{preset.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Challenge Stake / Bonus XP & Custom Title Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center pt-1">
                  <div className="lg:col-span-5 flex items-center gap-2">
                    <input
                      type="text"
                      value={challengeTitle}
                      onChange={(e) => setChallengeTitle(e.target.value)}
                      placeholder="Challenge name (e.g. 20 PYQ Sprint, Integration vs Mechanics)..."
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="lg:col-span-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mr-1">
                      Winner Reward:
                    </span>
                    {[30, 50, 75, 100].map((xpVal) => (
                      <button
                        key={xpVal}
                        type="button"
                        onClick={() => {
                          setChallengeBonusXp(xpVal);
                          onUpdateRoomState({ challengeBonusXp: xpVal }).catch(() => {});
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-num font-extrabold border cursor-pointer ${
                          challengeBonusXp === xpVal
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-black/50 border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        +{xpVal} XP
                      </button>
                    ))}
                  </div>

                  <div className="lg:col-span-3 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setChallengeWagerMode(false)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold border cursor-pointer ${
                        !challengeWagerMode
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-black/40 border-white/10 text-slate-400'
                      }`}
                      title="Winner receives bonus XP from the Arena without deducting from the partner"
                    >
                      🎁 Bonus XP
                    </button>
                    <button
                      type="button"
                      onClick={() => setChallengeWagerMode(true)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold border cursor-pointer ${
                        challengeWagerMode
                          ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                          : 'bg-black/40 border-white/10 text-slate-400'
                      }`}
                      title="Each scholar stakes XP; the winner takes the rival's wager!"
                    >
                      ⚔️ Wager XP
                    </button>
                  </div>
                </div>

                {/* Live Challenge Winner Banner or Manual Winner Selector */}
                <div className="p-2.5 px-3.5 rounded-xl bg-black/60 border border-amber-400/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {challengeRule === 'manual' ? (
                    <div className="flex flex-wrap items-center gap-2 w-full justify-between">
                      <span className="text-amber-200 font-bold flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>Crown Challenge Winner:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {participantStandings.map((p) => (
                          <button
                            key={p.member.id}
                            type="button"
                            onClick={() => setManualWinnerId(p.member.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-extrabold border cursor-pointer ${
                              manualWinnerId === p.member.id
                                ? 'bg-amber-400 text-slate-950 border-amber-300'
                                : 'bg-zinc-900 border-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            👑 {p.member.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : computedWinner ? (
                    <>
                      <span className="text-amber-200 font-bold flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>
                          Current Challenge Leader: <strong className="text-white">{computedWinner.member.name}</strong> ({computedWinner.solved} Solved • +{computedWinner.qXp} Q-XP • {computedWinner.solveRate}% Acc)
                        </span>
                      </span>
                      <span className="font-mono-num font-black text-emerald-300">
                        Wins +{challengeWagerMode ? challengeBonusXp * (participantStandings.length - 1) : challengeBonusXp} XP Challenge Bonus!
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-300">
                      Enter solved questions in the scholar cards below to automatically crown the <strong className="text-amber-300">{challengeTitle}</strong> winner!
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ROW 3: PER-SCHOLAR INDIVIDUAL SUBJECT, QUESTIONS & DIFFICULTY LANES */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>
                  4. Individual Scholar Desks ({participantStandings.length} Studying on Shared {effectiveDurationMins}m Timer)
                </span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Each scholar can pick a different subject, difficulty tier, and question count
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participantStandings.map((item) => {
                const { member, lane, solved, attempted, totalQs, solveRate, qXp, sessionXpBeforeChallenge } = item;
                const isWinner = Boolean(computedWinner && computedWinner.member.id === member.id);
                const challengeDelta =
                  challengeEnabled && participantStandings.length >= 2 && computedWinner
                    ? isWinner
                      ? challengeWagerMode
                        ? challengeBonusXp * (participantStandings.length - 1)
                        : challengeBonusXp
                      : challengeWagerMode
                      ? -challengeBonusXp
                      : 0
                    : 0;
                const finalProjectedXp = Math.max(0, sessionXpBeforeChallenge + challengeDelta);

                return (
                  <div
                    key={member.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
                      isWinner
                        ? 'bg-gradient-to-b from-amber-500/12 via-zinc-950 to-zinc-950 border-amber-400/60 shadow-[0_0_25px_rgba(251,191,36,0.12)]'
                        : 'bg-zinc-950/95 border-white/12'
                    }`}
                  >
                    {/* Scholar Card Header */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-10 h-10 rounded-xl font-black font-display text-sm flex items-center justify-center ${
                            isWinner
                              ? 'bg-amber-400 text-slate-950 shadow-md'
                              : 'bg-sky-500/20 border border-sky-400/40 text-sky-200'
                          }`}
                        >
                          {isWinner ? <Crown className="w-5 h-5 stroke-[2.5]" /> : member.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm sm:text-base font-extrabold text-white font-display">
                              {member.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.07] text-slate-300 font-semibold">
                              {member.institute}
                            </span>
                            {isWinner && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9.5px] font-black uppercase tracking-wider">
                                👑 Challenge Leader
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-slate-400 font-mono-num">
                            Shared Time: {effectiveDurationMins}m (+{baseTimeXp} XP) • Qs: +{qXp} XP
                            {challengeDelta !== 0 && (
                              <span className={challengeDelta > 0 ? 'text-amber-300 font-bold' : 'text-rose-400 font-bold'}>
                                {' '}
                                • Challenge: {challengeDelta > 0 ? `+${challengeDelta}` : challengeDelta} XP
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-lg sm:text-xl font-black font-mono-num text-emerald-400">
                          +{finalProjectedXp} XP
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                          Total Yield
                        </div>
                      </div>
                    </div>

                    {/* Subject Selector for this Scholar */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {member.name}&apos;s Subject
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {subjectOptions.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => updateLane(member.id, { subject: sub.id })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              lane.subject === sub.id
                                ? 'bg-sky-400 text-slate-950 shadow-sm'
                                : 'bg-zinc-900 text-slate-400 border border-zinc-800 hover:text-white'
                            }`}
                          >
                            {sub.short || sub.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Difficulty Selector for this Scholar */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Question Difficulty Tier
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {DIFFICULTY_META.map((tier) => {
                          const active = lane.difficulty === tier.id;
                          return (
                            <button
                              key={tier.id}
                              type="button"
                              onClick={() => updateLane(member.id, { difficulty: tier.id })}
                              className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer truncate ${
                                active
                                  ? tier.badgeClass
                                  : 'bg-zinc-900 border-zinc-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {tier.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Solved vs Attempted Question Counters */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Solved Box */}
                      <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-emerald-500/25 space-y-1.5">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="font-bold text-emerald-400">✅ Solved Qs</span>
                          <span className="font-mono-num text-slate-400 text-[9.5px]">
                            +{DIFFICULTY_META.find(d => d.id === lane.difficulty)?.solvedMult}x XP
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateLane(member.id, {
                                solvedQuestions: solved > 1 ? String(solved - 1) : ''
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={lane.solvedQuestions}
                            onChange={(e) =>
                              updateLane(member.id, {
                                solvedQuestions: e.target.value.replace(/[^0-9]/g, '')
                              })
                            }
                            className="w-full text-center py-1 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono-num font-bold text-sm focus:outline-none focus:border-emerald-400"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateLane(member.id, {
                                solvedQuestions: String(solved + 1)
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-bold text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          {[5, 10, 15].map((inc) => (
                            <button
                              key={inc}
                              type="button"
                              onClick={() =>
                                updateLane(member.id, {
                                  solvedQuestions: String(solved + inc)
                                })
                              }
                              className="flex-1 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono-num text-slate-300 cursor-pointer"
                            >
                              +{inc}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Attempted Box */}
                      <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-amber-500/25 space-y-1.5">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="font-bold text-amber-400">🧠 Attempted</span>
                          <span className="font-mono-num text-slate-400 text-[9.5px]">
                            +{DIFFICULTY_META.find(d => d.id === lane.difficulty)?.attemptMult}x XP
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateLane(member.id, {
                                attemptedQuestions: attempted > 1 ? String(attempted - 1) : ''
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={lane.attemptedQuestions}
                            onChange={(e) =>
                              updateLane(member.id, {
                                attemptedQuestions: e.target.value.replace(/[^0-9]/g, '')
                              })
                            }
                            className="w-full text-center py-1 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono-num font-bold text-sm focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateLane(member.id, {
                                attemptedQuestions: String(attempted + 1)
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-bold text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 font-mono-num">
                          <span>Total: {totalQs} Qs</span>
                          <span className="text-sky-300 font-bold">{solveRate}% Acc</span>
                        </div>
                      </div>
                    </div>

                    {/* Topic / Chapter Note for this Scholar */}
                    <input
                      type="text"
                      value={lane.notes}
                      onChange={(e) => updateLane(member.id, { notes: e.target.value })}
                      placeholder={`${member.name}'s topic / chapter (e.g. Cengage ${lane.subject} Ex 2)...`}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-zinc-800 text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOTTOM ACTION BAR: ONE-CLICK SETTLE & LOG COMBINED SESSION FOR ALL SELECTED SCHOLARS */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-sky-500/15 to-amber-500/15 border border-emerald-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-white flex flex-wrap items-center gap-2">
                <span>
                  Ready to Log for {participantStandings.map(p => p.member.name).join(' & ')} ({effectiveDurationMins}m Shared Timer)
                </span>
                {computedWinner && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                    👑 {computedWinner.member.name} Wins Challenge (+{challengeWagerMode ? challengeBonusXp * (participantStandings.length - 1) : challengeBonusXp} XP)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                Saves individual study logs with each scholar&apos;s own subject &amp; questions, deals combined Raid Boss damage, and settles the challenge XP!
              </p>
            </div>

            <button
              type="button"
              disabled={isSubmittingCombined || participantStandings.length === 0}
              onClick={handleSettleAndLogAll}
              className={`px-5 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 shrink-0 transition-all ${
                isSubmittingCombined ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-98'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.8]" />
              <span>
                {isSubmittingCombined
                  ? 'Logging Combined Session...'
                  : `Settle & Log Together (${participantStandings.length} Scholars)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
