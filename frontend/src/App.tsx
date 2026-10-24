import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, type ActiveTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ComposePage } from './pages/ComposePage';
import { ScheduledPage } from './pages/ScheduledPage';
import { SentPage } from './pages/SentPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { AccountPage } from './pages/AccountPage';
import { SlackConnectedPage } from './pages/SlackConnectedPage';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSlackCallback, setIsSlackCallback] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/slack/connected') {
      setIsSlackCallback(true);
    }
  }, []);

  if (isLoading) {
    return <LoadingSpinner label="Authenticating session with ReachInbox Outbox..." fullPage />;
  }

  // Not logged in -> Show Google OAuth Login Page
  if (!user) {
    return <LoginPage />;
  }

  // Slack OAuth callback landed
  if (isSlackCallback) {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar
            activeTab={activeTab}
            onOpenMobile={() => setIsMobileSidebarOpen(true)}
            onNavigateToAccount={() => setActiveTab('account')}
          />
          <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
            <SlackConnectedPage
              onNavigate={(tab) => {
                setIsSlackCallback(false);
                setActiveTab(tab);
              }}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ReachInbox Dark Navy Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          activeTab={activeTab}
          onOpenMobile={() => setIsMobileSidebarOpen(true)}
          onNavigateToAccount={() => setActiveTab('account')}
        />

        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
          {activeTab === 'compose' && <ComposePage onNavigate={setActiveTab} />}
          {activeTab === 'scheduled' && <ScheduledPage onNavigate={setActiveTab} />}
          {activeTab === 'sent' && <SentPage />}
          {activeTab === 'integrations' && <IntegrationsPage />}
          {activeTab === 'account' && <AccountPage />}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
