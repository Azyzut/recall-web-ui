'use client';

// Facilitator-facing failure-rate panel. Not part of the attendee workshop.
//
// The point of this screen is a single claim, made without asking anyone to take
// it on trust: a flag was changed at a particular second, and requests started
// failing at that same second. Both numbers come from the server — the chart is
// drawn from counts recorded in core-api, and the timestamps are core-api's clock,
// not the browser's. The UTC value is displayed because Feature Management's audit
// history is what you compare it against.
//
// The load generator sends real HTTP requests from this browser to a real endpoint.
// Nothing is simulated. That matters when a customer asks.
//
// STYLING: deliberately matched to demo/progressive-rollout.html in the SE guide,
// so the two screens read as one set when shown back to back — white ground,
// CloudBees Blue, Black 40 bars, swatch-labelled sections, one type scale, and a
// slider handle big enough to hit while presenting.
//
// Colour: Blue #0069FF is CloudBees Blue and Black 40 #CCCCCC is the grey scale.
// The red is a functional status colour only — there is no red in the CloudBees
// palette — so it is defined once here and easy to change if brand review objects.
// It stays red because the entire job of this panel is to make failure read as
// failure from across a room.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const BLUE = '#0069FF'; // CloudBees Blue — served
const RED = '#E5484D'; // functional status colour — failed
const GREY = '#CCCCCC'; // Black 40
const INK = '#1A1A1A'; // Black 100
const BODY = '#666666'; // Black 70
const LINE = '#E6E6E6'; // Black 30

const TARGETS = [
  { label: '/api/auth/redirect', url: '/api/auth/redirect' },
  { label: '/api/compliance/me', url: '/api/compliance/me' },
] as const;

interface Bucket { t: number; ok: number; err: number }
interface Failure { ts: number; route: string; status: number; flag?: string }
interface ConfigChange { ts: number; status: string }

interface Metrics {
  now: number;
  bucketMs: number;
  buckets: Bucket[];
  recent: Failure[];
  firstErrorAt: number | null;
  totalOk: number;
  totalErr: number;
  fmReady: boolean;
  flags: Record<string, boolean>;
  configChanges: ConfigChange[];
}

function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

function utc(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

/** Section label with a colour swatch, exactly as the rollout page does it. */
function Sub({ color, children, right }: {
  color: string; children: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <p style={{
      display: 'flex', alignItems: 'center', gap: '0.4em',
      color: BODY, margin: 0, fontSize: 'var(--t)', lineHeight: 1.15,
    }}>
      <span style={{
        display: 'inline-block', width: '0.62em', height: '0.62em',
        borderRadius: '0.12em', background: color, flex: 'none',
      }} />
      {children}
      {right && <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{right}</span>}
    </p>
  );
}

export default function MetricsPage() {
  const [password, setPassword] = useState('');   // set by the layout's gate
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState(4);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [target, setTarget] = useState<string>(TARGETS[0].url);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('adminPassword');
    if (stored) setPassword(stored);
  }, []);

  // Poll the server for counts. This endpoint is not itself instrumented, so
  // watching the page does not inflate the numbers it displays.
  useEffect(() => {
    if (!password) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/admin/metrics', {
          headers: { 'x-admin-password': password },
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `Metrics request failed (${res.status})`);
          if (res.status === 401) localStorage.removeItem('adminPassword');
          return;
        }
        setError(null);
        setData(await res.json());
      } catch {
        if (!cancelled) setError('Could not reach the metrics endpoint');
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [password]);

  // The load generator. The server does the counting, so the response is only
  // read for its status — and that is worth showing. Both target endpoints need a
  // signed-in session, and a 401 is recorded as a success because it is not a
  // server failure. Without this readout an expired session would draw a healthy
  // blue line while nothing was really being exercised.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      for (let i = 0; i < rate; i++) {
        fetch(target, { cache: 'no-store' })
          .then(r => setLastStatus(r.status))
          .catch(() => setLastStatus(null));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, rate, target]);

  const draw = useCallback(() => {
    const el = canvas.current;
    if (!el || !data) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const W = el.width, H = el.height;
    ctx.clearRect(0, 0, W, H);

    const buckets = data.buckets.slice(-90);
    const peak = Math.max(1, ...buckets.map(b => b.ok + b.err));
    const bw = W / buckets.length;

    // Blue below, red above. Grey was tried here and read as degraded — a washed
    // out bar looks like a timeout rather than a success, which is the opposite
    // of what a healthy baseline should convey. Blue is the same one the rollout
    // page uses for users receiving the feature: in both places it means "this
    // worked".
    buckets.forEach((b, i) => {
      const x = i * bw;
      const okH = (b.ok / peak) * H;
      const errH = (b.err / peak) * H;
      ctx.fillStyle = BLUE;
      ctx.fillRect(x, H - okH, bw - 4, okH);
      ctx.fillStyle = RED;
      ctx.fillRect(x, H - okH - errH, bw - 4, errH);
    });

    // Vertical rule wherever the server received new flag configuration. This is
    // the moment the answers changed, drawn against the moment failures began.
    const first = buckets[0]?.t ?? 0;
    const span = buckets.length * data.bucketMs;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    for (const c of data.configChanges) {
      const x = ((c.ts - first) / span) * W;
      if (x < 0 || x > W) continue;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }, [data]);

  useEffect(() => { draw(); }, [draw]);

  const clear = async () => {
    await fetch('/api/admin/metrics', {
      method: 'POST',
      headers: { 'x-admin-password': password },
    }).catch(() => {});
  };

  // One knob for every piece of text, as on the rollout page. Nothing smaller.
  const shell: React.CSSProperties = {
    ['--t' as string]: '40px',
    ['--sq' as string]: '44px',
    minHeight: '100%',
    background: '#fff',
    color: INK,
    font: 'var(--t)/1.15 "Unica 77", Arial, Helvetica, sans-serif',
    padding: '32px 40px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  };

  const recentWindow = data
    ? data.buckets.slice(-30).reduce((n, b) => n + b.err, 0)
    : 0;

  const btn: React.CSSProperties = {
    font: 'inherit', fontSize: 'var(--t)', lineHeight: 1,
    padding: '0.12em 0.34em', cursor: 'pointer',
    color: INK, background: '#fff',
    border: `2px solid ${LINE}`, borderRadius: '0.14em',
  };

  return (
    <div style={shell}>
      <style>{`
        .mx-range { -webkit-appearance: none; appearance: none; background: transparent;
                    cursor: pointer; height: var(--sq); margin: 0; flex: 1 1 240px; }
        .mx-range::-webkit-slider-runnable-track { height: 12px; background: ${LINE};
                                                   border-radius: 999px; }
        .mx-range::-webkit-slider-thumb { -webkit-appearance: none; width: var(--sq);
                                          height: var(--sq); border-radius: 50%;
                                          background: ${BLUE}; border: none;
                                          margin-top: calc((12px - var(--sq)) / 2); }
        .mx-range::-moz-range-track { height: 12px; background: ${LINE}; border-radius: 999px; }
        .mx-range::-moz-range-thumb { width: var(--sq); height: var(--sq); border-radius: 50%;
                                      background: ${BLUE}; border: none; }
      `}</style>

      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontSize: 'var(--t)', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          HTTP health
        </h1>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
          <span style={{ color: BODY }}>Failures, last 60s:</span>
          <span style={{
            fontSize: 'calc(var(--t) * 1.7)', fontWeight: 700, lineHeight: 1,
            letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
            color: recentWindow ? RED : GREY,
          }}>
            {recentWindow}
          </span>

          {data?.firstErrorAt && (
            <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <span style={{
                display: 'block', color: RED, fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {clock(data.firstErrorAt)}
              </span>
              <span style={{
                display: 'block', color: BODY, fontSize: 'calc(var(--t) * 0.5)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {utc(data.firstErrorAt)} · first failure
              </span>
            </span>
          )}
        </div>
      </header>

      {error && (
        <p style={{ color: RED, margin: 0 }}>{error}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => setRunning(r => !r)}
          style={{ ...btn, background: running ? RED : BLUE, borderColor: running ? RED : BLUE, color: '#fff' }}
        >
          {running ? 'Stop traffic' : 'Send traffic'}
        </button>

        <select
          value={target}
          onChange={e => setTarget(e.target.value)}
          style={btn}
        >
          {TARGETS.map(t => <option key={t.url} value={t.url}>{t.label}</option>)}
        </select>

        <input
          className="mx-range"
          type="range" min={1} max={20} value={rate}
          onChange={e => setRate(+e.target.value)}
          aria-label="Requests per second"
        />
        <span style={{ color: BODY, fontVariantNumeric: 'tabular-nums' }}>{rate}/sec</span>

        <button onClick={clear} style={btn}>Reset</button>
      </div>

      {running && lastStatus === 401 && (
        <p style={{ color: RED, margin: 0 }}>401 — sign in first, or the graph means nothing</p>
      )}

      {/* Both swatches on one line: two stacked label rows would push the chart
          down for no gain, and the pairing is the point. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2em', flexWrap: 'wrap' }}>
        <Sub color={BLUE}>Served</Sub>
        <Sub color={RED}>Failed</Sub>
        {data && (
          <span style={{ marginLeft: 'auto', color: BODY, fontVariantNumeric: 'tabular-nums' }}>
            {data.totalErr} of {data.totalOk + data.totalErr}
          </span>
        )}
      </div>

      <canvas
        ref={canvas}
        width={2000}
        height={680}
        style={{ width: '100%', height: 340, display: 'block' }}
      />

      <Sub color={BLUE}>Flags currently on</Sub>

      {data && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(data.flags).map(([name, on]) => (
            <span
              key={name}
              style={{
                padding: '0.1em 0.34em', borderRadius: '0.14em',
                border: `2px solid ${on ? BLUE : LINE}`,
                color: on ? BLUE : GREY,
              }}
            >
              {name.replace('recall.', '')}
            </span>
          ))}
          {!data.fmReady && (
            <span style={{ color: BODY }}>FM_KEY not set — showing code defaults</span>
          )}
        </div>
      )}

      {data && data.recent.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'calc(var(--t) * 0.6)' }}>
          <tbody>
            {data.recent.slice(0, 6).map((f, i) => (
              <tr key={i} style={{ borderTop: `2px solid ${LINE}` }}>
                <td style={{ padding: '0.3em 0', color: BODY, fontVariantNumeric: 'tabular-nums', width: '8em' }}>
                  {clock(f.ts)}
                </td>
                <td style={{ padding: '0.3em 0', color: RED, fontVariantNumeric: 'tabular-nums', width: '4em' }}>
                  {f.status}
                </td>
                <td style={{ padding: '0.3em 0', color: INK }}>{f.route}</td>
                <td style={{ padding: '0.3em 0', color: BODY }}>{f.flag ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link href="/admin" style={{ color: BODY, fontSize: 'calc(var(--t) * 0.6)' }}>
        Admin
      </Link>
    </div>
  );
}
