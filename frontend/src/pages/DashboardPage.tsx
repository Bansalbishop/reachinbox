import React, { useEffect, useState, useCallback } from 'react';
import {
  Send,
  Clock,
  CheckCircle2,
  Users,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api';
import type { EmailBatch, ScheduledEmail, SlackConnectionResponse } from '../types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { ActiveTab } from '../components/Sidebar';

interface DashboardPageProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalBatches, setTotalBatches] = useState(0);
  const [totalScheduled, setTotalScheduled] = useState(0);
  const [totalSent, setTotalSent] = useState(0);
  const [sendersCount, setSendersCount] = useState(0);
  const [slackStatus, setSlackStatus] = useState<SlackConnectionResponse | null>(null);

  const [recentBatches, setRecentBatches] = useState<EmailBatch[]>([]);
  const [recentSent, setRecentSent] = useState<ScheduledEmail[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [batchesRes, scheduledRes, sentRes, sendersRes, slackRes] = await Promise.all([
        api.emails.listBatches(1, 5).catch(() => ({ batches: [], total: 0, page: 1, size: 5 })),
        api.emails.getScheduled(1, 5).catch(() => ({ emails: [], total: 0, page: 1, size: 5 })),
        api.emails.getSent(1, 5).catch(() => ({ emails: [], total: 0, page: 1, size: 5 })),
        api.senders.list().catch(() => ({ senders: [] })),
        api.slack.getStatus().catch(() => ({ connected: false, connection: null })),
      ]);

      setTotalBatches(batchesRes.total);
      setRecentBatches(batchesRes.batches);

      setTotalScheduled(scheduledRes.total);
      setTotalSent(sentRes.total);
      setRecentSent(sentRes.emails);

      setSendersCount(sendersRes.senders.length);
      setSlackStatus(slackRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading) {
    return <LoadingSpinner label="Loading dashboard metrics from API..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Overview Metrics</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status synced directly from PostgreSQL, Redis & BullMQ
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('compose')}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Compose Batch
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Real Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Scheduled */}
        <Card className="hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Scheduled Emails
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalScheduled}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Pending / queued delivery</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Total Sent */}
        <Card className="hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sent Emails
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalSent}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Delivered via SMTP</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Email Batches */}
        <Card className="hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Batches
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalBatches}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Dispatched batch runs</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <Send className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Senders & Slack status */}
        <Card className="hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Senders & Alerts
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900">{sendersCount}</span>
                <span className="text-xs text-slate-400">senders</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    slackStatus?.connected ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
                <span className="text-[11px] text-slate-500">
                  {slackStatus?.connected ? 'Slack Connected' : 'Slack Not Connected'}
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Two Column Section: Recent Batches & Quick Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Batches (2 cols) */}
        <div className="lg:col-span-2">
          <Card
            title="Recent Email Batches"
            subtitle="Latest multi-recipient campaign batches"
            headerAction={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('scheduled')}
              >
                View Scheduled &rarr;
              </Button>
            }
            noPadding
          >
            {recentBatches.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Send className="w-6 h-6" />}
                  title="No email batches created yet"
                  description="Compose your first batch with a CSV or list of addresses to schedule delayed delivery."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigate('compose')}
                      icon={<PlusCircle className="w-4 h-4" />}
                    >
                      Compose Now
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Subject</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Start Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {recentBatches.map((batch) => {
                      const percent =
                        batch.totalCount > 0
                          ? Math.round((batch.sentCount / batch.totalCount) * 100)
                          : 0;
                      return (
                        <tr key={batch.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900 max-w-xs truncate">
                            {batch.subject}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={batch.status} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="w-32">
                              <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>
                                  {batch.sentCount} / {batch.totalCount}
                                </span>
                                <span>{percent}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(batch.startAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Live Queue & Integrations Quick Widget (1 col) */}
        <div className="space-y-4">
          <Card
            title="BullMQ Queue Monitor"
            subtitle="Real-time delayed job queue inspector"
          >
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Emails are scheduled directly into Redis via durable BullMQ delayed jobs with atomic rate-limiting.
            </p>
            <a
              href={api.authUrls.bullBoard}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-4 py-2.5 rounded-lg shadow-2xs transition-colors"
            >
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Open Bull Board Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 ml-auto" />
            </a>
          </Card>

          <Card
            title="Slack Rate-Limit Alerts"
            subtitle="Automated quota alerts"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-800">
                  {slackStatus?.connected
                    ? slackStatus.connection?.teamName || 'Connected Workspace'
                    : 'Not Connected'}
                </span>
              </div>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  slackStatus?.connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {slackStatus?.connected ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              When an hourly sending quota is exceeded, worker posts an alert to your Slack channel.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onNavigate('integrations')}
            >
              Manage Integrations
            </Button>
          </Card>
        </div>
      </div>

      {/* Recent Sent Emails Table Preview */}
      <Card
        title="Recently Delivered Emails"
        subtitle="Latest emails successfully sent via SMTP"
        headerAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('sent')}
          >
            View All Sent &rarr;
          </Button>
        }
        noPadding
      >
        {recentSent.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="No sent emails yet"
              description="Once scheduled email jobs are processed by the worker, sent records appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Recipient</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Sender</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentSent.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900">{email.recipient}</td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">{email.subject}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {email.sender?.email || 'System'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={email.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {email.sentAt ? new Date(email.sentAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
