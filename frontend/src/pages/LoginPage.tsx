import React from 'react';
import { Mail, ShieldCheck, Zap, Server, Clock } from 'lucide-react';
import { api } from '../lib/api';

export const LoginPage: React.FC = () => {
  const handleGoogleLogin = () => {
    // Redirect directly to the real backend Google OAuth route
    window.location.href = api.authUrls.googleLogin;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background subtle gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 mb-4">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ReachInbox Outbox
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Durable Email Batch Scheduler with BullMQ & Elasticsearch
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-7 sm:p-8 shadow-2xl border border-slate-200">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-1">
              Secure OAuth 2.0 authentication with real Google credentials
            </p>
          </div>

          {/* Real Continue with Google button */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold px-5 py-3 rounded-xl border border-slate-300 shadow-xs hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
          >
            {/* Official Google 'G' icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-400 font-medium uppercase tracking-wider">
                Production-grade Architecture
              </span>
            </div>
          </div>

          {/* Highlights */}
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span>Durable BullMQ delayed email queuing (No Cron)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span>Rate-limiting per sender with Redis sliding window</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Server className="w-3.5 h-3.5" />
              </div>
              <span>HttpOnly cookie sessions with PostgreSQL session store</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span>Idempotent batch processing with collision protection</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          ReachInbox Assignment &bull; Built with React, TypeScript & Vite
        </p>
      </div>
    </div>
  );
};
