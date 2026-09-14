'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword === 'thittam123') {
      setError('You cannot reuse the default password "thittam123"');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update password');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#101114] hairline-border rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400 font-bold text-xl shadow-lg">
            <KeyRound size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-100 tracking-tight">Set Your New Password</h1>
          <p className="text-xs text-gray-400">
            For security, your default password <code className="text-amber-300">thittam123</code> must be updated on your first login.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-400">
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-300 block mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min. 6 chars)"
              className="w-full bg-[#0c0d0f] hairline-border text-xs text-gray-100 px-3 py-2.5 rounded-lg focus:outline-none focus:border-[#5e6ad2]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-300 block mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-[#0c0d0f] hairline-border text-xs text-gray-100 px-3 py-2.5 rounded-lg focus:outline-none focus:border-[#5e6ad2]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-semibold rounded-lg transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            {isLoading ? 'Updating Password...' : 'Save Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
