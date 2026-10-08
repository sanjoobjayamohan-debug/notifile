import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { email: string; name: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      const displayName = name.trim() || email.split('@')[0] || 'User';
      onLoginSuccess({
        email: email || 'alex.morgan@example.com',
        name: displayName,
      });
      onClose();
    }, 600);
  };

  const handleQuickDemo = () => {
    onLoginSuccess({
      email: 'demo@notifile.io',
      name: 'Demo Account',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 mb-3">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
            {isRegister ? 'Create Your Notifile Account' : 'Welcome back to Notifile'}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Access your recent processed files, saved tools, and batch queue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@company.com"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-neutral-900 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 transition-colors shadow-sm mt-2"
          >
            {loading ? 'Authenticating...' : isRegister ? 'Create Free Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-center space-y-3">
          <button
            type="button"
            onClick={handleQuickDemo}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Continue as Guest / One-Click Demo
          </button>

          <div className="text-xs text-neutral-500">
            {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="font-semibold text-neutral-900 hover:underline dark:text-white"
            >
              {isRegister ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
