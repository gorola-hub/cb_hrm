'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function LiveClock() {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    let serverOffset = 0;

    // Synchronize with server time to avoid client clock tampering (NFR-PERF-001)
    async function syncServerTime() {
      try {
        const start = performance.now();
        const res = await fetch('/api/health');
        const data = await res.json();
        const end = performance.now();
        const latency = (end - start) / 2;
        if (data.timestamp) {
          const serverTime = new Date(data.timestamp).getTime();
          serverOffset = serverTime + latency - Date.now();
        }
      } catch {
        // Fallback to local clock if health check is unavailable
        serverOffset = 0;
      }
      setCurrentTime(new Date(Date.now() + serverOffset));
      setMounted(true);
    }

    syncServerTime();

    const interval = setInterval(() => {
      setCurrentTime(new Date(Date.now() + serverOffset));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted || !currentTime) {
    return (
      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 shadow-lg animate-pulse">
        <Clock className="w-6 h-6 text-slate-600" />
        <div className="space-y-1.5">
          <div className="h-6 w-28 bg-slate-800 rounded"></div>
          <div className="h-3 w-40 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  // Format in Indian Standard Time (Asia/Kolkata)
  const timeString = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateString = currentTime.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3 shadow-lg">
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
        <Clock className="w-5 h-5 animate-pulse" />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {timeString}
          </span>
          <span className="text-xs font-semibold text-amber-400/90 px-1.5 py-0.5 bg-amber-400/10 rounded">
            IST
          </span>
        </div>
        <div className="text-xs text-slate-400 font-medium">
          {dateString}
        </div>
      </div>
    </div>
  );
}

