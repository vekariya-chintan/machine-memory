import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { PromptNovaLogo } from './PromptNovaLogo';
import {
  authenticateTechnician,
  ensureTechniciansTablePopulated,
} from '../services/authService';
import { Technician } from '../types/industrial';

interface LoginScreenProps {
  onLoginSuccess: (technician: Technician) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Priming technicians data in the background
  useEffect(() => {
    ensureTechniciansTablePopulated().catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authenticateTechnician(email, password);
      if (result.success && result.technician) {
        onLoginSuccess(result.technician);
      } else {
        setErrorMessage(result.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-cyan-500 selection:text-black relative">
      {/* Subtle Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.12),rgba(147,51,234,0.08),rgba(15,23,42,0))]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b10_1px,transparent_1px),linear-gradient(to_bottom,#1e293b10_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Centered Login Card */}
      <div className="relative z-10 w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Team Logo and App Name */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-purple-500/40 p-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] mb-4">
            <img
              src="/PromptNova.png"
              alt="Team PromptNova Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/promptnova-logo.svg';
              }}
            />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-fuchsia-400 animate-pulse border-2 border-slate-950" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
            MACHINE<span className="text-cyan-400">MEMORY</span>
          </h1>
          <span className="text-xs font-mono text-cyan-400/90 font-bold tracking-widest uppercase mt-1">
            By Team PromptNova
          </span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Login Form: Email and Password only */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm font-sans transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm font-sans transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:via-sky-500 hover:to-blue-500 text-white font-semibold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 text-cyan-200" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
