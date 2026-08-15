'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Suspense } from 'react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-fill and lock email when arriving from an anon scan token
  useEffect(() => {
    if (tokenParam) {
      fetch(`/api/company/token?token=${encodeURIComponent(tokenParam)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.email) {
            setEmail(data.email);
            setEmailLocked(true);
          }
        })
        .catch(() => {});
    }
  }, [tokenParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    // Validation
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      // Registration successful - auto-login the user
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // If auto-login fails, redirect to login page
        router.push('/login?registered=true');
        return;
      }

      // Get dynamic redirect based on user's company status
      // This will also link anonymous discoveries if email matches
      try {
        const redirectRes = await fetch('/api/auth/redirect');
        const redirectData = await redirectRes.json();
        router.push(redirectData.redirect || '/discover');
      } catch {
        // Fallback to discover if redirect API fails
        router.push('/discover');
      }
    } catch {
      setErrorMessage('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white">Recall Tracker</h1>
            <p className="text-slate-400 mt-1">Product Recall Intelligence Platform</p>
          </Link>
        </div>

        {/* Register Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">Create your account</h2>
          <p className="text-slate-400 text-sm mb-6">
            Get instant access to your recall dashboard
          </p>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Work email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => !emailLocked && setEmail(e.target.value)}
                readOnly={emailLocked}
                required
                className={`w-full px-4 py-3 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-all ${
                  emailLocked
                    ? 'bg-slate-700/50 border-emerald-600/50 cursor-not-allowed'
                    : 'bg-slate-800/50 border-slate-600/50 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent'
                }`}
                placeholder="you@company.com"
              />
              {emailLocked && (
                <p className="text-xs text-emerald-400 mt-1">Linked to your scan — cannot be changed</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                placeholder="At least 8 characters"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                placeholder="Confirm your password"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Benefits */}
          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <p className="text-sm text-slate-400 mb-3">What you&apos;ll get:</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center text-slate-300">
                <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                20 product recalls identified for your supply chain
              </li>
              <li className="flex items-center text-slate-300">
                <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confidence scores with reasoning
              </li>
              <li className="flex items-center text-slate-300">
                <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save and track your recall responses
              </li>
            </ul>
          </div>

          {/* Sign In Link */}
          <p className="mt-6 text-center text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-slate-500 text-sm">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-slate-400 hover:text-slate-300">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-slate-400 hover:text-slate-300">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
