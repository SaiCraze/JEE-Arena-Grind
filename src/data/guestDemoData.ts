import { CYCLE_4_START_MS, CYCLE_5_START_MS } from '../services/blackoutService';

export interface GuestGuideStep {
  id: string;
  title: string;
  sectionLabel: string;
  summary: string;
  howItWorks: string[];
  tryItActions: string[];
  target: {
    tab?: 'arena' | 'timer' | 'tasks' | 'tuition' | 'stats';
    action?: 'open_log' | 'open_exam' | 'open_warfare' | 'open_chat' | 'open_lounge';
    ctaLabel: string;
  };
}

export const GUEST_GUIDE_STEPS: GuestGuideStep[] = [
  {
    id: 'standings_xp',
    title: 'Live Standings & Normalized XP Engine',
    sectionLabel: 'Arena Overview',
    summary:
      'Compete fairly across different coaching institutes using study hours, difficulty-weighted problems, streaks, and percentile-normalized mock scores.',
    howItWorks: [
      'Weekly Sprint cycles reset active leaderboard XP so every scholar gets a fresh shot at #1 each week.',
      'Streaks boost earned XP by +5% (3d), +10% (5d), and +15% (7d+), while Rest Tokens protect active streaks.',
      'Underdog buffs (+25% XP) help trailing scholars catch up dynamically when more than 150 XP behind the leader.'
    ],
    tryItActions: [
      'Switch leaderboard scopes between Current Sprint, Past Sprints, and All-Time Career.',
      'Tap any demo scholar card to open their 360-degree Dossier & Badge Progress.'
    ],
    target: {
      tab: 'arena',
      ctaLabel: 'Explore Standings'
    }
  },
  {
    id: 'focus_timer',
    title: 'Hardware Focus Timer & Study Lounge',
    sectionLabel: 'Focus Timer',
    summary:
      'Millisecond-accurate desk stopwatch that survives refreshes and lock screens, plus a shared Combined Study Room for squad blocks.',
    howItWorks: [
      'Start, pause, lap, and link any active study goal directly on the desk timer without losing banked seconds.',
      'Completed study blocks feed straight into the Session Logger with duration and subject pre-filled.',
      'Study Lounge lets scholars synchronize 50-minute focus sprints and challenge each other side-by-side.'
    ],
    tryItActions: [
      'Press Start on the stopwatch, record a split lap, or open Study Together.',
      'Try finishing a timed block to see how it pre-populates the Session Logger.'
    ],
    target: {
      tab: 'timer',
      ctaLabel: 'Open Focus Timer'
    }
  },
  {
    id: 'session_logger',
    title: 'Session & Difficulty-Weighted Problem Logger',
    sectionLabel: 'Session Logger',
    summary:
      'Log study sessions by time range or duration and score questions across Easy, Mains, Hard, and JEE Advanced tiers.',
    howItWorks: [
      'Multi-tier logging awards higher XP per solved and attempted problem on Hard (1.8x) and JEE Advanced (2.5x) sets.',
      'Every logged minute deals 1 DMG and every solved question deals 3 DMG directly to the Weekly Co-op Raid Boss.',
      'Logging 90+ minute study blocks unlocks a Mystery Supply Vault crate with tactical perks.'
    ],
    tryItActions: [
      'Log a sample 90-minute Physics session in this sandbox to trigger XP celebration and a Vault crate drop.'
    ],
    target: {
      action: 'open_log',
      ctaLabel: 'Try Session Logger'
    }
  },
  {
    id: 'mock_exams',
    title: 'Cohort-Normalized Mock Exam Tracker',
    sectionLabel: 'Mock Exam %ile Engine',
    summary:
      'Compare ranks fairly across small and huge coaching batches by converting raw rank and batch size into standardized percentile.',
    howItWorks: [
      'Percentile formula: (1 - (Rank - 1) / TotalStudents) x 100 across overall score and Physics, Chemistry, Math splits.',
      'A #18 rank out of 380 students in one institute compares apples-to-apples with #85 out of 1,850 in another.',
      'Built-in safeguards reject accidental typos where Batch Total is smaller than Rank.'
    ],
    tryItActions: [
      'Log a mock exam for your demo scholar to watch standings and subject percentiles recalculate immediately.'
    ],
    target: {
      action: 'open_exam',
      ctaLabel: 'Try Mock Exam Logger'
    }
  },
  {
    id: 'deep_analytics',
    title: 'Deep Analytics & Multi-Scholar Comparison',
    sectionLabel: 'Analytics Suite',
    summary:
      'Inspect multi-test percentile trajectories, subject solve accuracy, daily consistency heatmaps, and head-to-head radar comparisons.',
    howItWorks: [
      'Longitudinal mock charts track net percentile shifts alongside Physics, Chemistry, and Math stability.',
      '360-degree diagnostics highlight strongest and weakest subjects from real study logs and mock tests.',
      'Multi-Scholar Comparison overlays pace, accuracy, and XP distribution across selected peers.'
    ],
    tryItActions: [
      'Open Analytics to compare demo scholars side-by-side and generate a local diagnostic summary.'
    ],
    target: {
      tab: 'stats',
      ctaLabel: 'View Deep Analytics'
    }
  },
  {
    id: 'tasks_homework',
    title: 'Targets, Bounties & Tuition Homework Hub',
    sectionLabel: 'Targets & Tuition',
    summary:
      'Track personal chapter checklists, squad targets, and faculty homework deadlines with proof uploads and grading workflows.',
    howItWorks: [
      'Add personal study targets and link them right inside the Session Logger as you finish chapters.',
      'Tuition Faculty Hub organizes subject assignments, reference sheets, teacher notes, and grading status.',
      'Pending, submitted, and graded filters keep every scholar clear on upcoming deadlines.'
    ],
    tryItActions: [
      'Create a sample personal task in Targets or inspect how faculty assignments look in Tuition Hub.'
    ],
    target: {
      tab: 'tasks',
      ctaLabel: 'Open Targets & Tasks'
    }
  },
  {
    id: 'warfare_raid',
    title: 'Co-op Raid Boss & Social Warfare Hub',
    sectionLabel: 'Raid & Warfare',
    summary:
      'Team up to defeat the Weekly Raid Boss before deadline or spend earned sprint XP on tactical 1v1 duels, audits, and shields.',
    howItWorks: [
      'Co-op Raid Boss unites the squad: every logged study block chips away at shared Boss HP.',
      'Issue 1v1 Quickdraw Duels with escrow wagers, challenge sessions via Audit Badges, or activate a 24h Bounty Shield.',
      'Robin Hood Ambushes reward lower-ranked scholars who out-study the current #1 leader on a given day.'
    ],
    tryItActions: [
      'Inspect live Quickdraw Duels and Co-op Raid HP status inside the Warfare Hub.'
    ],
    target: {
      action: 'open_warfare',
      ctaLabel: 'Open Warfare Hub'
    }
  },
  {
    id: 'squad_chat',
    title: 'Squad Chat & Peer Doubt Bounties',
    sectionLabel: 'Squad Comms',
    summary:
      'Dedicated channels for general prep updates (#general), tactical callouts (#warfare), and handwritten peer doubt solving (#doubts).',
    howItWorks: [
      'Post a tricky Physics, Chemistry, or Math doubt with a +1 to +10 XP peer bounty attached.',
      'Squadmates post organic explanations or notebook steps, and accepting a solution transfers the XP bounty.',
      'Channel tags, pinned messages, reactions, and direct messages keep prep focused in one place.'
    ],
    tryItActions: [
      'Open Squad Chat, browse the #doubts thread, or post a sample message in the sandbox.'
    ],
    target: {
      action: 'open_chat',
      ctaLabel: 'Open Squad Chat'
    }
  }
];

export interface GuestDemoState {
  seed: number;
  activeDemoMemberId: string;
  members: any[];
  sessions: any[];
  exams: any[];
  tasks: any[];
  teachers: any[];
  teacherAssignments: any[];
  teacherNotes: any[];
  announcements: any[];
  activities: any[];
  messages: any[];
  arenaSettings: any;
}

function createRng(seedInput: number) {
  let s = (Math.abs(Math.floor(seedInput)) || 1) % 2147483647;
  if (s <= 0) s = 42197;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcDemoPercentile(rank: number, total: number): number {
  if (total <= 1) return 100;
  return Number(Math.max(0, Math.min(100, (1 - (rank - 1) / total) * 100)).toFixed(2));
}

const DEMO_SCHOLAR_TEMPLATES = [
  { id: 'demo_aarav', name: 'Aarav', institute: 'Apex Academy', title: 'Mechanics Ace' },
  { id: 'demo_diya', name: 'Diya', institute: 'Horizon Coaching', title: 'Thermo Tactician' },
  { id: 'demo_rohan', name: 'Rohan', institute: 'Vector Institute', title: 'Calculus Sprinter' },
  { id: 'demo_meera', name: 'Meera', institute: 'Apex Academy', title: 'Organic Specialist' },
  { id: 'demo_kabir', name: 'Kabir', institute: 'Zenith Prep', title: 'Irodov Grinder' }
];

const SUBJECT_TOPICS: Record<'Physics' | 'Chemistry' | 'Math', string[]> = {
  Physics: [
    'Rotational Dynamics PYQs',
    'Electrostatics Gauss Law drills',
    'Ray Optics & Prism derivations',
    'Current Electricity RC circuits',
    'Wave Optics & YDSE revision'
  ],
  Chemistry: [
    'Aldehydes & Ketones mechanisms',
    'Chemical Equilibrium numericals',
    'Coordination Compounds isomerism',
    'Electrochemistry Nernst practice',
    'Chemical Bonding & VSEPR drill'
  ],
  Math: [
    'Definite Integration properties',
    'Conic Sections tangent sheets',
    'Matrices & Determinants PYQs',
    'Complex Numbers geometry problems',
    'Probability & Bayes theorem sets'
  ]
};

export function createGuestDemoWorkspace(customSeed?: number): GuestDemoState {
  const seed = customSeed ?? Math.floor(Date.now() % 1000000) + Math.floor(Math.random() * 997);
  const rand = createRng(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

  const now = Date.now();
  const safeCycleStart = Math.max(CYCLE_5_START_MS + 3600 * 1000, now - 4 * 86400 * 1000);
  const cycleSpan = Math.max(6 * 3600 * 1000, now - safeCycleStart);

  // Pick one random scholar currently live studying on desk timer
  const liveGrinderIndex = randInt(1, DEMO_SCHOLAR_TEMPLATES.length - 1);
  const liveSubject = pick(['Physics', 'Chemistry', 'Math'] as const);
  const todayStr = toDateKey(now);

  const members = DEMO_SCHOLAR_TEMPLATES.map((tpl, idx) => {
    const isLive = idx === liveGrinderIndex;
    const streakCount = randInt(3, 11);
    const activeDelayMins = isLive ? randInt(12, 48) : randInt(20, 420);
    return {
      id: tpl.id,
      name: tpl.name,
      institute: tpl.institute,
      passcode: String(1100 + idx * 111),
      bonusXp: randInt(0, 25),
      manualMinutesOffset: 0,
      cycle4BonusXp: randInt(0, 30),
      cycle4ManualMinutesOffset: 0,
      cycle5BonusXp: randInt(0, 25),
      cycle5ManualMinutesOffset: 0,
      isGrinding: isLive,
      grindingSubject: isLive ? liveSubject : '',
      grindingStartedAt: isLive ? now - activeDelayMins * 60 * 1000 : null,
      grindingAccumulatedSeconds: 0,
      grindingLinkedTaskId: '',
      grindingUpdatedAt: isLive ? now - activeDelayMins * 60 * 1000 : now - activeDelayMins * 60 * 1000,
      unexcusedZero: false,
      unexcusedReason: '',
      unexcusedAt: null,
      streakCount,
      lastLoginDate: todayStr,
      restTokens: randInt(1, 2),
      equippedTitle: tpl.title,
      approvalStatus: 'approved' as const,
      lastActiveAt: isLive ? now - 15000 : now - activeDelayMins * 60 * 1000,
      doubtsResolvedCount: randInt(1, 4),
      doubtXpEarned: randInt(5, 22),
      isArchived: false
    };
  });

  const sessions: any[] = [];
  const diffWeights: Record<string, { solved: number; att: number }> = {
    easy: { solved: 0.8, att: 0.35 },
    mains: { solved: 1.2, att: 0.5 },
    hard: { solved: 1.8, att: 0.8 },
    adv: { solved: 2.5, att: 1.1 }
  };

  // Generate 5 to 6 varied sessions per demo scholar across Cycle 5 (including today) & Cycle 4
  members.forEach((m, mIdx) => {
    const countThisCycle = randInt(4, 6);
    for (let i = 0; i < countThisCycle; i++) {
      const subj = (['Physics', 'Chemistry', 'Math'] as const)[(mIdx + i) % 3];
      const diff = pick(['easy', 'mains', 'hard', 'adv'] as const);
      const duration = randInt(45, 135);
      const solved = randInt(14, 42);
      const attempted = randInt(2, 10);
      const w = diffWeights[diff];
      const baseTimeXp = Math.round(duration * 0.45);
      const qXp = Math.round(solved * w.solved + attempted * w.att);
      const xpEarned = Math.max(15, baseTimeXp + qXp);

      // Ensure index 0 is today so Today stats are populated cleanly
      const ts =
        i === 0
          ? now - randInt(45, 240) * 60 * 1000
          : Math.round(safeCycleStart + rand() * (cycleSpan - 3 * 3600 * 1000));
      const dStr = i === 0 ? todayStr : toDateKey(ts);
      const topic = pick(SUBJECT_TOPICS[subj]);

      sessions.push({
        id: `demo_sess_${seed}_${m.id}_c5_${i}`,
        memberId: m.id,
        memberName: m.name,
        sessionType: 'STUDY',
        inputMethod: 'DURATION_ONLY',
        subject: subj,
        date: dStr,
        duration,
        questions: solved + attempted,
        solvedQuestions: solved,
        attemptedQuestions: attempted,
        solveRate: Math.round((solved / Math.max(1, solved + attempted)) * 100),
        difficulty: diff,
        difficultyBreakdown: { [diff]: solved },
        attemptedBreakdown: { [diff]: attempted },
        questionXp: qXp,
        linkedTaskIds: [],
        tasksBonusXp: 0,
        notes: topic,
        xpEarned,
        timestamp: ts
      });
    }

    // Add 2 historical Cycle 4 sessions for longitudinal comparison & lifetime totals
    for (let h = 0; h < 2; h++) {
      const subj = pick(['Physics', 'Chemistry', 'Math'] as const);
      const diff = pick(['mains', 'hard'] as const);
      const duration = randInt(60, 120);
      const solved = randInt(18, 36);
      const attempted = randInt(3, 8);
      const xpEarned = Math.round(duration * 0.45 + solved * diffWeights[diff].solved);
      const ts = CYCLE_4_START_MS + randInt(1, 5) * 86400 * 1000;
      sessions.push({
        id: `demo_sess_${seed}_${m.id}_c4_${h}`,
        memberId: m.id,
        memberName: m.name,
        sessionType: 'STUDY',
        inputMethod: 'DURATION_ONLY',
        subject: subj,
        date: toDateKey(ts),
        duration,
        questions: solved + attempted,
        solvedQuestions: solved,
        attemptedQuestions: attempted,
        solveRate: Math.round((solved / Math.max(1, solved + attempted)) * 100),
        difficulty: diff,
        difficultyBreakdown: { [diff]: solved },
        attemptedBreakdown: { [diff]: attempted },
        questionXp: Math.round(solved * diffWeights[diff].solved),
        linkedTaskIds: [],
        tasksBonusXp: 0,
        notes: `${pick(SUBJECT_TOPICS[subj])} (Previous Sprint)`,
        xpEarned,
        timestamp: ts
      });
    }
  });

  sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Generate 10 randomized mock exams (2 per scholar, different batch sizes)
  const exams: any[] = [];
  members.forEach((m, idx) => {
    const batchSizeA = m.institute === 'Apex Academy' ? 480 : m.institute === 'Horizon Coaching' ? 1420 : 860;
    const rankA = randInt(Math.max(8, Math.round(batchSizeA * 0.04)), Math.round(batchSizeA * 0.24));
    const pctA = calcDemoPercentile(rankA, batchSizeA);
    const marksA = randInt(168, 246);
    const tsA = Math.round(safeCycleStart + rand() * (cycleSpan * 0.8));

    const subjSplitA = (['Physics', 'Chemistry', 'Math'] as const).map((sName) => {
      const sRank = Math.max(1, Math.min(batchSizeA, rankA + randInt(-Math.round(batchSizeA * 0.04), Math.round(batchSizeA * 0.05))));
      return {
        name: sName,
        marks: randInt(48, 86),
        maxMarks: 100,
        rank: sRank,
        percentile: calcDemoPercentile(sRank, batchSizeA)
      };
    });

    exams.push({
      id: `demo_exam_${seed}_${m.id}_1`,
      memberId: m.id,
      memberName: m.name,
      institute: m.institute,
      examType: idx % 2 === 0 ? 'JEE Mains' : 'Custom Coaching Mock',
      title: `${m.institute} Full Syllabus Mock #${randInt(4, 9)}`,
      date: toDateKey(tsA),
      totalStudents: batchSizeA,
      overallMarks: marksA,
      overallMaxMarks: 300,
      overallRank: rankA,
      overallPercentile: pctA,
      subjects: subjSplitA,
      timestamp: tsA
    });

    const batchSizeB = batchSizeA;
    const rankB = Math.max(1, Math.min(batchSizeB, rankA + randInt(-12, 35)));
    const pctB = calcDemoPercentile(rankB, batchSizeB);
    const tsB = CYCLE_4_START_MS + randInt(2, 5) * 86400 * 1000;
    const subjSplitB = (['Physics', 'Chemistry', 'Math'] as const).map((sName) => {
      const sRank = Math.max(1, Math.min(batchSizeB, rankB + randInt(-Math.round(batchSizeB * 0.04), Math.round(batchSizeB * 0.05))));
      return {
        name: sName,
        marks: randInt(32, 52),
        maxMarks: 60,
        rank: sRank,
        percentile: calcDemoPercentile(sRank, batchSizeB)
      };
    });

    exams.push({
      id: `demo_exam_${seed}_${m.id}_2`,
      memberId: m.id,
      memberName: m.name,
      institute: m.institute,
      examType: 'JEE Advanced Paper 1',
      title: `Part-Test Cumulative Mock #${randInt(1, 3)}`,
      date: toDateKey(tsB),
      totalStudents: batchSizeB,
      overallMarks: randInt(96, 148),
      overallMaxMarks: 180,
      overallRank: rankB,
      overallPercentile: pctB,
      subjects: subjSplitB,
      timestamp: tsB
    });
  });

  exams.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const tasks = [
    {
      id: `demo_task_${seed}_1`,
      title: 'Solve 35 Electrostatics Mixed PYQs (2019-2025)',
      subject: 'Physics',
      xp: 0,
      questionsText: 'Focus on spherical shell potential & dielectric slabs.',
      linkUrl: '',
      doubleXpFirst: true,
      requireProof: false,
      assignedTo: ['ALL'],
      isPersonal: false,
      ownerId: members[0].id,
      createdBy: 'Demo Arena',
      referenceImages: [],
      completions: {
        [members[1].id]: { status: 'verified', completedAt: now - 5 * 3600 * 1000, xpAwarded: 0 }
      },
      timeSpentByMember: { [members[1].id]: 85 },
      createdAt: safeCycleStart + 10000
    },
    {
      id: `demo_task_${seed}_2`,
      title: 'Aldol & Cannizzaro Reaction Mechanism Sheet',
      subject: 'Chemistry',
      xp: 0,
      questionsText: 'Complete stereochemistry variations before weekend mock.',
      linkUrl: '',
      doubleXpFirst: false,
      requireProof: false,
      assignedTo: ['ALL'],
      isPersonal: false,
      ownerId: members[0].id,
      createdBy: 'Demo Arena',
      referenceImages: [],
      completions: {},
      timeSpentByMember: {},
      createdAt: safeCycleStart + 20000
    },
    {
      id: `demo_task_${seed}_3`,
      title: 'Personal Checklist: 25 Definite Integration Challenges',
      subject: 'Math',
      xp: 0,
      questionsText: 'King property + Leibniz differentiation drills.',
      linkUrl: '',
      doubleXpFirst: false,
      requireProof: false,
      assignedTo: [members[0].id],
      isPersonal: true,
      ownerId: members[0].id,
      createdBy: members[0].name,
      referenceImages: [],
      completions: {},
      timeSpentByMember: {},
      createdAt: safeCycleStart + 30000
    }
  ];

  const teachers = [
    {
      id: 'demo_teacher_phy',
      name: 'Prof. Nair',
      subject: 'Physics',
      institute: 'Apex Faculty',
      passcode: '9911',
      bio: 'Mechanics & Electrodynamics Mentor',
      createdAt: CYCLE_4_START_MS
    },
    {
      id: 'demo_teacher_math',
      name: 'Dr. Verma',
      subject: 'Math',
      institute: 'Horizon Coaching',
      passcode: '9922',
      bio: 'Calculus & Coordinate Geometry Lead',
      createdAt: CYCLE_4_START_MS
    }
  ];

  const nextDueDate = toDateKey(now + 2 * 86400 * 1000);
  const teacherAssignments = [
    {
      id: `demo_asg_${seed}_1`,
      teacherId: 'demo_teacher_phy',
      teacherName: 'Prof. Nair',
      subject: 'Physics',
      title: 'Torque & Rolling Motion Drill Sheet #4',
      description: 'Submit clear step-by-step solutions for instantaneous axis of rotation problems 1-20.',
      hasQuestions: true,
      questionsCount: 20,
      questionDifficulty: 'hard' as const,
      xpReward: 40,
      doubleXpFullComplete: true,
      dueDate: nextDueDate,
      assignedTo: ['ALL'],
      requireProof: false,
      submissions: {
        [members[1].id]: {
          submittedAt: now - 4 * 3600 * 1000,
          note: 'Solved 19/20 cleanly in 70 minutes.',
          status: 'graded' as const,
          gradedBy: 'Prof. Nair',
          marksAwarded: 19,
          maxMarks: 20,
          xpAwarded: 40,
          feedback: 'Clean vector decomposition on Q14 and Q18.'
        }
      },
      createdAt: safeCycleStart + 40000
    },
    {
      id: `demo_asg_${seed}_2`,
      teacherId: 'demo_teacher_math',
      teacherName: 'Dr. Verma',
      subject: 'Math',
      title: 'Area Under Curves & Differential Equations DPP',
      description: 'Complete 25 timed mains-to-advanced level integrals.',
      hasQuestions: true,
      questionsCount: 25,
      questionDifficulty: 'medium' as const,
      xpReward: 35,
      doubleXpFullComplete: false,
      dueDate: toDateKey(now + 4 * 86400 * 1000),
      assignedTo: ['ALL'],
      requireProof: false,
      submissions: {},
      createdAt: safeCycleStart + 50000
    }
  ];

  const teacherNotes = [
    {
      id: `demo_note_${seed}_1`,
      teacherId: 'demo_teacher_phy',
      teacherName: 'Prof. Nair',
      subject: 'Physics',
      targetMemberId: 'ALL',
      note: 'Tip before Sunday mock: spend the first 4 minutes scanning easy Electrostatics & Modern Physics questions to bank guaranteed marks.',
      createdAt: now - 8 * 3600 * 1000
    }
  ];

  const announcements = [
    {
      id: `demo_ann_${seed}_1`,
      title: 'Demo Mode Active',
      message: 'Welcome to the Interactive JEE Arena Demo! All scholars, study sessions, and mocks here are randomized sample data - try logging a session or mock test freely.',
      timestamp: now - 3600 * 1000
    }
  ];

  const activities = sessions.slice(0, 5).map((s, idx) => ({
    id: `demo_act_${seed}_${idx}`,
    type: 'session_log',
    title: `${s.memberName} logged ${s.duration}m of ${s.subject}`,
    detail: `${s.solvedQuestions} solved Qs (${s.difficulty.toUpperCase()}) - -${s.duration + s.solvedQuestions * 3} Boss HP - +${s.xpEarned} XP`,
    memberId: s.memberId,
    xpDelta: s.xpEarned,
    xpEarned: s.xpEarned,
    timestamp: s.timestamp
  }));

  if (exams[0]) {
    activities.unshift({
      id: `demo_act_exam_${seed}`,
      type: 'exam_log',
      title: `${exams[0].memberName} logged ${exams[0].title}`,
      detail: `Rank #${exams[0].overallRank}/${exams[0].totalStudents} (${exams[0].overallPercentile.toFixed(1)}%ile) - ${exams[0].overallMarks}/${exams[0].overallMaxMarks}`,
      memberId: exams[0].memberId,
      xpDelta: Math.round(exams[0].overallPercentile * 3),
      xpEarned: Math.round(exams[0].overallPercentile * 3),
      timestamp: exams[0].timestamp
    });
  }

  activities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const messages = [
    {
      id: `demo_msg_${seed}_1`,
      senderId: members[1].id,
      senderName: members[1].name,
      senderType: 'student',
      recipientId: 'ALL',
      recipientName: 'Everyone',
      text: `Just finished a 90m ${liveSubject} block - chipped another 165 HP off the Raid Boss!`,
      timestamp: now - 50 * 60 * 1000,
      channelTag: 'general',
      replyTo: null,
      reactions: { '🔥': [members[0].id, members[2].id] },
      pinned: true
    },
    {
      id: `demo_msg_${seed}_2`,
      senderId: members[2].id,
      senderName: members[2].name,
      senderType: 'student',
      recipientId: 'ALL',
      recipientName: 'Everyone',
      text: 'Quick question on a rolling sphere accelerating up an incline with friction: when is static friction directed uphill vs downhill?',
      timestamp: now - 32 * 60 * 1000,
      channelTag: 'doubts',
      replyTo: null,
      reactions: {},
      pinned: false,
      doubtSubject: 'Physics',
      doubtDifficulty: 'hard',
      doubtBountyXp: 6,
      doubtWhatITried: 'Wrote a_cm = g*sin(theta) - f/m and alpha = fR/I, got confused when external force acts above CM.',
      doubtResolved: false,
      doubtResolvedBy: null,
      doubtResolvedById: null,
      doubtAwardedXp: null
    },
    {
      id: `demo_msg_${seed}_3`,
      senderId: members[3].id,
      senderName: members[3].name,
      senderType: 'student',
      recipientId: 'ALL',
      recipientName: 'Everyone',
      text: 'I challenged Rohan to a 45m Quickdraw Duel for 100 XP in the Warfare Hub. Let us see who finishes more calculus sets.',
      timestamp: now - 14 * 60 * 1000,
      channelTag: 'warfare',
      replyTo: null,
      reactions: { '⚔️': [members[0].id] },
      pinned: false
    }
  ];

  const demoSprintHistory = [
    {
      id: 'demo_sprint_4',
      sprintNumber: 4,
      sprintTitle: 'Demo Sprint 4 (Sample Clash)',
      dateRange: 'Previous Demo Week',
      winnerId: members[1].id,
      winnerName: members[1].name,
      winnerInstitute: members[1].institute,
      winnerXp: randInt(1350, 1780),
      runnerUpName: members[0].name,
      runnerUpInstitute: members[0].institute,
      runnerUpXp: randInt(1120, 1340),
      thirdPlaceName: members[2].name,
      thirdPlaceInstitute: members[2].institute,
      thirdPlaceXp: randInt(940, 1110),
      recordedAt: CYCLE_5_START_MS - 3600000,
      standings: [
        { rank: 1, id: members[1].id, name: members[1].name, institute: members[1].institute, xp: 1520, title: 'Champion of Sprint 4', studyMins: 1940, questions: 310, percentile: 92.4 },
        { rank: 2, id: members[0].id, name: members[0].name, institute: members[0].institute, xp: 1290, title: 'Runner-Up', studyMins: 1620, questions: 265, percentile: 88.1 },
        { rank: 3, id: members[2].id, name: members[2].name, institute: members[2].institute, xp: 1080, title: 'Third Place', studyMins: 1410, questions: 228, percentile: 84.5 },
        { rank: 4, id: members[3].id, name: members[3].name, institute: members[3].institute, xp: 890, title: 'Contender', studyMins: 1120, questions: 190, percentile: 81.2 },
        { rank: 5, id: members[4].id, name: members[4].name, institute: members[4].institute, xp: 710, title: 'Challenger', studyMins: 910, questions: 154, percentile: 76.8 }
      ]
    }
  ];

  const bossMaxHp = 2400;
  const bossCurHp = randInt(720, 1580);

  return {
    seed,
    activeDemoMemberId: members[0].id,
    members,
    sessions,
    exams,
    tasks,
    teachers,
    teacherAssignments,
    teacherNotes,
    announcements,
    activities,
    messages,
    arenaSettings: {
      currentCycle: 5,
      currentCycleStartMs: CYCLE_5_START_MS,
      leaderboardHidden: false,
      revealTimestamp: 0,
      hiddenAt: null,
      autoRoutineEnabled: false,
      lockDay: 5,
      lockTime: '23:59',
      unlockDay: 0,
      unlockTime: '22:00',
      autoLocked: false,
      lastAutoLockDate: '',
      routines: [],
      raidEnabled: true,
      raidOverrideSchedule: true,
      raidBossId: 'backlog_leviathan',
      raidBossMaxHp: bossMaxHp,
      raidBossCurrentHp: bossCurHp,
      raidFailedPenaltyActive: false,
      lastRaidDamageHit: {
        attackerName: members[liveGrinderIndex].name,
        damage: randInt(95, 185),
        timestamp: now - 35 * 60 * 1000
      },
      sprintHistory: demoSprintHistory,
      reigningSprintId: 'demo_sprint_4',
      audits: [],
      duels: [
        {
          id: `demo_duel_${seed}`,
          challengerId: members[3].id,
          challengerName: members[3].name,
          opponentId: members[2].id,
          opponentName: members[2].name,
          durationMins: 45,
          wagerXp: 100,
          escrowPot: 200,
          status: 'active',
          createdAt: now - 20 * 60 * 1000,
          startedAt: now - 15 * 60 * 1000,
          acceptedAt: now - 15 * 60 * 1000,
          expiresAt: now + 30 * 60 * 1000,
          inviteExpiresAt: now - 15 * 60 * 1000
        }
      ],
      ambushes: [],
      hostagePacts: [],
      simulateFridayBlackout: false,
      lastMidnightSettlementDateKey: todayStr,
      scheduledBlackoutUnlockAt: null,
      scheduledBlackoutPreNotified: false,
      pushSubscriptions: [],
      prankSettings: null,
      weeklySleeperAgent: {
        cycleNumber: 5,
        weekKey: 'DEMO-WEEK',
        memberId: '',
        memberName: '',
        assignedAt: now,
        previousMemberIds: [],
        revealedAtBlackout: false
      },
      combinedStudyRoom: {
        active: true,
        roomTitle: 'Demo Combined Focus Lounge',
        mode: 'POMODORO_50',
        sharedBlockStartedAt: null,
        sharedBlockDurationMins: 50,
        participantGoals: {
          [members[1].id]: '30 Electrostatics PYQs'
        },
        recentPings: []
      }
    }
  };
}
