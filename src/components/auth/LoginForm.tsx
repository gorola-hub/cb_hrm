'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Lock, Mail, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        if (res.error === 'AUTH_ACCOUNT_INACTIVE') {
          setError('Your account is deactivated in the CRM. Please contact your administrator.');
        } else {
          setError('Invalid email or password. Please verify your company credentials.');
        }
        setIsLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-8 space-y-6 card-noise">
      <div className="space-y-1 text-center pb-2">
        <div className="mx-auto w-12 h-12 bg-[#ffd700]/20 rounded-xl flex items-center justify-center border border-[#ffd700]/30 mb-2">
          <Lock className="w-6 h-6 text-[#ffd700]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-serif">
          Capital Bridge HRM
        </h1>
        <p className="text-sm text-[#888888] font-serif">
          Enter your credentials to access the employee shift platform
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-white font-serif block" htmlFor="email">
            Corporate Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-[#888888]" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@capitalbridgelogistics.com"
              required
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-white/15 rounded-lg text-white placeholder:text-[#888888] focus:outline-none focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700]/20 text-sm font-serif transition"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white font-serif block" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-[#888888]" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full pl-10 pr-10 py-2.5 bg-[#0a0a0a] border border-white/15 rounded-lg text-white placeholder:text-[#888888] focus:outline-none focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700]/20 text-sm font-serif transition"
            />
            <button
              type="button"
              aria-label="toggle password visibility"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-[#888888] hover:text-white p-0.5 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#ffd700] hover:bg-[#ffe033] text-black font-bold py-2.5 rounded-lg transition-colors shadow-lg shadow-yellow-900/10 mt-2 cursor-pointer font-serif flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </span>
          ) : (
            'Sign In to Shift Portal'
          )}
        </button>
      </form>
    </div>
  );
}
