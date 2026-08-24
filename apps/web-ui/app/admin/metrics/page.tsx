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
// Colour: Blue #0069FF is CloudBees Blue. The red is a functional status colour
// only — there is no red in the CloudBees palette — so it is defined once here and
// easy to change if brand review objects.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const OK_COLOR = '#0069FF';
const ERR_COLOR = '#E5484D';

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

export default function MetricsPage() {
  const [password, setPassword] = useState('');
  const [entered, setEntered] = useState('');
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

    buckets.forEach((b, i) => {
      const x = i * bw;
      const okH = (b.ok / peak) * H;
      const errH = (b.err / peak) * H;
      ctx.fillStyle = OK_COLOR;
      ctx.fillRect(x, H - okH, bw - 1, okH);
      ctx.fillStyle = ERR_COLOR;
      ctx.fillRect(x, H - okH - errH, bw - 1, errH);
    });

    // Vertical rule wherever the server received new flag configuration. This is
    // the moment the answers changed, drawn against the moment failures began.
    const first = buckets[0]?.t ?? 0;
    const span = buckets.length * data.bucketMs;
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
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

  if (!password) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
        <form
          className="w-full max-w-sm space-y-4"
          onSubmit={e => {
            e.preventDefault();
            localStorage.setItem('adminPassword', entered);
            setPassword(entered);
          }}
        >
          <input
            type="password"
            value={entered}
            onChange={e => setEntered(e.target.value)}
            placeholder="Admin password"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded text-white"
            autoFocus
          />
          <button type="submit" className="w-full py-3 rounded text-white font-medium"
                  style={{ background: OK_COLOR }}>
            Open
          </button>
        </form>
      </div>
    );
  }

  const recentWindow = data
    ? data.buckets.slice(-30).reduce((n, b) => n + b.err, 0)
    : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex items-baseline gap-8 flex-wrap">
          <h1 className="text-xl font-semibold">Failures</h1>
          <div className="text-6xl font-bold tabular-nums"
               style={{ color: recentWindow ? ERR_COLOR : '#666' }}>
            {recentWindow}
          </div>
          <span className="text-gray-500 text-sm self-end pb-2">last 60s</span>

          {data?.firstErrorAt && (
            <div className="ml-auto text-right">
              <div className="text-4xl font-bold tabular-nums" style={{ color: ERR_COLOR }}>
                {clock(data.firstErrorAt)}
              </div>
              <div className="text-gray-500 text-xs tabular-nums">
                {utc(data.firstErrorAt)} · first failure
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-300">
            {error}
          </div>
        )}

        <canvas ref={canvas} width={1800} height={340} className="w-full block" />

        <div className="flex items-center gap-6 text-sm text-gray-400 flex-wrap">
          <span><i className="inline-block w-3 h-3 rounded-sm mr-2" style={{ background: OK_COLOR }} />Served</span>
          <span><i className="inline-block w-3 h-3 rounded-sm mr-2" style={{ background: ERR_COLOR }} />Failed</span>
          <span className="text-gray-500">┆ flag configuration changed</span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setRunning(r => !r)}
            className="px-5 py-2 rounded font-medium text-white"
            style={{ background: running ? ERR_COLOR : OK_COLOR }}
          >
            {running ? 'Stop traffic' : 'Send traffic'}
          </button>

          <select
            value={target}
            onChange={e => setTarget(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            {TARGETS.map(t => <option key={t.url} value={t.url}>{t.label}</option>)}
          </select>

          <label className="text-sm text-gray-400 flex items-center gap-2">
            <input
              type="range" min={1} max={20} value={rate}
              onChange={e => setRate(+e.target.value)}
              style={{ accentColor: OK_COLOR }}
            />
            <span className="tabular-nums w-14">{rate}/sec</span>
          </label>

          <button onClick={clear} className="px-4 py-2 rounded border border-gray-700 text-sm text-gray-300">
            Reset
          </button>

          {running && lastStatus === 401 && (
            <span className="text-sm" style={{ color: ERR_COLOR }}>
              401 — sign in first, or the graph means nothing
            </span>
          )}

          <Link href="/admin" className="ml-auto text-sm text-gray-500 hover:text-gray-300">
            Admin
          </Link>
        </div>

        {data && (
          <div className="flex gap-3 flex-wrap">
            {Object.entries(data.flags).map(([name, on]) => (
              <span
                key={name}
                className="px-3 py-1 rounded-full text-sm border"
                style={{
                  borderColor: on ? OK_COLOR : '#374151',
                  color: on ? OK_COLOR : '#6B7280',
                }}
              >
                {name.replace('recall.', '')}
              </span>
            ))}
            {!data.fmReady && (
              <span className="px-3 py-1 text-sm text-gray-500">
                FM_KEY not set — flags are showing their code defaults
              </span>
            )}
          </div>
        )}

        {data && data.recent.length > 0 && (
          <table className="w-full text-sm">
            <tbody>
              {data.recent.slice(0, 8).map((f, i) => (
                <tr key={i} className="border-t border-gray-800">
                  <td className="py-2 text-gray-500 tabular-nums w-24">{clock(f.ts)}</td>
                  <td className="py-2 tabular-nums w-16" style={{ color: ERR_COLOR }}>{f.status}</td>
                  <td className="py-2 text-gray-400">{f.route}</td>
                  <td className="py-2 text-gray-500">{f.flag ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
