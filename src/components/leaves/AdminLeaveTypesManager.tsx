'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Power, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { LeaveTypeItem } from './LeaveRequestModal';

export function AdminLeaveTypesManager() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [defaultAnnualDays, setDefaultAnnualDays] = useState('12');
  const [allowCarryForward, setAllowCarryForward] = useState(false);
  const [maxCarryForwardDays, setMaxCarryForwardDays] = useState('0');
  const [isPaid, setIsPaid] = useState(true);

  const [editTarget, setEditTarget] = useState<LeaveTypeItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDefaultDays, setEditDefaultDays] = useState('12');
  const [editAllowCarry, setEditAllowCarry] = useState(false);
  const [editMaxCarry, setEditMaxCarry] = useState('0');
  const [editIsPaid, setEditIsPaid] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const fetchTypes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/leave-types');
      const json = await res.json();
      if (res.ok && json.success) {
        setLeaveTypes(json.leaveTypes);
      } else {
        setError(json.error?.message || 'Unable to load leave types.');
      }
    } catch {
      setError('Network error loading leave types.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/leave-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          defaultAnnualDays: Number(defaultAnnualDays) || 0,
          allowCarryForward,
          maxCarryForwardDays: allowCarryForward ? Number(maxCarryForwardDays) || 0 : 0,
          isPaid,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Failed to create leave type.');
        return;
      }
      setCode('');
      setName('');
      setDefaultAnnualDays('12');
      setAllowCarryForward(false);
      setMaxCarryForwardDays('0');
      setIsPaid(true);
      await fetchTypes();
    } catch {
      setError('Network error creating leave type.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(lt: LeaveTypeItem) {
    setError(null);
    const res = await fetch(`/api/admin/leave-types/${lt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !lt.isActive }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.error?.message || 'Failed to update leave type.');
      return;
    }
    await fetchTypes();
  }

  async function handleDelete(lt: LeaveTypeItem) {
    setError(null);
    const res = await fetch(`/api/admin/leave-types/${lt.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.error?.message || 'Failed to delete leave type.');
      return;
    }
    await fetchTypes();
  }

  function openEditModal(lt: LeaveTypeItem) {
    setEditTarget(lt);
    setEditName(lt.name);
    setEditDefaultDays(String(lt.defaultAnnualDays));
    setEditAllowCarry(lt.allowCarryForward);
    setEditMaxCarry(String(lt.maxCarryForwardDays));
    setEditIsPaid(lt.isPaid);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || editSaving) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leave-types/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          defaultAnnualDays: Number(editDefaultDays) || 0,
          allowCarryForward: editAllowCarry,
          maxCarryForwardDays: editAllowCarry ? Number(editMaxCarry) || 0 : 0,
          isPaid: editIsPaid,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Failed to update leave type.');
        return;
      }
      setEditTarget(null);
      await fetchTypes();
    } catch {
      setError('Network error updating leave type.');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Create Form */}
      <form
        onSubmit={handleCreate}
        className="bg-card border border-border rounded-2xl p-6 shadow-xl card-noise space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Plus className="w-4 h-4 text-[#ffd700]" />
          <h2 className="text-base font-bold text-foreground font-serif">Create Leave Type</h2>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label
              htmlFor="lt-code"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Type Code
            </label>
            <input
              id="lt-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BEREAVEMENT"
              required
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="lt-name"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Display Name
            </label>
            <input
              id="lt-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bereavement Leave"
              required
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="lt-days"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Default Annual Days
            </label>
            <input
              id="lt-days"
              type="number"
              step="0.5"
              min="0"
              value={defaultAnnualDays}
              onChange={(e) => setDefaultAnnualDays(e.target.value)}
              required
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="lt-carry-cap"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Carry-Forward Cap
            </label>
            <input
              id="lt-carry-cap"
              type="number"
              step="0.5"
              min="0"
              disabled={!allowCarryForward}
              value={maxCarryForwardDays}
              onChange={(e) => setMaxCarryForwardDays(e.target.value)}
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground disabled:opacity-40"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-5 text-xs text-foreground">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
              />
              <span>Paid Leave</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowCarryForward}
                onChange={(e) => setAllowCarryForward(e.target.checked)}
              />
              <span>Allow Year-End Carry-Forward</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 cursor-pointer disabled:opacity-50 font-serif"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Create Leave Type</span>
          </button>
        </div>
      </form>

      {/* Catalog List */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl card-noise space-y-3">
        <h3 className="text-base font-bold text-foreground font-serif border-b border-border pb-3">
          Configured Leave Types
        </h3>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-[#ffd700]" />
            <span>Loading leave types...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {leaveTypes.map((lt) => (
              <div
                key={lt.id}
                className="bg-secondary border border-border rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-foreground font-serif">{lt.name}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        lt.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {lt.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#ffd700]">{lt.code}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-card border border-border text-muted-foreground">
                      {lt.isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Default: {lt.defaultAnnualDays}d/yr • Carry-Forward:{' '}
                    {lt.allowCarryForward ? `Up to ${lt.maxCarryForwardDays}d` : 'Disabled'}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(lt)}
                      aria-label={`Edit ${lt.code}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-foreground hover:border-[#ffd700]/50 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(lt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-foreground hover:border-[#ffd700]/50 cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{lt.isActive ? 'Deactivate' : 'Activate'}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(lt)}
                    aria-label={`Delete ${lt.code}`}
                    className="p-2 rounded-lg bg-card border border-border text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Leave Type Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground font-serif">
              Edit Leave Type — {editTarget.code}
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="edit-lt-name"
                  className="block text-xs font-semibold uppercase text-muted-foreground mb-1 font-serif"
                >
                  Display Name
                </label>
                <input
                  id="edit-lt-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-lt-days"
                    className="block text-xs font-semibold uppercase text-muted-foreground mb-1 font-serif"
                  >
                    Annual Reference Days
                  </label>
                  <input
                    id="edit-lt-days"
                    type="number"
                    step="0.5"
                    min="0"
                    value={editDefaultDays}
                    onChange={(e) => setEditDefaultDays(e.target.value)}
                    required
                    className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-lt-carry-cap"
                    className="block text-xs font-semibold uppercase text-muted-foreground mb-1 font-serif"
                  >
                    Carry-Forward Cap
                  </label>
                  <input
                    id="edit-lt-carry-cap"
                    type="number"
                    step="0.5"
                    min="0"
                    disabled={!editAllowCarry}
                    value={editMaxCarry}
                    onChange={(e) => setEditMaxCarry(e.target.value)}
                    className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-foreground pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsPaid}
                    onChange={(e) => setEditIsPaid(e.target.checked)}
                  />
                  <span>Paid Leave</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAllowCarry}
                    onChange={(e) => setEditAllowCarry(e.target.checked)}
                  />
                  <span>Allow Year-End Carry-Forward</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

