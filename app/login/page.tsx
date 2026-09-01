'use client';

import { createBrowserSupabase } from '@/lib/supabase';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useTransition } from 'react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get('error') === 'auth';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [message, setMessage] = useState(hasError ? 'Authentication failed. Please try again.' : '');
  const [isPending, startTransition] = useTransition();

  const supabase = createBrowserSupabase();

  const handleEmailAuth = () => {
    startTransition(async () => {
      setMessage('');
      if (!email || !password) {
        setMessage('Please enter your email and password.');
        return;
      }

      const { error } =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (error) {
        setMessage(error.message);
      } else if (mode === 'signup') {
        setMessage('Check your email to confirm your account.');
      } else {
        window.location.href = '/';
      }
    });
  };

  const handleGoogle = () => {
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setMessage(error.message);
    });
  };

  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center px-4 py-12 bg-[#FAF8F2]">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#314A2E] mb-3">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 4C8.48 4 4 8.48 4 14s4.48 10 10 10 10-4.48 10-10S19.52 4 14 4Z" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 14l3 3 6-6" stroke="#D97442" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#243124]">Stewdio</h1>
          <p className="mt-1 text-sm text-[#708C69]">Your personal kitchen studio</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-[0_2px_16px_rgba(36,49,36,0.07)] p-6">
          <h2 className="text-lg font-bold text-[#243124] mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-[#708C69] mb-5">
            {mode === 'signin' ? 'Sign in to your cookbook' : 'Start building your recipe collection'}
          </p>

          {/* Error / info message */}
          {message && (
            <div className={`mb-4 rounded-lg px-3 py-2.5 text-sm ${
              message.startsWith('Check') ? 'bg-[#F0EDE6] text-[#314A2E]' : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          {/* Email */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[#243124] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2.5 text-sm text-[#243124] placeholder:text-[#B0AAA0]
                         focus:border-[#314A2E] focus:ring-2 focus:ring-[#314A2E]/10 outline-none transition-all bg-[#FDFCFA]"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#243124] mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2.5 pr-10 text-sm text-[#243124] placeholder:text-[#B0AAA0]
                           focus:border-[#314A2E] focus:ring-2 focus:ring-[#314A2E]/10 outline-none transition-all bg-[#FDFCFA]"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A09A] hover:text-[#708C69]"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleEmailAuth}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#314A2E] text-white font-semibold
                       text-sm py-2.5 rounded-lg hover:bg-[#243124] active:scale-[0.98]
                       transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E8E4DC]" />
            <span className="text-xs text-[#A0A09A]">or</span>
            <div className="flex-1 h-px bg-[#E8E4DC]" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2.5 border border-[#E8E4DC] bg-white
                       text-sm font-medium text-[#243124] py-2.5 rounded-lg
                       hover:bg-[#FDFCFA] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {/* Google logo */}
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Toggle mode */}
        <p className="mt-5 text-center text-sm text-[#708C69]">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}
            className="font-semibold text-[#314A2E] hover:text-[#D97442] transition-colors"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
