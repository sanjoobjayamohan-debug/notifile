import React, { useState, useEffect } from 'react';
import { ALL_TOOLS } from './data/tools';
import { ToolDef, ActivityItem } from './types';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { MainDashboard } from './components/MainDashboard';
import { ToolGrid } from './components/ToolGrid';
import { ToolWorkspace } from './components/ToolWorkspace';
import { QRCodeModal } from './components/QRCodeModal';
import { MobileShareView } from './components/MobileShareView';
import { CommandSearch } from './components/CommandSearch';
import { PricingModal } from './components/PricingModal';
import { HelpCenter } from './components/HelpCenter';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { ShareModal } from './components/ShareModal';
import { testConnection, auth } from './firebase/config';
import {
  BillingConfiguration,
  BillingState,
  CreditPlan,
  DEFAULT_BILLING_CONFIGURATION,
  TeamDuration,
  TeamMember,
  buyCreditPack,
  buyTeamPlan,
  getBillingUid,
  getLocalBillingState,
  isBillingAdmin,
  isUnlimitedActive,
  loadBillingConfiguration,
  loadBillingState,
  recordSuccessfulToolUsage,
  saveBillingConfiguration,
  saveTeamMembers,
} from './services/billingService';

export default function App() {
  // Check if viewing a shared mobile link e.g. /share/:id
  const pathname = window.location.pathname;
  const isShareRoute = pathname.startsWith('/share/');
  const shareId = isShareRoute ? pathname.split('/')[2] : null;

  const [currentView, setCurrentView] = useState<string>('home');
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrTargetFile, setQrTargetFile] = useState<{
    name: string;
    blob: Blob;
    size: number;
  } | null>(null);

  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  const [shareFileTarget, setShareFileTarget] = useState<{
    name: string;
    size: number;
    blobUrl: string;
    blob?: Blob;
  } | null>(null);

  const [latestCompletedActivity, setLatestCompletedActivity] = useState<ActivityItem | null>(null);

  // Persistence: User
  const [user, setUser] = useState<{ email: string; name: string; uid?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('notifile_user');
      return saved
        ? JSON.parse(saved)
        : { uid: 'user_david_101', name: 'David', email: 'david.miller@example.com' };
    } catch {
      return { uid: 'user_david_101', name: 'David', email: 'david.miller@example.com' };
    }
  });

  const [billing, setBilling] = useState<BillingState>(() => getLocalBillingState(user?.uid || 'local_guest'));
  const [billingConfig, setBillingConfig] = useState<BillingConfiguration>(DEFAULT_BILLING_CONFIGURATION);
  const [isBillingAdminUser, setIsBillingAdminUser] = useState(false);

  // Persistence: Favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('notifile_favorites');
      return saved ? JSON.parse(saved) : ['merge-pdf', 'compress-pdf', 'pdf-to-word', 'jpg-to-pdf'];
    } catch {
      return ['merge-pdf', 'compress-pdf'];
    }
  });

  // Persistence: Recent tools
  const [recentToolIds, setRecentToolIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('notifile_recent');
      return saved ? JSON.parse(saved) : ['compress-pdf', 'merge-pdf', 'split-pdf'];
    } catch {
      return [];
    }
  });

  // Persistence: Activities
  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    try {
      const saved = localStorage.getItem('notifile_activities');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Theme: Dark Mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('notifile_theme');
      if (saved) return saved === 'dark';
      return false;
    } catch {
      return false;
    }
  });

  // Verify Firebase Connection on boot per Skill instruction
  useEffect(() => {
    testConnection();
  }, []);

  useEffect(() => {
    loadBillingConfiguration()
      .then(setBillingConfig)
      .catch((error: unknown) => console.error('Failed to load billing configuration:', error));
  }, []);

  // Signed-in accounts use Firestore; the local demo profile uses browser storage.
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const u = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'David',
          email: firebaseUser.email || 'david.miller@example.com',
        };
        setUser(u);
        try {
          const [account, isAdmin] = await Promise.all([
            loadBillingState(u.uid),
            isBillingAdmin(),
          ]);
          setBilling(account);
          setIsBillingAdminUser(isAdmin);
        } catch (error) {
          console.error('Failed to load signed-in billing account:', error);
        }
      } else if (user?.uid) {
        setIsBillingAdminUser(false);
        setBilling(getLocalBillingState(user.uid));
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('notifile_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('notifile_theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('notifile_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('notifile_recent', JSON.stringify(recentToolIds));
  }, [recentToolIds]);

  useEffect(() => {
    localStorage.setItem('notifile_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('notifile_user', JSON.stringify(user));
    }
  }, [user]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectTool = (tool: ToolDef) => {
    setActiveTool(tool);
    setIsDashboardOpen(false);
    setRecentToolIds((prev) => [tool.id, ...prev.filter((id) => id !== tool.id)].slice(0, 8));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const billingUid = getBillingUid(user?.uid);

  const handleRecordActivity = async (
    fileName: string,
    originalSize: number,
    resultSize: number,
    toolId: string,
    toolName: string,
    creditCost: number
  ) => {
    const updatedBilling = await recordSuccessfulToolUsage(
      billingUid,
      billing,
      toolId,
      toolName,
      creditCost
    );
    setBilling(updatedBilling);

    const newActivity: ActivityItem = {
      id: `act_${Date.now()}`,
      toolId,
      toolName,
      fileName,
      originalSize,
      resultSize,
      creditsCharged: Math.abs(updatedBilling.transactions[0]?.credits || 0),
      timestamp: Date.now(),
      status: 'completed',
    };
    setActivities((prev) => [newActivity, ...prev]);
    setLatestCompletedActivity(newActivity);
  };

  const handlePurchaseCredits = async (plan: CreditPlan) => {
    setBilling(await buyCreditPack(billingUid, billing, plan, billingConfig));
  };

  const handlePurchaseTeam = async (duration: TeamDuration, seats: number) => {
    setBilling(await buyTeamPlan(billingUid, billing, duration, seats, billingConfig, {
      name: user?.name || 'Owner',
      email: user?.email || 'Owner account',
    }));
  };

  const handleSaveTeamMembers = async (members: TeamMember[], teamName?: string) => {
    setBilling(await saveTeamMembers(billingUid, billing, members, teamName));
  };

  const handleSaveBillingConfig = async (config: BillingConfiguration) => {
    await saveBillingConfiguration(config);
    setBillingConfig(config);
  };

  // If user opened a shared mobile link via QR code scan
  if (isShareRoute && shareId) {
    return <MobileShareView shareId={shareId} onGoHome={() => (window.location.href = '/')} />;
  }

  // Map sidebar category to ToolGrid category
  const mapSidebarViewToCategory = (view: string): string => {
    switch (view) {
      case 'merge':
        return 'pdf-organize';
      case 'split':
        return 'pdf-organize';
      case 'compress':
        return 'compress';
      case 'convert':
        return 'pdf-convert';
      case 'organize':
        return 'pdf-edit';
      case 'security':
        return 'security';
      case 'automate':
        return 'ocr';
      default:
        return 'all';
    }
  };

  return (
    <div className="min-h-screen flex bg-neutral-50/70 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 transition-colors duration-200">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          currentView={currentView}
          onSelectView={(view) => {
            setCurrentView(view);
            setActiveTool(null);
            setIsDashboardOpen(false);
          }}
          onOpenQRModal={() => {
            setQrTargetFile(null);
            setIsQrModalOpen(true);
          }}
          onOpenDashboard={() => {
            setIsDashboardOpen(true);
            setActiveTool(null);
          }}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 bg-white dark:bg-neutral-900 shadow-2xl">
            <Sidebar
              currentView={currentView}
              onSelectView={(view) => {
                setCurrentView(view);
                setActiveTool(null);
                setIsDashboardOpen(false);
                setMobileSidebarOpen(false);
              }}
              onOpenQRModal={() => {
                setQrTargetFile(null);
                setIsQrModalOpen(true);
                setMobileSidebarOpen(false);
              }}
              onOpenDashboard={() => {
                setIsDashboardOpen(true);
                setActiveTool(null);
                setMobileSidebarOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <TopHeader
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          user={user}
          onOpenDashboard={() => {
            setIsDashboardOpen(true);
            setActiveTool(null);
          }}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenPricing={() => setIsPricingOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
        />

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {isDashboardOpen && user ? (
            <DashboardView
              user={user}
              activities={activities}
              favorites={favorites}
              onSelectTool={handleSelectTool}
              onClearHistory={() => setActivities([])}
              onSignOut={() => {
                setUser(null);
                setIsDashboardOpen(false);
              }}
              onBackToTools={() => setIsDashboardOpen(false)}
              billing={billing}
              onOpenPricing={() => setIsPricingOpen(true)}
              latestActivity={latestCompletedActivity}
            />
          ) : activeTool ? (
            <ToolWorkspace
              tool={activeTool}
              onBack={() => setActiveTool(null)}
              onRecordActivity={handleRecordActivity}
              onTakeToPhone={(file) => {
                setQrTargetFile(file);
                setIsQrModalOpen(true);
              }}
              onShareFile={(file) => {
                setShareFileTarget(file);
              }}
              onOpenPricing={() => setIsPricingOpen(true)}
              billing={billing}
              billingConfig={billingConfig}
            />
          ) : currentView === 'home' ? (
            <MainDashboard
              userName={user?.name || 'David'}
              onSelectTool={handleSelectTool}
              onViewAllTools={() => setCurrentView('all')}
              creditBalance={billing.creditBalance}
              hasUnlimitedAccess={isUnlimitedActive(billing)}
              onOpenPricing={() => setIsPricingOpen(true)}
            />
          ) : (
            /* Category or All Tools Grid */
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => setCurrentView('home')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ← Back to Home
                </button>
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Tool Catalog
                </span>
              </div>
              <ToolGrid
                selectedCategory={mapSidebarViewToCategory(currentView)}
                onSelectCategory={(cat) => setCurrentView(cat)}
                onSelectTool={handleSelectTool}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                recentToolIds={recentToolIds}
              />
            </div>
          )}
        </main>
      </div>

      {/* Global QR Code Modal */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => {
          setIsQrModalOpen(false);
          setQrTargetFile(null);
        }}
        initialFile={qrTargetFile || undefined}
      />

      {/* Share Modal */}
      {shareFileTarget && (
        <ShareModal
          isOpen={Boolean(shareFileTarget)}
          onClose={() => setShareFileTarget(null)}
          fileName={shareFileTarget.name}
          fileSize={shareFileTarget.size}
          shareUrl={shareFileTarget.blobUrl}
          onOpenQR={() => {
            if (shareFileTarget.blob) {
              setQrTargetFile({
                name: shareFileTarget.name,
                blob: shareFileTarget.blob,
                size: shareFileTarget.size,
              });
            }
            setIsQrModalOpen(true);
          }}
        />
      )}

      {/* Command Search (Ctrl+K) */}
      <CommandSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectTool={handleSelectTool}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Credit and team pricing */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        billing={billing}
        config={billingConfig}
        isAdmin={isBillingAdminUser}
        onPurchaseCredits={handlePurchaseCredits}
        onPurchaseTeam={handlePurchaseTeam}
        onSaveConfiguration={handleSaveBillingConfig}
        onSaveTeamMembers={handleSaveTeamMembers}
      />

      {isHelpOpen && <HelpCenter
        config={billingConfig}
        onClose={() => setIsHelpOpen(false)}
        onOpenPricing={() => {
          setIsHelpOpen(false);
          setIsPricingOpen(true);
        }}
        onOpenTool={(toolId) => {
          const tool = ALL_TOOLS.find((item) => item.id === toolId);
          if (tool) {
            setIsHelpOpen(false);
            handleSelectTool(tool);
          }
        }}
      />}

      {/* Authentication */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(loggedUser) => setUser(loggedUser)}
      />
    </div>
  );
}
