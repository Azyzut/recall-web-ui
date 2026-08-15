'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Types matching the API response (requirement with parsed JSON fields)
interface Obligation {
  description: string;
  frequency: string;
  condition: string;
  citationSubsection: string;
}

interface DocumentFile {
  id: string;
  filename: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  s3Key: string;
}

interface RegulationSummary {
  scope?: string;
  whoItAppliesTo?: string;
  keyRequirements?: string[];
  exemptions?: string[];
}

interface RequirementDetail {
  id: string;
  citation: string;
  title: string;
  name?: string;
  agency: string;
  confidence: number | null;
  appliesTo?: string;
  triggers?: string[];
  excerpt?: string;
  fullText?: string;
  reasoning?: string;
  regulationSummary?: RegulationSummary;
  status: string;
  priority: number | null;
  notes?: string;
  source?: string;
  dueDate?: string | null;
  calendarTracking?: boolean;
  frequency?: string | null;
  possibleObligations?: Obligation[];
}

type PriorityString = 'high' | 'medium' | 'low';

function getPriorityString(priority: number | null | string | undefined): PriorityString | null {
  if (priority === 3 || priority === 'high') return 'high';
  if (priority === 2 || priority === 'medium') return 'medium';
  if (priority === 1 || priority === 'low') return 'low';
  return null;
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

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
    case 'in_progress': return 'bg-blue-900/30 text-blue-300 border-blue-700/30';
    case 'compliant': return 'bg-emerald-900/30 text-emerald-300 border-emerald-700/30';
    case 'non_compliant': return 'bg-red-900/30 text-red-300 border-red-700/30';
    case 'n_a': return 'bg-slate-700/50 text-slate-400 border-slate-600/50';
    default: return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
  }
}

function getFrequencyLabel(freq: string): string {
  switch (freq) {
    case 'annual': return 'Annual';
    case 'semi_annual': return 'Semi-Annual';
    case 'quarterly': return 'Quarterly';
    case 'monthly': return 'Monthly';
    case 'one_time': return 'One-Time';
    default: return freq;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string): string {
  switch (fileType) {
    case 'PDF': return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
    case 'XLSX': return 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    case 'DOCX': return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    default: return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
  }
}

function getFileColor(fileType: string): string {
  switch (fileType) {
    case 'PDF': return 'text-red-400';
    case 'XLSX': return 'text-emerald-400';
    case 'DOCX': return 'text-blue-400';
    case 'TXT': return 'text-slate-400';
    default: return 'text-slate-400';
  }
}

function buildGoogleCalendarUrl(req: RequirementDetail): string {
  const title = encodeURIComponent(`Recall: ${req.citation} - ${req.title}`);
  const details = encodeURIComponent(`Product recall: ${req.citation}\n${req.title}\n\nReview and track recall response.`);
  const date = req.dueDate ? new Date(req.dueDate) : new Date();
  const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endDate = new Date(date.getTime() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let recur = '';
  if (req.frequency === 'annual') recur = '&recur=RRULE:FREQ=YEARLY';
  else if (req.frequency === 'semi_annual') recur = '&recur=RRULE:FREQ=MONTHLY;INTERVAL=6';
  else if (req.frequency === 'quarterly') recur = '&recur=RRULE:FREQ=MONTHLY;INTERVAL=3';
  else if (req.frequency === 'monthly') recur = '&recur=RRULE:FREQ=MONTHLY';
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}/${endDate}${recur}`;
}

function generateICS(req: RequirementDetail): string {
  const date = req.dueDate ? new Date(req.dueDate) : new Date();
  const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endDate = new Date(date.getTime() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let rrule = '';
  if (req.frequency === 'annual') rrule = '\nRRULE:FREQ=YEARLY';
  else if (req.frequency === 'semi_annual') rrule = '\nRRULE:FREQ=MONTHLY;INTERVAL=6';
  else if (req.frequency === 'quarterly') rrule = '\nRRULE:FREQ=MONTHLY;INTERVAL=3';
  else if (req.frequency === 'monthly') rrule = '\nRRULE:FREQ=MONTHLY';
  return `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${dateStr}\nDTEND:${endDate}\nSUMMARY:Recall: ${req.citation} - ${req.title}\nDESCRIPTION:Product recall response review${rrule}\nEND:VEVENT\nEND:VCALENDAR`;
}

export default function RequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');

  const [reqId, setReqId] = useState<string | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  // Local editing state
  const [localNotes, setLocalNotes] = useState('');
  const [localDueDate, setLocalDueDate] = useState<string | null>(null);
  const [localCalendarTracking, setLocalCalendarTracking] = useState(false);
  const [localFrequency, setLocalFrequency] = useState<string | null>(null);

  // Document state
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = !!session;

  // Resolve params
  useEffect(() => {
    params.then(p => setReqId(p.id));
  }, [params]);

  const fetchRequirement = useCallback(async () => {
    if (!reqId) return;
    try {
      const tokenQuery = tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : '';
      const res = await fetch(`/api/requirements/${reqId}${tokenQuery}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to load requirement');
        return;
      }
      const data = await res.json();
      const r = data.requirement;
      setReq(r);
      setLocalNotes(r.notes || '');
      setLocalDueDate(r.dueDate || null);
      setLocalCalendarTracking(r.calendarTracking || false);
      setLocalFrequency(r.frequency || null);
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [reqId, tokenParam]);

  useEffect(() => {
    fetchRequirement();
  }, [fetchRequirement]);

  const handleUpdate = async (field: string, value: unknown) => {
    if (!req) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/requirements/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requirement) {
          setReq(prev => prev ? { ...prev, ...data.requirement } : prev);
        }
      }
    } catch {
      // Silent fail — data is still shown
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadICS = () => {
    if (!req) return;
    const ics = generateICS(req);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${req.citation.replace(/\s/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch documents for this requirement
  const fetchDocuments = useCallback(async () => {
    if (!reqId) return;
    try {
      const tokenQuery = tokenParam ? `&token=${encodeURIComponent(tokenParam)}` : '';
      const res = await fetch(`/api/documents?requirementId=${reqId}${tokenQuery}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch {
      // Silent fail — documents are supplementary
    }
  }, [reqId, tokenParam]);

  useEffect(() => {
    if (reqId) fetchDocuments();
  }, [reqId, fetchDocuments]);

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!reqId || !canEdit) return;
    setUploading(true);
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${fileArray.length})...`);

      try {
        // Step 1: Create document record + get presigned upload URL
        const createRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requirementId: reqId,
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            fileSizeBytes: file.size,
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          alert(`Failed to upload ${file.name}: ${err.error}`);
          continue;
        }

        const { uploadUrl } = await createRes.json();

        // Step 2: Upload file directly to S3 via presigned URL
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });

        if (!uploadRes.ok) {
          alert(`Failed to upload ${file.name} to storage`);
          continue;
        }
      } catch {
        alert(`Error uploading ${file.name}`);
      }
    }

    setUploading(false);
    setUploadProgress(null);
    fetchDocuments();
  };

  const handleDeleteDocument = async (docId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } else {
        alert('Failed to delete document');
      }
    } catch {
      alert('Error deleting document');
    }
  };

  const handleDownloadDocument = async (docId: string) => {
    try {
      const tokenQuery = tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : '';
      const res = await fetch(`/api/documents/${docId}${tokenQuery}`);
      if (res.ok) {
        const data = await res.json();
        window.open(data.downloadUrl, '_blank');
      } else {
        alert('Failed to get download link');
      }
    } catch {
      alert('Error downloading document');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Build back link
  const backHref = tokenParam ? `/matrix?token=${encodeURIComponent(tokenParam)}` : '/matrix';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading requirement...
        </div>
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Requirement not found'}</p>
          <Link href={backHref} className="text-blue-400 hover:text-blue-300 text-sm">
            Back to Matrix
          </Link>
        </div>
      </div>
    );
  }

  const priority = getPriorityString(req.priority);
  const summary = req.regulationSummary;

  // Build FDA/CPSC link from agency
  const agencyLink = (() => {
    if (req.agency === 'FDA') {
      return 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts';
    }
    if (req.agency === 'CPSC') {
      return 'https://www.cpsc.gov/Recalls';
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href={backHref} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Matrix
          </Link>
          <div className="flex items-center gap-2">
            {canEdit ? (
              <>
                <select
                  value={req.status || 'pending'}
                  onChange={(e) => {
                    setReq(prev => prev ? { ...prev, status: e.target.value } : prev);
                    handleUpdate('status', e.target.value);
                  }}
                  disabled={saving}
                  className={`px-2.5 py-1 rounded text-xs font-medium border cursor-pointer focus:outline-none transition-all ${getStatusColor(req.status)} ${saving ? 'opacity-50' : ''}`}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="compliant">Compliant</option>
                  <option value="non_compliant">Non-Compliant</option>
                  <option value="n_a">N/A</option>
                </select>
                <select
                  value={priority || 'medium'}
                  onChange={(e) => {
                    handleUpdate('priority', e.target.value);
                  }}
                  disabled={saving}
                  className={`px-2.5 py-1 rounded text-xs font-medium border cursor-pointer focus:outline-none transition-all ${
                    priority === 'high' ? 'bg-red-900/30 text-red-300 border-red-700/30' :
                    priority === 'medium' ? 'bg-amber-900/30 text-amber-300 border-amber-700/30' :
                    'bg-slate-700/30 text-slate-400 border-slate-600/30'
                  } ${saving ? 'opacity-50' : ''}`}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </>
            ) : (
              <>
                <span className={`px-2.5 py-1 rounded text-xs font-medium border ${getStatusColor(req.status)}`}>
                  {getStatusLabel(req.status)}
                </span>
                {priority && (
                  <span className={`px-2.5 py-1 rounded text-xs font-medium border ${
                    priority === 'high' ? 'bg-red-900/30 text-red-300 border-red-700/30' :
                    priority === 'medium' ? 'bg-amber-900/30 text-amber-300 border-amber-700/30' :
                    'bg-slate-700/30 text-slate-400 border-slate-600/30'
                  }`}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Title Block */}
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="px-2 py-0.5 text-xs font-bold uppercase bg-blue-500/20 text-blue-400 rounded">{req.agency}</span>
            <span className="text-sm font-mono text-slate-400">{req.citation}</span>
            {req.confidence !== null && (
              <span className={`text-sm font-bold ${
                req.confidence >= 80 ? 'text-emerald-400' :
                req.confidence >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {req.confidence}%
              </span>
            )}
            {req.dueDate && (
              <span className="text-sm text-slate-400">
                Due: {new Date(req.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{req.title}</h1>
          {req.appliesTo && (
            <p className="text-slate-400 mt-2">{req.appliesTo}</p>
          )}
        </div>

        {/* Overview */}
        {summary && (
          <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Overview</h2>
            {summary.scope && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Scope</p>
                <p className="text-sm text-slate-300">{summary.scope}</p>
              </div>
            )}
            {summary.whoItAppliesTo && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Who it applies to</p>
                <p className="text-sm text-slate-300">{summary.whoItAppliesTo}</p>
              </div>
            )}
            {summary.keyRequirements && summary.keyRequirements.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Key Requirements</p>
                <ul className="space-y-1">
                  {summary.keyRequirements.map((kr, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5 flex-shrink-0">&#8226;</span>
                      {kr}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.exemptions && summary.exemptions.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Exemptions</p>
                <ul className="space-y-1">
                  {summary.exemptions.map((ex, i) => (
                    <li key={i} className="text-sm text-slate-400 italic flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5 flex-shrink-0">&#8226;</span>
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Reasoning */}
        {req.reasoning && (
          <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Why This Applies</h2>
            <p className="text-sm text-slate-300 leading-relaxed">{req.reasoning}</p>
          </section>
        )}

        {/* Triggers */}
        {req.triggers && req.triggers.length > 0 && (
          <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Triggers</h2>
            <div className="flex flex-wrap gap-2">
              {req.triggers.map((trigger, i) => (
                <span key={i} className="px-3 py-1.5 text-sm bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                  {trigger}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Possible Obligations */}
        {req.possibleObligations && req.possibleObligations.length > 0 && (
          <section className="bg-slate-800/40 rounded-xl border border-amber-500/20 p-6">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-4">
              Possible Obligations ({req.possibleObligations.length})
            </h2>
            <div className="space-y-3">
              {req.possibleObligations.map((obl, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                  <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-200 font-medium">{obl.description}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 rounded">
                        {obl.frequency}
                      </span>
                      {obl.citationSubsection && (
                        <span className="text-xs text-slate-500 font-mono">{obl.citationSubsection}</span>
                      )}
                    </div>
                    {obl.condition && (
                      <p className="text-sm text-slate-400 italic mt-1">{obl.condition}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Notes */}
        <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Your Notes</h2>
          {canEdit ? (
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={() => {
                const val = localNotes.trim();
                if (val !== (req.notes || '').trim()) {
                  handleUpdate('notes', val);
                }
              }}
              placeholder="Add notes about your recall response status, actions taken, etc."
              rows={4}
              className="text-sm text-slate-300 w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none placeholder-slate-500"
            />
          ) : req.notes ? (
            <p className="text-sm text-slate-300">{req.notes}</p>
          ) : (
            <p className="text-sm text-slate-500 italic">No notes</p>
          )}
        </section>

        {/* Due Dates & Calendar */}
        <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Due Dates & Calendar</h2>
          {canEdit ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={localDueDate ? new Date(localDueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setLocalDueDate(val);
                  }}
                  onBlur={() => {
                    if (localDueDate !== (req.dueDate || null)) {
                      handleUpdate('dueDate', localDueDate);
                    }
                  }}
                  className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <span className="text-sm text-slate-400">Due Date</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localCalendarTracking}
                    onChange={(e) => {
                      setLocalCalendarTracking(e.target.checked);
                      handleUpdate('calendarTracking', e.target.checked);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                </label>
                <span className="text-sm text-slate-400">Track on calendar</span>
              </div>

              {localCalendarTracking && (
                <div className="flex items-center gap-3">
                  <select
                    value={localFrequency || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setLocalFrequency(val);
                      handleUpdate('frequency', val);
                    }}
                    className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="">Select frequency</option>
                    <option value="annual">Annual</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                    <option value="one_time">One-Time</option>
                  </select>
                  <span className="text-sm text-slate-400">Frequency</span>
                </div>
              )}

              {localDueDate && localCalendarTracking && localFrequency && (
                <div className="flex items-center gap-3 pt-2">
                  <a
                    href={buildGoogleCalendarUrl({ ...req, dueDate: localDueDate, frequency: localFrequency })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors"
                  >
                    Add to Google Calendar
                  </a>
                  <button
                    onClick={handleDownloadICS}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-600/50 transition-colors"
                  >
                    Add to Outlook (.ics)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {req.dueDate ? (
                <p className="text-sm text-slate-300">
                  Due: {new Date(req.dueDate).toLocaleDateString()}
                  {req.frequency && <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded">{getFrequencyLabel(req.frequency)}</span>}
                  {req.calendarTracking && <span className="ml-2 text-xs text-slate-500">Tracked</span>}
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">No due date set</p>
              )}
            </div>
          )}
        </section>

        {/* Documents & Files */}
        <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Documents & Files {documents.length > 0 && <span className="text-slate-500">({documents.length})</span>}
            </h2>
            {canEdit && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
            )}
          </div>

          {/* Upload zone (authenticated users only) */}
          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.docx,.doc,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all mb-4 ${
                  dragOver
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-600/50 hover:border-slate-500/70 hover:bg-slate-700/20'
                } ${uploading ? 'opacity-50 cursor-wait' : ''}`}
              >
                {uploading && uploadProgress ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-blue-300">{uploadProgress}</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-8 h-8 mx-auto text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-slate-400">
                      Drag & drop files here, or <span className="text-blue-400">browse</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">PDF, Excel, Word, TXT &mdash; Max 50MB</p>
                  </>
                )}
              </div>
            </>
          )}

          {/* File list */}
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30 group hover:border-slate-500/40 transition-colors">
                  {/* File type icon */}
                  <svg className={`w-8 h-8 flex-shrink-0 ${getFileColor(doc.fileType)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={getFileIcon(doc.fileType)} />
                  </svg>
                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{doc.filename}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium uppercase">{doc.fileType}</span>
                      <span>&middot;</span>
                      <span>{formatFileSize(doc.fileSizeBytes)}</span>
                      <span>&middot;</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownloadDocument(doc.id)}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-600/50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600/50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !canEdit ? (
            <p className="text-sm text-slate-500 italic">No documents uploaded yet.</p>
          ) : null}
        </section>

        {/* Regulation Text (collapsible) */}
        {req.fullText && (
          <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
            <button
              onClick={() => setShowFullText(!showFullText)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Regulation Text
              </h2>
              <svg className={`w-5 h-5 text-slate-400 transition-transform ${showFullText ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showFullText && (
              <div className="mt-4 max-h-[600px] overflow-y-auto">
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">{req.fullText}</pre>
              </div>
            )}
            {!showFullText && (
              <p className="text-xs text-slate-500 mt-2">
                {(req.fullText.length / 1000).toFixed(0)}K characters of regulatory text. Click to expand.
              </p>
            )}
          </section>
        )}

        {/* Excerpt (if no full text) */}
        {!req.fullText && req.excerpt && (
          <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Excerpt</h2>
            <p className="text-sm text-slate-300 italic">{req.excerpt}</p>
          </section>
        )}

        {/* Resources */}
        <section className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Resources</h2>
          <div className="space-y-2">
            {agencyLink && (
              <a
                href={agencyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {req.agency === 'FDA' ? 'FDA Safety Alerts' : 'CPSC Recalls'}
              </a>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
