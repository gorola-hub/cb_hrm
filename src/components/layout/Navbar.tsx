'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Bell, ExternalLink, Loader2 } from 'lucide-react';
import { UserAvatarDropdown } from './UserAvatarDropdown';

interface NavbarUser {
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
}

interface NavbarProps {
  user: NavbarUser;
  initialPendingLeaveCount?: number;
}

const emptySubscribe = () => () => {};

export function BrandLogo() {
  const { theme } = useTheme();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isLight = isClient && theme === 'light';
  const logoSrc = isLight ? '/images/logo-light.png' : '/images/logo-dark.png';
  const topOffset = isLight ? '4px' : '0px';

  return (
    <div className="h-full flex items-center overflow-hidden shrink-0 py-1 pl-0">
      <Image
        src={logoSrc}
        alt="Capital Bridge Logistics"
        width={350}
        height={210}
        style={{
          position: 'relative',
          top: topOffset,
        }}
        priority
        className="h-[120px] sm:h-[140px] md:h-[165px] lg:h-[190px] xl:h-[210px] w-auto object-contain transition-all duration-200"
      />
    </div>
  );
}

export function Navbar({ user, initialPendingLeaveCount }: NavbarProps) {
  const pathname = usePathname();
  const [isOpeningCrm, setIsOpeningCrm] = useState(false);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(initialPendingLeaveCount ?? 0);
  const isAdmin = user.role?.code === 'ADMIN';

  useEffect(() => {
    if (!isAdmin) return;

    const refreshPendingCount = async () => {
      try {
        const res = await fetch('/api/admin/leaves?status=PENDING');
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setPendingLeaveCount(json.data.pendingCount ?? 0);
        }
      } catch {
        // Ignore transient network failures
      }
    };

    if (initialPendingLeaveCount === undefined) {
      refreshPendingCount();
    }

    window.addEventListener('hrm:leaves-updated', refreshPendingCount);
    return () => {
      window.removeEventListener('hrm:leaves-updated', refreshPendingCount);
    };
  }, [isAdmin, initialPendingLeaveCount]);

  const handleOpenCrm = async () => {
    if (isOpeningCrm) return;
    setIsOpeningCrm(true);

    try {
      const res = await fetch('/api/auth/sso/token');
      const data = await res.json();

      if (res.ok && data.success && data.ssoUrl) {
        window.open(data.ssoUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert(data.error?.message || 'Failed to generate CRM SSO link. Please try again.');
      }
    } catch {
      alert('Network error connecting to SSO bridge.');
    } finally {
      setIsOpeningCrm(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border shadow-sm h-24 md:h-28 transition-colors duration-200">
      <div className="w-full h-full relative flex items-center justify-between">
        {/* Extreme Left: Brand Logo (Positioned at 0px margin, exactly matching CRM) */}
        <div className="h-full flex items-center shrink-0 pl-0">
          <Link href="/dashboard" className="h-full flex items-center pl-0">
            <BrandLogo />
          </Link>
        </div>

        {/* Center Nav Links: Starts at 15% from left to align with page content, exactly matching CRM */}
        <nav className="hidden md:flex items-center justify-start gap-1 lg:gap-2 absolute left-[15%] h-full">
          <Link
            href="/dashboard"
            className={`px-4 py-2 text-xs lg:text-sm tracking-wide rounded-full font-serif font-extrabold transition-all select-none shadow-md ${
              pathname === '/dashboard'
                ? 'bg-zinc-900 text-[#ffd700] border border-amber-400/60'
                : 'text-foreground hover:text-[#ffd700]'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/leaves"
            className={`px-4 py-2 text-xs lg:text-sm tracking-wide rounded-full font-serif font-extrabold transition-all select-none shadow-md ${
              pathname === '/leaves'
                ? 'bg-zinc-900 text-[#ffd700] border border-amber-400/60'
                : 'text-foreground hover:text-[#ffd700]'
            }`}
          >
            Leaves
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/admin/attendance"
                className={`px-4 py-2 text-xs lg:text-sm tracking-wide rounded-full font-serif font-extrabold transition-all select-none shadow-md ${
                  pathname === '/admin/attendance'
                    ? 'bg-zinc-900 text-[#ffd700] border border-amber-400/60'
                    : 'text-foreground hover:text-[#ffd700]'
                }`}
              >
                Attendance
              </Link>
              <Link
                href="/admin/leaves"
                className={`relative flex items-center gap-1.5 px-4 py-2 text-xs lg:text-sm tracking-wide rounded-full font-serif font-extrabold transition-all select-none shadow-md ${
                  pathname === '/admin/leaves'
                    ? 'bg-zinc-900 text-[#ffd700] border border-amber-400/60'
                    : 'text-foreground hover:text-[#ffd700]'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Leave Approvals</span>
                {pendingLeaveCount > 0 && (
                  <span
                    aria-label={`${pendingLeaveCount} pending leave requests`}
                    className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-mono font-bold bg-[#ffd700] text-zinc-950"
                  >
                    {pendingLeaveCount}
                  </span>
                )}
              </Link>
            </>
          )}
        </nav>

        {/* Extreme Right: Open CRM Button (with black pill fill) & Profile Avatar Dropdown */}
        <div className="flex items-center gap-3 shrink-0 pr-4 md:pr-6">
          <button
            onClick={handleOpenCrm}
            disabled={isOpeningCrm}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 shadow-sm transition active:scale-95 cursor-pointer font-serif disabled:opacity-50"
            title="Open Capital Bridge CRM in new tab"
            aria-label="Open CRM"
          >
            {isOpeningCrm ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden xs:inline">Opening CRM...</span>
              </>
            ) : (
              <>
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open CRM</span>
              </>
            )}
          </button>

          <div className="h-6 w-px bg-border" />

          {/* User Profile Avatar with Click Dropdown */}
          <UserAvatarDropdown user={user} />
        </div>
      </div>
    </header>
  );
}
