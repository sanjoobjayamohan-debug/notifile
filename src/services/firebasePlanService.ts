import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../firebase/config';
import { USAGE_CONFIG } from './usageEngine';

export interface UserPlanData {
  uid: string;
  email: string;
  displayName: string;
  currentPlan: 'free_tier' | 'wallet_recharge' | 'unlimited_pass';
  walletBalance: number;
  activitiesCount: number;
  timeoutStartedAt?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Fetch or initialize the user's plan state in Firestore
 */
export async function getOrInitUserPlan(uid: string, email: string, displayName = 'David'): Promise<UserPlanData> {
  const localProfile: UserPlanData = {
    uid,
    email,
    displayName,
    currentPlan: 'free_tier',
    walletBalance: 0,
    activitiesCount: 0,
    createdAt: new Date().toISOString(),
  };

  // If not signed in via Firebase Auth, return local profile fallback
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    return localProfile;
  }

  const userRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserPlanData;
    }

    await setDoc(userRef, localProfile);
    return localProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

/**
 * Verify plan and quota status in real time
 */
export interface PlanVerificationResult {
  canExecute: boolean;
  reason: 'ok' | 'timeout' | 'plan_exhausted' | 'insufficient_balance';
  message: string;
  detailedNotice: string;
  remainingUses: number;
  walletBalance: number;
  timeoutSecondsRemaining: number;
  planName: string;
}

export function evaluateUserPlan(plan: UserPlanData): PlanVerificationResult {
  const now = Date.now();

  // 1. Paid Wallet balance available (deducts ₹10 per task)
  if (plan.walletBalance >= USAGE_CONFIG.DEDUCTION_PER_ACTIVITY_INR) {
    return {
      canExecute: true,
      reason: 'ok',
      message: 'Wallet Balance Active',
      detailedNotice: `₹${plan.walletBalance.toFixed(2)} balance available.`,
      remainingUses: Math.floor(plan.walletBalance / USAGE_CONFIG.DEDUCTION_PER_ACTIVITY_INR),
      walletBalance: plan.walletBalance,
      timeoutSecondsRemaining: 0,
      planName: 'UPI Wallet Pay-As-You-Go',
    };
  }

  // 2. Initial Free Tier: First 10 uses
  if (plan.activitiesCount < USAGE_CONFIG.INITIAL_FREE_QUOTA) {
    const remaining = USAGE_CONFIG.INITIAL_FREE_QUOTA - plan.activitiesCount;
    return {
      canExecute: true,
      reason: 'ok',
      message: `FREE USES: ${plan.activitiesCount} / ${USAGE_CONFIG.INITIAL_FREE_QUOTA}`,
      detailedNotice: `${remaining} free uses remaining on your starter quota.`,
      remainingUses: remaining,
      walletBalance: plan.walletBalance,
      timeoutSecondsRemaining: 0,
      planName: 'Free Starter Plan (Batch 1)',
    };
  }

  // 3. 20-minute Timeout evaluation
  const timeoutStart = plan.timeoutStartedAt || now;
  const elapsed = now - timeoutStart;
  const remainingMs = USAGE_CONFIG.TIMEOUT_DURATION_MS - elapsed;

  if (remainingMs > 0) {
    const secLeft = Math.ceil(remainingMs / 1000);
    const mins = Math.floor(secLeft / 60);
    const secs = secLeft % 60;
    const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    return {
      canExecute: false,
      reason: 'timeout',
      message: 'Free limit reached',
      detailedNotice: `Your 10 free uses have ended. Cooldown active: try again in ${formatted}.`,
      remainingUses: 0,
      walletBalance: plan.walletBalance,
      timeoutSecondsRemaining: secLeft,
      planName: 'Cooldown Timeout (20m)',
    };
  }

  // 4. Second Free Tier: 5 additional uses after timeout
  const secondBatchCount = plan.activitiesCount - USAGE_CONFIG.INITIAL_FREE_QUOTA;
  if (secondBatchCount < USAGE_CONFIG.SECOND_FREE_QUOTA) {
    const remaining = USAGE_CONFIG.SECOND_FREE_QUOTA - secondBatchCount;
    return {
      canExecute: true,
      reason: 'ok',
      message: `FREE USES: ${secondBatchCount} / ${USAGE_CONFIG.SECOND_FREE_QUOTA}`,
      detailedNotice: `5 free uses unlocked after cooldown (${remaining} remaining).`,
      remainingUses: remaining,
      walletBalance: plan.walletBalance,
      timeoutSecondsRemaining: 0,
      planName: 'Free Post-Cooldown Plan (Batch 2)',
    };
  }

  // 5. All free uses finished -> Wallet required
  return {
    canExecute: false,
    reason: 'plan_exhausted',
    message: 'Plan Ended & Quota Exhausted',
    detailedNotice: 'All 15 free uses have been completed. Please recharge your wallet (min ₹482) to continue.',
    remainingUses: 0,
    walletBalance: plan.walletBalance,
    timeoutSecondsRemaining: 0,
    planName: 'Plan Ended (Recharge Required)',
  };
}

/**
 * Log activity and update plan stats in Firestore
 */
export async function recordPlanActivityInFirestore(
  userId: string,
  activity: {
    toolId: string;
    toolName: string;
    fileName: string;
    originalSize: number;
    resultSize: number;
  },
  currentPlan: UserPlanData
): Promise<UserPlanData> {
  const userRef = doc(db, 'users', userId);
  const actRef = doc(collection(db, 'users', userId, 'activities'));

  let newBalance = currentPlan.walletBalance;
  let charged = 0;
  if (currentPlan.walletBalance >= USAGE_CONFIG.DEDUCTION_PER_ACTIVITY_INR) {
    charged = USAGE_CONFIG.DEDUCTION_PER_ACTIVITY_INR;
    newBalance -= charged;
  }

  const newCount = currentPlan.activitiesCount + 1;
  const timeoutStartedAt =
    newCount === USAGE_CONFIG.INITIAL_FREE_QUOTA
      ? Date.now()
      : currentPlan.timeoutStartedAt;

  const updatedProfile: UserPlanData = {
    ...currentPlan,
    walletBalance: newBalance,
    activitiesCount: newCount,
    timeoutStartedAt,
    updatedAt: new Date().toISOString(),
  };

  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return updatedProfile;
  }

  try {
    await setDoc(actRef, {
      id: actRef.id,
      userId,
      toolId: activity.toolId,
      toolName: activity.toolName,
      fileName: activity.fileName,
      originalSize: activity.originalSize,
      resultSize: activity.resultSize,
      chargedAmount: charged,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });

    await updateDoc(userRef, {
      walletBalance: newBalance,
      activitiesCount: newCount,
      ...(timeoutStartedAt ? { timeoutStartedAt } : {}),
      updatedAt: new Date().toISOString(),
    });

    return updatedProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/activities`);
  }
}

/**
 * Record recharge in Firestore
 */
export async function recordRechargeInFirestore(
  userId: string,
  rechargeAmount: number,
  payableAmount: number
): Promise<number> {
  const userRef = doc(db, 'users', userId);
  const txRef = doc(collection(db, 'users', userId, 'transactions'));

  try {
    const snap = await getDoc(userRef);
    const existingBal = snap.exists() ? (snap.data().walletBalance || 0) : 0;
    const newBal = existingBal + rechargeAmount;

    await setDoc(txRef, {
      id: txRef.id,
      userId,
      rechargeAmount,
      discountAmount: +(rechargeAmount - payableAmount).toFixed(2),
      payableAmount,
      upiId: USAGE_CONFIG.UPI_ID,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });

    await updateDoc(userRef, {
      walletBalance: newBal,
      currentPlan: 'wallet_recharge',
      updatedAt: new Date().toISOString(),
    });

    return newBal;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/transactions`);
  }
}
