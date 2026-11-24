'use client';

import React, { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { User, LogOut, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';

interface UserAvatarDropdownProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    alias?: string | null;
    role: {
      code: string;
      name: string;
    };
    designation?: {
      name: string;
    } | null;
  };
}

export function UserAvatarDropdown({ user }: UserAvatarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prefer alias / nickname over legal name or email, matching CRM
  const displayName = user.alias || user.name || user.email || 'User';
  const userEmail = user.email || '';
  const userRole = user.role.code;
  const designationName = user.designation?.name;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
    } catch { }
    const crmUrl = process.env.NEXT_PUBLIC_CRM_URL || 'http://localhost:3000';
    const hrmUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${crmUrl}/api/auth/slo?callbackUrl=${encodeURIComponent(hrmUrl + '/login')}`;
  };

  return (
    <div
      ref={dropdownRef}
      style={{ position: 'relative', height: '40px', display: 'inline-flex', alignItems: 'center' }}
      className="text-left z-50 font-serif"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User account menu"
        className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary border-2 border-[#ffd700] hover:ring-2 hover:ring-[#ffd700]/50 transition-all focus:outline-none cursor-pointer relative z-10 shadow-sm"
      >
        <span className="text-sm font-bold text-foreground">{initials || <User className="w-5 h-5 text-foreground" />}</span>
      </button>

      {isOpen && (
        <div
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100 }}
          className="w-64 rounded-xl bg-card border border-border shadow-2xl py-2 text-card-foreground card-noise animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground truncate font-serif">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate font-serif">{userEmail}</p>
            {designationName && (
              <p className="text-[11px] text-amber-600 dark:text-[#ffd700] truncate font-serif mt-0.5">{designationName}</p>
            )}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 shadow-xs font-serif">
              <ShieldCheck className="w-3.5 h-3.5 text-[#ffd700]" />
              <span>{userRole}</span>
            </div>
          </div>

          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground px-1 font-serif">Theme Mode</span>
            <ThemeToggle />
          </div>

          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer font-serif"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
