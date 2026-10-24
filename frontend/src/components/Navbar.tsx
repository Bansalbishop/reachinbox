import React, { useEffect, useState } from 'react';
import { Menu, Activity, Layers, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE_URL } from '../lib/api';
import type { ActiveTab } from './Sidebar';

interface NavbarProps {
  activeTab: ActiveTab;
  onOpenMobile: () => void;
  onNavigateToAccount: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onOpenMobile,
  onNavigateToAccount,
}) => {
  const { user } = useAuth();
  const [healthStatus, setHealthStatus] = useState<'ok' | 'degraded' | 'checking'>('checking');

  useEffect(() => {
    let isMounted = true;
    api.health
      .check()
      .then((res) => {
        if (isMounted) {
          setHealthStatus(res.status === 'healthy' ? 'ok' : 'degraded');
        }
      })
      .catch(() => {
        if (isMounted) {
          setHealthStatus('degraded');
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const titles: Record<ActiveTab, { title: string; desc: string }> = {
    dashboard: { title: 'Dashboard', desc: 'Real-time email queue & dispatch overview' },
    compose: { title: 'Compose & Schedule', desc: 'Create delayed delivery batch with CSV upload' },
    scheduled: { title: 'Scheduled Emails', desc: 'Queued emails pending delivery time' },
    sent: { title: 'Sent Emails', desc: 'Delivered emails with provider message IDs' },
    integrations: { title: 'Integrations', desc: 'Slack alert webhooks & BullMQ board' },
    account: { title: 'Account & Senders', desc: 'Manage authenticated user and sender identities' },
  };

  const current = titles[activeTab] || { title: 'Dashboard', desc: '' };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {current.title}
          </h1>
          <p className="hidden sm:block text-xs text-slate-500">{current.desc}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* API Health indicator */}
        <div
          title={`Backend API: ${API_BASE_URL} (${healthStatus === 'ok' ? 'Healthy' : 'Degraded/Offline'})`}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 border-slate-200 text-slate-600"
        >
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span
            className={`w-2 h-2 rounded-full ${
              healthStatus === 'ok'
                ? 'bg-emerald-500'
                : healthStatus === 'degraded'
                ? 'bg-amber-500'
                : 'bg-slate-300 animate-pulse'
            }`}
          />
          <span className="text-[11px] font-mono text-slate-500">API</span>
        </div>

        {/* Bull Board link */}
        <a
          href={api.authUrls.bullBoard}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          <span>Bull Board</span>
          <ExternalLink className="w-3 h-3 text-indigo-400" />
        </a>

        {/* User avatar button */}
        {user && (
          <button
            onClick={onNavigateToAccount}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-indigo-500/20 transition-all"
            title="View Account"
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
