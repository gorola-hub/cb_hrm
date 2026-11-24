'use client';

import React, { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const lenisInstance = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenisRef.current = lenisInstance;
    listeners.forEach((l) => l());

    function raf(time: number) {
      lenisInstance.raf(time);
      requestAnimationFrame(raf);
    }

    const animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenisInstance.destroy();
      lenisRef.current = null;
      listeners.forEach((l) => l());
    };
  }, []);

  // Resync Lenis layout sizing on route transitions and DOM mutations
  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.resize();
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;

    let resizeTimer: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        lenisRef.current?.resize();
      }, 100);
    };

    const observer = new ResizeObserver(() => {
      debouncedResize();
    });

    if (document.body) {
      observer.observe(document.body);
    }

    window.addEventListener('resize', debouncedResize);

    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  const lenis = useSyncExternalStore(
    subscribe,
    () => lenisRef.current,
    () => null
  );

  return (
    <LenisContext.Provider value={lenis}>
      {children}
    </LenisContext.Provider>
  );
}

