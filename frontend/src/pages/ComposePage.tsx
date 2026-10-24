import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Clock,
  Gauge,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import { api, ApiRequestError } from '../lib/api';
import type { Sender } from '../types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { CsvUploader } from '../features/emails/CsvUploader';
import type { ActiveTab } from '../components/Sidebar';

interface ComposePageProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const ComposePage: React.FC<ComposePageProps> = ({ onNavigate }) => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [isLoadingSenders, setIsLoadingSenders] = useState(true);

  // Form state
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  
  // Start time: default to 5 minutes from now in local datetime-local format
  const getDefaultStartTime = () => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    // Convert to YYYY-MM-DDTHH:MM
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    return iso.slice(0, 16);
  };
  const [startTimeLocal, setStartTimeLocal] = useState(getDefaultStartTime());

  // Idempotency key: persists across retries of the SAME request
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{
    batchId: string;
    totalCount: number;
    startAt: string;
    isDuplicateKey?: boolean;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Add Sender Modal state
  const [isAddSenderModalOpen, setIsAddSenderModalOpen] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [newSenderHourlyLimit, setNewSenderHourlyLimit] = useState(50);
  const [newSenderMinInterval, setNewSenderMinInterval] = useState(5000);
  const [isSavingSender, setIsSavingSender] = useState(false);
  const [senderModalError, setSenderModalError] = useState<string | null>(null);

  const fetchSenders = useCallback(async () => {
    setIsLoadingSenders(true);
    try {
      const res = await api.senders.list();
      setSenders(res.senders);
      if (res.senders.length > 0 && !selectedSenderId) {
        // Default to first enabled sender
        const firstEnabled = res.senders.find((s) => s.enabled) || res.senders[0];
        setSelectedSenderId(firstEnabled.id);
      }
    } catch (err: any) {
      console.error('Failed to load senders:', err);
    } finally {
      setIsLoadingSenders(false);
    }
  }, [selectedSenderId]);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  const selectedSender = senders.find((s) => s.id === selectedSenderId);

  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail) return;

    setIsSavingSender(true);
    setSenderModalError(null);
    try {
      const res = await api.senders.create({
        email: newSenderEmail,
        name: newSenderName || undefined,
        hourlyLimit: Number(newSenderHourlyLimit) || 50,
        minIntervalMs: Number(newSenderMinInterval) || 5000,
      });
      await fetchSenders();
      setSelectedSenderId(res.sender.id);
      setIsAddSenderModalOpen(false);
      setNewSenderEmail('');
      setNewSenderName('');
    } catch (err: any) {
      setSenderModalError(err?.message || 'Failed to create sender identity');
    } finally {
      setIsSavingSender(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    // Frontend validations
    if (!selectedSenderId) {
      setSubmitError('Please select or configure a sending email address.');
      return;
    }
    if (!subject.trim()) {
      setSubmitError('Email subject is required.');
      return;
    }
    if (!body.trim()) {
      setSubmitError('Email body content is required.');
      return;
    }
    if (recipients.length === 0) {
      setSubmitError('Please provide at least one valid recipient address.');
      return;
    }

    const startDate = new Date(startTimeLocal);
    if (isNaN(startDate.getTime())) {
      setSubmitError('Please choose a valid start time.');
      return;
    }
    if (startDate.getTime() < Date.now() - 30000) {
      setSubmitError('Start time must be in the future.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.emails.createBatch({
        senderId: selectedSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        startAt: startDate.toISOString(),
        idempotencyKey,
      });

      setSubmitSuccess({
        batchId: res.batch.id,
        totalCount: res.batch.totalCount,
        startAt: res.batch.startAt,
        isDuplicateKey: !res.created,
      });

      // Reset form fields and generate a NEW idempotency key for the next batch
      setSubject('');
      setBody('');
      setRecipients([]);
      setIdempotencyKey(crypto.randomUUID());
    } catch (err: any) {
      if (err instanceof ApiRequestError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('An unexpected error occurred while scheduling email batch.');
      }
      // Note: idempotencyKey is intentionally retained so if the user clicks Retry,
      // it safely reuses the same idempotency key according to specifications!
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Success Notification */}
      {submitSuccess && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <h4 className="font-bold text-base text-emerald-950">
                {submitSuccess.isDuplicateKey
                  ? 'Batch Already Submitted (Idempotent replay)'
                  : 'Batch Successfully Scheduled!'}
              </h4>
              <p className="mt-1 text-emerald-800">
                {submitSuccess.totalCount} email jobs have been committed to PostgreSQL and queued
                into BullMQ with delayed delivery starting at{' '}
                <span className="font-semibold">
                  {new Date(submitSuccess.startAt).toLocaleString()}
                </span>
                .
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate('scheduled')}
                >
                  View in Scheduled Emails &rarr;
                </Button>
                <button
                  onClick={() => setSubmitSuccess(null)}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline"
                >
                  Schedule Another Batch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {submitError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <h5 className="font-semibold text-rose-950">Submission Failed</h5>
            <p className="text-xs text-rose-800 mt-0.5">{submitError}</p>
            <p className="text-[11px] text-rose-600 mt-1">
              Idempotency key retained (<code className="font-mono">{idempotencyKey.slice(0, 8)}...</code>). Retrying will safely prevent duplicate emails.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Sender & Delivery Parameters */}
        <Card
          title="1. Sender Identity & Rate Limit Constraints"
          subtitle="Select configured sending email address and review queue throttling"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Sender Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  From Address <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddSenderModalOpen(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add New Sender
                </button>
              </div>

              {isLoadingSenders ? (
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              ) : senders.length === 0 ? (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                  <span>No senders found. Please add a sender address.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddSenderModalOpen(true)}
                  >
                    Add Sender
                  </Button>
                </div>
              ) : (
                <select
                  value={selectedSenderId}
                  onChange={(e) => setSelectedSenderId(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                >
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ? `${s.name} <${s.email}>` : s.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Start Time Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Schedule Start Time <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={startTimeLocal}
                  min={getDefaultStartTime()}
                  onChange={(e) => setStartTimeLocal(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Batched emails start delivering at this exact timestamp via BullMQ delay.
              </p>
            </div>
          </div>

          {/* Sender Throttling Parameters Callout */}
          {selectedSender && (
            <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Minimum interval between emails:{' '}
                  <span className="font-semibold text-slate-900">
                    {(selectedSender.minIntervalMs / 1000).toFixed(1)}s ({selectedSender.minIntervalMs}ms)
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Gauge className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Hourly rate limit:{' '}
                  <span className="font-semibold text-slate-900">
                    {selectedSender.hourlyLimit} emails/hour
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                <span>Idempotency Key: {idempotencyKey.slice(0, 8)}...</span>
              </div>
            </div>
          )}
        </Card>

        {/* Step 2: Recipients via CSV / Text */}
        <Card
          title="2. Recipients List (CSV or Text Upload)"
          subtitle="Upload contacts file or paste emails. Duplicates and invalid formats are filtered in real-time."
        >
          <CsvUploader
            recipients={recipients}
            onRecipientsChange={(list) => setRecipients(list)}
          />
        </Card>

        {/* Step 3: Email Content */}
        <Card
          title="3. Email Subject & Body"
          subtitle="Compose message template to be sent to all batch recipients"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Subject Line <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Exclusive invitation to ReachInbox private beta"
                maxLength={500}
                className="w-full text-sm rounded-lg border border-slate-300 px-3.5 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400"
                required
              />
              <div className="flex justify-end text-[11px] text-slate-400 mt-1">
                {subject.length} / 500 characters
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Body <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                placeholder="Hi there,&#10;&#10;We're reaching out to follow up on your recent request..."
                maxLength={50000}
                className="w-full text-sm rounded-lg border border-slate-300 p-3.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 font-sans"
                required
              />
              <div className="flex justify-end text-[11px] text-slate-400 mt-1">
                {body.length} / 50,000 characters
              </div>
            </div>
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500">
            {recipients.length > 0 ? (
              <span className="font-semibold text-slate-800">
                Ready to schedule {recipients.length} email{recipients.length === 1 ? '' : 's'}
              </span>
            ) : (
              <span>Add recipients above to enable scheduling</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => onNavigate('dashboard')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              disabled={recipients.length === 0 || !subject || !body || isSubmitting}
              icon={<Send className="w-4 h-4" />}
            >
              Schedule Batch Delivery
            </Button>
          </div>
        </div>
      </form>

      {/* Add Sender Modal */}
      <Modal
        isOpen={isAddSenderModalOpen}
        onClose={() => setIsAddSenderModalOpen(false)}
        title="Add Sender Identity"
      >
        <form onSubmit={handleCreateSender} className="space-y-4">
          {senderModalError && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs">
              {senderModalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={newSenderEmail}
              onChange={(e) => setNewSenderEmail(e.target.value)}
              placeholder="sales@yourdomain.com"
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Display Name (Optional)
            </label>
            <input
              type="text"
              value={newSenderName}
              onChange={(e) => setNewSenderName(e.target.value)}
              placeholder="ReachInbox Sales Team"
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hourly Limit
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={newSenderHourlyLimit}
                onChange={(e) => setNewSenderHourlyLimit(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Max emails per hour</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Min Interval (ms)
              </label>
              <input
                type="number"
                min={0}
                max={60000}
                step={500}
                value={newSenderMinInterval}
                onChange={(e) => setNewSenderMinInterval(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Space between sends</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddSenderModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingSender}
            >
              Save Sender
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
