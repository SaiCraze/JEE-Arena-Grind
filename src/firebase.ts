import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  setLogLevel,
  disableNetwork,
  type Firestore,
  type DocumentReference,
  type CollectionReference,
  type SetOptions
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  INITIAL_FIRESTORE_MEMBERS,
  INITIAL_FIRESTORE_SESSIONS,
  INITIAL_FIRESTORE_EXAMS,
  INITIAL_FIRESTORE_TASKS,
  INITIAL_FIRESTORE_ACTIVITIES,
  INITIAL_FIRESTORE_ARENA_STATE
} from './data/arenaSeedSnapshot';

export { collection, doc };

// Silence internal @firebase/firestore gRPC retry logs in browser console
setLogLevel('silent');

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

let firestoreInstance: Firestore;
try {
  firestoreInstance = firebaseConfig.firestoreDatabaseId
    ? initializeFirestore(
        app,
        { experimentalAutoDetectLongPolling: true },
        firebaseConfig.firestoreDatabaseId
      )
    : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch {
  firestoreInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;

// Immediately disable direct browser-to-Firestore WebChannel/gRPC network streams.
// All reads, real-time listeners, and writes flow through the Express Server SSE + Write-Coalescing Engine.
disableNetwork(db).catch(() => {});

export const appId = 'f185877a-3655-484c-85a9-d315ecdb03cd';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let quotaExceededDetected = false;

export function isFirestoreQuotaExceeded(): boolean {
  return quotaExceededDetected;
}

export function notifyQuotaExceeded(errMessage?: string): void {
  if (!quotaExceededDetected) {
    quotaExceededDetected = true;
    disableNetwork(db).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('firestore-quota-exceeded', {
          detail: {
            message: errMessage || 'Firestore daily free write quota reached. Running on live server sync engine.'
          }
        })
      );
    }
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as { code?: string | number })?.code;

  const isQuota =
    errCode === 'resource-exhausted' ||
    errCode === 8 ||
    errCode === '8' ||
    errMessage.includes('RESOURCE_EXHAUSTED') ||
    errMessage.includes('resource-exhausted') ||
    errMessage.includes('Quota limit exceeded') ||
    errMessage.includes('Quota exceeded');

  if (isQuota) {
    notifyQuotaExceeded(errMessage);
    return;
  }

  const isUnavailable =
    errCode === 'unavailable' ||
    errMessage.includes('unavailable') ||
    errMessage.includes('Could not reach Cloud Firestore') ||
    errMessage.includes('offline');

  if (isUnavailable) {
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  console.warn('Firestore notice:', errInfo);
}

export interface ServerFirestoreBootstrap {
  success: boolean;
  revision?: number;
  timestamp: number;
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
  arenaState: any | null;
  quotaExceeded?: boolean;
  quotaMessage?: string;
  fromFallback?: boolean;
  coalescedSaves?: number;
}

const LOCAL_MIRROR_STORAGE_KEY = 'jee_arena_live_mirror_v5_clean';
const PERMANENTLY_DELETED_IDS = new Set<string>(['nishchit_590']);

export function sanitizeMirrorMembers(rawMembers: any[], extraDeletedIds?: string[]): any[] {
  const deletedSet = new Set<string>(PERMANENTLY_DELETED_IDS);
  if (Array.isArray(extraDeletedIds)) {
    for (const id of extraDeletedIds) {
      if (id) deletedSet.add(String(id));
    }
  }
  const defaultMap = new Map<string, any>();
  for (const def of INITIAL_FIRESTORE_MEMBERS) {
    if (def && def.id && !deletedSet.has(def.id)) defaultMap.set(def.id, def);
  }
  const resultMap = new Map<string, any>();
  for (const [id, def] of defaultMap.entries()) {
    resultMap.set(id, { ...def });
  }
  if (Array.isArray(rawMembers)) {
    for (const item of rawMembers) {
      if (!item || !item.id || deletedSet.has(item.id)) continue;
      const baseDef = defaultMap.get(item.id);
      if (baseDef) {
        const resolvedArchived =
          item.id === 'nishchit'
            ? !Boolean(item.explicitlyRestoredByAdmin)
            : item.isArchived !== undefined
            ? Boolean(item.isArchived)
            : Boolean(baseDef.isArchived);
        resultMap.set(item.id, {
          ...baseDef,
          ...item,
          name: item.name || baseDef.name || 'Scholar',
          institute: item.institute || baseDef.institute || 'Modulus',
          passcode: item.passcode || baseDef.passcode || '0000',
          isArchived: resolvedArchived,
          explicitlyRestoredByAdmin: Boolean(item.explicitlyRestoredByAdmin && !resolvedArchived),
          archivedAt: resolvedArchived ? (item.archivedAt || baseDef.archivedAt || 1794330000000) : null
        });
      } else if (item.name && typeof item.name === 'string' && item.name.trim().length > 0) {
        const isNishchitCustom = item.id === 'nishchit' || item.name.trim().toLowerCase() === 'nishchit';
        const resolvedCustomArchived = isNishchitCustom
          ? !Boolean(item.explicitlyRestoredByAdmin)
          : Boolean(item.isArchived);
        resultMap.set(item.id, {
          ...item,
          name: item.name.trim(),
          institute: item.institute || 'Modulus',
          passcode: item.passcode || '0000',
          isArchived: resolvedCustomArchived
        });
      }
    }
  }
  const archivedIds = new Set<string>();
  const archivedNames = new Set<string>();
  for (const m of resultMap.values()) {
    if (m.isArchived) {
      archivedIds.add(m.id);
      if (m.name) archivedNames.add(String(m.name).toLowerCase());
    }
  }
  return Array.from(resultMap.values()).map((m: any) => {
    const cleaned = { ...m };
    if (cleaned.declaredRivalId && archivedIds.has(cleaned.declaredRivalId)) {
      cleaned.declaredRivalId = '';
      cleaned.declaredRivalName = '';
    }
    if (cleaned.declaredRivalName && archivedNames.has(String(cleaned.declaredRivalName).toLowerCase())) {
      cleaned.declaredRivalId = '';
      cleaned.declaredRivalName = '';
    }
    if (cleaned.lastNudgedBy && archivedNames.has(String(cleaned.lastNudgedBy).toLowerCase())) {
      cleaned.lastNudgedBy = '';
    }
    return cleaned;
  });
}

function createInitialMirrorState(): ServerFirestoreBootstrap {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('jee_arena_live_mirror_v1');
      localStorage.removeItem('jee_arena_live_mirror_v2');
      localStorage.removeItem('jee_arena_live_mirror_v3');
      localStorage.removeItem('jee_arena_live_mirror_v4_no_nishchit');
      const activeId = localStorage.getItem('jee_arena_active_id');
      if (activeId && activeId.toLowerCase().includes('nishchit')) {
        localStorage.removeItem('jee_arena_active_id');
      }
      const saved = localStorage.getItem(LOCAL_MIRROR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.members) && parsed.members.length > 0) {
          const extraDeleted = Array.isArray(parsed.arenaState?.deletedDocIds) ? parsed.arenaState.deletedDocIds : [];
          return {
            success: true,
            timestamp: parsed.timestamp || Date.now(),
            members: sanitizeMirrorMembers(parsed.members, extraDeleted),
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : INITIAL_FIRESTORE_SESSIONS,
            exams: Array.isArray(parsed.exams) ? parsed.exams : INITIAL_FIRESTORE_EXAMS,
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : INITIAL_FIRESTORE_TASKS,
            teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
            teacherAssignments: Array.isArray(parsed.teacherAssignments) ? parsed.teacherAssignments : [],
            teacherNotes: Array.isArray(parsed.teacherNotes) ? parsed.teacherNotes : [],
            announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
            activities: Array.isArray(parsed.activities) ? parsed.activities : INITIAL_FIRESTORE_ACTIVITIES,
            messages: Array.isArray(parsed.messages) ? parsed.messages : [],
            arenaState: parsed.arenaState || INITIAL_FIRESTORE_ARENA_STATE
          };
        }
      }
    } catch {
      // Ignore storage parse error
    }
  }

  return {
    success: true,
    timestamp: Date.now(),
    members: sanitizeMirrorMembers([...INITIAL_FIRESTORE_MEMBERS]),
    sessions: [...INITIAL_FIRESTORE_SESSIONS],
    exams: [...INITIAL_FIRESTORE_EXAMS],
    tasks: [...INITIAL_FIRESTORE_TASKS],
    teachers: [],
    teacherAssignments: [],
    teacherNotes: [],
    announcements: [],
    activities: [...INITIAL_FIRESTORE_ACTIVITIES],
    messages: [],
    arenaState: { ...INITIAL_FIRESTORE_ARENA_STATE }
  };
}

let liveMirror: ServerFirestoreBootstrap = createInitialMirrorState();
let latestAppliedRevision = 0;
let activeBridgeMutations = 0;
let lastLocalMutationAtMs = 0;

function persistMirrorToLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_MIRROR_STORAGE_KEY, JSON.stringify(liveMirror));
  } catch {
    // Ignore storage quota errors
  }
}

type ListenerRecord = {
  id: number;
  kind: 'doc' | 'col';
  collectionName: string;
  docId?: string;
  ref: any;
  onNext: (snap: any) => void;
  previousIds: Set<string>;
  lastHash: string;
};

let nextListenerId = 1;
const activeListeners = new Map<number, ListenerRecord>();

function mapCollectionNameToMirrorKey(collectionName: string): keyof ServerFirestoreBootstrap {
  if (collectionName === 'teacher_assignments') return 'teacherAssignments';
  if (collectionName === 'teacher_notes') return 'teacherNotes';
  return (collectionName as keyof ServerFirestoreBootstrap) || 'members';
}

function buildDocSnapshot(ref: any, docId: string, data: any | null) {
  const existsFlag = Boolean(data !== null && data !== undefined);
  const cloned = existsFlag ? { ...data } : undefined;
  return {
    id: docId,
    ref,
    metadata: { fromCache: false, hasPendingWrites: false },
    exists: () => existsFlag,
    data: () => cloned
  };
}

function buildColSnapshot(listener: ListenerRecord, rawItems: any[]) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  const currentIds = new Set<string>();
  const addedDocs: any[] = [];

  const docs = items.map((item: any) => {
    const itemId = String(item.id || '');
    currentIds.add(itemId);
    const docSnap = {
      id: itemId,
      ref: doc(listener.ref, itemId),
      metadata: { fromCache: false, hasPendingWrites: false },
      exists: () => true,
      data: () => ({ ...item })
    };
    if (!listener.previousIds.has(itemId)) {
      addedDocs.push({
        type: 'added' as const,
        doc: docSnap
      });
    }
    return docSnap;
  });

  listener.previousIds = currentIds;

  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    metadata: { fromCache: false, hasPendingWrites: false },
    docChanges: () => addedDocs
  };
}

function notifyListener(listener: ListenerRecord, force = false) {
  try {
    if (listener.kind === 'doc') {
      let data: any = null;
      if (listener.collectionName === 'settings' && listener.docId === 'arenaState') {
        data = liveMirror.arenaState;
      } else {
        const key = mapCollectionNameToMirrorKey(listener.collectionName);
        const list = liveMirror[key];
        if (Array.isArray(list)) {
          data = list.find((item: any) => item.id === listener.docId) || null;
        }
      }
      const nextHash = JSON.stringify(data);
      if (!force && listener.lastHash === nextHash) return;
      listener.lastHash = nextHash;
      listener.onNext(buildDocSnapshot(listener.ref, listener.docId || '', data));
    } else {
      const key = mapCollectionNameToMirrorKey(listener.collectionName);
      const list = Array.isArray(liveMirror[key]) ? (liveMirror[key] as any[]) : [];
      const nextHash = JSON.stringify(list);
      if (!force && listener.lastHash === nextHash) return;
      listener.lastHash = nextHash;
      listener.onNext(buildColSnapshot(listener, list));
    }
  } catch (err) {
    console.warn('Snapshot listener callback error:', err);
  }
}

function notifyAllListeners(targetCollection?: string) {
  for (const listener of activeListeners.values()) {
    if (!targetCollection || listener.collectionName === targetCollection) {
      notifyListener(listener, false);
    }
  }
}

function mergeRemoteMembersWithLocalTimers(remoteMembers: any[], localMembers: any[]): any[] {
  const cleanRemote = sanitizeMirrorMembers(remoteMembers);
  if (!Array.isArray(localMembers) || localMembers.length === 0) return cleanRemote;
  const now = Date.now();
  return cleanRemote.map((rm: any) => {
    if (!rm || !rm.id) return rm;
    const local = localMembers.find((lm: any) => lm && lm.id === rm.id);
    if (!local) return rm;
    const localUpdated = Number(local.grindingUpdatedAt) || 0;
    const remoteUpdated = Number(rm.grindingUpdatedAt) || 0;
    // If local timer state was updated more recently (e.g. local Stop/Log while a GET was in flight), preserve local timer fields
    if (localUpdated > remoteUpdated && now - localUpdated < 20000) {
      return {
        ...rm,
        isGrinding: Boolean(local.isGrinding),
        grindingSubject: local.grindingSubject ?? '',
        grindingStartedAt: local.grindingStartedAt ?? null,
        grindingAccumulatedSeconds: Number(local.grindingAccumulatedSeconds) || 0,
        grindingLinkedTaskId: local.grindingLinkedTaskId ?? '',
        grindingUpdatedAt: localUpdated
      };
    }
    return rm;
  });
}

function ingestServerPayload(
  data: Partial<ServerFirestoreBootstrap>,
  targetCollection?: string,
  options?: { isAuthoritativeSync?: boolean }
) {
  if (!data) return;
  const incomingRev = typeof data.revision === 'number' ? data.revision : null;
  if (!options?.isAuthoritativeSync) {
    // Reject out-of-order bootstrap responses while a local mutation is in-flight or just completed
    if (activeBridgeMutations > 0 || (Date.now() - lastLocalMutationAtMs < 3500)) {
      return;
    }
    if (incomingRev !== null && latestAppliedRevision > 0 && incomingRev < latestAppliedRevision) {
      return;
    }
  }
  if (incomingRev !== null) {
    latestAppliedRevision = options?.isAuthoritativeSync ? incomingRev : Math.max(latestAppliedRevision, incomingRev);
  }
  if (Array.isArray(data.members) && data.members.length > 0) {
    liveMirror.members = mergeRemoteMembersWithLocalTimers(data.members, liveMirror.members);
  }
  if (Array.isArray(data.sessions)) liveMirror.sessions = data.sessions;
  if (Array.isArray(data.exams)) liveMirror.exams = data.exams;
  if (Array.isArray(data.tasks)) liveMirror.tasks = data.tasks;
  if (Array.isArray(data.teachers)) liveMirror.teachers = data.teachers;
  if (Array.isArray(data.teacherAssignments)) liveMirror.teacherAssignments = data.teacherAssignments;
  if (Array.isArray(data.teacherNotes)) liveMirror.teacherNotes = data.teacherNotes;
  if (Array.isArray(data.announcements)) liveMirror.announcements = data.announcements;
  if (Array.isArray(data.activities)) liveMirror.activities = data.activities;
  if (Array.isArray(data.messages)) liveMirror.messages = data.messages;
  if (data.arenaState) liveMirror.arenaState = data.arenaState;
  liveMirror.timestamp = Date.now();

  if (data.quotaExceeded) {
    notifyQuotaExceeded(data.quotaMessage);
  }

  persistMirrorToLocalStorage();
  notifyAllListeners(targetCollection);
}

function applyLocalMirrorMutation(params: {
  action: 'set' | 'add' | 'update' | 'delete';
  collectionName: string;
  docId: string;
  data?: any;
  merge?: boolean;
}): boolean {
  const { action, collectionName, docId, data, merge } = params;

  if (collectionName === 'settings' && docId === 'arenaState') {
    liveMirror.arenaState = merge
      ? { ...(liveMirror.arenaState || {}), ...(data || {}) }
      : { ...(data || {}) };
    persistMirrorToLocalStorage();
    notifyAllListeners('settings');
    return true;
  }

  const key = mapCollectionNameToMirrorKey(collectionName);
  const currentList = Array.isArray(liveMirror[key]) ? [...(liveMirror[key] as any[])] : [];

  if (action === 'set' || action === 'add') {
    const idx = currentList.findIndex((item: any) => item.id === docId);
    const nextDoc = { id: docId, ...(data || {}) };
    if (idx >= 0) {
      const mergedDoc = merge ? { ...currentList[idx], ...(data || {}), id: docId } : nextDoc;
      currentList[idx] = mergedDoc;
    } else {
      currentList.unshift(nextDoc);
    }
    (liveMirror as any)[key] = key === 'members' ? sanitizeMirrorMembers(currentList) : currentList;
  } else if (action === 'update') {
    const idx = currentList.findIndex((item: any) => item.id === docId);
    if (idx >= 0) {
      const mergedDoc = { ...currentList[idx], ...(data || {}), id: docId };
      currentList[idx] = mergedDoc;
    } else if (key !== 'members') {
      currentList.unshift({ id: docId, ...(data || {}) });
    } else {
      const baseMem = INITIAL_FIRESTORE_MEMBERS.find((m: any) => m.id === docId);
      if (baseMem) {
        currentList.unshift({ ...baseMem, ...(data || {}), id: docId });
      }
    }
    (liveMirror as any)[key] = key === 'members' ? sanitizeMirrorMembers(currentList) : currentList;
  } else if (action === 'delete') {
    const isProtectedCoreMember =
      key === 'members' && INITIAL_FIRESTORE_MEMBERS.some((m: any) => m.id === docId);
    if (!isProtectedCoreMember) {
      const nextList = currentList.filter((item: any) => item.id !== docId);
      (liveMirror as any)[key] = nextList;
    }
  }

  persistMirrorToLocalStorage();
  notifyAllListeners(collectionName);
  return true;
}

// Start singleton Server-Sent Events (SSE) stream + BroadcastChannel for real-time multi-device & multi-tab sync
let sseInitialized = false;
let broadcastChan: BroadcastChannel | null = null;
let serverClockOffsetMs = 0;
const processedSignalIds = new Set<string>();

export function getServerSyncedNow(): number {
  return Date.now() + serverClockOffsetMs;
}

function updateServerClockOffset(serverNow?: number) {
  if (typeof serverNow === 'number' && serverNow > 0) {
    const rawDiff = serverNow - Date.now();
    // Smooth clock offset update
    serverClockOffsetMs = Math.abs(rawDiff) < 500 ? 0 : rawDiff;
  }
}

function dispatchWebRTCSignal(sig: any) {
  if (!sig || !sig.id || typeof window === 'undefined') return;
  if (processedSignalIds.has(sig.id)) return;
  processedSignalIds.add(sig.id);
  window.dispatchEvent(new CustomEvent('jee-webrtc-signal', { detail: sig }));
}

export async function sendWebRTCSignal(packet: {
  type: string;
  roomCode?: string;
  fromId?: string;
  fromName?: string;
  fromMemberId?: string;
  fromMemberName?: string;
  toMemberId?: string;
  memberId?: string;
  pairingCode?: string;
  sharedStartedAt?: number;
  action?: string;
  startTimestamp?: number;
  timerSeconds?: number;
  sdp?: any;
  candidate?: any;
  timerState?: any;
  [key: string]: any;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (broadcastChan) {
    try {
      broadcastChan.postMessage({
        type: 'WEBRTC_SIGNAL',
        signal: { ...packet, id: `local_${Date.now()}_${Math.random()}`, timestamp: Date.now() }
      });
    } catch {}
  }
  try {
    const res = await fetch('/api/webrtc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet)
    });
    return res.ok;
  } catch {
    return false;
  }
}

function ensureRealtimeStreamConnected() {
  if (sseInitialized || typeof window === 'undefined') return;
  sseInitialized = true;

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChan = new BroadcastChannel('jee_arena_live_sync_v1');
      broadcastChan.onmessage = (ev) => {
        if (ev.data && ev.data.type === 'MIRROR_MUTATION' && ev.data.payload) {
          applyLocalMirrorMutation(ev.data.payload);
          window.dispatchEvent(new CustomEvent('jee-server-synced'));
        } else if (ev.data && ev.data.type === 'WEBRTC_SIGNAL' && ev.data.signal) {
          dispatchWebRTCSignal(ev.data.signal);
        }
      };
    } catch {}
  }

  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (typeof EventSource === 'undefined') return;
    try {
      if (es) {
        try {
          es.close();
        } catch {}
      }
      es = new EventSource('/api/firestore/stream');
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (!parsed) return;
          updateServerClockOffset(parsed.serverNow);

          if (parsed.type === 'webrtc_signal' && parsed.signal) {
            dispatchWebRTCSignal(parsed.signal);
            return;
          }

          if (parsed.type === 'delta' && parsed.mutation) {
            if (typeof parsed.revision === 'number') {
              latestAppliedRevision = Math.max(latestAppliedRevision, parsed.revision);
            }
            const mut = parsed.mutation;
            if (mut.collectionName === 'settings' && mut.docId === 'arenaState' && mut.updatedDoc) {
              liveMirror.arenaState = mut.updatedDoc;
              persistMirrorToLocalStorage();
              notifyAllListeners('settings');
            } else if (mut.collectionName && mut.docId) {
              if (mut.action === 'delete') {
                applyLocalMirrorMutation({
                  action: 'delete',
                  collectionName: mut.collectionName,
                  docId: mut.docId
                });
              } else {
                applyLocalMirrorMutation({
                  action: 'set',
                  collectionName: mut.collectionName,
                  docId: mut.docId,
                  data: mut.updatedDoc || mut.data,
                  merge: true
                });
              }
            }
            window.dispatchEvent(new CustomEvent('jee-server-synced'));
            return;
          }

          if (parsed.payload) {
            const targetCol = parsed.mutation?.collectionName;
            const syncPayload = typeof parsed.revision === 'number'
              ? { ...parsed.payload, revision: parsed.revision }
              : parsed.payload;
            ingestServerPayload(syncPayload, targetCol, {
              isAuthoritativeSync: parsed.type === 'sync' && activeBridgeMutations === 0
            });
            window.dispatchEvent(new CustomEvent('jee-server-synced'));
          }
        } catch {
          // Ignore malformed packet
        }
      };
      es.onerror = () => {
        try {
          es?.close();
        } catch {}
        es = null;
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 1500);
        }
      };
    } catch {
      // Fallback to bootstrap polling if EventSource fails
    }
  };

  connect();

  const handleWakeOrFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!es || es.readyState === EventSource.CLOSED) {
      connect();
    }
    fetchFastTimerSync().catch(() => {});
  };

  window.addEventListener('visibilitychange', handleWakeOrFocus);
  window.addEventListener('focus', handleWakeOrFocus);
  window.addEventListener('pageshow', handleWakeOrFocus);
  window.addEventListener('online', handleWakeOrFocus);
}

export async function fetchFastTimerSync(): Promise<{
  success: boolean;
  members: any[];
  combinedStudyRoom: any | null;
  serverNow: number;
} | null> {
  if (typeof window === 'undefined') return null;
  ensureRealtimeStreamConnected();
  try {
    const res = await fetch('/api/firestore/timers', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success) {
      updateServerClockOffset(data.serverNow);
      if (Array.isArray(data.members) && data.members.length > 0) {
        const currentMirrorMembers = Array.isArray(liveMirror.members) && liveMirror.members.length > 0
          ? liveMirror.members
          : sanitizeMirrorMembers(data.members);
        const now = Date.now();
        const mergedMembers = currentMirrorMembers.map((existing: any) => {
          const remote = data.members.find((rm: any) => rm && rm.id === existing.id);
          if (!remote) return existing;
          const localUpdated = Number(existing.grindingUpdatedAt) || 0;
          const remoteUpdated = Number(remote.grindingUpdatedAt) || 0;
          if (localUpdated > remoteUpdated && now - localUpdated < 20000) {
            return existing;
          }
          return {
            ...existing,
            isGrinding: Boolean(remote.isGrinding),
            grindingSubject: remote.grindingSubject ?? existing.grindingSubject ?? '',
            grindingStartedAt: remote.grindingStartedAt ?? null,
            grindingAccumulatedSeconds: Number(remote.grindingAccumulatedSeconds) || 0,
            grindingLinkedTaskId: remote.grindingLinkedTaskId ?? '',
            grindingUpdatedAt: remoteUpdated || localUpdated,
            lastActiveAt: remote.lastActiveAt || existing.lastActiveAt
          };
        });
        const prevHash = JSON.stringify(liveMirror.members);
        const nextHash = JSON.stringify(mergedMembers);
        if (prevHash !== nextHash) {
          liveMirror.members = mergedMembers;
          persistMirrorToLocalStorage();
          notifyAllListeners('members');
        }
      }
      if (data.combinedStudyRoom) {
        const prevRoomHash = JSON.stringify(liveMirror.arenaState?.combinedStudyRoom || null);
        const nextRoomHash = JSON.stringify(data.combinedStudyRoom);
        if (prevRoomHash !== nextRoomHash) {
          liveMirror.arenaState = {
            ...(liveMirror.arenaState || {}),
            combinedStudyRoom: data.combinedStudyRoom
          };
          persistMirrorToLocalStorage();
          notifyAllListeners('settings');
        }
      }
      if (Array.isArray(data.webrtcSignals)) {
        for (const sig of data.webrtcSignals) {
          dispatchWebRTCSignal(sig);
        }
      }
      window.dispatchEvent(new CustomEvent('jee-server-synced'));
      return {
        success: true,
        members: liveMirror.members || [],
        combinedStudyRoom: data.combinedStudyRoom || null,
        serverNow: data.serverNow || Date.now()
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchServerFirestoreBootstrap(force = false): Promise<ServerFirestoreBootstrap | null> {
  if (typeof window === 'undefined') return null;
  ensureRealtimeStreamConnected();
  try {
    const res = await fetch(`/api/firestore/bootstrap${force ? '?force=1' : ''}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) return liveMirror;
    const data = await res.json();
    if (data && data.success) {
      ingestServerPayload(data, undefined, {
        isAuthoritativeSync: Boolean(force && activeBridgeMutations === 0)
      });
      window.dispatchEvent(new CustomEvent('jee-server-synced'));
      return liveMirror;
    }
    return liveMirror;
  } catch {
    return liveMirror;
  }
}

export interface VirtualDocSnapshot {
  id: string;
  ref: any;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
  exists: () => boolean;
  data: () => Record<string, any>;
}

export interface VirtualSnapshot {
  id: string;
  ref: any;
  docs: VirtualDocSnapshot[];
  size: number;
  empty: boolean;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
  exists: () => boolean;
  data: () => Record<string, any>;
  docChanges: () => Array<{ type: 'added' | 'modified' | 'removed'; doc: VirtualDocSnapshot }>;
}

export function onSnapshot(
  ref: any,
  onNext: (snap: VirtualSnapshot) => void,
  _onError?: (err: Error) => void
): () => void {
  ensureRealtimeStreamConnected();

  const isDoc = ref?.type === 'document' || Boolean(ref?.parent && ref?.parent?.type === 'collection');
  const collectionName = isDoc ? (ref?.parent?.id || 'settings') : (ref?.id || 'members');
  const docId = isDoc ? ref?.id : undefined;

  const id = nextListenerId++;
  const record: ListenerRecord = {
    id,
    kind: isDoc ? 'doc' : 'col',
    collectionName,
    docId,
    ref,
    onNext,
    previousIds: new Set<string>(),
    lastHash: ''
  };

  activeListeners.set(id, record);

  // Immediately deliver initial snapshot on next microtask
  Promise.resolve().then(() => {
    if (activeListeners.has(id)) {
      notifyListener(record, true);
    }
  });

  return () => {
    activeListeners.delete(id);
  };
}

export async function getDoc(docRef: DocumentReference<any>): Promise<any> {
  const collectionName = docRef.parent?.id || 'settings';
  const docId = docRef.id;
  let data: any = null;
  if (collectionName === 'settings' && docId === 'arenaState') {
    data = liveMirror.arenaState;
  } else {
    const key = mapCollectionNameToMirrorKey(collectionName);
    const list = liveMirror[key];
    if (Array.isArray(list)) {
      data = list.find((item: any) => item.id === docId) || null;
    }
  }
  return buildDocSnapshot(docRef, docId, data);
}

export async function getDocs(colRef: CollectionReference<any>): Promise<any> {
  const collectionName = colRef.id;
  const key = mapCollectionNameToMirrorKey(collectionName);
  const list = Array.isArray(liveMirror[key]) ? (liveMirror[key] as any[]) : [];
  const dummyListener: ListenerRecord = {
    id: 0,
    kind: 'col',
    collectionName,
    ref: colRef,
    onNext: () => {},
    previousIds: new Set<string>(),
    lastHash: ''
  };
  return buildColSnapshot(dummyListener, list);
}

async function mutateViaServerBridge(payload: {
  action: 'set' | 'add' | 'update' | 'delete';
  collectionName: string;
  docId?: string;
  data?: any;
  merge?: boolean;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  activeBridgeMutations++;
  lastLocalMutationAtMs = Date.now();
  try {
    const res = await fetch('/api/firestore/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => null);
    if (result && result.quotaExceeded) {
      notifyQuotaExceeded();
    }
    if (!res.ok || (result && result.success === false)) {
      throw new Error(result?.error || `Server sync failed (HTTP ${res.status})`);
    }
    if (result && typeof result.revision === 'number') {
      latestAppliedRevision = Math.max(latestAppliedRevision, result.revision);
    }
    lastLocalMutationAtMs = Date.now();
    if (broadcastChan && payload.docId) {
      try {
        broadcastChan.postMessage({ type: 'MIRROR_MUTATION', payload });
      } catch {}
    }
  } finally {
    activeBridgeMutations = Math.max(0, activeBridgeMutations - 1);
  }
}

function captureCollectionSnapshot(collectionName: string, docId: string) {
  if (collectionName === 'settings' && docId === 'arenaState') {
    return { isArena: true, prev: liveMirror.arenaState ? { ...liveMirror.arenaState } : null };
  }
  const key = mapCollectionNameToMirrorKey(collectionName);
  const prevList = Array.isArray(liveMirror[key]) ? [...(liveMirror[key] as any[])] : [];
  return { isArena: false, key, prev: prevList };
}

function restoreCollectionSnapshot(collectionName: string, snap: { isArena: boolean; key?: keyof ServerFirestoreBootstrap; prev: any }) {
  if (snap.isArena) {
    liveMirror.arenaState = snap.prev;
  } else if (snap.key) {
    (liveMirror as any)[snap.key] = snap.prev;
  }
  persistMirrorToLocalStorage();
  notifyAllListeners(collectionName);
}

export async function setDoc(docRef: DocumentReference<any>, data: any, options?: SetOptions): Promise<void> {
  const collectionName = docRef.parent?.id || '';
  const docId = docRef.id;
  const merge = Boolean(options && 'merge' in options && options.merge);

  if (!collectionName) return;
  const snap = captureCollectionSnapshot(collectionName, docId);
  applyLocalMirrorMutation({ action: 'set', collectionName, docId, data, merge });

  try {
    await mutateViaServerBridge({ action: 'set', collectionName, docId, data, merge });
  } catch (err) {
    restoreCollectionSnapshot(collectionName, snap);
    throw err;
  }
}

export async function addDoc(colRef: CollectionReference<any>, data: any): Promise<DocumentReference<any>> {
  const newDocRef = doc(colRef);
  const collectionName = colRef.id;
  const docId = newDocRef.id;

  const snap = captureCollectionSnapshot(collectionName, docId);
  applyLocalMirrorMutation({ action: 'set', collectionName, docId, data, merge: false });
  try {
    await mutateViaServerBridge({
      action: 'set',
      collectionName,
      docId,
      data,
      merge: false
    });
  } catch (err) {
    restoreCollectionSnapshot(collectionName, snap);
    throw err;
  }

  return newDocRef;
}

export async function updateDoc(docRef: DocumentReference<any>, data: any): Promise<void> {
  const collectionName = docRef.parent?.id || '';
  const docId = docRef.id;

  if (!collectionName) return;
  const snap = captureCollectionSnapshot(collectionName, docId);
  applyLocalMirrorMutation({ action: 'update', collectionName, docId, data, merge: true });

  try {
    await mutateViaServerBridge({ action: 'update', collectionName, docId, data });
  } catch (err) {
    restoreCollectionSnapshot(collectionName, snap);
    throw err;
  }
}

export async function deleteDoc(docRef: DocumentReference<any>): Promise<void> {
  const collectionName = docRef.parent?.id || '';
  const docId = docRef.id;

  if (!collectionName) return;
  const snap = captureCollectionSnapshot(collectionName, docId);
  applyLocalMirrorMutation({ action: 'delete', collectionName, docId });

  try {
    await mutateViaServerBridge({ action: 'delete', collectionName, docId });
  } catch (err) {
    restoreCollectionSnapshot(collectionName, snap);
    throw err;
  }
}

export async function initFirebaseAuth(onUser?: (u: User | null) => void) {
  ensureRealtimeStreamConnected();
  onAuthStateChanged(auth, (user) => {
    if (onUser) onUser(user);
  });

  try {
    const globalWindow = window as unknown as { __initial_auth_token?: string };
    if (globalWindow.__initial_auth_token) {
      return await signInWithCustomToken(auth, globalWindow.__initial_auth_token);
    }
  } catch (err: unknown) {
    console.warn('Custom token auth notice:', err);
  }
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}

