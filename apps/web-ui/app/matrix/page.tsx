'use client';

import { useState, useEffect, useRef, useCallback, Suspense, memo, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { useFM } from '@/components/providers/FMProvider';

// Dynamic import of DraggableRequirementsList - only loaded for authenticated users
// This saves ~50-60KB for anonymous users who can't drag anyway
const DraggableRequirementsList = dynamic(
  () => import('./DraggableRequirementsList'),
  { ssr: false }
);

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
  // CRUD fields from requirements table
  status?: 'pending' | 'in_progress' | 'compliant' | 'non_compliant' | 'n_a';
  priority?: 'high' | 'medium' | 'low' | number | null; // number from DB, string from UI
  notes?: string;
  sortOrder?: number | null;
  // Calendar tracking fields
  dueDate?: string | null;
  calendarTracking?: boolean;
  frequency?: 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'one_time' | null;
  // AI-extracted possible obligations
  possibleObligations?: {
    description: string;
    frequency: string;
    condition: string;
    citationSubsection: string;
  }[];
}

interface ComplianceStats {
  total: number;
  pending: number;
  inProgress: number;
  compliant: number;
  nonCompliant: number;
  notApplicable: number;
  complianceRate: number;
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
  discoveryInProgress?: boolean;
}

// Props for the memoized requirement card
interface RequirementCardProps {
  req: Requirement;
  reqId: string;
  isExpanded: boolean;
  isNew: boolean;
  canEdit: boolean;
  savingId: string | null;
  activeTab: string;
  editingField: { reqId: string; field: string } | null;
  editValue: string;
  newTrigger: string;
  deleteConfirmId: string | null;
  onUpdate: (reqId: string, field: string, value: string | string[] | boolean | null) => void;
  onToggleExpand: (reqId: string) => void;
  onStartEditing: (reqId: string, field: string, currentValue: string) => void;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onSetEditValue: (value: string) => void;
  onSetNewTrigger: (value: string) => void;
  onAddTrigger: (reqId: string, currentTriggers: string[]) => void;
  onRemoveTrigger: (reqId: string, currentTriggers: string[], index: number) => void;
  onSetDeleteConfirmId: (id: string | null) => void;
  onDeleteRequirement: (reqId: string) => void;
  tokenParam: string | null;
}

// Memoized requirement card - only re-renders when its specific props change
const RequirementCard = memo(function RequirementCard({
  req,
  reqId,
  isExpanded,
  isNew,
  canEdit,
  savingId,
  activeTab,
  editingField,
  editValue,
  newTrigger,
  deleteConfirmId,
  onUpdate,
  onToggleExpand,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onSetEditValue,
  onSetNewTrigger,
  onAddTrigger,
  onRemoveTrigger,
  onSetDeleteConfirmId,
  onDeleteRequirement,
  tokenParam,
}: RequirementCardProps) {
  // Local state for typing fields - prevents parent re-render on every keystroke
  const [localNotes, setLocalNotes] = useState(req.notes || '');
  const [localDueDate, setLocalDueDate] = useState(req.dueDate || '');
  const [localCalendarTracking, setLocalCalendarTracking] = useState(req.calendarTracking || false);
  const [localFrequency, setLocalFrequency] = useState(req.frequency || '');

  // Helper functions defined inside component to avoid prop instability
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

  const getPriorityString = (priority: Requirement['priority']): 'high' | 'medium' | 'low' | null => {
    if (priority === 3 || priority === 'high') return 'high';
    if (priority === 2 || priority === 'medium') return 'medium';
    if (priority === 1 || priority === 'low') return 'low';
    return null;
  };

  const frequencyLabel = (frequency: string | null | undefined): string => {
    switch (frequency) {
      case 'annual': return 'Annual';
      case 'semi_annual': return 'Semi-Annual';
      case 'quarterly': return 'Quarterly';
      case 'monthly': return 'Monthly';
      case 'one_time': return 'One-Time';
      default: return '';
    }
  };

  const frequencyToRRule = (frequency: string | null | undefined): string => {
    switch (frequency) {
      case 'annual': return 'RRULE:FREQ=YEARLY';
      case 'semi_annual': return 'RRULE:FREQ=YEARLY;INTERVAL=6';
      case 'quarterly': return 'RRULE:FREQ=MONTHLY;INTERVAL=3';
      case 'monthly': return 'RRULE:FREQ=MONTHLY';
      case 'one_time': return '';
      default: return '';
    }
  };

  const formatDateForCalendar = (dateStr: string): string => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const generateGoogleCalendarUrl = (r: Requirement): string => {
    if (!r.dueDate) return '';
    const dateStr = formatDateForCalendar(r.dueDate);
    const title = encodeURIComponent(`Recall: ${r.citation} - ${r.name || r.title}`);
    const details = encodeURIComponent(`Product recall: ${r.name || r.title}\n\nRecall #: ${r.citation}\n\n${r.appliesTo || ''}`);
    const rrule = frequencyToRRule(r.frequency);
    const recur = rrule ? `&recur=${encodeURIComponent(rrule)}` : '';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}${recur}`;
  };

  const generateIcsFile = (r: Requirement): void => {
    if (!r.dueDate) return;
    const dateStr = formatDateForCalendar(r.dueDate);
    const uid = `${r.id}@recall-tracker`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const rrule = frequencyToRRule(r.frequency);
    const rruleLine = rrule ? `\n${rrule}` : '';

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Product Recall Tracker//NONSGML v1.0//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART;VALUE=DATE:${dateStr}
DTEND;VALUE=DATE:${dateStr}
SUMMARY:Recall: ${r.citation} - ${(r.name || r.title).replace(/[,;\\]/g, ' ')}
DESCRIPTION:Product recall: ${(r.name || r.title).replace(/[,;\\]/g, ' ')}\\n\\nRecall #: ${r.citation}${rruleLine}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recall-${r.citation.replace(/\s+/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle date change - only updates local state, onBlur will sync to parent
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDueDate(e.target.value || '');
  };

  // Sync to parent only on blur, not on every change (prevents re-renders on month navigation)
  const handleDateBlur = () => {
    if (localDueDate !== (req.dueDate || '')) {
      onUpdate(reqId, 'dueDate', localDueDate || null);
    }
  };

  // Sync local state when props change (e.g., after server response)
  useEffect(() => {
    setLocalNotes(req.notes || '');
  }, [req.notes]);

  useEffect(() => {
    setLocalDueDate(req.dueDate || '');
  }, [req.dueDate]);

  useEffect(() => {
    setLocalCalendarTracking(req.calendarTracking || false);
  }, [req.calendarTracking]);

  useEffect(() => {
    setLocalFrequency(req.frequency || '');
  }, [req.frequency]);

  return (
    <div
      className={`p-4 hover:bg-slate-800/30 transition-all duration-300 ${isNew ? 'animate-slide-in bg-blue-500/5' : ''}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12">
          <div className="text-center">
            <div className={`text-lg font-bold ${getConfidenceStyle(req.confidence)}`}>
              {req.confidence}%
            </div>
            <div className="h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div className={`h-full ${getConfidenceBar(req.confidence)} transition-all`} style={{ width: `${req.confidence}%` }}></div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getAgencyBadgeStyle(activeTab)}`}>
              {activeTab}
            </span>
            <span className="text-sm font-mono text-slate-500">{req.citation}</span>
            {/* Status - Dropdown for auth, Badge for anon */}
            {canEdit ? (
              <select
                value={req.status || 'pending'}
                onChange={(e) => onUpdate(reqId, 'status', e.target.value)}
                disabled={savingId === reqId}
                className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all
                  ${savingId === reqId ? 'opacity-50 cursor-wait' : ''}
                  ${req.status === 'compliant' ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' :
                    req.status === 'non_compliant' ? 'bg-red-900/50 text-red-300 border-red-700/50' :
                    req.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300 border-blue-700/50' :
                    req.status === 'n_a' ? 'bg-slate-700/50 text-slate-400 border-slate-600/50' :
                    'bg-slate-700/50 text-slate-300 border-slate-600/50'}`}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="compliant">Compliant</option>
                <option value="non_compliant">Non-Compliant</option>
                <option value="n_a">N/A</option>
              </select>
            ) : (
              req.status && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  req.status === 'compliant' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50' :
                  req.status === 'non_compliant' ? 'bg-red-900/50 text-red-300 border border-red-700/50' :
                  req.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' :
                  req.status === 'n_a' ? 'bg-slate-700/50 text-slate-400 border border-slate-600/50' :
                  'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                }`}>
                  {req.status === 'n_a' ? 'N/A' :
                   req.status === 'non_compliant' ? 'Non-Compliant' :
                   req.status === 'in_progress' ? 'In Progress' :
                   req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                </span>
              )
            )}
            {/* Priority - Dropdown for auth, Badge for anon */}
            {canEdit ? (
              <select
                value={getPriorityString(req.priority) || 'medium'}
                onChange={(e) => onUpdate(reqId, 'priority', e.target.value)}
                disabled={savingId === reqId}
                className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all
                  ${savingId === reqId ? 'opacity-50 cursor-wait' : ''}
                  ${getPriorityString(req.priority) === 'high' ? 'bg-red-900/30 text-red-300 border-red-700/30' :
                    getPriorityString(req.priority) === 'medium' ? 'bg-amber-900/30 text-amber-300 border-amber-700/30' :
                    'bg-slate-700/30 text-slate-400 border-slate-600/30'}`}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            ) : (
              (() => {
                const priority = getPriorityString(req.priority);
                if (!priority) return null;
                return (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    priority === 'high' ? 'bg-red-900/30 text-red-300 border border-red-700/30' :
                    priority === 'medium' ? 'bg-amber-900/30 text-amber-300 border border-amber-700/30' :
                    'bg-slate-700/30 text-slate-400 border border-slate-600/30'
                  }`}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                  </span>
                );
              })()
            )}
          </div>
          {/* Title - editable inline */}
          {isExpanded && canEdit && editingField?.reqId === reqId && (editingField.field === 'title' || editingField.field === 'name') ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => onSetEditValue(e.target.value)}
              onBlur={onSaveEditing}
              onKeyDown={(e) => { if (e.key === 'Enter') onSaveEditing(); if (e.key === 'Escape') onCancelEditing(); }}
              className="font-semibold text-white mb-1 w-full bg-slate-800 border border-blue-500/50 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          ) : (
            <h3
              className={`font-semibold text-white mb-1 ${isExpanded && canEdit ? 'cursor-pointer hover:bg-slate-800/50 rounded px-1 -mx-1' : ''}`}
              onClick={() => isExpanded && canEdit && onStartEditing(reqId, req.name ? 'name' : 'title', req.name || req.title)}
            >
              {req.name || req.title}
            </h3>
          )}
          {/* AppliesTo - editable inline when expanded */}
          {isExpanded && canEdit && editingField?.reqId === reqId && editingField.field === 'appliesTo' ? (
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => onSetEditValue(e.target.value)}
              onBlur={onSaveEditing}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditing(); }}
              rows={3}
              className="text-sm text-slate-400 w-full bg-slate-800 border border-blue-500/50 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          ) : (
            req.appliesTo && (
              <p
                className={`text-sm text-slate-400 ${isExpanded ? '' : 'line-clamp-2'} ${isExpanded && canEdit ? 'cursor-pointer hover:bg-slate-800/50 rounded px-1 -mx-1' : ''}`}
                onClick={() => isExpanded && canEdit && onStartEditing(reqId, 'appliesTo', req.appliesTo || '')}
              >
                {req.appliesTo}
              </p>
            )
          )}

          {isExpanded && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl space-y-3">
              {/* Citation - editable */}
              {canEdit && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Citation</p>
                  {editingField?.reqId === reqId && editingField.field === 'citation' ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => onSetEditValue(e.target.value)}
                      onBlur={onSaveEditing}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSaveEditing(); if (e.key === 'Escape') onCancelEditing(); }}
                      className="text-sm font-mono text-slate-300 w-full bg-slate-700 border border-blue-500/50 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  ) : (
                    <p
                      className="text-sm font-mono text-slate-300 cursor-pointer hover:bg-slate-700/50 rounded px-1 -mx-1"
                      onClick={() => onStartEditing(reqId, 'citation', req.citation)}
                    >
                      {req.citation}
                    </p>
                  )}
                </div>
              )}
              {/* Triggers - editable tags */}
              {(req.triggers && req.triggers.length > 0) || canEdit ? (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Triggers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(req.triggers || []).map((trigger, idx) => (
                      <span key={idx} className="px-2 py-1 text-xs bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 flex items-center gap-1">
                        {trigger}
                        {canEdit && (
                          <button
                            onClick={() => onRemoveTrigger(reqId, req.triggers || [], idx)}
                            className="text-amber-500/60 hover:text-amber-300 ml-0.5"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    ))}
                    {canEdit && (
                      <input
                        type="text"
                        value={newTrigger}
                        onChange={(e) => onSetNewTrigger(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onAddTrigger(reqId, req.triggers || []);
                          }
                        }}
                        placeholder="+ add trigger"
                        className="px-2 py-1 text-xs bg-slate-700/50 text-slate-300 rounded border border-slate-600/50 focus:border-amber-500/50 focus:outline-none w-24 placeholder-slate-500"
                      />
                    )}
                  </div>
                </div>
              ) : null}
              {/* Excerpt - editable */}
              {req.excerpt || canEdit ? (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Excerpt</p>
                  {canEdit && editingField?.reqId === reqId && editingField.field === 'excerpt' ? (
                    <textarea
                      autoFocus
                      value={editValue}
                      onChange={(e) => onSetEditValue(e.target.value)}
                      onBlur={onSaveEditing}
                      onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditing(); }}
                      rows={4}
                      className="text-sm text-slate-300 italic w-full bg-slate-700 border border-blue-500/50 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                    />
                  ) : (
                    <p
                      className={`text-sm text-slate-300 italic ${canEdit ? 'cursor-pointer hover:bg-slate-700/50 rounded px-1 -mx-1' : ''}`}
                      onClick={() => canEdit && onStartEditing(reqId, 'excerpt', req.excerpt || '')}
                    >
                      {req.excerpt || (canEdit ? 'Click to add excerpt...' : '')}
                    </p>
                  )}
                </div>
              ) : null}
              {/* Notes - uses local state for typing */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                {canEdit ? (
                  <textarea
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== (req.notes || '').trim()) {
                        onUpdate(reqId, 'notes', val);
                      }
                    }}
                    placeholder="Add notes about your recall response status, actions taken, etc."
                    rows={3}
                    className="text-sm text-slate-300 w-full bg-slate-700 border border-slate-600/50 rounded px-2 py-1 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none placeholder-slate-500"
                  />
                ) : req.notes ? (
                  <p className="text-sm text-slate-300">{req.notes}</p>
                ) : (
                  <p className="text-sm text-slate-500 italic">No notes</p>
                )}
              </div>

              {/* Possible Obligations (AI-extracted) */}
              {req.possibleObligations && req.possibleObligations.length > 0 && (
                <div className="pt-3 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Possible Obligations</p>
                  <div className="space-y-2">
                    {req.possibleObligations.map((obl, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                        <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-slate-200 font-medium">{obl.description}</span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 rounded">
                              {obl.frequency}
                            </span>
                            {obl.citationSubsection && (
                              <span className="text-[10px] text-slate-500 font-mono">{obl.citationSubsection}</span>
                            )}
                          </div>
                          {obl.condition && (
                            <p className="text-xs text-slate-400 italic mt-1">{obl.condition}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Due Dates & Calendar section */}
              <div className="pt-3 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Due Dates & Calendar</p>
                {canEdit ? (
                  <div className="space-y-3">
                    {/* Due Date Input - uses local state, only syncs on blur */}
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={localDueDate ? new Date(localDueDate).toISOString().split('T')[0] : ''}
                        onChange={handleDateChange}
                        onBlur={handleDateBlur}
                        className="bg-slate-700 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-slate-300 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      <span className="text-sm text-slate-400">Due Date</span>
                    </div>

                    {/* Calendar Tracking Toggle - uses local state */}
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localCalendarTracking}
                          onChange={(e) => {
                            const newVal = e.target.checked;
                            setLocalCalendarTracking(newVal);
                            onUpdate(reqId, 'calendarTracking', newVal ? 'true' : 'false');
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      <span className="text-sm text-slate-400">Track on calendar</span>
                    </div>

                    {/* Frequency Dropdown - uses local state */}
                    {localCalendarTracking && (
                      <div className="flex items-center gap-3 ml-12">
                        <select
                          value={localFrequency}
                          onChange={(e) => {
                            const newVal = e.target.value || '';
                            setLocalFrequency(newVal);
                            onUpdate(reqId, 'frequency', newVal);
                          }}
                          className="bg-slate-700 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-slate-300 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        >
                          <option value="">Select frequency...</option>
                          <option value="annual">Annual</option>
                          <option value="semi_annual">Semi-Annual</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="monthly">Monthly</option>
                          <option value="one_time">One-Time</option>
                        </select>
                        <span className="text-sm text-slate-400">Frequency</span>
                      </div>
                    )}

                    {/* Calendar Export Buttons */}
                    {localDueDate && localFrequency && (
                      <div className="flex items-center gap-2 mt-2">
                        <a
                          href={generateGoogleCalendarUrl({ ...req, dueDate: localDueDate, frequency: localFrequency as Requirement['frequency'] })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z"/>
                          </svg>
                          Add to Google Calendar
                        </a>
                        <button
                          onClick={() => generateIcsFile({ ...req, dueDate: localDueDate, frequency: localFrequency as Requirement['frequency'] })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Add to Outlook
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Read-only view for anonymous users */
                  <div className="space-y-2">
                    {req.dueDate && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-slate-300">
                          Due: {new Date(req.dueDate).toLocaleDateString()}
                        </span>
                        {req.frequency && (
                          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                            {frequencyLabel(req.frequency)}
                          </span>
                        )}
                      </div>
                    )}
                    {!req.dueDate && (
                      <p className="text-sm text-slate-500 italic">No due date set</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          <button onClick={() => onToggleExpand(reqId)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Expand/collapse">
            <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <a href={`/matrix/requirements/${reqId}${tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : ''}`} className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-colors" title="View full details">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </a>
          <a href={`https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts`} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors" title="View on FDA.gov">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          {/* Delete Button (auth only) */}
          {canEdit && (
            deleteConfirmId === reqId ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onDeleteRequirement(reqId)}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500"
                >
                  Confirm
                </button>
                <button
                  onClick={() => onSetDeleteConfirmId(null)}
                  className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSetDeleteConfirmId(reqId)}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if something that affects THIS specific card changed

  // Core requirement data
  if (prevProps.req !== nextProps.req) return false;
  if (prevProps.isExpanded !== nextProps.isExpanded) return false;
  if (prevProps.isNew !== nextProps.isNew) return false;
  if (prevProps.canEdit !== nextProps.canEdit) return false;
  if (prevProps.activeTab !== nextProps.activeTab) return false;

  // savingId: only care if THIS card is/was being saved
  const prevSaving = prevProps.savingId === prevProps.reqId;
  const nextSaving = nextProps.savingId === nextProps.reqId;
  if (prevSaving !== nextSaving) return false;

  // editingField: only care if THIS card is/was being edited
  const prevEditing = prevProps.editingField?.reqId === prevProps.reqId;
  const nextEditing = nextProps.editingField?.reqId === nextProps.reqId;
  if (prevEditing !== nextEditing) return false;
  // If this card IS being edited, also check editValue
  if (nextEditing) {
    if (prevProps.editValue !== nextProps.editValue) return false;
  }
  // If this card is expanded, check newTrigger (trigger input is visible when expanded)
  if (nextProps.isExpanded && prevProps.newTrigger !== nextProps.newTrigger) return false;

  // deleteConfirmId: only care if THIS card has the confirm dialog
  const prevDeleting = prevProps.deleteConfirmId === prevProps.reqId;
  const nextDeleting = nextProps.deleteConfirmId === nextProps.reqId;
  if (prevDeleting !== nextDeleting) return false;

  return true;
});

const matrixThemeConfigs: Record<string, {
  iconGradient: string; headerBg: string; shadow: string;
  avatarGradient: string; ctaGradient: string; ctaHover: string;
  ctaShadow: string; dotColor: string;
  fdaTab: string; cpscTab: string; accentBorder: string;
}> = {
  default: {
    iconGradient: 'from-blue-600 to-cyan-500',
    headerBg: 'bg-slate-900/50',
    shadow: 'shadow-blue-500/20',
    avatarGradient: 'from-blue-500 to-cyan-500',
    ctaGradient: 'from-blue-600 to-cyan-600',
    ctaHover: 'hover:from-blue-500 hover:to-cyan-500',
    ctaShadow: 'shadow-blue-500/25',
    dotColor: 'bg-blue-500',
    fdaTab: 'bg-blue-600 border-blue-500 text-white',
    cpscTab: 'bg-amber-600 border-amber-500 text-white',
    accentBorder: 'border-blue-500/30',
  },
  dark: {
    // Genuinely neutral, from the brand grey scale. Previously this was a copy of
    // `smb` differing only in headerBg, so the two were indistinguishable in the
    // UI and the flag looked like it had a redundant option.
    iconGradient: 'from-[#4D4D4D] to-[#B3B3B3]',
    headerBg: 'bg-[#1A1A1A]/90',
    shadow: 'shadow-black/50',
    avatarGradient: 'from-[#333333] to-[#666666]',
    ctaGradient: 'from-[#333333] to-[#4D4D4D]',
    ctaHover: 'hover:from-[#4D4D4D] hover:to-[#666666]',
    ctaShadow: 'shadow-black/60',
    dotColor: 'bg-[#B3B3B3]',
    fdaTab: 'bg-[#4D4D4D] border-[#666666] text-white',
    cpscTab: 'bg-[#1A1A1A] border-[#4D4D4D] text-white',
    accentBorder: 'border-[#666666]/40',
  },
  vibrant: {
    iconGradient: 'from-purple-600 to-pink-500',
    headerBg: 'bg-slate-900/50',
    shadow: 'shadow-purple-500/30',
    avatarGradient: 'from-purple-500 to-pink-500',
    ctaGradient: 'from-purple-600 to-pink-600',
    ctaHover: 'hover:from-purple-500 hover:to-pink-500',
    ctaShadow: 'shadow-purple-500/40',
    dotColor: 'bg-purple-400',
    fdaTab: 'bg-purple-600 border-purple-500 text-white',
    cpscTab: 'bg-pink-600 border-pink-500 text-white',
    accentBorder: 'border-purple-500/30',
  },
  branded: {
    // Actual CloudBees colours: #0069FF primary blue, #806FF6 purple, #E6CEFF
    // lavender. Previously orange-to-red, which appears nowhere in the palette.
    // As the one theme that is recognisably somebody's brand, it carries the
    // point of a string flag: the same product, re-skinned per customer.
    iconGradient: 'from-[#0069FF] to-[#806FF6]',
    headerBg: 'bg-slate-900/50',
    shadow: 'shadow-[#0069FF]/30',
    avatarGradient: 'from-[#0069FF] to-[#806FF6]',
    ctaGradient: 'from-[#0069FF] to-[#806FF6]',
    ctaHover: 'hover:from-[#3388FF] hover:to-[#9B8DF8]',
    ctaShadow: 'shadow-[#0069FF]/40',
    dotColor: 'bg-[#0069FF]',
    fdaTab: 'bg-[#0069FF] border-[#0069FF] text-white',
    cpscTab: 'bg-[#806FF6] border-[#806FF6] text-white',
    accentBorder: 'border-[#E6CEFF]/40',
  },
};

function MatrixContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');
  const fm = useFM();
  const themeKey = fm.getValue('recall.headerTheme', 'default') as string;
  const headerTheme = matrixThemeConfigs[themeKey] || matrixThemeConfigs.default;

  const [initialLoading, setInitialLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComplianceData | null>(null);
  const [activeTab, setActiveTab] = useState<'FDA' | 'CPSC'>('FDA');
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());
  const [chatMessage, setChatMessage] = useState('');
  const [pollCount, setPollCount] = useState(0);
  // Wall-clock seconds since polling began. Derived from a 1s interval rather than
  // from pollCount, because the poll interval is 15s and multiplying it made the
  // timer jump 0:00 -> 0:15 -> 0:30, which reads like the page is stalling.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!polling) {
      setElapsedSeconds(0);
      return;
    }
    const id = setInterval(() => setElapsedSeconds(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [polling]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [chatExpanded, setChatExpanded] = useState(false);
  // Chat agent state
  const [chatMessages, setChatMessages] = useState<{ id: string; role: 'USER' | 'ASSISTANT'; content: string; toolsUsed?: string[]; createdAt: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const revealRef = useRef<NodeJS.Timeout | null>(null);
  const prevActiveTabRef = useRef<string>(activeTab);
  const fetchFailCount = useRef(0);
  const hasDataRef = useRef(false);

  // Inline editing state: { reqId: { field: editValue } }
  const [editingField, setEditingField] = useState<{ reqId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newTrigger, setNewTrigger] = useState('');

  // Step 6: Full CRUD state
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addFormData, setAddFormData] = useState({
    citation: '',
    title: '',
    description: '',
    priority: 'medium',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Auth state flags for CRUD UI gating (Steps 4-6)
  const isAnonymous = !session && !!tokenParam;
  const isAuthenticated = !!session;
  const canEdit = isAuthenticated;  // Only logged-in users can edit
  const canView = isAuthenticated || isAnonymous;

  // Chat agent: send message to /api/chat
  const sendChatMessage = useCallback(async (text: string) => {
    if (!text.trim() || chatLoading) return;
    setChatMessage('');
    setChatError(null);

    const userMsg = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'USER' as const,
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      setConversationId(data.conversationId);
      setChatMessages(prev => [...prev, {
        id: data.messageId,
        role: 'ASSISTANT',
        content: data.response,
        toolsUsed: data.toolsUsed,
        createdAt: new Date().toISOString(),
      }]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, conversationId]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // Calculate stats from requirements using single-pass reduce (O(n) instead of O(5n))
  const calculateStats = useCallback((requirements: Requirement[]): ComplianceStats => {
    const counts = requirements.reduce(
      (acc, r) => {
        const status = r.status || 'pending';
        acc.total++;
        if (status === 'pending') acc.pending++;
        else if (status === 'in_progress') acc.inProgress++;
        else if (status === 'compliant') acc.compliant++;
        else if (status === 'non_compliant') acc.nonCompliant++;
        else if (status === 'n_a') acc.notApplicable++;
        return acc;
      },
      { total: 0, pending: 0, inProgress: 0, compliant: 0, nonCompliant: 0, notApplicable: 0 }
    );

    const applicable = counts.total - counts.notApplicable;
    const complianceRate = applicable > 0 ? Math.round((counts.compliant / applicable) * 100) : 0;

    return { ...counts, complianceRate };
  }, []);

  const fetchData = useCallback(async (): Promise<boolean> => {
    try {
      const url = tokenParam
        ? `/api/compliance?token=${encodeURIComponent(tokenParam)}`
        : '/api/compliance/me';

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        // FM kill switch (recall.dashboardRedesign). The service is closed, so an
        // authenticated session must not survive it: end the session and return to
        // the login page, which refuses to let anyone back in while the flag is on.
        //
        // Rendering an error in place here was worse. This page assumes it will get
        // data, so a 503 reached code paths that had none and tripped Next's error
        // boundary -- "This page couldn't load", with a Reload button that did it
        // all again.
        if (response.status === 503) {
          await signOut({ redirect: false });
          window.location.href = '/login?maintenance=1';
          return true;
        }
        if (response.status === 404) {
          // 404 means NO discoveries row exists for this company, and polling can
          // never fix that. The worker creates the discoveries row BEFORE it starts
          // scanning ("Created empty discovery ... progressive loading enabled"), so
          // an in-progress discovery returns 200 with discoveryInProgress: true.
          // A 404 therefore means a discovery was never started.
          //
          // This previously returned false to keep polling, so anyone reaching
          // /matrix before discovering watched "Scanning recall databases..." for
          // forty polls and then the page died. Stop, and say what to do.
          setError('No discovery yet. Start one from the Discover page to build your compliance matrix.');
          setInitialLoading(false);
          return true;
        } else {
          setError(result.error || 'Failed to load compliance data');
          setInitialLoading(false);
          return true;
        }
      } else {
        fetchFailCount.current = 0; // Reset on success
        setError(null); // Clear any transient error
        setData(result);
        hasDataRef.current = true;
        setInitialLoading(false);

        // Calculate stats from all requirements across discoveries
        const allRequirements = result.discoveries?.flatMap((d: Discovery) => d.requirements || []) || [];
        setStats(calculateStats(allRequirements));

        // Check if discovery is still in progress (from API response)
        // If discoveryInProgress is true, keep polling; otherwise stop
        const isComplete = result.discoveryInProgress === false;
        return isComplete;
      }
    } catch {
      fetchFailCount.current += 1;
      console.warn(`[Matrix] Fetch failed (attempt ${fetchFailCount.current}/5)`);

      // If we already have data, tolerate up to 5 consecutive failures silently
      // (covers Edge tab backgrounding, transient network blips, etc.)
      if (hasDataRef.current && fetchFailCount.current <= 5) {
        return false; // Keep polling — don't show error, don't stop
      }

      // If we have no data at all and this is the first load, show error after 3 tries
      if (!hasDataRef.current && fetchFailCount.current >= 3) {
        setError('Unable to connect. Please check your connection and refresh the page.');
        setInitialLoading(false);
        return true;
      }

      // No data yet but under 3 failures — keep trying
      if (!hasDataRef.current) {
        return false;
      }

      // Over 5 consecutive failures with existing data — show soft error but keep data visible
      setError('Connection lost. Your data is still shown below. Attempting to reconnect...');
      return false; // Keep polling to auto-recover
    }
  }, [tokenParam, calculateStats]);

  // Helper to update a single requirement in local state (optimistic update)
  const updateRequirementInState = useCallback((reqId: string, updates: Partial<Requirement>) => {
    setData(prevData => {
      if (!prevData) return prevData;

      const newDiscoveries = prevData.discoveries.map(discovery => ({
        ...discovery,
        requirements: discovery.requirements.map(req =>
          req.id === reqId ? { ...req, ...updates } : req
        ),
      }));

      const newData = { ...prevData, discoveries: newDiscoveries };

      // Recalculate stats if status changed (affects compliance metrics)
      if ('status' in updates) {
        const allRequirements = newDiscoveries.flatMap(d => d.requirements || []);
        // Use setTimeout to avoid setState inside setState
        setTimeout(() => setStats(calculateStats(allRequirements)), 0);
      }

      return newData;
    });
  }, [calculateStats]);

  // Close export menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  // Export handler: downloads compliance matrix as Excel or PDF
  const handleExport = useCallback(async (format: 'xlsx' | 'pdf') => {
    if (!data?.company?.id) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const params = new URLSearchParams({
        companyId: data.company.id,
        agency: activeTab,
        format,
      });
      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recall-tracker-${activeTab}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [data, activeTab]);

  // Handler for updating any requirement field (auth users only)
  // Uses optimistic local state updates - no full refetch needed
  const handleRequirementUpdate = useCallback(async (
    reqId: string,
    field: string,
    value: string | string[] | boolean | null
  ) => {
    if (!reqId) return;

    setSavingId(reqId);

    // Prepare the update value for local state
    let localUpdate: Partial<Requirement> = {};
    let body: Record<string, unknown>;

    if (field === 'triggers') {
      body = { triggers: value };
      localUpdate = { triggers: value as string[] };
    } else if (field === 'calendarTracking') {
      const boolValue = value === 'true' || value === true;
      body = { calendarTracking: boolValue };
      localUpdate = { calendarTracking: boolValue };
    } else if (field === 'dueDate') {
      const dateValue = value === '' ? null : value as string;
      body = { dueDate: dateValue };
      localUpdate = { dueDate: dateValue };
    } else if (field === 'frequency') {
      const freqValue = value === '' ? null : value as Requirement['frequency'];
      body = { frequency: freqValue };
      localUpdate = { frequency: freqValue };
    } else {
      body = { [field]: value };
      localUpdate = { [field]: value } as Partial<Requirement>;
    }

    // Optimistic update: update local state immediately
    updateRequirementInState(reqId, localUpdate);

    try {
      const response = await fetch(`/api/requirements/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Update failed:', error);
        // On error, refetch to restore correct state
        await fetchData();
        return;
      }
      // Success - local state already updated, no refetch needed
    } catch (error) {
      console.error('Network error:', error);
      // On error, refetch to restore correct state
      await fetchData();
    } finally {
      setSavingId(null);
    }
  }, [fetchData, updateRequirementInState]);

  // Step 6: Handler for adding new requirement
  const handleAddRequirement = async () => {
    if (!data?.company?.id || !addFormData.citation || !addFormData.title) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: data.company.id,
          citation: addFormData.citation,
          title: addFormData.title,
          agency: activeTab,
          description: addFormData.description,
          priority: addFormData.priority,
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        setAddFormData({ citation: '', title: '', description: '', priority: 'medium' });
        await fetchData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 6: Handler for deleting requirement
  const handleDeleteRequirement = async (reqId: string) => {
    try {
      const response = await fetch(`/api/requirements/${reqId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDeleteConfirmId(null);
        await fetchData();
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // Drag-to-reorder handler
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;

    // Find the current discovery and reorder its requirements
    const discoveryIndex = data.discoveries.findIndex(d => d.agency === activeTab);
    if (discoveryIndex === -1) return;

    const reqs = [...data.discoveries[discoveryIndex].requirements];
    // Work with filtered list if a filter is active
    const workingList = statusFilter === 'all' ? reqs : reqs.filter(r => (r.status || 'pending') === statusFilter);

    const oldIndex = workingList.findIndex(r => (r.id || `${activeTab}-${workingList.indexOf(r)}`) === active.id);
    const newIndex = workingList.findIndex(r => (r.id || `${activeTab}-${workingList.indexOf(r)}`) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(workingList, oldIndex, newIndex);

    // If filtering, merge reordered items back into the full list
    let fullReordered: Requirement[];
    if (statusFilter === 'all') {
      fullReordered = reordered;
    } else {
      fullReordered = [...reqs];
      const filteredIds = new Set(workingList.map(r => r.id));
      let filteredIdx = 0;
      for (let i = 0; i < fullReordered.length; i++) {
        if (filteredIds.has(fullReordered[i].id)) {
          fullReordered[i] = reordered[filteredIdx++];
        }
      }
    }

    // Optimistic update
    const newData = { ...data };
    newData.discoveries = [...data.discoveries];
    newData.discoveries[discoveryIndex] = {
      ...data.discoveries[discoveryIndex],
      requirements: fullReordered,
    };
    setData(newData);

    // Build sort order updates and send to API
    const reorderPayload = fullReordered
      .filter(r => r.id)
      .map((r, idx) => ({ id: r.id, sortOrder: idx }));

    try {
      const response = await fetch('/api/requirements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: reorderPayload }),
      });

      if (!response.ok) {
        console.error('Reorder failed, refreshing...');
        await fetchData();
      }
    } catch (error) {
      console.error('Reorder network error:', error);
      await fetchData();
    }
  }, [data, activeTab, statusFilter, fetchData]);

  // Inline editing helpers
  const startEditing = (reqId: string, field: string, currentValue: string) => {
    setEditingField({ reqId, field });
    setEditValue(currentValue || '');
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEditing = async () => {
    if (!editingField) return;
    const trimmed = editValue.trim();
    await handleRequirementUpdate(editingField.reqId, editingField.field, trimmed);
    setEditingField(null);
    setEditValue('');
  };

  const handleAddTrigger = async (reqId: string, currentTriggers: string[]) => {
    const trimmed = newTrigger.trim();
    if (!trimmed) return;
    await handleRequirementUpdate(reqId, 'triggers', [...currentTriggers, trimmed]);
    setNewTrigger('');
  };

  const handleRemoveTrigger = async (reqId: string, currentTriggers: string[], index: number) => {
    const updated = currentTriggers.filter((_, i) => i !== index);
    await handleRequirementUpdate(reqId, 'triggers', updated);
  };

  useEffect(() => {
    if (!tokenParam && status === 'loading') return;

    if (!tokenParam && status === 'unauthenticated') {
      setInitialLoading(false);
      return;
    }

    const startPolling = async () => {
      const done = await fetchData();
      if (!done) {
        setPolling(true);
        setPollCount(0);
      }
    };

    startPolling();

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (revealRef.current) clearTimeout(revealRef.current);
    };
  }, [status, tokenParam, fetchData]);

  // Polling effect
  useEffect(() => {
    if (!polling) return;

    const poll = async () => {
      setPollCount(prev => prev + 1);
      const done = await fetchData();

      if (!done && pollCount < 40) {
        pollingRef.current = setTimeout(poll, 15000);
      } else if (!done) {
        setError('Discovery is taking longer than expected. Please refresh the page in a few minutes.');
        setPolling(false);
      }
    };

    pollingRef.current = setTimeout(poll, 15000);

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [polling, pollCount, fetchData]);

  // Reveal animation - show requirements one by one when data arrives
  // Note: 'data' is needed to trigger when data first loads, but the effect only
  // increments visibleCount (never resets), so data changes won't cause re-animation
  useEffect(() => {
    if (!data) return;

    const requirements = data.discoveries.find(d => d.agency === activeTab)?.requirements || [];
    const totalReqs = requirements.length;

    // Start revealing (only increments, never resets)
    if (visibleCount < totalReqs) {
      revealRef.current = setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + 1, totalReqs));
      }, 200); // 200ms between each reveal
    } else if (!data.discoveryInProgress) {
      // Discovery is complete - stop polling
      setPolling(false);
    }

    return () => {
      if (revealRef.current) clearTimeout(revealRef.current);
    };
  }, [data, activeTab, visibleCount]);

  // Reset visible count and filter when tab changes (not on data updates)
  useEffect(() => {
    // Only reset when tab ACTUALLY changes, not on every data update
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      if (data) {
        setVisibleCount(0);
        setStatusFilter('all'); // Reset filter when changing tabs
      }
    }
  }, [activeTab, data]);

  // When filter changes, show all filtered results immediately (no animation)
  // Note: 'data' is intentionally omitted from deps - we read it but don't react to changes
  useEffect(() => {
    if (data && statusFilter !== 'all') {
      const reqs = data.discoveries.find(d => d.agency === activeTab)?.requirements || [];
      // Show all filtered results immediately when a specific filter is selected
      const filtered = reqs.filter(r => (r.status || 'pending') === statusFilter);
      setVisibleCount(filtered.length);
    }
  }, [statusFilter, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
      },
      CPSC: {
        active: 'bg-gradient-to-br from-amber-600 to-orange-600 text-white border-orange-500 shadow-orange-500/25',
        inactive: 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-orange-500/50 hover:bg-slate-800',
      },
    };
    return isActive ? styles[agency as keyof typeof styles].active : styles[agency as keyof typeof styles].inactive;
  };

  // getConfidenceStyle is needed for the activity feed in the right column
  const getConfidenceStyle = (confidence: number) => {
    if (confidence >= 80) return 'text-emerald-400';
    if (confidence >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };

  // Memoize requirements derivation to prevent recalculation on every render
  const requirements = useMemo(() => {
    if (!data) return [];
    const discovery = data.discoveries.find(d => d.agency === activeTab);
    return discovery?.requirements || [];
  }, [data, activeTab]);

  const userIdentifier = session?.user?.email || tokenParam;

  // Unauthenticated State
  if (!tokenParam && status === 'unauthenticated' && !initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
            <p className="text-slate-400 mb-6">Please sign in or run a discovery first.</p>
            <div className="flex flex-col gap-3">
              <Link href="/login" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-cyan-500 transition-all">
                Sign In
              </Link>
              <Link href="/discover" className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 border border-slate-700">
                Run Discovery
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error && error !== 'no-discoveries') {
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
            <Link href="/discover" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium">
              Run Discovery
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Memoize filtered requirements to prevent recalculation during animations
  const filteredRequirements = useMemo(() => {
    if (statusFilter === 'all') return requirements;
    return requirements.filter(r => (r.status || 'pending') === statusFilter);
  }, [requirements, statusFilter]);

  // Memoize visible requirements slice
  const visibleRequirements = useMemo(() => {
    return filteredRequirements.slice(0, visibleCount);
  }, [filteredRequirements, visibleCount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className={`border-b border-slate-800/50 ${headerTheme.headerBg} backdrop-blur-xl sticky top-0 z-40`}>
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${headerTheme.iconGradient} flex items-center justify-center shadow-lg ${headerTheme.shadow}`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  {data?.company.name || 'Loading...'}
                </h1>
                <p className="text-sm text-slate-400">Compliance Matrix</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {data && (
                <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${headerTheme.dotColor}`}></span>
                    NAICS {data.company.naicsCode}
                  </span>
                  <span>{data.company.employeeCount} employees</span>
                  <span>{data.company.state}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {/* Calendar link */}
                {fm.isEnabled('recall.calendarView', false) && (
                  <Link
                    href={`/matrix/calendar${tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : ''}`}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 border border-slate-700 transition-colors"
                    title="Compliance Calendar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">Calendar</span>
                  </Link>
                )}
                {/* Show Register for anonymous users, New Discovery for authenticated */}
                {!session && tokenParam ? (
                  <Link href={`/register?token=${encodeURIComponent(tokenParam)}`} className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${headerTheme.ctaGradient} text-white rounded-lg text-sm font-medium ${headerTheme.ctaHover} transition-all shadow-lg ${headerTheme.ctaShadow}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Create Account
                  </Link>
                ) : (
                  <Link href="/discover" className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 border border-slate-700">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Find More Recalls
                  </Link>
                )}
                {session && (
                  <div className="relative group">
                    <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 border border-slate-700">
                      <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${headerTheme.avatarGradient} flex items-center justify-center text-xs text-white font-medium`}>
                        {session.user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <div className="p-3 border-b border-slate-700">
                        <p className="text-sm text-white font-medium truncate">{session.user?.email}</p>
                      </div>
                      <button onClick={() => signOut({ callbackUrl: '/' })} className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50">
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Registration Banner for Anonymous Users - shows as soon as data loads */}
      {isAnonymous && data && (
        <div className="bg-gradient-to-r from-blue-600/10 via-cyan-600/10 to-blue-600/10 border-b border-blue-500/20">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="text-sm min-w-0">
                  <span className="text-white font-medium">Create a free account</span>
                  <span className="text-slate-400"> to unlock: </span>
                  <span className="hidden lg:inline text-slate-300">
                    Notes & due dates
                    <span className="text-slate-600 mx-1.5">&bull;</span>
                    Calendar tracking
                    <span className="text-slate-600 mx-1.5">&bull;</span>
                    Edit status & priority
                    <span className="text-slate-600 mx-1.5">&bull;</span>
                    Add/remove requirements
                    <span className="text-slate-600 mx-1.5">&bull;</span>
                    Export to Excel & PDF
                  </span>
                  <span className="lg:hidden text-slate-300">editing, calendar tracking, notes, export & more</span>
                </div>
              </div>
              <Link
                href={`/register?token=${encodeURIComponent(tokenParam || '')}`}
                className="flex-shrink-0 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-medium rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/25"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        {/* Agency Pills - Compact horizontal tabs */}
        <div className="flex items-center gap-2 mb-6">
          {(['FDA', 'CPSC'] as const).map((agency) => {
            const discovery = data?.discoveries.find(d => d.agency === agency);
            const count = discovery?.requirements?.length || 0;
            const isActive = activeTab === agency;
            return (
              <button
                key={agency}
                onClick={() => setActiveTab(agency)}
                className={`px-4 py-2 rounded-full border transition-all duration-200 flex items-center gap-2 ${
                  isActive
                    ? agency === 'FDA' ? headerTheme.fdaTab
                    : headerTheme.cpscTab
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span className="font-semibold">{data ? count : '--'}</span>
                <span className="text-sm">{agency}</span>
              </button>
            );
          })}

          {/* Discovery status indicator */}
          {data && requirements.length >= 20 && (
            <div className="ml-auto flex items-center gap-2 text-emerald-400 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Scan Complete
            </div>
          )}
        </div>

        {/* Step 6: Filter Buttons (auth users only) */}
        {canEdit && data && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {['all', 'pending', 'in_progress', 'compliant', 'non_compliant', 'n_a'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${statusFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'}`}
              >
                {filter === 'all' ? 'All' :
                 filter === 'n_a' ? 'N/A' :
                 filter.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </button>
            ))}
          </div>
        )}

        {/* Determine if we should show the right column */}
        {(() => {
          // The wrapper below is `hidden lg:block` only while collapsed. It used to be
          // unconditional, so below 1024px the chat panel was display:none: clicking the
          // launcher set chatExpanded, the launcher unmounted because it renders only
          // while collapsed, and nothing replaced it — the button appeared to vanish.
          const showRightColumn = polling || (data?.discoveryInProgress) || chatExpanded;
          const isDiscoveryComplete = data && !data.discoveryInProgress;

          return (
            <>
              <div className="flex gap-6">
                {/* Main Column - Compliance Matrix - Full width when right column hidden */}
                <div className={`flex-1 min-w-0 ${!showRightColumn ? '' : ''}`}>

            {/* Stats Bar - shows recall response overview */}
            {stats && data && (
              <div className="flex items-center gap-6 px-4 py-3 bg-slate-800/50 rounded-xl mb-4 border border-slate-700/50">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{stats.total}</div>
                  <div className="text-xs text-slate-400">Total</div>
                </div>
                <div className="h-8 w-px bg-slate-700"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">{stats.complianceRate}%</div>
                  <div className="text-xs text-slate-400">Compliant</div>
                </div>
                <div className="h-8 w-px bg-slate-700"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                  <div className="text-xs text-slate-400">Pending</div>
                </div>
                <div className="h-8 w-px bg-slate-700"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{stats.nonCompliant}</div>
                  <div className="text-xs text-slate-400">Non-Compliant</div>
                </div>
                {stats.inProgress > 0 && (
                  <>
                    <div className="h-8 w-px bg-slate-700"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">{stats.inProgress}</div>
                      <div className="text-xs text-slate-400">In Progress</div>
                    </div>
                  </>
                )}
                {stats.notApplicable > 0 && (
                  <>
                    <div className="h-8 w-px bg-slate-700"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-400">{stats.notApplicable}</div>
                      <div className="text-xs text-slate-400">N/A</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Requirements List */}
            <div className="bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-800/50 overflow-hidden">
              <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {activeTab} Requirements
                  <span className="ml-2 text-slate-500 font-normal">
                    ({data ? (
                      statusFilter === 'all'
                        ? `${visibleCount}/${requirements.length}`
                        : `${filteredRequirements.length} ${statusFilter === 'n_a' ? 'N/A' : statusFilter.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
                    ) : '...'})
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  {/* Step 6: Add Requirement Button (auth only) */}
                  {canEdit && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  )}
                  <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  {canEdit && (
                    <div className="relative" ref={exportMenuRef}>
                      <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        disabled={exporting}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        title="Export matrix"
                      >
                        {exporting ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                      </button>
                      {showExportMenu && (
                        <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                          {fm.isEnabled('recall.exportPdf', false) && (
                            <button
                              onClick={() => handleExport('pdf')}
                              className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              Export PDF
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Skeleton loading state */}
              {!data && (
                <div className="divide-y divide-slate-800/50">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 animate-pulse">
                      <div className="flex items-start gap-4">
                        <div className="w-12">
                          <div className="h-6 bg-slate-800 rounded mb-1"></div>
                          <div className="h-1 bg-slate-800 rounded"></div>
                        </div>
                        <div className="flex-1">
                          <div className="h-4 bg-slate-800 rounded w-32 mb-2"></div>
                          <div className="h-5 bg-slate-800 rounded w-3/4 mb-2"></div>
                          <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {data && requirements.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 mb-2">No {activeTab} requirements discovered yet</p>
                </div>
              )}

              {/* Requirements - Use DraggableRequirementsList for auth users (supports drag), plain list for anonymous */}
              {data && visibleRequirements.length > 0 && (
                canEdit ? (
                  <DraggableRequirementsList
                    requirements={visibleRequirements}
                    activeTab={activeTab}
                    visibleCount={visibleCount}
                    totalCount={requirements.length}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setIsDragging(false)}
                    renderRequirement={(req, index, isNew) => {
                      const reqId = req.id || `${activeTab}-${index}`;
                      const isExpanded = expandedReqs.has(reqId);
                      return (
                        <RequirementCard
                          req={req}
                          reqId={reqId}
                          isExpanded={isExpanded}
                          isNew={isNew}
                          canEdit={canEdit}
                          savingId={savingId}
                          activeTab={activeTab}
                          editingField={editingField}
                          editValue={editValue}
                          newTrigger={newTrigger}
                          deleteConfirmId={deleteConfirmId}
                          onUpdate={handleRequirementUpdate}
                          onToggleExpand={toggleExpand}
                          onStartEditing={startEditing}
                          onCancelEditing={cancelEditing}
                          onSaveEditing={saveEditing}
                          onSetEditValue={setEditValue}
                          onSetNewTrigger={setNewTrigger}
                          onAddTrigger={handleAddTrigger}
                          onRemoveTrigger={handleRemoveTrigger}
                          onSetDeleteConfirmId={setDeleteConfirmId}
                          onDeleteRequirement={handleDeleteRequirement}
                          tokenParam={tokenParam}
                        />
                      );
                    }}
                  />
                ) : (
                  // Anonymous users get plain list (no @dnd-kit loaded - saves ~50-60KB)
                  <div className="divide-y divide-slate-800/50">
                    {visibleRequirements.map((req, index) => {
                      const reqId = req.id || `${activeTab}-${index}`;
                      const isExpanded = expandedReqs.has(reqId);
                      const isNew = index === visibleCount - 1 && visibleCount < requirements.length;
                      return (
                        <div key={reqId}>
                          <RequirementCard
                            req={req}
                            reqId={reqId}
                            isExpanded={isExpanded}
                            isNew={isNew}
                            canEdit={canEdit}
                            savingId={savingId}
                            activeTab={activeTab}
                            editingField={editingField}
                            editValue={editValue}
                            newTrigger={newTrigger}
                            deleteConfirmId={deleteConfirmId}
                            onUpdate={handleRequirementUpdate}
                            onToggleExpand={toggleExpand}
                            onStartEditing={startEditing}
                            onCancelEditing={cancelEditing}
                            onSaveEditing={saveEditing}
                            onSetEditValue={setEditValue}
                            onSetNewTrigger={setNewTrigger}
                            onAddTrigger={handleAddTrigger}
                            onRemoveTrigger={handleRemoveTrigger}
                            onSetDeleteConfirmId={setDeleteConfirmId}
                            onDeleteRequirement={handleDeleteRequirement}
                            tokenParam={tokenParam}
                          />
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right Column - Discovery Progress / Chat - Only show during discovery or when chat expanded */}
          {showRightColumn && (
            <div className={`flex-shrink-0 transition-all duration-300 ${chatExpanded ? 'block w-full lg:w-[480px]' : 'hidden lg:block w-80'}`}>
              <div className="bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-800/50 sticky top-24 flex flex-col overflow-hidden max-h-[calc(100vh-7rem)]">

                {/* Discovery Progress Panel - shown during active discovery */}
                {(polling || data?.discoveryInProgress) && (
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl blur opacity-30 animate-pulse"></div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Scanning for Recalls</h3>
                      <p className="text-xs text-slate-400">Searching FDA and CPSC databases</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-300">
                        {data ? `Found ${visibleCount} recall${visibleCount !== 1 ? 's' : ''}` : 'Scanning recall databases...'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {elapsedSeconds > 0 && `${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500"
                        style={{ width: data ? `${Math.min(100, (visibleCount / Math.max(visibleCount, 20)) * 100)}%` : `${Math.max(5, (pollCount / 20) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Activity feed */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Recent Activity</p>
                    {visibleRequirements.slice(-5).reverse().map((req, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg animate-slide-in">
                        <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-300 truncate">{req.citation}</p>
                          <p className="text-xs text-slate-500 truncate">{req.name || req.title}</p>
                        </div>
                        <span className={`text-xs font-medium ${getConfidenceStyle(req.confidence)}`}>{req.confidence}%</span>
                      </div>
                    ))}
                    {visibleRequirements.length === 0 && (
                      <div className="flex items-center gap-2 p-2 text-slate-500">
                        <div className="w-4 h-4 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="text-xs">Scanning recalls...</span>
                      </div>
                    )}
                  </div>

                  {/* Status steps */}
                  <div className="mt-4 pt-4 border-t border-slate-800/50">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Profile', done: pollCount >= 1 },
                        { label: 'Scan', done: pollCount >= 2 },
                        { label: 'Analyze', done: data && visibleCount > 0 },
                        { label: 'Complete', done: data && !data.discoveryInProgress },
                      ].map((step, i) => (
                        <div key={i} className="text-center">
                          <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center ${step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
                            {step.done ? (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <span className="text-xs">{i + 1}</span>
                            )}
                          </div>
                          <span className={`text-xs ${step.done ? 'text-slate-300' : 'text-slate-600'}`}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}


              {/* Expanded Chat Panel - shown when chat is expanded */}
              {chatExpanded && (
                <>
                  <div className="p-4 border-b border-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">Compliance Agent</h3>
                          <p className="text-xs text-slate-400">Powered by Claude Opus</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setChatExpanded(false)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                    {/* Initial greeting when no messages */}
                    {chatMessages.length === 0 && !chatLoading && (
                      <>
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          </div>
                          <div className="bg-slate-800/50 rounded-2xl rounded-tl-none p-4">
                            <p className="text-sm text-slate-300">
                              Hi! I can help you understand product recalls and plan your response. I have access to your tracked recalls, uploaded documents, and live FDA/CPSC data.
                            </p>
                          </div>
                        </div>

                        {isAuthenticated && (
                          <div className="flex flex-wrap gap-2">
                            {['Summarize my recalls', 'What actions should I take?', 'Response deadlines?', 'Supply chain impact?'].map((s) => (
                              <button
                                key={s}
                                onClick={() => sendChatMessage(s)}
                                className="px-3 py-1.5 bg-slate-800/50 text-slate-400 text-xs rounded-full border border-slate-700 hover:border-blue-500/50 hover:text-blue-400 transition-colors"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Chat messages */}
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex gap-3 min-w-0 ${msg.role === 'USER' ? 'justify-end' : ''}`}>
                        {msg.role === 'ASSISTANT' && (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          </div>
                        )}
                        <div className={`rounded-2xl p-3 ${
                          msg.role === 'USER'
                            ? 'bg-blue-600/30 border border-blue-500/30 rounded-tr-none max-w-[85%]'
                            : 'bg-slate-800/50 rounded-tl-none min-w-0 max-w-full'
                        }`}>
                          {msg.role === 'ASSISTANT' ? (
                            <div className="text-sm text-slate-200 prose prose-invert prose-sm max-w-none overflow-x-auto prose-headings:text-slate-100 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:text-xs prose-table:block prose-table:overflow-x-auto prose-th:px-2 prose-th:py-1 prose-th:bg-slate-700/50 prose-th:whitespace-nowrap prose-td:px-2 prose-td:py-1 prose-td:border-slate-700 prose-strong:text-slate-100 prose-blockquote:border-violet-500/50 prose-blockquote:text-slate-400 prose-code:text-violet-300 prose-a:text-blue-400">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                          {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {msg.toolsUsed.map((tool) => (
                                <span key={tool} className="text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded-full">
                                  {tool.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Loading indicator */}
                    {chatLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <div className="bg-slate-800/50 rounded-2xl rounded-tl-none p-4">
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error message */}
                    {chatError && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-red-400 flex-1">{chatError}</p>
                        <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-300">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-800/50">
                    {isAuthenticated ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendChatMessage(chatMessage);
                            }
                          }}
                          placeholder="Ask about recalls..."
                          disabled={chatLoading}
                          className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                        />
                        <button
                          onClick={() => sendChatMessage(chatMessage)}
                          disabled={chatLoading || !chatMessage.trim()}
                          className="p-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-xs text-slate-500">
                          <a href="/register" className="text-blue-400 hover:text-blue-300">Create an account</a> to chat with the Recall Advisor
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Chat Button - shown when discovery complete and chat collapsed */}
        {isDiscoveryComplete && !chatExpanded && fm.isEnabled('recall.recallAdvisor', false) && (
          <button
            onClick={() => setChatExpanded(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-violet-600 to-purple-600 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center hover:scale-110 hover:shadow-purple-500/50 transition-all z-50 group"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {/* Tooltip */}
            <div className="absolute right-full mr-3 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Ask Recall Advisor
            </div>
          </button>
        )}
            </>
          );
        })()}
      </div>

      {/* Step 6: Add Requirement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Add Recall to Tracker</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Recall Number *</label>
                <input
                  type="text"
                  value={addFormData.citation}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, citation: e.target.value }))}
                  placeholder="e.g., FDA D-0123-2024"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Product / Recall Title *</label>
                <input
                  type="text"
                  value={addFormData.title}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Frozen Vegetables - Listeria Contamination"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={addFormData.description}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Priority</label>
                <select
                  value={addFormData.priority}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRequirement}
                disabled={isSubmitting || !addFormData.citation || !addFormData.title}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add Recall'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  );
}

export default function MatrixPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MatrixContent />
    </Suspense>
  );
}
