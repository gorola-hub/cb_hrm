'use client';

import { signOut } from 'next-auth/react';
import { Clock, ExternalLink, LogOut, User as UserIcon } from 'lucide-react';
import Link from 'next/link';

interface NavbarUser {
  id: string;
  name?: string | null;
  email?: string | null;
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
}

export function Navbar({ user }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Capital Bridge</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 font-semibold font-mono">
                  HRM
                </span>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-slate-100 bg-slate-900 border border-slate-800"
            >
              Dashboard
            </Link>
          </nav>
        </div>

        {/* Right Section: User & Actions */}
        <div className="flex items-center gap-4">
          {/* User Profile Badge */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-200">
                {user.name || user.email}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 justify-end">
                <span>{user.designation?.name || 'Logistics'}</span>
                <span>•</span>
                <span className="text-amber-400 font-semibold">{user.role.code}</span>
              </div>
            </div>

            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-xl border border-transparent hover:border-slate-800 transition cursor-pointer"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

