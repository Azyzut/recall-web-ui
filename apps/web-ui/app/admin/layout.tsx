'use client';

// Shell for every /admin/* route.
//
// Two jobs. It holds the password gate ONCE — previously each admin page read
// localStorage and rendered its own login form, so the logic was duplicated three
// times and any change had to be made three times. And it provides the left nav,
// without which /admin/telemetry and /admin/rollout are reachable only by typing
// the URL, which is a poor property for something used while presenting.
//
// The gate is a convenience, not a security boundary: every admin endpoint checks
// the password server-side on each request. Removing this component would make the
// UI awkward, not insecure.

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/admin', label: 'Accounts' },
  { href: '/admin/telemetry', label: 'Telemetry' },
  { href: '/admin/rollout', label: 'Rollout' },
];

const BLUE = '#0069FF';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [password, setPassword] = useState<string | null>(null);
  const [entered, setEntered] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPassword(localStorage.getItem('adminPassword'));
    setReady(true);
  }, []);

  // Nothing renders until localStorage has been read, or the gate flashes on
  // every navigation for users who are already signed in.
  if (!ready) return null;

  if (!password) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
        <form
          className="w-full max-w-sm"
          onSubmit={e => {
            e.preventDefault();
            localStorage.setItem('adminPassword', entered);
            setPassword(entered);
          }}
        >
          <h1 className="text-2xl font-bold text-white mb-2 text-center">Admin Access</h1>
          <p className="text-gray-400 text-center mb-6">Enter the admin password</p>
          <input
            type="password"
            value={entered}
            onChange={e => setEntered(e.target.value)}
            placeholder="Admin password"
            autoFocus
            className="w-full px-4 py-3 mb-4 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full px-4 py-3 rounded-lg font-medium text-white"
            style={{ background: BLUE }}
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-900">
      <nav className="w-56 shrink-0 border-r border-gray-800 p-4 flex flex-col gap-1">
        <div className="px-3 pb-4">
          <div className="text-white font-semibold">Recall Tracker</div>
          <div className="text-gray-500 text-xs">Admin</div>
        </div>

        {NAV.map(item => {
          // /admin must match exactly, or it stays highlighted on every child
          // route. The others match their subtree so a detail page keeps its
          // section lit.
          const active = item.href === '/admin'
            ? pathname === '/admin' || pathname.startsWith('/admin/user')
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded text-sm"
              style={{
                background: active ? BLUE : 'transparent',
                color: active ? '#fff' : '#9CA3AF',
              }}
            >
              {item.label}
            </Link>
          );
        })}

        <button
          onClick={() => { localStorage.removeItem('adminPassword'); setPassword(null); }}
          className="mt-auto px-3 py-2 text-left text-xs text-gray-600 hover:text-gray-400"
        >
          Sign out
        </button>
      </nav>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
