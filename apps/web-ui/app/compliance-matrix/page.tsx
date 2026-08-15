'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Requirement {
  id: string;
  name?: string;
  title: string;
  citation: string;
  agency: string;
  confidence: number;
  appliesTo?: string;
  triggers?: string[];
  excerpt?: string;
}

interface Discovery {
  id: string;
  agency: string;
  requirements: Requirement[];
  discoveredAt: string;
}

interface CompanyData {
  id: string;
  name: string;
  website: string;
  naicsCode: string;
  employeeCount: number;
  state: string;
}

interface ComplianceData {
  success: boolean;
  company: CompanyData;
  discoveries: Discovery[];
}

function ComplianceMatrixContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComplianceData | null>(null);
  const [activeTab, setActiveTab] = useState<'FDA' | 'CPSC'>('FDA');
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());
  const [chatMessage, setChatMessage] = useState('');

  useEffect(() => {
    if (!email) {
      setError('No email provided. Please run a discovery first.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/compliance?email=${encodeURIComponent(email)}`);
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to load recall data');
        } else {
          setData(result);
        }
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [email]);

  const toggleExpand = (reqId: string) => {
    const newExpanded = new Set(expandedReqs);
    if (newExpanded.has(reqId)) {
      newExpanded.delete(reqId);
    } else {
      newExpanded.add(reqId);
    }
    setExpandedReqs(newExpanded);
  };

  const getAgencyStyles = (agency: string, isActive: boolean) => {
    const styles = {
      FDA: {
        active: 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-500 shadow-blue-500/25',
        inactive: 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-blue-500/50 hover:bg-slate-800',
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      },
      CPSC: {
        active: 'bg-gradient-to-br from-amber-600 to-orange-600 text-white border-orange-500 shadow-orange-500/25',
        inactive: 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-orange-500/50 hover:bg-slate-800',
        badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      },
    };
    return isActive ? styles[agency as keyof typeof styles].active : styles[agency as keyof typeof styles].inactive;
  };

  const getAgencyBadgeStyle = (agency: string) => {
    const styles = {
      FDA: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      CPSC: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    };
    return styles[agency as keyof typeof styles] || 'bg-slate-500/20 text-slate-400';
  };

  const getConfidenceStyle = (confidence: number) => {
    if (confidence >= 80) return 'text-emerald-400';
    if (confidence >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getConfidenceBar = (confidence: number) => {
    if (confidence >= 80) return 'bg-emerald-500';
    if (confidence >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  // Get requirements for active tab
  const getRequirements = () => {
    if (!data) return [];
    const discovery = data.discoveries.find(d => d.agency === activeTab);
    return discovery?.requirements || [];
  };

  // Loading State - Beautiful with progress indication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
            {/* Animated Logo */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-30 animate-pulse"></div>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white text-center mb-2">
              Building Your Recall Matrix
            </h2>
            <p className="text-slate-400 text-center text-sm mb-6">
              Analyzing recall databases and matching to your product profile
            </p>

            {/* Progress Animation */}
            <div className="space-y-4">
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-full animate-shimmer"></div>
              </div>

              <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>This usually takes about 5 minutes</span>
              </div>
            </div>

            {/* Steps */}
            <div className="mt-8 space-y-3">
              {[
                { label: 'Analyzing your product profile', done: true },
                { label: 'Scanning recall databases', done: true },
                { label: 'Matching applicable recalls', done: false },
                { label: 'Calculating risk scores', done: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    step.done
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-600'
                  }`}>
                    {step.done ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                    )}
                  </div>
                  <span className={step.done ? 'text-slate-300' : 'text-slate-500'}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Data</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/25"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Run Discovery
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const requirements = getRequirements();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">{data?.company.name}</h1>
                <p className="text-sm text-slate-400">Recall Matrix</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  NAICS {data?.company.naicsCode}
                </span>
                <span>{data?.company.employeeCount} employees</span>
                <span>{data?.company.state}</span>
              </div>
              <Link
                href="/discover"
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors border border-slate-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Discovery
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-6">
          {/* Left Column - Recall Matrix */}
          <div className="flex-1 min-w-0">
            {/* Agency Tabs */}
            <div className="flex gap-3 mb-6">
              {(['FDA', 'CPSC'] as const).map((agency) => {
                const discovery = data?.discoveries.find(d => d.agency === agency);
                const count = discovery?.requirements?.length || 0;
                const isActive = activeTab === agency;
                return (
                  <button
                    key={agency}
                    onClick={() => setActiveTab(agency)}
                    className={`flex-1 p-4 rounded-xl border transition-all duration-200 ${getAgencyStyles(agency, isActive)} ${isActive ? 'shadow-lg' : ''}`}
                  >
                    <div className="text-3xl font-bold">{count}</div>
                    <div className={`text-sm ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                      {agency} Recalls
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Requirements List */}
            <div className="bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-800/50 overflow-hidden">
              <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {activeTab} Recalls
                  <span className="ml-2 text-slate-500 font-normal">({requirements.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>

              {requirements.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 mb-2">No {activeTab} recalls discovered yet</p>
                  <Link href="/discover" className="text-blue-400 hover:text-blue-300 text-sm">
                    Run a discovery to find applicable recalls
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {requirements.map((req, index) => {
                    const reqId = req.id || `${activeTab}-${index}`;
                    const isExpanded = expandedReqs.has(reqId);
                    return (
                      <div
                        key={reqId}
                        className="p-4 hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {/* Confidence Indicator */}
                          <div className="flex-shrink-0 w-12">
                            <div className="text-center">
                              <div className={`text-lg font-bold ${getConfidenceStyle(req.confidence)}`}>
                                {req.confidence}%
                              </div>
                              <div className="h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full ${getConfidenceBar(req.confidence)} transition-all`}
                                  style={{ width: `${req.confidence}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getAgencyBadgeStyle(activeTab)}`}>
                                {activeTab}
                              </span>
                              <span className="text-sm font-mono text-slate-500">{req.citation}</span>
                            </div>
                            <h3 className="font-semibold text-white mb-1">{req.name || req.title}</h3>

                            {req.appliesTo && (
                              <p className="text-sm text-slate-400 line-clamp-2">
                                {req.appliesTo}
                              </p>
                            )}

                            {/* Expanded Content */}
                            {isExpanded && (
                              <div className="mt-4 p-4 bg-slate-800/50 rounded-xl space-y-3">
                                {req.triggers && req.triggers.length > 0 && (
                                  <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Triggers</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {req.triggers.map((trigger, idx) => (
                                        <span key={idx} className="px-2 py-1 text-xs bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                                          {trigger}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {req.excerpt && (
                                  <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Recall Details</p>
                                    <p className="text-sm text-slate-300 italic">{req.excerpt}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <button
                              onClick={() => toggleExpand(reqId)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <a
                              href={`https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                              title="View on FDA.gov"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
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

          {/* Right Column - Chat Interface */}
          <div className="w-96 flex-shrink-0 hidden lg:block">
            <div className="bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-800/50 h-[calc(100vh-140px)] sticky top-24 flex flex-col overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Recall Agent</h3>
                    <p className="text-xs text-slate-400">Ask questions about your product recalls</p>
                  </div>
                </div>
              </div>

              {/* Chat Tabs */}
              <div className="flex border-b border-slate-800/50">
                {[
                  { id: 'chat', label: 'Chat', icon: '💬' },
                  { id: 'docs', label: 'Docs', icon: '📄' },
                  { id: 'updates', label: 'Updates', icon: '📰' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      tab.id === 'chat'
                        ? 'text-white border-b-2 border-blue-500 bg-slate-800/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                    }`}
                  >
                    <span className="mr-1.5">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Welcome Message */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🤖</span>
                  </div>
                  <div className="bg-slate-800/50 rounded-2xl rounded-tl-none p-4 max-w-[280px]">
                    <p className="text-sm text-slate-300">
                      Hi! I&apos;m your recall assistant. I can help you understand product recalls, search recall databases, and answer questions about your matrix.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Try asking: &quot;What FDA recalls affect our products?&quot;
                    </p>
                  </div>
                </div>

                {/* Suggestion Chips */}
                <div className="flex flex-wrap gap-2">
                  {[
                    'Summarize active recalls',
                    'What products are affected?',
                    'Upcoming recall deadlines',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      className="px-3 py-1.5 bg-slate-800/50 text-slate-400 text-xs rounded-full border border-slate-700 hover:border-blue-500/50 hover:text-blue-400 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-slate-800/50">
                <div className="flex gap-2">
                  <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask about product recalls..."
                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                  />
                  <button className="p-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/20">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

export default function ComplianceMatrixPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ComplianceMatrixContent />
    </Suspense>
  );
}
