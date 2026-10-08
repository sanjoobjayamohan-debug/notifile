export interface CreditPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonusCredits: number;
  validityDays: number;
  maxFileSizeMB: number;
  description: string;
  popular: boolean;
  active: boolean;
}

export interface TeamDuration {
  id: 'week' | 'month' | 'year';
  label: string;
  days: number;
  pricePerMember: number;
  active: boolean;
}

export interface BillingConfiguration {
  creditPlans: CreditPlan[];
  teamDurations: TeamDuration[];
  teamSeatOptions: number[];
  minimumTeamMembers: number;
  maximumTeamMembers: number;
  toolCreditCosts: Record<string, number>;
  defaultToolCreditCost: number;
  maximumProcessingMinutes: number;
  fairUseJobsPerHour: number;
  promotionalDiscountPercent: number;
}

export const DEFAULT_BILLING_CONFIGURATION: BillingConfiguration = {
  creditPlans: [
    { id: 'starter', name: 'Starter', price: 50, credits: 50, bonusCredits: 0, validityDays: 365, maxFileSizeMB: 25, description: 'A flexible start for occasional tasks.', popular: false, active: true },
    { id: 'essential', name: 'Essential', price: 150, credits: 150, bonusCredits: 20, validityDays: 365, maxFileSizeMB: 50, description: 'Extra credits for regular document work.', popular: false, active: true },
    { id: 'plus', name: 'Plus', price: 300, credits: 300, bonusCredits: 60, validityDays: 365, maxFileSizeMB: 100, description: 'A balanced pack for everyday productivity.', popular: true, active: true },
    { id: 'pro', name: 'Pro', price: 800, credits: 800, bonusCredits: 200, validityDays: 365, maxFileSizeMB: 250, description: 'More room for large, frequent workloads.', popular: false, active: true },
    { id: 'max', name: 'Max', price: 1050, credits: 1050, bonusCredits: 350, validityDays: 365, maxFileSizeMB: 500, description: 'The best value for high-volume work.', popular: false, active: true },
  ],
  teamDurations: [
    { id: 'week', label: '7 Days', days: 7, pricePerMember: 300, active: true },
    { id: 'month', label: '1 Month', days: 30, pricePerMember: 799, active: true },
    { id: 'year', label: '1 Year', days: 365, pricePerMember: 7999, active: true },
  ],
  teamSeatOptions: [1, 2, 5, 10, 25, 50, 100],
  minimumTeamMembers: 1,
  maximumTeamMembers: 100,
  toolCreditCosts: {
    'compress-pdf': 5,
    'merge-pdf': 5,
    'split-pdf': 5,
    'rearrange-pdf': 5,
    'edit-pdf': 15,
    'delete-pages': 5,
    'crop-pdf': 5,
    'rotate-pdf': 5,
    'organize-pdf': 5,
    'extract-pages': 5,
    'fill-sign': 10,
    'add-watermark': 5,
    'protect-pdf': 5,
    'unlock-pdf': 5,
    'flatten-pdf': 5,
    'pdf-ocr': 15,
    'image-ocr': 15,
    'pdf-to-word': 10,
    'pdf-to-excel': 15,
    'pdf-to-ppt': 15,
    'remove-bg': 10,
    'compress-image': 5,
    'convert-image': 5,
    'crop-image': 5,
  },
  defaultToolCreditCost: 5,
  maximumProcessingMinutes: 20,
  fairUseJobsPerHour: 120,
  promotionalDiscountPercent: 0,
};
