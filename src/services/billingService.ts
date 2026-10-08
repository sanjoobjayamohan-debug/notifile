import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { getAppApiUrl } from './apiUrls';
import {
  BillingConfiguration,
  CreditPlan,
  DEFAULT_BILLING_CONFIGURATION,
  TeamDuration,
} from '../config/billingConfig';

export { DEFAULT_BILLING_CONFIGURATION } from '../config/billingConfig';
export type { BillingConfiguration, CreditPlan, TeamDuration } from '../config/billingConfig';

export interface BillingTransaction {
  id: string;
  createdAt: number;
  description: string;
  credits: number;
  status: 'completed' | 'failed';
  toolId?: string;
  amountINR?: number;
  kind: 'purchase' | 'usage' | 'team_purchase';
}

export interface CreditLot {
  id: string;
  remaining: number;
  expiresAt: number | null;
  maxFileSizeMB: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member';
  status: 'Active' | 'Pending';
  joinedAt: number;
}

export interface TeamSubscription {
  id: string;
  teamName: string;
  seats: number;
  durationId: TeamDuration['id'];
  startedAt: number;
  expiresAt: number;
  members: TeamMember[];
  maxFileSizeMB: number;
  maximumProcessingMinutes: number;
  fairUseJobsPerHour: number;
}

export interface BillingState {
  creditBalance: number;
  creditLots: CreditLot[];
  creditsPurchased: number;
  creditsUsed: number;
  lastPurchaseAt: number | null;
  teamSubscription: TeamSubscription | null;
  transactions: BillingTransaction[];
  usageTimestamps: number[];
}

const EMPTY_BILLING_STATE: BillingState = {
  creditBalance: 0,
  creditLots: [],
  creditsPurchased: 0,
  creditsUsed: 0,
  lastPurchaseAt: null,
  teamSubscription: null,
  transactions: [],
  usageTimestamps: [],
};

const localKey = (uid: string) => `notifile_billing_v1_${uid}`;
const billingDoc = (uid: string) => doc(db, 'users', uid, 'billing', 'state');
const transactionsCollection = (uid: string) => collection(db, 'users', uid, 'billingTransactions');

function saveLocal(uid: string, state: BillingState): void {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(state));
  } catch (error) {
    console.error('Failed to persist billing state locally:', error);
    throw new Error('Could not save billing changes in this browser.');
  }
}

function normalizeCreditLots(state: BillingState, now = Date.now()): BillingState {
  const sourceLots = state.creditLots?.length
    ? state.creditLots
    : state.creditBalance > 0
      ? [{ id: 'legacy-balance', remaining: state.creditBalance, expiresAt: null, maxFileSizeMB: Number.MAX_SAFE_INTEGER }]
      : [];
  const creditLots = sourceLots.filter((lot) => lot.remaining > 0 && (lot.expiresAt === null || lot.expiresAt > now));
  return {
    ...state,
    creditLots,
    creditBalance: creditLots.reduce((total, lot) => total + lot.remaining, 0),
  };
}

export function getLocalBillingState(uid: string): BillingState {
  const raw = localStorage.getItem(localKey(uid));
  if (!raw) return { ...EMPTY_BILLING_STATE, transactions: [] };
  const parsed = JSON.parse(raw) as Partial<BillingState>;
  return normalizeCreditLots({
    ...EMPTY_BILLING_STATE,
    ...parsed,
    transactions: parsed.transactions || [],
    usageTimestamps: parsed.usageTimestamps || [],
  });
}

function hasFirestoreSession(uid: string): boolean {
  return Boolean(auth.currentUser && auth.currentUser.uid === uid);
}

function activeSubscription(state: BillingState, now = Date.now()): TeamSubscription | null {
  return state.teamSubscription && state.teamSubscription.expiresAt > now
    ? state.teamSubscription
    : null;
}

export function getToolCreditCost(config: BillingConfiguration, toolId: string): number {
  return config.toolCreditCosts[toolId] ?? config.defaultToolCreditCost;
}

export function getDiscountedPrice(price: number, config: BillingConfiguration): number {
  const discount = Math.min(100, Math.max(0, config.promotionalDiscountPercent || 0));
  return Math.round(price * (1 - discount / 100) * 100) / 100;
}

export async function loadBillingState(uid: string): Promise<BillingState> {
  const local = getLocalBillingState(uid);
  if (!hasFirestoreSession(uid)) return local;
  try {
    const [stateSnapshot, transactionSnapshot] = await Promise.all([
      getDoc(billingDoc(uid)),
      getDocs(query(transactionsCollection(uid), orderBy('createdAt', 'desc'), limit(100))),
    ]);
    const state = stateSnapshot.exists()
      ? { ...EMPTY_BILLING_STATE, ...stateSnapshot.data() as Partial<BillingState> }
      : local;
    const transactions = transactionSnapshot.docs.map((item) => item.data() as BillingTransaction);
    const combined = normalizeCreditLots({ ...state, transactions });
    if (stateSnapshot.exists() && combined.creditBalance !== state.creditBalance) {
      await setDoc(billingDoc(uid), {
        creditBalance: combined.creditBalance,
        creditLots: combined.creditLots,
      }, { merge: true });
    }
    saveLocal(uid, combined);
    return combined;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}/billing`);
  }
}

export async function loadBillingConfiguration(): Promise<BillingConfiguration> {
  try {
    const snapshot = await getDoc(doc(db, 'billingConfiguration', 'current'));
    return snapshot.exists()
      ? { ...DEFAULT_BILLING_CONFIGURATION, ...snapshot.data() as Partial<BillingConfiguration> }
      : DEFAULT_BILLING_CONFIGURATION;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'billingConfiguration/current');
  }
}

export async function isBillingAdmin(): Promise<boolean> {
  if (!auth.currentUser) return false;
  const token = await auth.currentUser.getIdTokenResult();
  return token.claims.admin === true;
}

export async function saveBillingConfiguration(config: BillingConfiguration): Promise<void> {
  if (!(await isBillingAdmin())) {
    throw new Error('Only an administrator can update billing configuration.');
  }
  try {
    await setDoc(doc(db, 'billingConfiguration', 'current'), config);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'billingConfiguration/current');
  }
}

async function appendCloudTransaction(uid: string, transaction: BillingTransaction): Promise<void> {
  await setDoc(doc(transactionsCollection(uid), transaction.id), transaction);
}

async function callMockPurchase(uid: string, body: Record<string, unknown>): Promise<BillingState | null> {
  if (!hasFirestoreSession(uid)) return null;
  const token = await auth.currentUser!.getIdToken();
  const response = await fetch(getAppApiUrl('/api/billing/mock-purchase'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Mock checkout failed (${response.status}).`);
  }
  return loadBillingState(uid);
}

export async function buyCreditPack(
  uid: string,
  state: BillingState,
  plan: CreditPlan,
  config: BillingConfiguration = DEFAULT_BILLING_CONFIGURATION
): Promise<BillingState> {
  const cloudState = await callMockPurchase(uid, { kind: 'credits', planId: plan.id });
  if (cloudState) return cloudState;
  const now = Date.now();
  const creditCount = plan.credits + plan.bonusCredits;
  const lot = {
    id: `purchase_${now}`,
    remaining: creditCount,
    expiresAt: plan.validityDays > 0 ? now + plan.validityDays * 24 * 60 * 60 * 1000 : null,
    maxFileSizeMB: plan.maxFileSizeMB,
  };
  const transaction: BillingTransaction = {
    id: lot.id,
    createdAt: now,
    description: `${plan.name} credit pack (simulated checkout)`,
    credits: creditCount,
    status: 'completed',
    amountINR: getDiscountedPrice(plan.price, config),
    kind: 'purchase',
  };
  const next = {
    ...state,
    creditBalance: state.creditBalance + creditCount,
    creditLots: [...state.creditLots, lot],
    creditsPurchased: state.creditsPurchased + creditCount,
    lastPurchaseAt: now,
    transactions: [transaction, ...state.transactions],
  };

  saveLocal(uid, next);
  return next;
}

export async function buyTeamPlan(
  uid: string,
  state: BillingState,
  duration: TeamDuration,
  seats: number,
  config: BillingConfiguration,
  owner?: { name: string; email: string }
): Promise<BillingState> {
  if (
    !Number.isInteger(seats) ||
    seats < config.minimumTeamMembers ||
    seats > config.maximumTeamMembers
  ) {
    throw new Error(`Team size must be between ${config.minimumTeamMembers} and ${config.maximumTeamMembers} members.`);
  }
  const cloudState = await callMockPurchase(uid, { kind: 'team', durationId: duration.id, seats });
  if (cloudState) return cloudState;
  const now = Date.now();
  const existingTeam = state.teamSubscription;
  if (existingTeam && existingTeam.members.length > seats) {
    throw new Error('The new plan needs enough seats for current team members.');
  }
  const subscription: TeamSubscription = {
    id: `team_${now}`,
    teamName: existingTeam?.teamName || 'My Team',
    seats,
    durationId: duration.id,
    startedAt: now,
    expiresAt: now + duration.days * 24 * 60 * 60 * 1000,
    maxFileSizeMB: Math.max(...config.creditPlans.map((plan) => plan.maxFileSizeMB)),
    maximumProcessingMinutes: config.maximumProcessingMinutes,
    fairUseJobsPerHour: config.fairUseJobsPerHour,
    members: existingTeam?.members || [{
      id: uid,
      name: owner?.name || auth.currentUser?.displayName || 'Owner',
      email: owner?.email || auth.currentUser?.email || 'Owner account',
      role: 'Owner',
      status: 'Active',
      joinedAt: now,
    }],
  };
  const transaction: BillingTransaction = {
    id: `team_purchase_${now}`,
    createdAt: now,
    description: `Team Unlimited · ${seats} seat${seats === 1 ? '' : 's'} · ${duration.label} (simulated checkout)`,
    credits: 0,
    status: 'completed',
    amountINR: getDiscountedPrice(duration.pricePerMember * seats, config),
    kind: 'team_purchase',
  };
  const next = { ...state, teamSubscription: subscription, lastPurchaseAt: now, transactions: [transaction, ...state.transactions] };

  saveLocal(uid, next);
  return next;
}

export async function saveTeamMembers(
  uid: string,
  state: BillingState,
  members: TeamMember[],
  teamName = state.teamSubscription?.teamName
): Promise<BillingState> {
  if (!state.teamSubscription) throw new Error('There is no team plan to update.');
  if (members.length > state.teamSubscription.seats) {
    throw new Error('The member list cannot exceed the number of purchased seats.');
  }
  const next = {
    ...state,
    teamSubscription: { ...state.teamSubscription, members, teamName: teamName || state.teamSubscription.teamName },
  };
  if (hasFirestoreSession(uid)) {
    const token = await auth.currentUser!.getIdToken();
    const response = await fetch(getAppApiUrl('/api/billing/team-members'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ members, teamName: teamName || state.teamSubscription.teamName }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || `Could not update team members (${response.status}).`);
    }
    return loadBillingState(uid);
  }
  saveLocal(uid, next);
  return next;
}

export async function recordSuccessfulToolUsage(
  uid: string,
  state: BillingState,
  toolId: string,
  toolName: string,
  cost: number
): Promise<BillingState> {
  const now = Date.now();
  const transactionId = `usage_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const transactionDetails = {
    id: transactionId,
    createdAt: now,
    description: toolName,
    status: 'completed',
    toolId,
    kind: 'usage',
  } satisfies Omit<BillingTransaction, 'credits'>;

  if (hasFirestoreSession(uid)) {
    try {
      const { state: next, transaction } = await runTransaction(db, async (transactionWriter) => {
        const reference = billingDoc(uid);
        const snapshot = await transactionWriter.get(reference);
        const current = { ...EMPTY_BILLING_STATE, ...(snapshot.exists() ? snapshot.data() : {}) } as BillingState;
        const isUnlimited = Boolean(activeSubscription(current, now));
        const currentWithLots = normalizeCreditLots(current, now);
        const usageWindowStart = now - 60 * 60 * 1000;
        const usageTimestamps = (current.usageTimestamps || []).filter((timestamp) => timestamp >= usageWindowStart);
        if (
          isUnlimited &&
          usageTimestamps.length >= (current.teamSubscription?.fairUseJobsPerHour || 0)
        ) {
          throw new Error('FAIR_USE_LIMIT');
        }
        if (!isUnlimited && currentWithLots.creditBalance < cost) {
          throw new Error('INSUFFICIENT_CREDITS');
        }
        let amountRemaining = isUnlimited ? 0 : cost;
        const creditLots = currentWithLots.creditLots
          .sort((first, second) => (first.expiresAt ?? Number.MAX_SAFE_INTEGER) - (second.expiresAt ?? Number.MAX_SAFE_INTEGER))
          .map((lot) => {
            const used = Math.min(lot.remaining, amountRemaining);
            amountRemaining -= used;
            return { ...lot, remaining: lot.remaining - used };
          })
          .filter((lot) => lot.remaining > 0);
        const updated: BillingState = {
          ...currentWithLots,
          creditLots,
          creditBalance: isUnlimited ? currentWithLots.creditBalance : currentWithLots.creditBalance - cost,
          creditsUsed: current.creditsUsed + (isUnlimited ? 0 : cost),
          usageTimestamps: [...usageTimestamps, now],
        };
        const completedTransaction: BillingTransaction = {
          ...transactionDetails,
          credits: isUnlimited ? 0 : -cost,
          status: 'completed',
          kind: 'usage',
        };
        transactionWriter.set(reference, {
          creditBalance: updated.creditBalance,
          creditLots: updated.creditLots,
          creditsUsed: updated.creditsUsed,
          creditsPurchased: current.creditsPurchased,
          lastPurchaseAt: current.lastPurchaseAt,
          teamSubscription: current.teamSubscription,
          usageTimestamps: updated.usageTimestamps,
        }, { merge: true });
        transactionWriter.set(doc(transactionsCollection(uid), completedTransaction.id), completedTransaction);
        return { state: updated, transaction: completedTransaction };
      });
      const merged = { ...next, transactions: [transaction, ...state.transactions] };
      saveLocal(uid, merged);
      return merged;
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') throw error;
      if (error instanceof Error && error.message === 'FAIR_USE_LIMIT') throw error;
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/billing`);
    }
  }

  const currentState = normalizeCreditLots(state, now);
  const unlimited = Boolean(activeSubscription(currentState, now));
  const usageWindowStart = now - 60 * 60 * 1000;
  const usageTimestamps = currentState.usageTimestamps.filter((timestamp) => timestamp >= usageWindowStart);
  if (
    unlimited &&
    usageTimestamps.length >= (currentState.teamSubscription?.fairUseJobsPerHour || 0)
  ) {
    throw new Error('FAIR_USE_LIMIT');
  }
  if (!unlimited && currentState.creditBalance < cost) {
    throw new Error('INSUFFICIENT_CREDITS');
  }
  let amountRemaining = unlimited ? 0 : cost;
  const creditLots = currentState.creditLots
    .sort((first, second) => (first.expiresAt ?? Number.MAX_SAFE_INTEGER) - (second.expiresAt ?? Number.MAX_SAFE_INTEGER))
    .map((lot) => {
      const used = Math.min(lot.remaining, amountRemaining);
      amountRemaining -= used;
      return { ...lot, remaining: lot.remaining - used };
    })
    .filter((lot) => lot.remaining > 0);
  const next = {
    ...currentState,
    creditLots,
    creditBalance: unlimited ? currentState.creditBalance : currentState.creditBalance - cost,
    creditsUsed: state.creditsUsed + (unlimited ? 0 : cost),
    usageTimestamps: [...usageTimestamps, now],
    transactions: [{
      ...transactionDetails,
      credits: unlimited ? 0 : -cost,
      status: 'completed',
      kind: 'usage',
    } as BillingTransaction, ...state.transactions],
  };
  saveLocal(uid, next);
  return next;
}

export function isUnlimitedActive(state: BillingState, now = Date.now()): boolean {
  return Boolean(activeSubscription(state, now));
}

export function getMaxAllowedFileSizeMB(state: BillingState, now = Date.now()): number {
  const team = activeSubscription(state, now);
  if (team) return team.maxFileSizeMB;
  return normalizeCreditLots(state, now).creditLots.reduce(
    (maximum, lot) => Math.max(maximum, lot.maxFileSizeMB || 0),
    0
  );
}

export function isFairUseLimitReached(state: BillingState, now = Date.now()): boolean {
  const team = activeSubscription(state, now);
  if (!team) return false;
  return state.usageTimestamps.filter((timestamp) => timestamp >= now - 60 * 60 * 1000).length >= team.fairUseJobsPerHour;
}

export function getBillingUid(uid?: string): string {
  return uid || auth.currentUser?.uid || 'local_guest';
}
