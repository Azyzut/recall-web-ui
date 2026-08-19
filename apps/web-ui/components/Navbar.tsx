'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { useFM } from '@/components/providers/FMProvider';

const navThemeConfigs: Record<string, { badgeGradient: string; avatarBg: string; ctaBg: string; ctaHover: string }> = {
  default: {
    badgeGradient: 'from-blue-500 to-blue-600',
    avatarBg: 'bg-blue-600',
    ctaBg: 'bg-blue-600',
    ctaHover: 'hover:bg-blue-500',
  },
  dark: {
    badgeGradient: 'from-[#4D4D4D] to-[#B3B3B3]',
    avatarBg: 'bg-[#333333]',
    ctaBg: 'bg-[#333333]',
    ctaHover: 'hover:bg-[#4D4D4D]',
  },
  vibrant: {
    badgeGradient: 'from-purple-500 to-pink-500',
    avatarBg: 'bg-purple-600',
    ctaBg: 'bg-purple-600',
    ctaHover: 'hover:bg-purple-500',
  },
  branded: {
    badgeGradient: 'from-[#0069FF] to-[#806FF6]',
    avatarBg: 'bg-[#0069FF]',
    ctaBg: 'bg-[#0069FF]',
    ctaHover: 'hover:bg-[#3388FF]',
  },
};

export default function Navbar() {
  const { data: session, status } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const fm = useFM();
  const themeKey = fm.getValue('recall.headerTheme', 'default') as string;
  const navTheme = navThemeConfigs[themeKey] || navThemeConfigs.default;

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  // Get user initial for avatar
  const userInitial = session?.user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <nav className="border-b border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-gradient-to-br ${navTheme.badgeGradient} rounded-lg flex items-center justify-center`}>
            <span className="text-white font-bold text-sm">PRT</span>
          </div>
          <span className="text-white font-semibold text-lg">Recall Tracker</span>
        </Link>

        <div className="flex items-center gap-4">
          {status === 'loading' ? (
            // Loading state
            <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
          ) : session ? (
            // Logged in state
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
              >
                <div className={`w-8 h-8 rounded-full ${navTheme.avatarBg} flex items-center justify-center`}>
                  <span className="text-white text-sm font-medium">{userInitial}</span>
                </div>
                <span className="hidden sm:inline text-sm">{session.user?.email}</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <p className="text-sm text-white font-medium truncate">{session.user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/matrix"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                      onClick={() => setShowDropdown(false)}
                    >
                      My Recalls
                    </Link>
                    <Link
                      href="/discover"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                      onClick={() => setShowDropdown(false)}
                    >
                      New Scan
                    </Link>
                  </div>
                  <div className="border-t border-slate-700 py-1">
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Logged out state
            <>
              <Link href="/login" className="text-slate-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link href="/register" className={`${navTheme.ctaBg} ${navTheme.ctaHover} text-white px-4 py-2 rounded-lg font-medium transition-colors`}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
