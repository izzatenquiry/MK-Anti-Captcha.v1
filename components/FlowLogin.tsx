
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { saveUserPersonalAuthToken, saveUserRecaptchaToken, hasActiveTokenUltra, getMasterRecaptchaToken, getTokenUltraRegistration, getEmailFromPoolByCode, getUserProfile } from '../services/userService';
import { type User } from '../types';
import { KeyIcon, CheckCircleIcon, XIcon, AlertTriangleIcon, InformationCircleIcon, EyeIcon, EyeOffIcon, SparklesIcon, ClipboardIcon, ServerIcon, UserIcon } from './Icons';
import Spinner from './common/Spinner';
import { getTranslations } from '../services/translations';
import { runComprehensiveTokenTest, type TokenTestResult } from '../services/imagenV3Service';
import { testAntiCaptchaKey } from '../services/antiCaptchaService';
import eventBus from '../services/eventBus';

interface FlowLoginProps {
    currentUser?: User | null;
    onUserUpdate?: (user: User) => void;
    onOpenChangeServerModal?: () => void;
}

const FlowLogin: React.FC<FlowLoginProps> = ({ currentUser, onUserUpdate, onOpenChangeServerModal }) => {
    const [flowToken, setFlowToken] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing'>('idle');
    const [testResults, setTestResults] = useState<TokenTestResult[] | null>(null);
    const [tokenSaved, setTokenSaved] = useState(false);
    
    const saveTimeoutRef = useRef<any>(null);
    const recaptchaSaveTimeoutRef = useRef<any>(null);
    const isInitialMount = useRef(true);
    const T = getTranslations().settingsView;
    const T_Api = T.api;

    // Shared API Key State
    const [activeApiKey, setActiveApiKey] = useState<string | null>(null);

    // Anti-Captcha State
    const [antiCaptchaApiKey, setAntiCaptchaApiKey] = useState('');
    const [antiCaptchaProjectId, setAntiCaptchaProjectId] = useState(() => {
        return localStorage.getItem('antiCaptchaProjectId') || '';
    });
    const [showAntiCaptchaKey, setShowAntiCaptchaKey] = useState(false);
    const [antiCaptchaTestStatus, setAntiCaptchaTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [antiCaptchaTestMessage, setAntiCaptchaTestMessage] = useState<string>('');
    const [recaptchaTokenSaved, setRecaptchaTokenSaved] = useState(false);
    const [isSavingRecaptcha, setIsSavingRecaptcha] = useState(false);
    
    // Token Ultra Credentials State
    const [tokenUltraRegistration, setTokenUltraRegistration] = useState<any>(null);
    const [emailDetails, setEmailDetails] = useState<{ email: string; password: string } | null>(null);
    const [showUltraPassword, setShowUltraPassword] = useState(false);
    const [copiedUltraEmail, setCopiedUltraEmail] = useState(false);
    const [copiedUltraPassword, setCopiedUltraPassword] = useState(false);
    
    // Server State
    const [currentServer, setCurrentServer] = useState<string | null>(null);
    
    const fetchCurrentServer = useCallback(() => {
        const server = sessionStorage.getItem('selectedProxyServer');
        setCurrentServer(server);
    }, []);

    useEffect(() => {
        fetchCurrentServer();
        setActiveApiKey(sessionStorage.getItem('monoklix_session_api_key'));
        
        const handleServerChanged = () => fetchCurrentServer();
        eventBus.on('serverChanged', handleServerChanged);
        
        return () => {
            eventBus.remove('serverChanged', handleServerChanged);
        };
    }, [fetchCurrentServer]);
    
    // Synchronize states with currentUser
    useEffect(() => {
        if (!currentUser) return;
        
        if (currentUser.personalAuthToken) {
            setFlowToken(currentUser.personalAuthToken);
        }
        
        const resolveAntiCaptchaKey = async () => {
            const cachedUltraStatus = sessionStorage.getItem(`token_ultra_active_${currentUser.id}`);
            if (cachedUltraStatus === 'true') {
                const cachedMasterToken = sessionStorage.getItem('master_recaptcha_token');
                if (cachedMasterToken && cachedMasterToken.trim()) {
                    setAntiCaptchaApiKey(cachedMasterToken);
                    return;
                }
                
                const masterTokenResult = await getMasterRecaptchaToken();
                if (masterTokenResult.success && masterTokenResult.apiKey) {
                    setAntiCaptchaApiKey(masterTokenResult.apiKey);
                    return;
                }
            }
            
            if (currentUser.recaptchaToken) {
                setAntiCaptchaApiKey(currentUser.recaptchaToken);
                return;
            }

            setAntiCaptchaApiKey('');
        };
        
        resolveAntiCaptchaKey();
        
        // Load Token Ultra details
        const loadTokenUltraDetails = async () => {
            const regResult = await getTokenUltraRegistration(currentUser.id);
            if (regResult.success && regResult.registration) {
                setTokenUltraRegistration(regResult.registration);
                if (regResult.registration.email_code) {
                    const emailResult = await getEmailFromPoolByCode(regResult.registration.email_code);
                    if (emailResult.success) {
                        setEmailDetails({ email: emailResult.email, password: emailResult.password });
                    }
                }
            }
        };
        loadTokenUltraDetails();
        
        if (isInitialMount.current) isInitialMount.current = false;
    }, [currentUser?.personalAuthToken, currentUser?.recaptchaToken, currentUser?.id]);

    // Auto-save Flow Token
    useEffect(() => {
        if (isInitialMount.current || !currentUser || !flowToken.trim() || flowToken.trim() === currentUser?.personalAuthToken) {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            return;
        }

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                setIsSaving(true);
                const result = await saveUserPersonalAuthToken(currentUser.id, flowToken.trim());
                if (result.success) {
                    setTokenSaved(true);
                    if (onUserUpdate) onUserUpdate(result.user);
                    setTimeout(() => setTokenSaved(false), 3000);
                }
            } catch (err) {
                console.error("Auto-save Flow Token failed", err);
            } finally {
                setIsSaving(false);
            }
        }, 2000);

        return () => clearTimeout(saveTimeoutRef.current as any);
    }, [flowToken, currentUser, onUserUpdate]);

    // Auto-save Anti-Captcha Key
    useEffect(() => {
        if (isInitialMount.current || !currentUser || !antiCaptchaApiKey.trim()) return;

        const isUnchanged = async () => {
            const cachedUltraStatus = sessionStorage.getItem(`token_ultra_active_${currentUser.id}`);
            if (cachedUltraStatus === 'true') {
                const cachedMasterToken = sessionStorage.getItem('master_recaptcha_token');
                return antiCaptchaApiKey.trim() === (cachedMasterToken || '');
            }
            return antiCaptchaApiKey.trim() === (currentUser.recaptchaToken || '');
        };

        isUnchanged().then(unchanged => {
            if (unchanged) return;

            if (recaptchaSaveTimeoutRef.current) clearTimeout(recaptchaSaveTimeoutRef.current);

            recaptchaSaveTimeoutRef.current = setTimeout(async () => {
                try {
                    setIsSavingRecaptcha(true);
                    const result = await saveUserRecaptchaToken(currentUser.id, antiCaptchaApiKey.trim());
                    if (result.success) {
                        setRecaptchaTokenSaved(true);
                        if (onUserUpdate) onUserUpdate(result.user);
                        setTimeout(() => setRecaptchaTokenSaved(false), 3000);
                    }
                } catch (err) {
                    console.error("Auto-save Anti-Captcha failed", err);
                } finally {
                    setIsSavingRecaptcha(false);
                }
            }, 2000);
        });

        return () => clearTimeout(recaptchaSaveTimeoutRef.current as any);
    }, [antiCaptchaApiKey, currentUser, onUserUpdate]);

    useEffect(() => {
        localStorage.setItem('antiCaptchaProjectId', antiCaptchaProjectId);
    }, [antiCaptchaProjectId]);

    const handleTestAntiCaptcha = async () => {
        if (!antiCaptchaApiKey.trim()) return;
        setAntiCaptchaTestStatus('testing');
        setAntiCaptchaTestMessage('Testing API key...');
        try {
            const result = await testAntiCaptchaKey(antiCaptchaApiKey.trim());
            if (result.valid) {
                setAntiCaptchaTestStatus('success');
                setAntiCaptchaTestMessage('✅ API key is valid!');
            } else {
                setAntiCaptchaTestStatus('error');
                setAntiCaptchaTestMessage(`❌ ${result.error || 'Invalid API key'}`);
            }
        } catch (error) {
            setAntiCaptchaTestStatus('error');
            setAntiCaptchaTestMessage('❌ Test failed');
        }
        setTimeout(() => { setAntiCaptchaTestStatus('idle'); setAntiCaptchaTestMessage(''); }, 5000);
    };

    const handleCopyUltraEmail = () => {
        if (emailDetails?.email) {
            navigator.clipboard.writeText(emailDetails.email);
            setCopiedUltraEmail(true);
            setTimeout(() => setCopiedUltraEmail(false), 2000);
        }
    };

    const handleCopyUltraPassword = () => {
        if (emailDetails?.password) {
            navigator.clipboard.writeText(emailDetails.password);
            setCopiedUltraPassword(true);
            setTimeout(() => setCopiedUltraPassword(false), 2000);
        }
    };

    const handleOpenFlow = () => window.open('https://labs.google/fx/tools/flow', '_blank');
    const handleGetToken = () => window.open('https://labs.google/fx/api/auth/session', '_blank');

    const handleTestToken = useCallback(async () => {
        const tokenToTest = flowToken.trim() || currentUser?.personalAuthToken;
        if (!tokenToTest) return;
        setTestStatus('testing');
        setTestResults(null);
        try {
            const results = await runComprehensiveTokenTest(tokenToTest);
            setTestResults(results);
        } catch (err) {
            setError('Test failed');
        } finally {
            setTestStatus('idle');
        }
    }, [flowToken, currentUser?.personalAuthToken]);

    if (!currentUser) return null;

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Left Panel: Flow Login */}
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm p-6 h-full overflow-y-auto border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                            <KeyIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Flow Login</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage your manual authentication tokens</p>
                        </div>
                    </div>

                    {/* How to Get Token Instructions (MOVED TO TOP) */}
                    <div className="mb-6">
                        <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-[0.5px] border-blue-200 dark:border-blue-800">
                            <InformationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="text-[11px] sm:text-xs text-blue-800 dark:text-blue-200">
                                <p className="text-[11px] sm:text-xs font-bold mb-2 uppercase tracking-wide">How to get your Flow Token:</p>
                                <ol className="text-[11px] sm:text-xs space-y-1.5 list-decimal list-inside font-medium">
                                    <li>Click "Login Google Flow" and sign in</li>
                                    <li>Click "Get Token" to open the API session page</li>
                                    <li>Copy the token from the JSON response</li>
                                    <li>Paste it below - it will auto-save</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {/* Token Ultra Credentials Box (NOW BELOW INSTRUCTIONS) */}
                    {emailDetails && (
                        <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 animate-zoomIn">
                            <div className="flex items-center gap-2 mb-3">
                                <SparklesIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <h3 className="text-sm font-bold text-purple-900 dark:text-purple-100">
                                    Ultra AI Account Details
                                    {tokenUltraRegistration?.email_code && (
                                        <span className="text-sm font-bold text-purple-900 dark:text-purple-100"> ({tokenUltraRegistration.email_code})</span>
                                    )}
                                </h3>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest mb-1">Assigned Email</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 font-mono text-xs p-2 bg-white dark:bg-black/40 rounded border border-purple-200 dark:border-purple-800 truncate">
                                            {emailDetails.email}
                                        </div>
                                        <button onClick={handleCopyUltraEmail} className="p-2 bg-purple-100 dark:bg-purple-800 rounded hover:bg-purple-200 transition-colors">
                                            {copiedUltraEmail ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <ClipboardIcon className="w-4 h-4 text-purple-600 dark:text-purple-300" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest mb-1">Password</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 font-mono text-xs p-2 bg-white dark:bg-black/40 rounded border border-purple-200 dark:border-purple-800 truncate">
                                            {showUltraPassword ? emailDetails.password : '••••••••••••'}
                                        </div>
                                        <button onClick={() => setShowUltraPassword(!showUltraPassword)} className="p-2 bg-purple-100 dark:bg-purple-800 rounded">
                                            {showUltraPassword ? <EyeOffIcon className="w-4 h-4 text-purple-600" /> : <EyeIcon className="w-4 h-4 text-purple-600" />}
                                        </button>
                                        <button onClick={handleCopyUltraPassword} className="p-2 bg-purple-100 dark:bg-purple-800 rounded hover:bg-purple-200 transition-colors">
                                            {copiedUltraPassword ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <ClipboardIcon className="w-4 h-4 text-purple-600 dark:text-purple-300" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* ENHANCED FOCUS TEXT */}
                            <div className="mt-4 p-2 bg-red-50 dark:bg-red-900/30 rounded border border-red-100 dark:border-red-800 flex items-center justify-center gap-2">
                                <InformationCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                                <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wide">
                                    Use these credentials to log in to Google Flow.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="flow-token" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Personal Token (Flow Token)</label>
                            <div className="relative">
                                <input id="flow-token" type={showToken ? 'text' : 'password'} value={flowToken} onChange={(e) => setFlowToken(e.target.value)} placeholder="Paste your Flow token here" className="w-full px-4 py-3 pr-20 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm" />
                                <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
                                    {tokenSaved && flowToken.trim() && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Saved</span>}
                                    {isSaving && <Spinner />}
                                    <button type="button" onClick={() => setShowToken(!showToken)} className="px-3 flex items-center text-neutral-500 hover:text-neutral-700">
                                        {showToken ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">Token used for image/video generation requests</p>
                        </div>

                        {testStatus === 'testing' && <div className="flex items-center gap-2 text-sm text-neutral-500"><Spinner /> {T_Api.testing}</div>}
                        {testResults && (
                            <div className="space-y-2">
                                {testResults.map(result => (
                                    <div key={result.service} className={`flex items-start gap-2 text-sm p-2 rounded-md ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                        {result.success ? <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"/> : <XIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>}
                                        <div>
                                            <span className={`font-semibold ${result.success ? 'text-green-800 dark:text-green-200' : 'text-red-700 dark:text-red-300'}`}>{result.service} Service</span>
                                            <p className={`text-xs ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>{result.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-3">
                            <button onClick={handleOpenFlow} className="w-full flex items-center justify-center gap-2 bg-neutral-300 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-neutral-400 dark:hover:bg-neutral-700 transition-colors shadow-sm">Login Google Flow</button>
                            <button onClick={handleGetToken} className="w-full flex items-center justify-center gap-2 bg-primary-600 dark:bg-primary-700 text-white text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors">Get Token</button>
                            <button onClick={handleTestToken} disabled={(!flowToken.trim() && !currentUser?.personalAuthToken) || testStatus === 'testing'} className="w-full flex items-center justify-center gap-2 bg-blue-600 dark:bg-blue-700 text-white text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">{testStatus === 'testing' ? <Spinner /> : <SparklesIcon className="w-4 h-4" />}Health Test</button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: API & Anti-Captcha & Server Configuration */}
                <div className="flex flex-col gap-6">
                    {/* MONOklix API Keys Panel */}
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-base sm:text-lg font-bold mb-4 text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-primary-500" />
                            {T_Api.title}
                        </h3>
                        
                        <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-[0.5px] border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2 sm:gap-3">
                                <InformationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <p className="text-[11px] sm:text-xs text-blue-800 dark:text-blue-200">
                                    {T_Api.description}
                                </p>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-sm font-medium">
                                <span className="text-neutral-600 dark:text-neutral-400">{T_Api.sharedStatus}</span>
                                {activeApiKey ? (
                                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                        <CheckCircleIcon className="w-4 h-4" />
                                        {T_Api.connected}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-red-500">
                                        <XIcon className="w-4 h-4" />
                                        {T_Api.notLoaded}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Anti-Captcha Panel */}
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm h-auto overflow-y-auto border border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-base sm:text-lg font-bold mb-4 text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                            <KeyIcon className="w-5 h-5 text-primary-500" />
                            Anti-Captcha Configuration
                        </h3>

                        <div className="p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-[0.5px] border-yellow-200 dark:border-yellow-800 mb-4">
                            <div className="flex items-start gap-2 sm:gap-3">
                                <InformationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div className="text-[11px] sm:text-xs text-yellow-800 dark:text-blue-200">
                                    <p className="text-[11px] sm:text-xs font-semibold mb-1">Required for Generation • Main Input</p>
                                    <p className="text-[11px] sm:text-xs">Google requires reCAPTCHA solving. This key allows the system to auto-solve it via <a href="https://anti-captcha.com" target="_blank" className="underline">anti-captcha.com</a>.</p>
                                    <p className="text-[11px] sm:text-xs mt-1.5 font-medium">💡 This is the primary input for your Anti-Captcha API key. Token auto-saves when you type.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Anti-Captcha API Key</label>
                                <div className="relative">
                                    <input type={showAntiCaptchaKey ? 'text' : 'password'} value={antiCaptchaApiKey} onChange={(e) => setAntiCaptchaApiKey(e.target.value)} placeholder="Enter your anti-captcha.com API key" className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2.5 pr-10 focus:ring-2 focus:ring-primary-500 font-mono text-sm" />
                                    <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
                                        {recaptchaTokenSaved && antiCaptchaApiKey.trim() && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Saved</span>}
                                        {isSavingRecaptcha && <Spinner />}
                                        <button onClick={() => setShowAntiCaptchaKey(!showAntiCaptchaKey)} className="px-3 flex items-center text-neutral-500 hover:text-neutral-700">
                                            {showAntiCaptchaKey ? <EyeOffIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-500 mt-1">Token is auto-saved upon change.</p>
                            </div>

                            <div className="w-full space-y-2">
                                <button onClick={handleTestAntiCaptcha} disabled={!antiCaptchaApiKey || antiCaptchaTestStatus === 'testing'} className="w-full px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {antiCaptchaTestStatus === 'testing' ? <Spinner /> : <SparklesIcon className="w-4 h-4" />}Test API Key
                                </button>
                                {antiCaptchaTestMessage && <span className={`text-sm font-medium ${antiCaptchaTestStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>{antiCaptchaTestMessage}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Server Configuration Panel */}
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-base sm:text-lg font-bold mb-4 text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                            <ServerIcon className="w-5 h-5 text-primary-500" />
                            Generation Server
                        </h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Choose the backend server for processing your requests. Switching servers can help if one is slow or overloaded.</p>
                        
                        <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 flex items-center justify-between transition-all">
                            <div className="min-w-0 flex-1 mr-4">
                                <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">Status: Connected to</p>
                                <p className="font-mono text-sm text-primary-600 dark:text-primary-400 truncate">
                                    {currentServer ? currentServer.replace('https://', '').toUpperCase() : 'NOT CONFIGURED'}
                                </p>
                            </div>
                            <button 
                                onClick={onOpenChangeServerModal}
                                className="px-4 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-all shadow-md hover:shadow-primary-500/20 active:scale-95 shrink-0"
                            >
                                Change Server
                            </button>
                        </div>
                        
                        <div className="mt-4 flex items-start gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                            <InformationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>Tip: iOS users are recommended to use servers labeled <b>S1, S2, S3, S4, or S6</b> for optimal compatibility.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlowLogin;
