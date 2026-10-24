import React, { useEffect, useState } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';
import type { ActiveTab } from '../components/Sidebar';

interface SlackConnectedPageProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const SlackConnectedPage: React.FC<SlackConnectedPageProps> = ({ onNavigate }) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Clear the /slack/connected URL path in history
    window.history.replaceState({}, document.title, '/');

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onNavigate('integrations');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onNavigate]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">Slack Workspace Connected!</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Your Slack OAuth authorization was successfully completed. Rate-limit quota warnings and queue alerts will now be dispatched to your team's channel.
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
          Redirecting to Integrations in <span className="font-semibold text-slate-800">{countdown}s</span>...
        </div>

        <Button
          variant="primary"
          size="md"
          className="w-full"
          onClick={() => onNavigate('integrations')}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Go to Integrations Now
        </Button>
      </div>
    </div>
  );
};
