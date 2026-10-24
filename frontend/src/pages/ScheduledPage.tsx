import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Clock, Filter, AlertCircle, PlusCircle, Send, Play } from 'lucide-react';
import { api } from '../lib/api';
import type { ScheduledEmail } from '../types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { ActiveTab } from '../components/Sidebar';

interface ScheduledPageProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const ScheduledPage: React.FC<ScheduledPageProps> = ({ onNavigate }) => {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchScheduled = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (searchQuery.trim() || statusFilter) {
        const res = await api.emails.search({
          page,
          size: pageSize,
          recipient: searchQuery.trim() || undefined,
          status: statusFilter || undefined,
        });
        setEmails(res.hits || []);
        setTotal(res.total || 0);
      } else {
        const res = await api.emails.getScheduled(page, pageSize);
        setEmails(res.emails || []);
        setTotal(res.total || 0);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch scheduled emails');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    fetchScheduled();
  }, [fetchScheduled]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchScheduled();
  };

  const handleSyncQueue = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.emails.reconcile();
      setSuccessMessage(`Queue synchronized: ${res.reconciled} email(s) queued/promoted for dispatch.`);
      await fetchScheduled();
    } catch (err: any) {
      setError(err?.message || 'Failed to synchronize queue');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDispatchNow = async (emailId: string) => {
    setDispatchingId(emailId);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.emails.dispatchNow(emailId);
      setSuccessMessage('Email dispatched to worker for immediate processing.');
      await fetchScheduled();
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch email');
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipient or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-lg border border-slate-300 px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Active Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="QUEUED">QUEUED</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncQueue}
            isLoading={isSyncing}
            icon={<Play className="w-3.5 h-3.5 text-indigo-600" />}
            title="Scan and promote overdue emails to worker queue"
          >
            Sync Queue
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchScheduled}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <Card
        title="Scheduled Dispatch Queue"
        subtitle="Emails waiting for BullMQ background delivery with sliding-window sender limits"
      >
        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner label="Loading scheduled queue..." />
          </div>
        ) : emails.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-6 h-6" />}
            title="No scheduled emails found"
            description={
              searchQuery || statusFilter
                ? 'No scheduled emails match your active search filters.'
                : 'You do not have any pending or queued emails awaiting dispatch.'
            }
            action={
              <Button
                variant="primary"
                onClick={() => onNavigate('compose')}
                icon={<PlusCircle className="w-4 h-4" />}
              >
                Schedule New Batch
              </Button>
            }
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Recipient</th>
                    <th className="px-4 py-3.5">Subject</th>
                    <th className="px-4 py-3.5">Sender</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Scheduled Delivery</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {emails.map((email) => {
                    const scheduledDate = new Date(email.scheduledAt);
                    const isOverdue = scheduledDate.getTime() <= Date.now();

                    return (
                      <tr key={email.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {email.recipient}
                        </td>
                        <td className="px-4 py-4 text-slate-600 max-w-sm truncate">
                          <div>{email.subject}</div>
                          {email.lastError && (
                            <div className="text-[11px] text-rose-600 mt-0.5 max-w-xs truncate" title={email.lastError}>
                              Error: {email.lastError}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {email.sender?.email || '—'}
                          {email.sender?.name && (
                            <span className="block text-[11px] text-slate-400">
                              {email.sender.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={email.status} />
                            {email.attempts > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({email.attempts} try)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs whitespace-nowrap">
                          <span className={isOverdue ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                            {scheduledDate.toLocaleString()}
                          </span>
                          {isOverdue && (
                            <span className="block text-[10px] text-amber-500 font-medium">
                              Ready for worker pickup
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          {isOverdue && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDispatchNow(email.id)}
                              isLoading={dispatchingId === email.id}
                              icon={<Send className="w-3 h-3 text-indigo-600" />}
                              title="Force dispatch to worker right now"
                            >
                              Send Now
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={(newPage) => setPage(newPage)}
              isLoading={isLoading}
            />
          </div>
        )}
      </Card>
    </div>
  );
};
