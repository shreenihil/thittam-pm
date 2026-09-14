'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, AlertCircle, Sparkles, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      if (data.user?.mustResetPassword) {
        router.push('/reset-password');
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('thittam123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] bg-mesh-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background glow orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#5e6ad2]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 glass-panel rounded-2xl p-8 shadow-card-elevated border border-white/10 space-y-6 animate-fade-in-up">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#5e6ad2] to-indigo-400 mx-auto flex items-center justify-center text-white font-bold text-xl shadow-glow-accent">
            TH
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Thittam</h1>
          <p className="text-xs text-gray-400">Enterprise Project Management & Workflow System</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-xs text-red-400 animate-scale-in">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300 block">Email Address or Username</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@thittam.local"
                className="w-full bg-[#0c0d10] border border-white/10 hover:border-white/20 focus:border-[#5e6ad2] text-xs text-gray-100 pl-10 pr-3.5 py-3 rounded-xl focus:outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300 block">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#0c0d10] border border-white/10 hover:border-white/20 focus:border-[#5e6ad2] text-xs text-gray-100 pl-10 pr-3.5 py-3 rounded-xl focus:outline-none transition-all duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#5e6ad2] hover:bg-[#4e5ac0] active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating Session...</span>
              </>
            ) : (
              <>
                <span>Sign In to Thittam</span>
                <KeyRound size={14} />
              </>
            )}
          </button>
        </form>

        {/* Quick Fill Credentials Widget */}
        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Sparkles size={12} className="text-[#5e6ad2]" />
              Quick Demo Accounts (Click to Fill):
            </span>
            <span className="text-amber-400 font-mono font-medium">thittam123</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Admin', email: 'admin@thittam.local', role: 'Full Control' },
              { label: 'HR', email: 'hr@thittam.local', role: 'Users Mgmt' },
              { label: 'HOD', email: 'hod@thittam.local', role: 'Dept Admin' },
              { label: 'Team Lead', email: 'teamlead@thittam.local', role: 'Lead & Triage' },
              { label: 'Employee', email: 'employee@thittam.local', role: 'Execution' },
              { label: 'Intern', email: 'intern@thittam.local', role: 'Execution' },
            ].map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillCredentials(acc.email)}
                className="px-2.5 py-1.5 bg-[#0e1014] hover:bg-[#151720] border border-white/5 hover:border-[#5e6ad2]/40 rounded-lg text-left transition-all text-[11px] group flex items-center justify-between"
              >
                <div className="truncate">
                  <span className="font-semibold text-gray-200 group-hover:text-white block truncate">
                    {acc.label}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono block truncate">
                    {acc.email}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
