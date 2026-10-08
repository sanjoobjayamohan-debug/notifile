/**
 * Modular Usage & Wallet Configuration
 */
export const USAGE_CONFIG = {
  INITIAL_FREE_QUOTA: 10,
  TIMEOUT_DURATION_MS: 20 * 60 * 1000, // 20 minutes
  SECOND_FREE_QUOTA: 5,
  MINIMUM_RECHARGE_INR: 482,
  DISCOUNT_PERCENT: 2, // 2% discount on every recharge
  DEDUCTION_PER_ACTIVITY_INR: 10, // ₹10 deducted per paid activity
  PRESET_AMOUNTS: [482, 1000, 2000, 5000],
  UPI_ID: 'notifile@upi',
  REFERENCE_PRICING: {
    WEEKLY: 482,
    MONTHLY: 674,
    ANNUAL: 6068,
  },
};

export interface UsageState {
  activitiesCount: number; // total activities performed
  timeoutStartedAt: number | null; // timestamp when 20m cooldown started
  walletBalance: number; // in INR (₹)
}

const STORAGE_KEY = 'notifile_usage_state_v2';

const DEFAULT_STATE: UsageState = {
  activitiesCount: 0,
  timeoutStartedAt: null,
  walletBalance: 0,
};

export function getUsageState(): UsageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveUsageState(state: UsageState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save usage state:', err);
  }
}

export interface ActivityPermission {
  canProceed: boolean;
  reason?: 'timeout' | 'insufficient_wallet' | 'ok';
  statusText: string;
  subText: string;
  freeUsesRemaining: number;
  totalFreeInCurrentBatch: number;
  currentFreeBatchUsed: number;
  timeoutSecondsRemaining: number;
  walletBalance: number;
  stage: 'initial_free' | 'in_timeout' | 'second_free' | 'wallet_required' | 'wallet_active';
}

export function checkActivityPermission(): ActivityPermission {
  const state = getUsageState();
  const now = Date.now();

  // 1. If user has active wallet balance
  if (state.walletBalance >= USAGE_CONFIG.DEDUCTION_PER_ACTIVITY_INR) {
    return {
      canProceed: true,
      reason: 'ok',
      statusText: 'Wallet Active',
      subText: `₹${state.walletBalance.toFixed(2)} balance available`,
      freeUsesRemaining: 0,
      totalFreeInCurrentBatch: 0,
      currentFreeBatchUsed: 0,
      timeoutSecondsRemaining: 0,
      walletBalance: state.walletBalance,
      stage: 'wallet_active',
    };
  }

  // 2. Stage 1: First 10 activities are free
  if (state.activitiesCount < USAGE_CONFIG.INITIAL_FREE_QUOTA) {
    const remaining = USAGE_CONFIG.INITIAL_FREE_QUOTA - state.activitiesCount;
    return {
      canProceed: true,
      reason: 'ok',
      statusText: `FREE USES: ${state.activitiesCount} / ${USAGE_CONFIG.INITIAL_FREE_QUOTA}`,
      subText: `${remaining} free ${remaining === 1 ? 'use' : 'uses'} remaining`,
      freeUsesRemaining: remaining,
      totalFreeInCurrentBatch: USAGE_CONFIG.INITIAL_FREE_QUOTA,
      currentFreeBatchUsed: state.activitiesCount,
      timeoutSecondsRemaining: 0,
      walletBalance: state.walletBalance,
      stage: 'initial_free',
    };
  }

  // 3. Stage 2: First 10 used -> 20-minute timeout check
  if (!state.timeoutStartedAt) {
    state.timeoutStartedAt = now;
    saveUsageState(state);
  }

  const elapsed = now - state.timeoutStartedAt;
  const remainingMs = USAGE_CONFIG.TIMEOUT_DURATION_MS - elapsed;

  if (remainingMs > 0) {
    const secLeft = Math.ceil(remainingMs / 1000);
    const mins = Math.floor(secLeft / 60);
    const secs = secLeft % 60;
    const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    return {
      canProceed: false,
      reason: 'timeout',
      statusText: 'Free limit reached',
      subText: `Try again in ${formatted}`,
      freeUsesRemaining: 0,
      totalFreeInCurrentBatch: USAGE_CONFIG.INITIAL_FREE_QUOTA,
      currentFreeBatchUsed: USAGE_CONFIG.INITIAL_FREE_QUOTA,
      timeoutSecondsRemaining: secLeft,
      walletBalance: state.walletBalance,
      stage: 'in_timeout',
    };
  }

  // 4. Stage 3: After 20-minute timeout ends, give 5 additional free usages
  const secondBatchCount = state.activitiesCount - USAGE_CONFIG.INITIAL_FREE_QUOTA;
  if (secondBatchCount < USAGE_CONFIG.SECOND_FREE_QUOTA) {
    const remaining = USAGE_CONFIG.SECOND_FREE_QUOTA - secondBatchCount;
    return {
      canProceed: true,
      reason: 'ok',
      statusText: `FREE USES: ${secondBatchCount} / ${USAGE_CONFIG.SECOND_FREE_QUOTA}`,
      subText: '5 free uses unlocked after cooldown',
      freeUsesRemaining: remaining,
      totalFreeInCurrentBatch: USAGE_CONFIG.SECOND_FREE_QUOTA,
      currentFreeBatchUsed: secondBatchCount,
      timeoutSecondsRemaining: 0,
      walletBalance: state.walletBalance,
      stage: 'second_free',
    };
  }

  // 5. Stage 4: 5 additional free uses completed -> Wallet Recharge Required
  return {
    canProceed: false,
    reason: 'insufficient_wallet',
    statusText: 'Insufficient wallet balance',
    subText: 'Recharge your wallet to continue.',
    freeUsesRemaining: 0,
    totalFreeInCurrentBatch: USAGE_CONFIG.SECOND_FREE_QUOTA,
    currentFreeBatchUsed: USAGE_CONFIG.SECOND_FREE_QUOTA,
    timeoutSecondsRemaining: 0,
    walletBalance: state.walletBalance,
    stage: 'wallet_required',
  };
}

/**
 * Record an activity execution
 */
export function recordUsageActivity(): { chargedFromWallet: boolean; newBalance: number } {
  const state = getUsageState();

  if (state.walletBalance >= USAGE_CONFIG.DEDUCTION_PER_ACTIVITY_INR) {
    state.walletBalance -= USAGE_CONFIG.DEDUCTION_PER_ACTIVITY_INR;
    saveUsageState(state);
    return { chargedFromWallet: true, newBalance: state.walletBalance };
  }

  state.activitiesCount += 1;

  // If hitting 10, trigger 20m timeout immediately
  if (state.activitiesCount === USAGE_CONFIG.INITIAL_FREE_QUOTA) {
    state.timeoutStartedAt = Date.now();
  }

  saveUsageState(state);
  return { chargedFromWallet: false, newBalance: state.walletBalance };
}

/**
 * Add funds to wallet (e.g. ₹482 adds ₹482 to balance, while user paid discounted price)
 */
export function addWalletFunds(rechargeAmountINR: number): number {
  const state = getUsageState();
  state.walletBalance += rechargeAmountINR;
  saveUsageState(state);
  return state.walletBalance;
}

/**
 * Calculate 2% discount and payable amount
 */
export function calculateRecharge(amount: number) {
  const discountRate = USAGE_CONFIG.DISCOUNT_PERCENT / 100;
  const discountAmount = +(amount * discountRate).toFixed(2);
  const payableAmount = +(amount - discountAmount).toFixed(2);
  return {
    rechargeAmount: amount,
    discountPercent: USAGE_CONFIG.DISCOUNT_PERCENT,
    discountAmount,
    payableAmount,
  };
}
