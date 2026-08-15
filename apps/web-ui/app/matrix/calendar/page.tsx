'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface CalendarRequirement {
  id: string;
  citation: string;
  title: string;
  agency: string;
  status: string;
  dueDate: string;
  calendarTracking: boolean;
  frequency: string | null;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'compliant': return 'bg-emerald-500';
    case 'in_progress': return 'bg-blue-500';
    case 'non_compliant': return 'bg-red-500';
    case 'pending': return 'bg-amber-500';
    case 'n_a': return 'bg-slate-500';
    default: return 'bg-slate-500';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'in_progress': return 'In Progress';
    case 'compliant': return 'Compliant';
    case 'non_compliant': return 'Non-Compliant';
    case 'n_a': return 'N/A';
    default: return status;
  }
}

function getAgencyColor(agency: string): string {
  switch (agency) {
    case 'FDA': return 'text-blue-400';
    case 'CPSC': return 'text-amber-400';
    default: return 'text-slate-400';
  }
}

function getFrequencyLabel(freq: string | null): string {
  switch (freq) {
    case 'annual': return 'Annual';
    case 'semi_annual': return 'Semi-Annual';
    case 'quarterly': return 'Quarterly';
    case 'monthly': return 'Monthly';
    case 'one_time': return 'One-Time';
    default: return '';
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading calendar...
        </div>
      </div>
    }>
      <CalendarPage />
    </Suspense>
  );
}

function CalendarPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');

  const [requirements, setRequirements] = useState<CalendarRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const tokenQuery = tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : '';
      const url = `/api/calendar${tokenQuery}`;

      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to load data');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setRequirements(data.requirements || []);
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [tokenParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build calendar grid data
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
      });
    }

    // Next month padding (fill to 6 rows)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  // Map dates to requirements
  const dateMap = useMemo(() => {
    const map: Record<string, CalendarRequirement[]> = {};
    for (const req of requirements) {
      const dateKey = new Date(req.dueDate).toISOString().split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(req);
    }
    return map;
  }, [requirements]);

  // Requirements for selected date
  const selectedReqs = useMemo(() => {
    if (!selectedDate) return [];
    return dateMap[selectedDate] || [];
  }, [selectedDate, dateMap]);

  // Counts for the summary bar
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let overdue = 0;
    let upcoming = 0;
    let total = requirements.length;
    for (const req of requirements) {
      const due = new Date(req.dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < today && req.status !== 'compliant' && req.status !== 'n_a') overdue++;
      else if (due >= today && due <= new Date(today.getTime() + 30 * 86400000)) upcoming++;
    }
    return { total, overdue, upcoming };
  }, [requirements]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().split('T')[0];

  const backHref = tokenParam ? `/matrix?token=${encodeURIComponent(tokenParam)}` : '/matrix';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading calendar...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href={backHref} className="text-blue-400 hover:text-blue-300 text-sm">Back to Matrix</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href={backHref} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Matrix
          </Link>
          <h1 className="text-sm font-semibold text-white">Compliance Calendar</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-400 mt-1">Tracked Deadlines</p>
          </div>
          <div className={`bg-slate-800/40 border rounded-xl p-4 text-center ${stats.overdue > 0 ? 'border-red-500/30' : 'border-slate-700/50'}`}>
            <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-400' : 'text-white'}`}>{stats.overdue}</p>
            <p className="text-xs text-slate-400 mt-1">Overdue</p>
          </div>
          <div className={`bg-slate-800/40 border rounded-xl p-4 text-center ${stats.upcoming > 0 ? 'border-amber-500/30' : 'border-slate-700/50'}`}>
            <p className={`text-2xl font-bold ${stats.upcoming > 0 ? 'text-amber-400' : 'text-white'}`}>{stats.upcoming}</p>
            <p className="text-xs text-slate-400 mt-1">Next 30 Days</p>
          </div>
        </div>

        {requirements.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/50 border-dashed rounded-xl p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-400 mb-2">No tracked deadlines yet</p>
            <p className="text-sm text-slate-500">
              Open a requirement and enable &ldquo;Track on calendar&rdquo; with a due date and frequency to see it here.
            </p>
            <Link href={backHref} className="inline-block mt-4 px-4 py-2 text-sm bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors">
              Go to Matrix
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar grid */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                {/* Month navigation */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">
                      {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h2>
                    <button
                      onClick={() => {
                        const now = new Date();
                        setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                      }}
                      className="px-2 py-0.5 text-xs text-slate-400 hover:text-white border border-slate-600/50 rounded hover:bg-slate-700/50 transition-colors"
                    >
                      Today
                    </button>
                  </div>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-700/50">
                  {DAY_NAMES.map(day => (
                    <div key={day} className="px-2 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7">
                  {calendarDays.map(({ date, isCurrentMonth }, i) => {
                    const dateKey = date.toISOString().split('T')[0];
                    const dayReqs = dateMap[dateKey] || [];
                    const isToday = dateKey === todayKey;
                    const isSelected = dateKey === selectedDate;
                    const hasOverdue = dayReqs.some(r => {
                      const d = new Date(r.dueDate);
                      d.setHours(0, 0, 0, 0);
                      return d < today && r.status !== 'compliant' && r.status !== 'n_a';
                    });

                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
                        className={`relative min-h-[72px] sm:min-h-[80px] p-1.5 border-b border-r border-slate-700/30 text-left transition-colors ${
                          !isCurrentMonth ? 'bg-slate-900/30' : 'hover:bg-slate-700/20'
                        } ${isSelected ? 'bg-blue-900/20 ring-1 ring-blue-500/40' : ''}`}
                      >
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                          isToday ? 'bg-blue-600 text-white' :
                          !isCurrentMonth ? 'text-slate-600' : 'text-slate-300'
                        }`}>
                          {date.getDate()}
                        </span>

                        {/* Requirement dots */}
                        {dayReqs.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {dayReqs.slice(0, 3).map((req, j) => (
                              <div key={j} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight truncate ${
                                hasOverdue && req.status !== 'compliant' && req.status !== 'n_a'
                                  ? 'bg-red-500/15 text-red-300'
                                  : 'bg-slate-700/50 text-slate-300'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusColor(req.status)}`} />
                                <span className="truncate">{req.citation}</span>
                              </div>
                            ))}
                            {dayReqs.length > 3 && (
                              <div className="text-[10px] text-slate-500 px-1">+{dayReqs.length - 3} more</div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Side panel — selected date details or upcoming list */}
            <div className="space-y-4">
              {selectedDate && selectedReqs.length > 0 ? (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="space-y-3">
                    {selectedReqs.map(req => (
                      <Link
                        key={req.id}
                        href={`/matrix/requirements/${req.id}${tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : ''}`}
                        className="block p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg hover:border-slate-500/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(req.status)}`} />
                          <span className={`text-xs font-bold ${getAgencyColor(req.agency)}`}>{req.agency}</span>
                          <span className="text-xs text-slate-500 font-mono">{req.citation}</span>
                        </div>
                        <p className="text-sm text-slate-200 font-medium">{req.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                            req.status === 'compliant' ? 'bg-emerald-500/20 text-emerald-300' :
                            req.status === 'non_compliant' ? 'bg-red-500/20 text-red-300' :
                            req.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-slate-600/50 text-slate-400'
                          }`}>{getStatusLabel(req.status)}</span>
                          {req.frequency && (
                            <span className="text-[10px] text-slate-500">{getFrequencyLabel(req.frequency)}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : selectedDate ? (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-500">No deadlines on this date</p>
                </div>
              ) : null}

              {/* Upcoming deadlines list */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Upcoming Deadlines</h3>
                {(() => {
                  const sorted = [...requirements]
                    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
                  const upcoming = sorted.filter(r => {
                    const d = new Date(r.dueDate);
                    d.setHours(0, 0, 0, 0);
                    return d >= today;
                  }).slice(0, 8);
                  const overdue = sorted.filter(r => {
                    const d = new Date(r.dueDate);
                    d.setHours(0, 0, 0, 0);
                    return d < today && r.status !== 'compliant' && r.status !== 'n_a';
                  });

                  return (
                    <div className="space-y-2">
                      {overdue.length > 0 && (
                        <>
                          <p className="text-xs font-medium text-red-400 uppercase mt-1 mb-1">Overdue</p>
                          {overdue.map(req => (
                            <Link
                              key={req.id}
                              href={`/matrix/requirements/${req.id}${tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : ''}`}
                              className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15 hover:border-red-500/30 transition-colors"
                            >
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(req.status)}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-200 font-medium truncate">{req.citation}</p>
                                <p className="text-[10px] text-red-400">
                                  {new Date(req.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </>
                      )}
                      {upcoming.length > 0 && (
                        <>
                          {overdue.length > 0 && <p className="text-xs font-medium text-slate-500 uppercase mt-3 mb-1">Coming Up</p>}
                          {upcoming.map(req => {
                            const d = new Date(req.dueDate);
                            d.setHours(0, 0, 0, 0);
                            const daysUntil = Math.ceil((d.getTime() - today.getTime()) / 86400000);
                            return (
                              <Link
                                key={req.id}
                                href={`/matrix/requirements/${req.id}${tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : ''}`}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
                              >
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(req.status)}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-200 font-medium truncate">{req.citation}</p>
                                  <p className="text-[10px] text-slate-500">{req.title}</p>
                                </div>
                                <span className={`text-[10px] font-medium flex-shrink-0 ${
                                  daysUntil <= 7 ? 'text-amber-400' :
                                  daysUntil <= 30 ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                                </span>
                              </Link>
                            );
                          })}
                        </>
                      )}
                      {overdue.length === 0 && upcoming.length === 0 && (
                        <p className="text-xs text-slate-500 italic">All deadlines are in the past and compliant</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
