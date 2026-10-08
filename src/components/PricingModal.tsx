import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Crown, Plus, ShieldCheck, Sparkles, Users, X, Zap } from 'lucide-react';
import {
  BillingConfiguration,
  BillingState,
  CreditPlan,
  TeamDuration,
  TeamMember,
  getDiscountedPrice,
  isUnlimitedActive,
} from '../services/billingService';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  billing: BillingState;
  config: BillingConfiguration;
  isAdmin: boolean;
  onPurchaseCredits: (plan: CreditPlan) => Promise<void>;
  onPurchaseTeam: (duration: TeamDuration, seats: number) => Promise<void>;
  onSaveConfiguration: (config: BillingConfiguration) => Promise<void>;
  onSaveTeamMembers: (members: TeamMember[], teamName?: string) => Promise<void>;
}

type CheckoutSelection =
  | { kind: 'credits'; plan: CreditPlan }
  | { kind: 'team'; duration: TeamDuration; seats: number };

const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  billing,
  config,
  isAdmin,
  onPurchaseCredits,
  onPurchaseTeam,
  onSaveConfiguration,
  onSaveTeamMembers,
}) => {
  const [tab, setTab] = useState<'credits' | 'team'>('credits');
  const [seats, setSeats] = useState(config.teamSeatOptions[0] || 1);
  const [durationId, setDurationId] = useState<TeamDuration['id']>('week');
  const [checkout, setCheckout] = useState<CheckoutSelection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [teamNameDraft, setTeamNameDraft] = useState(billing.teamSubscription?.teamName || 'My Team');
  const [newToolId, setNewToolId] = useState('');
  const [newToolCost, setNewToolCost] = useState(5);
  const activeTeam = isUnlimitedActive(billing) ? billing.teamSubscription : null;

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      setCheckout(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTeam) setTeamNameDraft(activeTeam.teamName);
  }, [activeTeam?.id, activeTeam?.teamName]);

  const duration = config.teamDurations.find((item) => item.id === durationId) || config.teamDurations[0];
  const teamPrice = duration ? duration.pricePerMember * seats : 0;
  const discountedTeamPrice = getDiscountedPrice(teamPrice, config);
  const yearly = config.teamDurations.find((item) => item.id === 'year');
  const monthly = config.teamDurations.find((item) => item.id === 'month');
  const yearlySavings = yearly && monthly && monthly.pricePerMember > 0
    ? Math.max(0, Math.round((1 - yearly.pricePerMember / (monthly.pricePerMember * 12)) * 100))
    : 0;

  const activeCreditPlans = useMemo(
    () => config.creditPlans.filter((plan) => plan.active),
    [config.creditPlans]
  );

  if (!isOpen) return null;

  const beginCheckout = (selection: CheckoutSelection) => {
    setError('');
    setSuccess('');
    setCheckout(selection);
  };

  const completeCheckout = async () => {
    if (!checkout) return;
    setIsSubmitting(true);
    setError('');
    try {
      if (checkout.kind === 'credits') await onPurchaseCredits(checkout.plan);
      else await onPurchaseTeam(checkout.duration, checkout.seats);
      setCheckout(null);
      setSuccess('Simulation complete. No payment was collected.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete the simulated checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCreditPlan = (id: string, patch: Partial<CreditPlan>) => {
    onSaveConfiguration({
      ...config,
      creditPlans: config.creditPlans.map((plan) => plan.id === id ? { ...plan, ...patch } : plan),
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'));
  };

  const updateTeamDuration = (id: TeamDuration['id'], patch: Partial<TeamDuration>) => {
    onSaveConfiguration({
      ...config,
      teamDurations: config.teamDurations.map((item) => item.id === id ? { ...item, ...patch } : item),
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'));
  };

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!billing.teamSubscription || !memberEmail.trim()) return;
    const members = billing.teamSubscription.members;
    if (members.length >= billing.teamSubscription.seats) {
      setError('All purchased team seats are currently in use.');
      return;
    }
    const email = memberEmail.trim().toLowerCase();
    if (members.some((member) => member.email.toLowerCase() === email)) {
      setError('That email is already on the team.');
      return;
    }
    try {
      await onSaveTeamMembers([
        ...members,
        {
          id: `invite_${Date.now()}`,
          name: memberName.trim() || email.split('@')[0],
          email,
          role: 'Member',
          status: 'Pending',
          joinedAt: Date.now(),
        },
      ]);
      setMemberEmail('');
      setMemberName('');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the team member.');
    }
  };

  const removeMember = (id: string) => {
    if (!billing.teamSubscription) return;
    onSaveTeamMembers(billing.teamSubscription.members.filter((member) => member.id !== id))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not remove the member.'));
  };

  const changeMemberRole = (id: string, role: TeamMember['role']) => {
    if (!billing.teamSubscription) return;
    onSaveTeamMembers(billing.teamSubscription.members.map((member) =>
      member.id === id ? { ...member, role } : member
    )).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update the member role.'));
  };

  const saveTeamName = (event: React.FormEvent) => {
    event.preventDefault();
    if (billing.teamSubscription) {
      onSaveTeamMembers(billing.teamSubscription.members, teamNameDraft.trim())
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not save the team name.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] overflow-y-auto bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="relative min-h-full w-full p-5 sm:p-8 lg:p-10">
        <button onClick={onClose} aria-label="Close pricing" className="fixed right-4 top-4 z-10 rounded-xl border border-neutral-200 bg-white p-2 text-neutral-400 shadow-sm hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 sm:right-6 sm:top-6">
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-8 max-w-3xl pt-4 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" /> Flexible plans for your workflow
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">Choose how you work</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Use credits when you need flexibility. Choose Team Unlimited when you need unlimited processing.
          </p>
        </div>

        <div className="mx-auto mb-8 flex w-fit rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950">
          {(['credits', 'team'] as const).map((item) => (
            <button
              key={item}
              onClick={() => { setTab(item); setCheckout(null); setError(''); }}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === item ? 'bg-white text-blue-700 shadow-sm dark:bg-neutral-800 dark:text-blue-300' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
            >
              {item === 'credits' ? 'Credits' : 'Team Unlimited'}
            </button>
          ))}
        </div>

        {success && <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">{success}</div>}
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

        {checkout ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900/70 dark:bg-blue-950/20">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Order summary</h3>
            {checkout.kind === 'credits' ? (
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow label="Credit pack" value={checkout.plan.name} />
                <SummaryRow label="Credits" value={`${checkout.plan.credits + checkout.plan.bonusCredits} credits`} />
                <SummaryRow label="Validity" value={`${checkout.plan.validityDays} days`} />
                {config.promotionalDiscountPercent > 0 && <SummaryRow label="Promotion" value={`${config.promotionalDiscountPercent}% off ${money(checkout.plan.price)}`} />}
                <SummaryRow label="Amount" value={money(getDiscountedPrice(checkout.plan.price, config))} />
                <SummaryRow label="Payment" value="Mock checkout — no payment collected" />
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow label="Plan" value="Team Unlimited" />
                <SummaryRow label="Seats" value={`${checkout.seats} team member${checkout.seats === 1 ? '' : 's'}`} />
                <SummaryRow label="Duration" value={checkout.duration.label} />
                {config.promotionalDiscountPercent > 0 && <SummaryRow label="Promotion" value={`${config.promotionalDiscountPercent}% off ${money(checkout.duration.pricePerMember * checkout.seats)}`} />}
                <SummaryRow label="Amount" value={money(getDiscountedPrice(checkout.duration.pricePerMember * checkout.seats, config))} />
                <SummaryRow label="Payment" value="Mock checkout — no payment collected" />
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setCheckout(null)} className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">Back</button>
              <button disabled={isSubmitting} onClick={completeCheckout} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {isSubmitting ? 'Processing…' : 'Confirm simulation'}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-neutral-500">This development checkout is not a real payment and must not be used for production sales.</p>
          </div>
        ) : tab === 'credits' ? (
          <>
            <div className="mx-auto grid max-w-screen-2xl gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {activeCreditPlans.map((plan) => (
                <article key={plan.id} className={`relative flex flex-col rounded-2xl border bg-white p-5 dark:bg-neutral-900 ${plan.popular ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200 dark:border-neutral-800'}`}>
                  {plan.popular && <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Popular</span>}
                  <p className="text-sm font-semibold text-neutral-500">{plan.name}</p>
                  <p className="mt-2 text-3xl font-bold text-neutral-900 dark:text-white">{money(getDiscountedPrice(plan.price, config))}</p>
                  {config.promotionalDiscountPercent > 0 && <p className="text-xs text-neutral-400 line-through">{money(plan.price)}</p>}
                  <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-300">{plan.credits + plan.bonusCredits} credits{plan.bonusCredits > 0 ? ` · ${plan.bonusCredits} bonus` : ''}</p>
                  <p className="mt-3 min-h-10 text-xs leading-5 text-neutral-500">{plan.description}</p>
                  <ul className="my-4 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" />Valid for {plan.validityDays} days</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" />About {Math.floor((plan.credits + plan.bonusCredits) / Math.max(1, config.defaultToolCreditCost))} standard operations</li>
                  </ul>
                  <button onClick={() => beginCheckout({ kind: 'credits', plan })} className="mt-auto rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Buy credits</button>
                </article>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <strong className="text-neutral-900 dark:text-white">Tool costs are shown before processing.</strong> Your balance is charged only after a successful operation. An active team subscription takes priority over credits.
            </div>
          </>
        ) : (
          <div className="mx-auto grid max-w-screen-2xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white"><Users className="h-4 w-4 text-blue-600" />Number of team members</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {config.teamSeatOptions.filter((option) => option >= config.minimumTeamMembers && option <= config.maximumTeamMembers).map((option) => (
                  <button key={option} onClick={() => setSeats(option)} className={`min-w-12 rounded-lg border px-3 py-2 text-sm font-semibold ${seats === option ? 'border-blue-600 bg-blue-600 text-white' : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'}`}>{option}</button>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white"><Clock3 className="h-4 w-4 text-blue-600" />Duration</div>
              <div className="mt-3 space-y-2">
                {config.teamDurations.filter((item) => item.active).map((item) => (
                  <button key={item.id} onClick={() => setDurationId(item.id)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${durationId === item.id ? 'border-blue-500 bg-white ring-1 ring-blue-500 dark:bg-neutral-900' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'}`}>
                    <span className="flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200">
                      {item.label}
                      {item.id === 'year' && yearlySavings > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">Save {yearlySavings}%</span>}
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-white">{money(item.pricePerMember)} / member</span>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-end justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <span className="text-sm font-medium text-neutral-500">Total</span>
                <span className="text-2xl font-bold text-neutral-900 dark:text-white">{money(discountedTeamPrice)}</span>
              </div>
              <button disabled={!duration} onClick={() => duration && beginCheckout({ kind: 'team', duration, seats })} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">Buy Team Plan</button>
              <p className="mt-3 text-xs leading-5 text-neutral-500">Unlimited access is subject to configurable file-size, processing-time, fair-use, and system-resource limits.</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900/70 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white"><Crown className="h-4 w-4 text-blue-600" />Team Unlimited</div>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Unlimited PDF processing, conversions, OCR, image tools, batch processing, and workflows while the plan is active. Credits remain available when it expires.</p>
                {activeTeam ? (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-sm dark:border-blue-900 dark:bg-neutral-900">
                    <form onSubmit={saveTeamName} className="flex gap-2">
                      <input aria-label="Team name" maxLength={80} value={teamNameDraft} onChange={(event) => setTeamNameDraft(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm font-bold dark:border-neutral-700 dark:bg-neutral-950" />
                      <button className="rounded-lg border border-neutral-200 px-2 py-1 text-xs font-semibold dark:border-neutral-700">Save name</button>
                      <span className="shrink-0 self-center text-xs">{activeTeam.seats} seats</span>
                    </form>
                    <div className="mt-1 text-xs text-neutral-500">{activeTeam.members.length} used · {Math.max(0, activeTeam.seats - activeTeam.members.length)} available</div>
                    <div className="mt-1 text-xs text-neutral-500">Started {new Date(activeTeam.startedAt).toLocaleDateString()}</div>
                    <div className="mt-1 text-xs text-neutral-500">Expires {new Date(activeTeam.expiresAt).toLocaleDateString()}</div>
                    <form onSubmit={addMember} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Member name" className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950" />
                      <input required type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="Email address" className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950" />
                      <button className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">Add Member</button>
                    </form>
                    <p className="mt-2 text-[11px] text-neutral-500">Members are stored as pending seats; invitation email and acceptance are not configured in this mock checkout.</p>
                    <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                      {activeTeam.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <span className="min-w-0 truncate"><strong>{member.name}</strong><span className="ml-2 text-neutral-500">{member.email}</span></span>
                          {member.role === 'Owner' ? (
                            <span className="shrink-0 text-neutral-500">{member.role} · {member.status}</span>
                          ) : (
                            <select aria-label={`Role for ${member.email}`} value={member.role} onChange={(event) => changeMemberRole(member.id, event.target.value as TeamMember['role'])} className="shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] dark:border-neutral-700 dark:bg-neutral-950">
                              <option value="Admin">Admin</option><option value="Member">Member</option>
                            </select>
                          )}
                          {member.role !== 'Owner' && <button onClick={() => removeMember(member.id)} className="shrink-0 text-red-600 hover:underline">Remove</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-2 text-xs text-neutral-500"><ShieldCheck className="h-4 w-4 text-blue-600" />Credits are used when no team plan is active.</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto mt-8 flex max-w-screen-2xl flex-col justify-between gap-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500 dark:border-neutral-800 sm:flex-row sm:items-center">
          <span>Current balance: <strong className="text-neutral-900 dark:text-white">{billing.creditBalance.toLocaleString()} credits</strong></span>
          <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-blue-600" />Mock checkout is for development only</span>
          {isAdmin && <button onClick={() => setAdminOpen((value) => !value)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{adminOpen ? 'Hide pricing controls' : 'Admin pricing controls'}</button>}
        </div>

        {isAdmin && adminOpen && (
          <section className="mx-auto mt-5 max-w-screen-2xl rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Pricing configuration</h3>
            <p className="mb-4 mt-1 text-xs text-neutral-500">Saved centrally in Firestore. Admin claim required by Firestore rules.</p>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {config.creditPlans.map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-2 text-xs font-bold">{plan.name}</div>
                    <TextEditor label="Plan name" value={plan.name} onChange={(value) => updateCreditPlan(plan.id, { name: value })} />
                    <NumberEditor label="Price (₹)" value={plan.price} onChange={(value) => updateCreditPlan(plan.id, { price: value })} />
                    <NumberEditor label="Credits" value={plan.credits} onChange={(value) => updateCreditPlan(plan.id, { credits: value })} />
                    <NumberEditor label="Bonus credits" value={plan.bonusCredits} onChange={(value) => updateCreditPlan(plan.id, { bonusCredits: value })} />
                    <NumberEditor label="Validity (days)" value={plan.validityDays} onChange={(value) => updateCreditPlan(plan.id, { validityDays: value })} />
                    <NumberEditor label="Future max file size (MB; not enforced)" value={plan.maxFileSizeMB} onChange={(value) => updateCreditPlan(plan.id, { maxFileSizeMB: value })} />
                    <TextEditor label="Description" value={plan.description} onChange={(value) => updateCreditPlan(plan.id, { description: value })} />
                    <div className="flex gap-3 text-[11px]">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={plan.active} onChange={(event) => updateCreditPlan(plan.id, { active: event.target.checked })} />Enabled</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={plan.popular} onChange={(event) => updateCreditPlan(plan.id, { popular: event.target.checked })} />Popular</label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {config.teamDurations.map((item) => (
                  <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-2 text-xs font-bold">{item.label}</div>
                    <TextEditor label="Label" value={item.label} onChange={(value) => updateTeamDuration(item.id, { label: value })} />
                    <NumberEditor label="Duration (days)" value={item.days} onChange={(value) => updateTeamDuration(item.id, { days: value })} />
                    <NumberEditor label="Price per member (₹)" value={item.pricePerMember} onChange={(value) => updateTeamDuration(item.id, { pricePerMember: value })} />
                    <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={item.active} onChange={(event) => updateTeamDuration(item.id, { active: event.target.checked })} />Enabled</label>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberEditor label="Minimum team members" value={config.minimumTeamMembers} onChange={(value) => onSaveConfiguration({ ...config, minimumTeamMembers: value }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'))} />
                <NumberEditor label="Maximum team members" value={config.maximumTeamMembers} onChange={(value) => onSaveConfiguration({ ...config, maximumTeamMembers: value }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'))} />
                <NumberListEditor label="Seat-count options" value={config.teamSeatOptions} onChange={(value) => onSaveConfiguration({ ...config, teamSeatOptions: value }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'))} />
              </div>
              <h4 className="text-xs font-bold">Tool costs (credits)</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(config.toolCreditCosts).map(([toolId, cost]) => (
                  <NumberEditor key={toolId} label={toolId} value={cost} onChange={(value) => onSaveConfiguration({ ...config, toolCreditCosts: { ...config.toolCreditCosts, [toolId]: value } }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'))} />
                ))}
                <NumberEditor label="Default tool cost" value={config.defaultToolCreditCost} onChange={(value) => onSaveConfiguration({ ...config, defaultToolCreditCost: value }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'))} />
                <NumberEditor label="Max processing time (minutes)" value={config.maximumProcessingMinutes} onChange={(value) => onSaveConfiguration({ ...config, maximumProcessingMinutes: value }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'))} />
                <NumberEditor label="Fair-use jobs/hour" value={config.fairUseJobsPerHour} onChange={(value) => onSaveConfiguration({ ...config, fairUseJobsPerHour: value }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'))} />
                <NumberEditor label="Promotional discount (%)" value={config.promotionalDiscountPercent} onChange={(value) => onSaveConfiguration({ ...config, promotionalDiscountPercent: Math.min(100, value) }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update pricing.'))} />
              </div>
              <form onSubmit={(event) => {
                event.preventDefault();
                const id = newToolId.trim();
                if (!id) return;
                onSaveConfiguration({ ...config, toolCreditCosts: { ...config.toolCreditCosts, [id]: newToolCost } })
                  .then(() => setNewToolId(''))
                  .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not add tool pricing.'));
              }} className="flex flex-wrap gap-2">
                <input required value={newToolId} onChange={(event) => setNewToolId(event.target.value)} placeholder="New tool ID" className="min-w-48 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950" />
                <input type="number" min={0} value={newToolCost} onChange={(event) => setNewToolCost(Math.max(0, Number(event.target.value) || 0))} aria-label="New tool credit cost" className="w-28 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950" />
                <button className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">Add tool cost</button>
              </form>
              <p className="text-[11px] text-neutral-500">New tools use the default credit cost unless an explicit tool ID is added. Effective configuration is shared from Firestore.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 border-b border-neutral-200/70 pb-2 dark:border-neutral-800">
    <span className="text-neutral-500">{label}</span><strong className="text-right text-neutral-900 dark:text-white">{value}</strong>
  </div>
);

const NumberEditor = ({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="mb-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(event) => setDraft(Math.max(0, Number(event.target.value) || 0))}
        onBlur={() => { if (draft !== value) onChange(draft); }}
        className="w-24 rounded-md border border-neutral-200 bg-white px-2 py-1 text-right text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      />
    </label>
  );
};

const TextEditor = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="mb-2 block text-[11px] text-neutral-500">
      <span className="mb-1 block">{label}</span>
      <input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onChange(draft); }} className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
    </label>
  );
};

const NumberListEditor = ({ label, value, onChange }: { label: string; value: number[]; onChange: (value: number[]) => void }) => {
  const [draft, setDraft] = useState(value.join(', '));
  useEffect(() => setDraft(value.join(', ')), [value]);
  return (
    <label className="text-[11px] text-neutral-500">
      <span className="mb-1 block">{label} (comma-separated)</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== value.join(', ')) {
            onChange([...new Set(draft.split(',').map((entry) => Number(entry.trim())).filter((number) => Number.isInteger(number) && number > 0))].sort((a, b) => a - b));
          }
        }}
        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      />
    </label>
  );
};
