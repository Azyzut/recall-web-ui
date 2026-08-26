'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Deliberately no default. This page previously prefilled and DISPLAYED a
// constant admin password, putting it on screen for anyone who opened /admin —
// in a repository attendees copy. The value is not repeated here: naming a
// retired credential in a public repo republishes it for anyone still using it.
const DEFAULT_PASSWORD = '';

interface CompanyUser {
  id: string;
  companyName: string;
  website: string;
  normalizedWebsite: string;
  naicsCode: string;
  employeeCount: number | null;
  state: string | null;
  contactEmail: string | null;
  firstDiscoveredAt: string;
  discoveryCount: number;
  totalRequirements: number;
}

interface AdminStats {
  totalUsers: number;
  totalDiscoveries: number;
  totalRequirements: number;
  usersThisWeek: number;
}

interface ActiveDiscovery {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  startedAt: string;
  elapsedSeconds: number;
  progress: {
    current: number;
    total: number;
    percent: number;
    currentCitation?: string;
  };
}

export default function AdminPage() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeDiscoveries, setActiveDiscoveries] = useState<ActiveDiscovery[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored password
    const storedPassword = localStorage.getItem('adminPassword');
    if (storedPassword) {
      setPassword(storedPassword);
      fetchAdminData(storedPassword);
    } else {
      setLoading(false);
    }
  }, []);

  // Poll for active discoveries every 2 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchActiveDiscoveries = async () => {
      try {
        const storedPassword = localStorage.getItem('adminPassword');
        if (!storedPassword) return;

        const response = await fetch(`/api/admin/discoveries/active?auth=${encodeURIComponent(storedPassword)}`);
        if (response.ok) {
          const data = await response.json();
          setActiveDiscoveries(data.discoveries || []);
        }
      } catch (err) {
        console.error('Failed to fetch active discoveries:', err);
      }
    };

    // Fetch immediately
    fetchActiveDiscoveries();

    // Then poll every 2 seconds
    const interval = setInterval(fetchActiveDiscoveries, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const cancelDiscovery = async (discoveryId: string) => {
    setCancellingId(discoveryId);
    try {
      const storedPassword = localStorage.getItem('adminPassword');
      if (!storedPassword) return;

      const response = await fetch(`/api/admin/discoveries/cancel?auth=${encodeURIComponent(storedPassword)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveryId }),
      });

      if (response.ok) {
        // Remove from local state immediately
        setActiveDiscoveries(prev => prev.filter(d => d.id !== discoveryId));
      } else {
        const data = await response.json();
        console.error('Cancel failed:', data.error);
      }
    } catch (err) {
      console.error('Failed to cancel discovery:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchAdminData = async (authPassword: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users?auth=${encodeURIComponent(authPassword)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load admin data');
        setIsAuthenticated(false);
        localStorage.removeItem('adminPassword');
      } else {
        setUsers(data.users);
        setStats(data.stats);
        setIsAuthenticated(true);
        localStorage.setItem('adminPassword', authPassword);
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    fetchAdminData(password);
  };

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    return (
      user.companyName?.toLowerCase().includes(search) ||
      user.contactEmail?.toLowerCase().includes(search) ||
      user.naicsCode?.includes(search) ||
      user.website?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-2 text-center">Admin Access</h1>
          <p className="text-gray-400 text-center mb-6">Enter password to access the admin dashboard</p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Access Dashboard
            </button>
          </form>

          <p className="text-gray-500 text-xs text-center mt-4">
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">User and recall tracking for Product Recall Tracker</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Total Users</p>
              <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Total Discoveries</p>
              <p className="text-3xl font-bold text-blue-400">{stats.totalDiscoveries}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Total Requirements</p>
              <p className="text-3xl font-bold text-green-400">{stats.totalRequirements}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">New This Week</p>
              <p className="text-3xl font-bold text-yellow-400">{stats.usersThisWeek}</p>
            </div>
          </div>
        )}

        {/* Active Discoveries Panel */}
        {activeDiscoveries.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                Active Discoveries ({activeDiscoveries.length})
              </h2>
            </div>

            <div className="space-y-4">
              {activeDiscoveries.map(discovery => (
                <div key={discovery.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">{discovery.companyName}</p>
                      <p className="text-gray-400 text-sm">{discovery.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">Elapsed: {formatElapsedTime(discovery.elapsedSeconds)}</p>
                      <button
                        onClick={() => cancelDiscovery(discovery.id)}
                        disabled={cancellingId === discovery.id}
                        className="mt-1 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cancellingId === discovery.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                      <span>Progress: {discovery.progress.current}/{discovery.progress.total}</span>
                      <span>{discovery.progress.percent}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${discovery.progress.percent}%` }}
                      ></div>
                    </div>
                  </div>

                  {discovery.progress.currentCitation && (
                    <p className="text-gray-500 text-xs">
                      Processing: {discovery.progress.currentCitation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by company, email, NAICS, or website..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Users Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-750">
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contact Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Website</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">NAICS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Employees</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Requirements</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Signed Up</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-750">
                    <td className="px-4 py-3 text-sm text-gray-300 font-mono">{user.id}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{user.companyName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-blue-400">{user.contactEmail || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {user.website ? (
                        <a href={user.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                          {user.normalizedWebsite}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 font-mono">{user.naicsCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{user.employeeCount || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{user.state || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs">
                        {user.totalRequirements} reqs
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(user.firstDiscoveredAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/admin/user/${user.id}`}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                      >
                        View Matrix
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {searchTerm ? 'No users match your search.' : 'No users yet.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>
    </div>
  );
}
