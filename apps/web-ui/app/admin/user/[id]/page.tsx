'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Requirement {
  id?: string;
  citation: string;
  title: string;
  name?: string;
  agency: string;
  confidence: number;
  appliesTo?: string;
  triggers?: string[];
  excerpt?: string;
  reasoning?: string;
  createdBy?: 'AI' | 'USER';
  createdAt?: string;
}

interface Discovery {
  id: string;
  agency: string;
  requirements: Requirement[];
  discoveredAt: string;
  metadata?: {
    model?: string;
    totalTokens?: number;
    estimatedCost?: number;
  };
}

interface CompanyDetails {
  id: string;
  companyName: string;
  website: string;
  normalizedWebsite: string;
  naicsCode: string;
  employeeCount: number | null;
  state: string | null;
  contactEmail: string | null;
  firstDiscoveredAt: string;
  websiteAnalysis?: {
    products?: string[];
    services?: string[];
    activities?: string[];
    potentialHazards?: string[];
  };
}

interface UserDetailData {
  company: CompanyDetails;
  discoveries: Discovery[];
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.id as string;

  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAgency, setActiveAgency] = useState<string>('FDA');
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchUserData = async () => {
      // Get stored password from localStorage
      const storedPassword = localStorage.getItem('adminPassword');
      if (!storedPassword) {
        setError('Not authenticated. Please login via /admin first.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/admin/users/${userId}?auth=${encodeURIComponent(storedPassword)}`);
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to load user data');
        } else {
          setData(result);
        }
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const toggleExpand = (reqId: string) => {
    const newExpanded = new Set(expandedReqs);
    if (newExpanded.has(reqId)) {
      newExpanded.delete(reqId);
    } else {
      newExpanded.add(reqId);
    }
    setExpandedReqs(newExpanded);
  };

  const getAgencyColor = (agency: string) => {
    switch (agency) {
      case 'FDA': return 'bg-blue-900 text-blue-300 border-blue-700';
      case 'CPSC': return 'bg-orange-900 text-orange-300 border-orange-700';
      default: return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-400';
    if (confidence >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCreatedByBadge = (createdBy?: 'AI' | 'USER') => {
    if (createdBy === 'USER') {
      return <span className="px-2 py-0.5 bg-purple-900 text-purple-300 text-xs rounded">USER</span>;
    }
    return <span className="px-2 py-0.5 bg-cyan-900 text-cyan-300 text-xs rounded">AI</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg border border-red-500 p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error || 'User not found'}</p>
          <Link href="/admin" className="text-blue-400 hover:text-blue-300">
            ← Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  const { company, discoveries } = data;

  // Aggregate all requirements from all discoveries per agency
  const getRequirementsByAgency = (agency: string): Requirement[] => {
    return discoveries
      .filter(d => d.agency === agency)
      .flatMap(d => d.requirements || []);
  };

  const requirements = getRequirementsByAgency(activeAgency);

  // Count requirements by agency (aggregated across all discoveries)
  const agencyCounts = {
    FDA: getRequirementsByAgency('FDA').length,
    CPSC: getRequirementsByAgency('CPSC').length,
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb — the section is already lit in the sidebar, but the
            trail names which account you are inside. */}
        <nav className="mb-4 text-sm text-gray-500">
          <Link href="/admin" className="text-blue-400 hover:text-blue-300">Accounts</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">{company.companyName}</span>
        </nav>

        {/* Company Header */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{company.companyName}</h1>
              <p className="text-gray-400 mt-1">User ID: {company.id}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-gray-400">First discovered</p>
              <p className="text-white">{new Date(company.firstDiscoveredAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Company Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <p className="text-gray-500 text-xs uppercase">Email</p>
              <p className="text-blue-400">{company.contactEmail || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase">Website</p>
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                {company.normalizedWebsite}
              </a>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase">NAICS Code</p>
              <p className="text-white font-mono">{company.naicsCode}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase">Employees</p>
              <p className="text-white">{company.employeeCount || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase">State</p>
              <p className="text-white">{company.state || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase">Total Discoveries</p>
              <p className="text-white">{discoveries.length}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase">Total Requirements</p>
              <p className="text-green-400 font-bold">
                {agencyCounts.FDA + agencyCounts.CPSC}
              </p>
            </div>
          </div>

          {/* Website Analysis (if available) */}
          {company.websiteAnalysis && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-gray-500 text-xs uppercase mb-2">AI-Extracted Company Intelligence</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {company.websiteAnalysis.products && company.websiteAnalysis.products.length > 0 && (
                  <div>
                    <p className="text-gray-400">Products</p>
                    <p className="text-white">{company.websiteAnalysis.products.slice(0, 3).join(', ')}</p>
                  </div>
                )}
                {company.websiteAnalysis.potentialHazards && company.websiteAnalysis.potentialHazards.length > 0 && (
                  <div>
                    <p className="text-gray-400">Hazards</p>
                    <p className="text-yellow-400">{company.websiteAnalysis.potentialHazards.slice(0, 3).join(', ')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Agency Tabs */}
        <div className="flex gap-2 mb-6">
          {(['FDA', 'CPSC'] as const).map((agency) => (
            <button
              key={agency}
              onClick={() => setActiveAgency(agency)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeAgency === agency
                  ? getAgencyColor(agency) + ' border'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-750'
              }`}
            >
              {agency} ({agencyCounts[agency]})
            </button>
          ))}
        </div>

        {/* Discovery Metadata - show all discoveries for this agency */}
        {(() => {
          const agencyDiscoveries = discoveries.filter(d => d.agency === activeAgency);
          if (agencyDiscoveries.length === 0) return null;
          const totalCost = agencyDiscoveries.reduce((sum, d) => sum + (d.metadata?.estimatedCost || 0), 0);
          return (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4 text-sm">
              <div className="flex gap-6 text-gray-400 flex-wrap">
                <span>Discoveries: <span className="text-white font-mono">{agencyDiscoveries.length}</span></span>
                <span>IDs: <span className="text-white font-mono">{agencyDiscoveries.map(d => d.id).join(', ')}</span></span>
                {totalCost > 0 && (
                  <span>Total Cost: <span className="text-green-400">${totalCost.toFixed(2)}</span></span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Requirements List */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">
              {activeAgency} Requirements ({requirements.length})
            </h2>
          </div>

          {requirements.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No {activeAgency} requirements discovered yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {requirements.map((req, index) => {
                const reqId = req.id || `${activeAgency}-${index}`;
                const isExpanded = expandedReqs.has(reqId);

                return (
                  <div key={reqId} className="p-4 hover:bg-gray-750">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getAgencyColor(activeAgency)}`}>
                            {activeAgency}
                          </span>
                          <span className="text-sm font-mono text-gray-400">{req.citation}</span>
                          <span className={`text-xs font-medium ${getConfidenceColor(req.confidence)}`}>
                            {req.confidence}% confidence
                          </span>
                          {getCreatedByBadge(req.createdBy || 'AI')}
                        </div>
                        <h3 className="font-semibold text-white">{req.name || req.title}</h3>

                        {req.appliesTo && (
                          <p className="text-sm text-blue-400 mt-2">
                            <span className="font-medium">Why it applies:</span> {req.appliesTo}
                          </p>
                        )}

                        {/* Expandable Details */}
                        {isExpanded && (
                          <div className="mt-4 p-4 bg-gray-900 rounded-lg text-sm space-y-3">
                            {req.reasoning && (
                              <div>
                                <p className="text-gray-500 uppercase text-xs mb-1">Full Reasoning</p>
                                <p className="text-gray-300">{req.reasoning}</p>
                              </div>
                            )}
                            {req.triggers && req.triggers.length > 0 && (
                              <div>
                                <p className="text-gray-500 uppercase text-xs mb-1">Triggers</p>
                                <div className="flex flex-wrap gap-1">
                                  {req.triggers.map((trigger, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-yellow-900 text-yellow-300 rounded text-xs">
                                      {trigger}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {req.excerpt && (
                              <div>
                                <p className="text-gray-500 uppercase text-xs mb-1">Regulation Excerpt</p>
                                <p className="text-gray-400 italic">{req.excerpt}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="ml-4 flex flex-col gap-2">
                        <button
                          onClick={() => toggleExpand(reqId)}
                          className="px-3 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                        >
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </button>
                        <a
                          href={`https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded"
                        >
                          FDA.gov →
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
