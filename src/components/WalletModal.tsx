import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  Tag,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  USAGE_CONFIG,
  addWalletFunds,
  calculateRecharge,
} from '../services/usageEngine';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onFundsAdded: (newBalance: number) => void;
  initialAmount?: number;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  currentBalance,
  onFundsAdded,
  initialAmount,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(
    initialAmount && initialAmount >= USAGE_CONFIG.MINIMUM_RECHARGE_INR
      ? initialAmount
      : USAGE_CONFIG.MINIMUM_RECHARGE_INR
  );
  const [customInput, setCustomInput] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState<number>(0);
  const [newBalanceDisplay, setNewBalanceDisplay] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const calculation = calculateRecharge(selectedAmount);

  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setIsVerifying(false);
      setErrorMsg(null);
      setCustomInput('');
      return;
    }
    generateUpiQR(calculation.payableAmount);
  }, [isOpen, selectedAmount, calculation.payableAmount]);

  const generateUpiQR = async (payable: number) => {
    try {
      const upiUrl = `upi://pay?pa=${USAGE_CONFIG.UPI_ID}&pn=Notifile&am=${payable}&cu=INR&tn=Notifile%20Wallet%20Recharge`;
      const dataUrl = await QRCode.toDataURL(upiUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#1d4ed8',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate UPI QR:', err);
    }
  };

  const handleSelectPreset = (amt: number) => {
    setSelectedAmount(amt);
    setCustomInput('');
    setErrorMsg(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      if (num < USAGE_CONFIG.MINIMUM_RECHARGE_INR) {
        setErrorMsg(`Minimum recharge amount is ₹${USAGE_CONFIG.MINIMUM_RECHARGE_INR}`);
      } else {
        setErrorMsg(null);
        setSelectedAmount(num);
      }
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(USAGE_CONFIG.UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleRechargeSubmit = () => {
    if (selectedAmount < USAGE_CONFIG.MINIMUM_RECHARGE_INR) {
      setErrorMsg(`Minimum recharge amount is ₹${USAGE_CONFIG.MINIMUM_RECHARGE_INR}`);
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      const newBal = addWalletFunds(selectedAmount);
      setConfirmedAmount(selectedAmount);
      setNewBalanceDisplay(newBal);
      setIsSuccess(true);
      onFundsAdded(newBal);
    }, 900);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:p-7 my-6">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {isSuccess ? (
          /* Payment Confirmation State matching Section 5 of prompt */
          <div className="text-center py-4 space-y-5 animate-fade-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shadow-inner">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div>
              <h3 className="font-bold text-xl text-neutral-900 dark:text-white">
                Wallet Recharged Successfully
              </h3>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Tag className="h-3 w-3" />
                <span>2% discount applied</span>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-950/60 space-y-3">
              <div className="text-xs text-neutral-500">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  ₹{confirmedAmount.toLocaleString('en-IN')}
                </span>{' '}
                added to your wallet
              </div>

              <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  New Wallet Balance
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                  ₹{newBalanceDisplay.toFixed(2)}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-all"
            >
              <span>Continue Using PDF Tools</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* Recharge Wallet UI matching Section 4 of prompt */
          <div className="space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shadow-2xs">
                  <Wallet className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                  Recharge Wallet
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-500">
                  Minimum recharge ₹{USAGE_CONFIG.MINIMUM_RECHARGE_INR}
                </span>
                <span aria-hidden="true" className="text-neutral-300">·</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Get 2% OFF on every wallet recharge
                </span>
              </div>
            </div>

            {/* Current Balance card */}
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-950/50">
              <span className="text-xs text-neutral-500 font-medium">Wallet Balance</span>
              <span className="text-base font-bold text-neutral-900 dark:text-white font-mono tabular-nums">
                ₹{currentBalance.toFixed(2)}
              </span>
            </div>

            {/* Quick Recharge presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                Quick Recharge
              </label>
              <div className="grid grid-cols-4 gap-2">
                {USAGE_CONFIG.PRESET_AMOUNTS.map((amt) => {
                  const isSelected = selectedAmount === amt && !customInput;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPreset(amt)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:border-blue-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount */}
            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Custom Amount (Min ₹{USAGE_CONFIG.MINIMUM_RECHARGE_INR})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-neutral-400">
                  ₹
                </span>
                <input
                  type="number"
                  min={USAGE_CONFIG.MINIMUM_RECHARGE_INR}
                  value={customInput}
                  onChange={handleCustomChange}
                  placeholder={`${USAGE_CONFIG.MINIMUM_RECHARGE_INR}`}
                  className="w-full rounded-xl border border-neutral-300 bg-white pl-7 pr-3 py-2 text-xs font-bold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                />
              </div>
              {errorMsg && (
                <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{errorMsg}</span>
                </p>
              )}
            </div>

            {/* Amount Breakdown matching Section 4 of prompt */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3.5 dark:border-neutral-800 dark:bg-neutral-950/60 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                <span>Recharge Amount:</span>
                <span className="font-mono font-medium tabular-nums">
                  ₹{calculation.rechargeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span>2% Discount:</span>
                <span className="font-mono tabular-nums">
                  -₹{calculation.discountAmount.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-neutral-200 pt-2 dark:border-neutral-800 flex items-center justify-between font-bold text-neutral-900 dark:text-white text-sm">
                <span>You Pay:</span>
                <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400 text-base">
                  ₹{calculation.payableAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Dynamic UPI QR Code Scan Card */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/70">
              <div className="inline-block rounded-xl bg-white p-2 shadow-sm border border-neutral-200 dark:border-neutral-700 mb-2">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="UPI Payment QR Code"
                    className="h-36 w-36 rounded-lg object-contain"
                  />
                ) : (
                  <div className="h-36 w-36 flex items-center justify-center text-xs text-neutral-400">
                    Loading QR...
                  </div>
                )}
              </div>

              <div className="text-center text-[11px] text-neutral-500 mb-2">
                Scan with Google Pay, PhonePe, Paytm, or BHIM
              </div>

              {/* UPI ID copy */}
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                <span className="text-neutral-400 text-[11px]">UPI:</span>
                <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 text-xs">
                  {USAGE_CONFIG.UPI_ID}
                </span>
                <button
                  onClick={handleCopyUpi}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 ml-1"
                  title="Copy UPI ID"
                >
                  {copiedUpi ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              disabled={isVerifying || selectedAmount < USAGE_CONFIG.MINIMUM_RECHARGE_INR}
              onClick={handleRechargeSubmit}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 active:scale-98 transition-all"
            >
              {isVerifying ? (
                <span>Confirming Payment...</span>
              ) : (
                <span>Recharge Wallet (Pay ₹{calculation.payableAmount.toFixed(2)})</span>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 text-center">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Full ₹{selectedAmount} credited to balance · 2% instant discount</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
