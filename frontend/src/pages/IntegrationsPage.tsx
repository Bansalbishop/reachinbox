import { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Layers,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Bell,
} from 'lucide-react';
import { api } from '../lib/api';
import type { SlackConnectionResponse } from '../types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const IntegrationsPage: React.FC = () => {
  const [slackData, setSlackData] = useState<SlackConnectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchSlackStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.slack.getStatus();
      setSlackData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to check Slack integration status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlackStatus();
  }, [fetchSlackStatus]);

  const handleConnectSlack = () => {
    // Redirect directly to the real backend Slack OAuth route
    window.location.href = api.authUrls.slackConnect;
  };

  const handleDisconnectSlack = async () => {
    setIsDisconnecting(true);
    try {
      await api.slack.disconnect();
      setIsDisconnectModalOpen(false);
      await fetchSlackStatus();
    } catch (err: any) {
      setError(err?.message || 'Failed to disconnect Slack integration');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner label="Checking integration statuses..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Connected Integrations</h2>
          <p className="text-xs text-slate-500 mt-1">
            Connect external services for real-time rate limit notifications and queue observability
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSlackStatus}
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

      {/* Integration Cards */}
      <div className="space-y-6">
        {/* Slack Integration Card */}
        <Card noPadding>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#4A154B] text-white flex items-center justify-center shrink-0 shadow-md">
                  {/* Official Slack SVG */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.272 0a2.528 2.528 0 0 1-2.52 2.521 2.527 2.527 0 0 1-2.522-2.521V2.522A2.527 2.527 0 0 1 15.166 0a2.528 2.528 0 0 1 2.52 2.522v6.312zm0 10.123a2.528 2.528 0 0 1 2.52 2.522A2.528 2.528 0 0 1 15.166 24a2.527 2.527 0 0 1-2.52-2.522v-2.52h2.52zm0-1.271a2.527 2.527 0 0 1-2.52-2.521 2.528 2.528 0 0 1 2.52-2.522h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Slack Notifications</h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        slackData?.connected
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {slackData?.connected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Connected
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          Disconnected
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg">
                    Receive automated alerts in your team's Slack channel whenever sending quotas or hourly rate limits are exceeded.
                  </p>
                </div>
              </div>

              <div>
                {slackData?.connected ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setIsDisconnectModalOpen(true)}
                    icon={<LogOut className="w-3.5 h-3.5" />}
                  >
                    Disconnect Slack
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleConnectSlack}
                    className="bg-[#4A154B] hover:bg-[#3D113E] focus:ring-[#4A154B]"
                    icon={<Share2 className="w-4 h-4" />}
                  >
                    Connect Slack
                  </Button>
                )}
              </div>
            </div>

            {/* Connection Details or Connect Guide */}
            {slackData?.connected && slackData.connection ? (
              <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Workspace Team:</span>
                  <p className="font-semibold text-slate-800 text-sm mt-0.5">
                    {slackData.connection.teamName || slackData.connection.teamId}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Granted Scopes:</span>
                  <p className="font-mono text-slate-700 text-xs mt-0.5 truncate">
                    {slackData.connection.scopes || 'chat:write, channels:read'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Connected On:</span>
                  <p className="text-slate-700 text-xs mt-0.5">
                    {new Date(slackData.connection.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-900">
                <Bell className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-indigo-950">Why connect Slack?</p>
                  <p className="mt-0.5 text-indigo-800 leading-relaxed">
                    Our background worker tracks hourly email quotas per sender via Redis sliding windows. When a sender hits 50 emails/hour, delayed jobs are rescheduled safely, and a deduplicated incident notification is instantly dispatched to your Slack channel.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Bull Board Dashboard Card */}
        <Card noPadding>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Layers className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Bull Board (Queue Dashboard)</h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      Protected Route
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg">
                    Real-time BullMQ visual UI exposed by the Express backend at <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">/admin/queues</code>.
                  </p>
                </div>
              </div>

              <div>
                <a
                  href={api.authUrls.bullBoard}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-xs transition-colors"
                >
                  <span>Open Bull Board</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Queue Name:</span>
                <p className="font-mono font-semibold text-slate-800 text-xs mt-0.5">
                  email-queue
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Worker Concurrency:</span>
                <p className="font-semibold text-slate-800 text-xs mt-0.5">
                  5 concurrent workers
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Access Security:</span>
                <p className="text-slate-700 text-xs mt-0.5">
                  Requires active session cookie
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Disconnect Confirmation Modal */}
      <Modal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        title="Disconnect Slack Integration"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to remove the Slack connection? Rate-limit quota warnings will no longer be posted to your workspace.
          </p>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDisconnectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDisconnecting}
              onClick={handleDisconnectSlack}
            >
              Confirm Disconnect
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
