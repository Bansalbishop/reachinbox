import React from 'react';
import {
  LayoutDashboard,
  Send,
  Clock,
  CheckCircle2,
  Share2,
  User as UserIcon,
  ExternalLink,
  LogOut,
  Mail,
  X,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export type ActiveTab = 'dashboard' | 'compose' | 'scheduled' | 'sent' | 'integrations' | 'account';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'compose', label: 'Compose Email', icon: <Send className="w-5 h-5" /> },
    { id: 'scheduled', label: 'Scheduled', icon: <Clock className="w-5 h-5" /> },
    { id: 'sent', label: 'Sent Emails', icon: <CheckCircle2 className="w-5 h-5" /> },
    { id: 'integrations', label: 'Integrations', icon: <Share2 className="w-5 h-5" /> },
    { id: 'account', label: 'Account & Senders', icon: <UserIcon className="w-5 h-5" /> },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B132B] text-slate-300 w-64 border-r border-slate-800/80">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
              ReachInbox
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-950 text-indigo-400 border border-indigo-800/60 px-1.5 py-0.2 rounded">
                Outbox
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Email Scheduler</p>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Main Menu
        </div>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Dedicated section for Queue Monitor */}
        <div className="pt-5 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Infrastructure
        </div>
        <a
          href={api.authUrls.bullBoard}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-all group"
        >
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>Bull Board</span>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
        </a>
      </div>

      {/* Authenticated User Footer */}
      {user && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-800/40">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-indigo-500/40 object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-700 text-white font-medium flex items-center justify-center shrink-0 text-xs">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer with backdrop */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
