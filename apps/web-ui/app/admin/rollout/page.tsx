'use client';

// Live progressive rollout, measured rather than simulated.
//
// demo/progressive-rollout.html in the SE guide is the conceptual explainer: 200
// invented users and a local slider, entirely offline. This page is the proof.
// Every cell is one real evaluation of a real flag through the server SDK against
// the configuration Feature Management currently holds. Move the percentage in
// Unify and the grid follows about two seconds later, over SSE.
//
// It measures because it cannot read: the rollout percentage is not exposed by
// the flag API, the CasC repo or the SDK config endpoint. Saying "this is two
// hundred live evaluations, not a number read back from a settings page" is a
// stronger claim than the one we originally wanted to make.
//
// CELLS ARE EVALUATIONS, NOT USERS — and the labels say so. A percentage rollout
// on the server SDK splits per evaluation, because the bucket hashes a device
// property that means nothing in a process serving everybody. Calling these users
// would be the one claim this page cannot support.

import { useCallback, useEffect, useRef, useState } from 'react';

const BLUE = '#0069FF';   // CloudBees Blue — evaluation received the feature
const GREY = '#CCCCCC';   // Black 40 — did not
const INK = '#1A1A1A';
const BODY = '#666666';
const LINE = '#E6E6E6';
const RED = '#E5484D';   // functional status colour; none exists in the palette

const FLAGS = [
  'recall.exportPdf',
  'recall.calendarView',
  'recall.recallAdvisor',
  'recall.dashboardRedesign',
];

const COLUMNS = 40;

interface Segment { name: string; total: number; enabled: number }

interface Probe {
  flag: string;
  samples: number;
  enabled: number;
  pattern: boolean[];
  segments: Segment[];
  sticky: 'yes' | 'no' | 'indeterminate';
  mismatches: number;
  fmReady: boolean;
  at: number;
}

export default function RolloutPage() {
  const [flag, setFlag] = useState(FLAGS[0]);
  const [data, setData] = useState<Probe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<number[]>([]);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;

    const tick = async () => {
      const password = localStorage.getItem('adminPassword');
      if (!password) return;
      try {
        const res = await fetch(
          `/api/admin/rollout-probe?flag=${encodeURIComponent(flag)}`,
          { headers: { 'x-admin-password': password }, cache: 'no-store' }
        );
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `Probe failed (${res.status})`);
          return;
        }
        setError(null);
        const next: Probe = await res.json();
        setData(next);
        history.current.push(next.enabled / next.samples);
        if (history.current.length > 80) history.current.shift();
      } catch {
        if (!cancelled) setError('Could not reach the probe endpoint');
      }
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [flag, paused]);

  // Reset the trend when the flag changes — carrying one flag's history into
  // another's chart would be quietly wrong.
  useEffect(() => { history.current = []; }, [flag]);

  const draw = useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const W = el.width, H = el.height;
    ctx.clearRect(0, 0, W, H);

    const bars = history.current;
    const bw = W / 80;
    bars.forEach((share, i) => {
      const h = share * H;
      ctx.fillStyle = GREY;
      ctx.fillRect(i * bw, 0, bw - 3, H - h);
      ctx.fillStyle = BLUE;
      ctx.fillRect(i * bw, H - h, bw - 3, h);
    });
  }, []);

  useEffect(() => { draw(); }, [data, draw]);

  const pct = data ? Math.round((data.enabled / data.samples) * 100) : 0;

  return (
    <div style={{
      ['--t' as string]: '40px',
      minHeight: '100%', background: '#fff', color: INK,
      font: 'var(--t)/1.15 "Unica 77", Arial, Helvetica, sans-serif',
      padding: '32px 40px 40px', display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontSize: 'var(--t)', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          Progressive rollout
        </h1>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
          <span style={{ color: BODY }}>Measured:</span>
          <span style={{
            fontSize: 'calc(var(--t) * 1.7)', fontWeight: 700, lineHeight: 1,
            letterSpacing: '-0.03em', color: BLUE, fontVariantNumeric: 'tabular-nums',
          }}>
            {pct}%
          </span>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <select
          value={flag}
          onChange={e => setFlag(e.target.value)}
          style={{
            font: 'inherit', fontSize: 'var(--t)', padding: '0.12em 0.34em',
            color: INK, background: '#fff', border: `2px solid ${LINE}`,
            borderRadius: '0.14em',
          }}
        >
          {FLAGS.map(f => <option key={f} value={f}>{f.replace('recall.', '')}</option>)}
        </select>

        <button
          onClick={() => setPaused(p => !p)}
          style={{
            font: 'inherit', fontSize: 'var(--t)', padding: '0.12em 0.34em',
            cursor: 'pointer', color: paused ? '#fff' : INK,
            background: paused ? BLUE : '#fff',
            border: `2px solid ${paused ? BLUE : LINE}`, borderRadius: '0.14em',
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>

        {data && (
          <span style={{ marginLeft: 'auto', color: BODY, fontVariantNumeric: 'tabular-nums' }}>
            {data.enabled} of {data.samples}
          </span>
        )}
      </div>

      {error && <p style={{ color: RED, margin: 0 }}>{error}</p>}


      {data && !data.fmReady && (
        <p style={{ color: '#E5484D', margin: 0 }}>
          FM_KEY not set — every flag reads its code default, so this grid is not a rollout
        </p>
      )}

      {data?.sticky === 'no' ? (
        // Refusing to draw is the point. With the default stickiness the grid is
        // technically accurate and completely misleading: it reshuffles every
        // poll, so it shows a rollout reaching different users each time rather
        // than the same users keeping the feature. Better to say so than to let
        // someone present it.
        <div style={{
          border: `2px solid ${RED}`, borderRadius: '0.14em',
          padding: '0.5em 0.6em', display: 'flex', flexDirection: 'column', gap: '0.4em',
        }}>
          <strong style={{ color: RED }}>Stickiness property is not set to userId</strong>
          <span style={{ fontSize: 'calc(var(--t) * 0.55)', color: BODY }}>
            {data.mismatches} of {data.samples} sample users got two different answers to the
            same question, so this rollout is bucketing per evaluation rather than per user.
            The grid would reshuffle every two seconds, which is not what a progressive
            rollout does.
          </span>
          <span style={{ fontSize: 'calc(var(--t) * 0.55)', color: INK }}>
            Feature management → click <strong>{data.flag}</strong> → the
            <strong> ⋮ </strong> top right → Flag settings → set Stickiness property to
            <strong> userId</strong> → Save configuration.
          </span>
          <span style={{ fontSize: 'calc(var(--t) * 0.5)', color: BODY }}>
            Set per flag, and it applies across every environment.
          </span>
        </div>
      ) : (
        <>
      {/* One band per company size. A percentage rollout fills all three at
          roughly the same rate; a target group on companySize fills exactly one,
          which is the difference the overall number alone would hide. */}
      {(data?.segments ?? []).map(seg => {
        const start = (data?.segments ?? [])
          .slice(0, (data?.segments ?? []).indexOf(seg))
          .reduce((n, s2) => n + s2.total, 0);
        const cells = (data?.pattern ?? []).slice(start, start + seg.total);
        const share = seg.total ? Math.round((seg.enabled / seg.total) * 100) : 0;
        return (
          <div key={seg.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{
              display: 'flex', alignItems: 'center', gap: '0.4em', color: BODY,
              margin: 0, fontSize: 'calc(var(--t) * 0.6)',
            }}>
              <span style={{
                display: 'inline-block', width: '0.62em', height: '0.62em',
                borderRadius: '0.12em', background: share ? BLUE : GREY, flex: 'none',
              }} />
              {seg.name}
              <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                {seg.enabled} of {seg.total} · {share}%
              </span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`, gap: 4 }}>
              {cells.map((on, i) => (
                <span key={i} style={{
                  display: 'block', aspectRatio: '1', borderRadius: 3,
                  background: on ? BLUE : GREY, transition: 'background .45s ease',
                }} />
              ))}
            </div>
          </div>
        );
      })}

      <p style={{ display: 'flex', alignItems: 'center', gap: '0.4em', color: BODY, margin: 0 }}>
        <span style={{
          display: 'inline-block', width: '0.62em', height: '0.62em',
          borderRadius: '0.12em', background: GREY, flex: 'none',
        }} />
        Share over time, sampled every two seconds
      </p>
        </>
      )}

      <canvas ref={canvas} width={2000} height={400}
              style={{ width: '100%', height: 200, display: 'block' }} />

      <p style={{ fontSize: 'calc(var(--t) * 0.45)', color: BODY, margin: 0, maxWidth: '70ch' }}>
        Each cell is one sample user, evaluated against <strong>{flag}</strong> through the
        server SDK — measured, not read from configuration. The set is fixed, so raising the
        percentage adds users rather than reshuffling them. Requires the flag's rollout
        stickiness property to be <strong>userId</strong>; left at the default the grid still
        works but changes on every poll.
      </p>
    </div>
  );
}
