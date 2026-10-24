import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Calendar,
  LogOut,
  PlusCircle,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE_URL } from '../lib/api';
import type { Sender } from '../types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const AccountPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [isLoadingSenders, setIsLoadingSenders] = useState(true);

  // New Sender Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newHourlyLimit, setNewHourlyLimit] = useState(50);
  const [newMinInterval, setNewMinInterval] = useState(5000);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchSenders = useCallback(async () => {
    setIsLoadingSenders(true);
    try {
      const res = await api.senders.list();
      setSenders(res.senders);
    } catch (err: any) {
      console.error('Failed to fetch senders:', err);
    } finally {
      setIsLoadingSenders(false);
    }
  }, []);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    setIsSaving(true);
    setModalError(null);
    try {
      await api.senders.create({
        email: newEmail.trim(),
        name: newName.trim() || undefined,
        hourlyLimit: Number(newHourlyLimit) || 50,
        minIntervalMs: Number(newMinInterval) || 5000,
      });
      await fetchSenders();
      setIsAddModalOpen(false);
      setNewEmail('');
      setNewName('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to create sender');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* User Profile Card */}
      <Card noPadding>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-16 h-16 rounded-full border-2 border-indigo-600/30 object-cover shadow-xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-slate-900">{user.name}</h3>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {user.email}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Member since {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                    <Shield className="w-3 h-3 text-indigo-600" />
                    Google OAuth Verified
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="md"
              onClick={logout}
              icon={<LogOut className="w-4 h-4 text-rose-500" />}
              className="hover:border-rose-300 hover:text-rose-600"
            >
              Sign Out
            </Button>
          </div>

          {/* User Meta */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-400 font-medium">Session Store:</span>
              <p className="font-semibold text-slate-800 text-sm mt-0.5">
                PostgreSQL <code className="text-xs font-mono font-normal">session</code> table
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-400 font-medium">API Endpoint:</span>
              <p className="font-mono text-xs text-slate-800 mt-0.5 truncate">{API_BASE_URL}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Senders Management */}
      <Card
        title="Sender Addresses & Rate Limit Profiles"
        subtitle="Configure 'From' email addresses with individual hourly and delay limits"
        headerAction={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Add Sender
          </Button>
        }
        noPadding
      >
        {isLoadingSenders ? (
          <div className="p-12">
            <LoadingSpinner label="Loading senders..." />
          </div>
        ) : senders.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No sender identities configured yet. Add your first sender above to start scheduling emails.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Sender Email</th>
                  <th className="px-4 py-3.5">Display Name</th>
                  <th className="px-4 py-3.5">Hourly Limit</th>
                  <th className="px-4 py-3.5">Min Interval</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {senders.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{s.email}</td>
                    <td className="px-4 py-4 text-slate-600">{s.name || '—'}</td>
                    <td className="px-4 py-4 text-xs font-semibold text-slate-800">
                      {s.hourlyLimit} / hr
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {(s.minIntervalMs / 1000).toFixed(1)}s ({s.minIntervalMs}ms)
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          s.enabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {s.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Sender Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Sender Address"
      >
        <form onSubmit={handleCreateSender} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sender Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. outreach@yourcompany.com"
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
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Growth Team"
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
                value={newHourlyLimit}
                onChange={(e) => setNewHourlyLimit(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Default: 50/hour</p>
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
                value={newMinInterval}
                onChange={(e) => setNewMinInterval(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Default: 5000ms (5s)</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
            >
              Save Sender
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
