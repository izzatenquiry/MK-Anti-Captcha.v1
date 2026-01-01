
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type User, type AiLogItem, type Language, type TokenUltraRegistration } from '../../types';
import { updateUserProfile, saveUserPersonalAuthToken, assignPersonalTokenAndIncrementUsage, getTokenUltraRegistration } from '../../services/userService';
import {
    CreditCardIcon, CheckCircleIcon, XIcon, EyeIcon, EyeOffIcon, ChatIcon,
    AlertTriangleIcon, DatabaseIcon, TrashIcon, RefreshCwIcon, WhatsAppIcon, InformationCircleIcon, SparklesIcon, VideoIcon, ImageIcon, KeyIcon, ActivityIcon, ClockIcon
} from '../Icons';
import Spinner from '../common/Spinner';
import Tabs, { type Tab } from '../common/Tabs';
import { getTranslations } from '../../services/translations';
import { getFormattedCacheStats, clearVideoCache } from '../../services/videoCacheService';
import { runComprehensiveTokenTest, type TokenTestResult } from '../../services/imagenV3Service';
import eventBus from '../../services/eventBus';
import FlowLogin from '../FlowLogin';
import RegisterTokenUltra from '../RegisterTokenUltra';

// Define the types for the settings view tabs
type SettingsTabId = 'profile' | 'flowLogin' | 'registerTokenUltra';

const getTabs = (): Tab<SettingsTabId>[] => {
    const T = getTranslations().settingsView;
    return [
        { id: 'profile', label: T.tabs.profile },
        { id: 'flowLogin', label: 'Token Setting' },
        { id: 'registerTokenUltra', label: 'Token Ultra' },
    ];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface SettingsViewProps {
  currentUser: User;
  tempApiKey: string | null;
  onUserUpdate: (user: User) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  veoTokenRefreshedAt: string | null;
  assignTokenProcess: () => Promise<{ success: boolean; error: string | null; }>;
  onOpenChangeServerModal: () => void;
}

const ClaimTokenModal: React.FC<{
  status: 'searching' | 'success' | 'error';
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}> = ({ status, error, onRetry, onClose }) => {
    const T = getTranslations().claimTokenModal;
    return (
    <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50 p-4 animate-zoomIn" aria-modal="true" role="dialog">
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-8 text-center max-w-sm w-full">
        {status === 'searching' && (
            <>
            <Spinner />
            <h2 className="text-lg sm:text-xl font-semibold mt-4">{T.searchingTitle}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-sm sm:text-base">
                {T.searchingMessage}
            </p>
            </>
        )}
        {status === 'success' && (
            <>
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-lg sm:text-xl font-semibold mt-4">{T.successTitle}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-sm sm:text-base">
                {T.successMessage}
            </p>
            </>
        )}
        {status === 'error' && (
            <>
            <AlertTriangleIcon className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-lg sm:text-xl font-semibold mt-4">{T.errorTitle}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-sm sm:text-base">
                {error || T.errorMessageDefault}
            </p>
            <div className="mt-6 flex gap-4">
                <button onClick={onClose} className="w-full bg-neutral-200 dark:bg-neutral-700 font-semibold py-2 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
                {T.closeButton}
                </button>
                <button onClick={onRetry} className="w-full bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors">
                {T.retryButton}
                </button>
            </div>
            </>
        )}
        </div>
    </div>
)};

// --- PANELS ---

interface ProfilePanelProps extends Pick<SettingsViewProps, 'currentUser' | 'onUserUpdate' | 'assignTokenProcess'> {
    language: Language;
    setLanguage: (lang: Language) => void;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ currentUser, onUserUpdate, language, setLanguage, assignTokenProcess }) => {
    const T = getTranslations().settingsView;
    const T_Profile = T.profile;

    const [fullName, setFullName] = useState(currentUser.fullName || currentUser.username);
    const [email, setEmail] = useState(currentUser.email);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'loading'; message: string }>({ type: 'idle', message: '' });
    const statusTimeoutRef = useRef<number | null>(null);
    
    // Token Ultra Status State
    const [ultraRegistration, setUltraRegistration] = useState<TokenUltraRegistration | null>(null);
    const [isLoadingUltra, setIsLoadingUltra] = useState(false);

    useEffect(() => {
        const loadUltraStatus = async () => {
            setIsLoadingUltra(true);
            try {
                const result = await getTokenUltraRegistration(currentUser.id);
                if (result.success) {
                    setUltraRegistration(result.registration);
                }
            } catch (e) {
                console.error("Failed to load ultra status", e);
            } finally {
                setIsLoadingUltra(false);
            }
        };
        loadUltraStatus();
    }, [currentUser.id]);

     useEffect(() => {
        return () => {
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        };
    }, []);

    const getAccountStatus = (user: User): { text: string; colorClass: string } => {
        switch (user.status) {
            case 'admin': return { text: T_Profile.status.admin, colorClass: 'text-green-500' };
            case 'lifetime': return { text: T_Profile.status.lifetime, colorClass: 'text-green-500' };
            case 'subscription': return { text: T_Profile.status.subscription, colorClass: 'text-green-500' };
            case 'trial': return { text: T_Profile.status.trial, colorClass: 'text-yellow-500' };
            case 'inactive': return { text: T_Profile.status.inactive, colorClass: 'text-red-500' };
            case 'pending_payment': return { text: T_Profile.status.pending, colorClass: 'text-yellow-500' };
            default: return { text: T_Profile.status.unknown, colorClass: 'text-neutral-500' };
        }
    };

    const handleSave = async () => {
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        setStatus({ type: 'loading', message: T_Profile.saving });
        const result = await updateUserProfile(currentUser.id, { fullName, email });
        if (result.success === false) {
            setStatus({ type: 'error', message: T_Profile.fail.replace('{message}', result.message) });
        } else {
            onUserUpdate(result.user);
            setStatus({ type: 'success', message: T_Profile.success });
        }
        statusTimeoutRef.current = window.setTimeout(() => setStatus({ type: 'idle', message: '' }), 4000);
    };


    const accountStatus = getAccountStatus(currentUser);
    let expiryInfo = null;
    if (currentUser.status === 'subscription' && currentUser.subscriptionExpiry) {
        const expiryDate = new Date(currentUser.subscriptionExpiry);
        const isExpired = Date.now() > expiryDate.getTime();
        expiryInfo = (
            <span className={isExpired ? 'text-red-500 font-bold' : ''}>
                {T_Profile.expiresOn} {expiryDate.toLocaleDateString()} {isExpired && `(${T_Profile.expired})`}
            </span>
        );
    }

    return (
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm h-full overflow-y-auto border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg sm:text-xl font-semibold mb-6">{T_Profile.title}</h2>
            
            {/* Account Status Box */}
            <div className="mb-6 p-4 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{T_Profile.accountStatus} <span className={`font-bold ${accountStatus.colorClass}`}>{accountStatus.text}</span></p>
                {expiryInfo && <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">{expiryInfo}</p>}
            </div>

            {/* User Profile Form */}
            <div className="space-y-6 mb-8 border-b border-neutral-200 dark:border-neutral-800 pb-8">
                <div>
                    <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">{T_Profile.email}</label>
                    <input type="email" value={email} readOnly disabled className="w-full bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 cursor-not-allowed" />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">{T_Profile.fullName}</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none transition" />
                </div>

                <div className="pt-2">
                    <button onClick={handleSave} disabled={status.type === 'loading'} className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
                        {status.type === 'loading' ? <Spinner /> : T_Profile.save}
                    </button>
                    {status.message && <p className={`mt-2 text-center text-sm ${status.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{status.message}</p>}
                </div>
            </div>

            {/* Token Ultra Status Section (MOVED HERE) */}
            {!isLoadingUltra && ultraRegistration && (
                <div className="space-y-4 animate-zoomIn">
                    <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <ClockIcon className="w-5 h-5 text-primary-500" />
                        Token Ultra Status
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Status:</span>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                                ultraRegistration.status === 'active' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400'
                                : ultraRegistration.status === 'expired'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400'
                            }`}>
                                {ultraRegistration.status === 'active' ? 'Active' : ultraRegistration.status === 'expired' ? 'Expired' : 'Expiring Soon'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Active Until:</span>
                            <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300">
                                {new Date(ultraRegistration.expires_at).toLocaleDateString('en-GB', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                }).toUpperCase()}
                            </span>
                        </div>
                        
                        {ultraRegistration.status === 'expired' && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                                <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-red-800 dark:text-red-200 mb-1">YOUR TOKEN ULTRA HAS EXPIRED</p>
                                    <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">Please renew your token by submitting a new payment proof in the Token Ultra tab to continue using premium features.</p>
                                </div>
                            </div>
                        )}
                        {ultraRegistration.status === 'expiring_soon' && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
                                <InformationCircleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-yellow-800 dark:text-yellow-200 mb-1">TOKEN ULTRA EXPIRING SOON</p>
                                    <p className="text-[11px] text-yellow-700 dark:text-yellow-300 leading-relaxed">Your token will expire soon. Please renew early in the Token Ultra tab to avoid any service interruption.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface CacheManagerPanelProps {
    currentUser: User;
}

const CacheManagerPanel: React.FC<CacheManagerPanelProps> = ({ currentUser }) => {
    const T = getTranslations().settingsView.cache;
  const [stats, setStats] = useState<{
    size: string;
    count: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const formattedStats = await getFormattedCacheStats();
      setStats(formattedStats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleClearCache = async () => {
    if (!confirm(T.confirmClear)) {
      return;
    }

    setIsClearing(true);
    try {
      await clearVideoCache();
      await loadStats();
      alert(T.clearSuccess);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert(T.clearFail);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm h-full border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3 mb-6">
          <DatabaseIcon className="w-8 h-8 text-primary-500" />
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">{T.title}</h2>
            <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400">
              {T.subtitle}
            </p>
          </div>
        </div>

        {/* Usage Statistics / Credits */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 border-b border-neutral-200 dark:border-neutral-800 pb-6">
            <div className="p-3 sm:p-4 bg-neutral-50 dark:bg-neutral-800/30 border-[0.5px] border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between transition-all hover:border-blue-200 dark:hover:border-blue-900/50">
                <div>
                    <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Images Generated</p>
                    <p className="text-xl sm:text-2xl font-bold text-neutral-800 dark:text-neutral-200">{currentUser.totalImage || 0}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
            </div>
            <div className="p-3 sm:p-4 bg-neutral-50 dark:bg-neutral-800/30 border-[0.5px] border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between transition-all hover:border-purple-200 dark:hover:border-purple-900/50">
                <div>
                    <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Videos Generated</p>
                    <p className="text-xl sm:text-2xl font-bold text-neutral-800 dark:text-neutral-200">{currentUser.totalVideo || 0}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
            </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-neutral-50 dark:bg-neutral-800/30 border-[0.5px] border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between transition-all hover:border-green-200 dark:hover:border-green-900/50">
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">{T.storageUsed}</p>
                  <p className="text-xl sm:text-2xl font-bold text-neutral-800 dark:text-neutral-200">{stats.size}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <DatabaseIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="p-3 sm:p-4 bg-neutral-50 dark:bg-neutral-800/30 border-[0.5px] border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between transition-all hover:border-purple-200 dark:hover:border-purple-900/50">
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">{T.videosCached}</p>
                  <p className="text-xl sm:text-2xl font-bold text-neutral-800 dark:text-neutral-200">{stats.count}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>
            
            <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border-[0.5px] border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="text-[11px] sm:text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {T.howItWorks}
              </h3>
              <ul className="text-[11px] sm:text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <li>{T.l1}</li>
                <li>{T.l2}</li>
                <li>{T.l3}</li>
                <li>{T.l4}</li>
              </ul>
            </div>

            <div className="flex gap-3 w-full">
              <button onClick={loadStats} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold py-2 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50">
                <RefreshCwIcon className="w-4 h-4" /> {T.refresh}
              </button>
              <button onClick={handleClearCache} disabled={isClearing || stats.count === 0} className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isClearing ? (<><Spinner /> {T.clearing}</>) : (<><TrashIcon className="w-4 h-4" /> {T.clear}</>)}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">{T.failLoad}</div>
        )}
      </div>
  );
};

const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, tempApiKey, onUserUpdate, language, setLanguage, veoTokenRefreshedAt, assignTokenProcess, onOpenChangeServerModal }) => {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');
    const tabs = getTabs();

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <ProfilePanel 
                            currentUser={currentUser} 
                            onUserUpdate={onUserUpdate} 
                            language={language} 
                            setLanguage={setLanguage}
                            assignTokenProcess={assignTokenProcess}
                        />
                        <div className="h-full">
                            <CacheManagerPanel currentUser={currentUser} />
                        </div>
                    </div>
                );
            case 'flowLogin':
                return (
                    <div className="w-full">
                        <FlowLogin 
                            currentUser={currentUser}
                            onUserUpdate={onUserUpdate}
                            onOpenChangeServerModal={onOpenChangeServerModal}
                        />
                    </div>
                );
            case 'registerTokenUltra':
                return (
                    <div className="w-full">
                        <RegisterTokenUltra 
                            currentUser={currentUser}
                            onUserUpdate={onUserUpdate}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 mb-6 flex justify-center">
                <Tabs 
                    tabs={tabs}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
                {renderContent()}
            </div>
        </div>
    );
};

export default SettingsView;
