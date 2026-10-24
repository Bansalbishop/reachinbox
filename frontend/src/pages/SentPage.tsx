import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import type { ScheduledEmail } from '../types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const SentPage: React.FC = () => {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.emails.getSent(page, pageSize);
      setEmails(res.emails || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch sent emails');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchSent();
  }, [fetchSent]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Delivered Emails</h2>
          <p className="text-xs text-slate-500 mt-1">
            Historical log of emails dispatched via SMTP transport with verification metadata
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSent}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <Card noPadding>
        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner label="Fetching delivered emails log..." />
          </div>
        ) : emails.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="No delivered emails found"
              description="Emails that complete SMTP delivery through the background worker will appear here."
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Recipient</th>
                    <th className="px-4 py-3.5">Subject</th>
                    <th className="px-4 py-3.5">Sender</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Delivered At</th>
                    <th className="px-4 py-3.5">Provider ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {emails.map((email) => (
                    <tr key={email.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {email.recipient}
                      </td>
                      <td className="px-4 py-4 text-slate-600 max-w-sm truncate">
                        {email.subject}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {email.sender?.email || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={email.status} />
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {email.sentAt ? new Date(email.sentAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] text-slate-400 max-w-[140px] truncate">
                        {email.providerMessageId || '—'}
                      </td>
                    </tr>
                  ))}
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
