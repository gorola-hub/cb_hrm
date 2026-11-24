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
      <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3 shadow-lg animate-pulse card-noise">
        <Clock className="w-6 h-6 text-muted-foreground" />
        <div className="space-y-1.5">
          <div className="h-6 w-28 bg-muted rounded"></div>
          <div className="h-3 w-40 bg-muted rounded"></div>
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
    <div className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-3 shadow-lg card-noise text-card-foreground">
      <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-[#ffd700] shrink-0">
        <Clock className="w-5 h-5" />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-foreground tabular-nums">
            {timeString}
          </span>
          <span className="text-[11px] font-semibold text-[#ffd700] px-2 py-0.5 bg-zinc-900 border border-amber-400/60 rounded font-mono">
            IST
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-serif">
          {dateString}
        </div>
      </div>
    </div>
  );
}
