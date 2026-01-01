
import React, { useState, useEffect } from 'react';
import { LogoIcon, SparklesIcon } from './components/Icons';
import { loginUser } from './services/userService';
import Spinner from './components/common/Spinner';
import { type User } from './types';
import { APP_VERSION } from './services/appConfig';
import { getTranslations } from './services/translations';
import { loadData } from './services/indexedDBService';

interface LoginPageProps {
    onLoginSuccess: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState('light'); // Default to light
    const T = getTranslations().loginPage;
    const commonT = getTranslations().common;

    // Load theme from localStorage
    useEffect(() => {
        const loadTheme = async () => {
            const savedTheme = await loadData<string>('theme');
            if (savedTheme) {
                setTheme(savedTheme);
            } else {
                setTheme('light'); // Default to light
            }
        };
        loadTheme();
    }, []);

    // Apply theme to document
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme]);
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        
        const result = await loginUser(email);
        
        if (result.success === true) {
            onLoginSuccess(result.user);
        } else {
            const errorKey = result.message as keyof typeof commonT.errors;
            setError(commonT.errors[errorKey] || result.message);
        }
        setIsLoading(false);
    };

    return (
        <div className="relative flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-[#050505] overflow-hidden p-4">
            
            {/* Background Ambient Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-start/20 dark:bg-brand-start/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-end/10 dark:bg-brand-end/10 rounded-full blur-[120px] pointer-events-none animate-float"></div>

            {/* Login Card */}
            <div className="w-full max-w-md relative z-10">
                <div className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl border border-neutral-200 dark:border-white/10 rounded-3xl shadow-lg dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 sm:p-10 relative overflow-hidden">
                    
                    {/* Top Gradient Line Decoration */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-50"></div>

                    <div className="text-center mb-8">
                        <div className="inline-flex justify-center mb-6 filter drop-shadow-[0_0_15px_rgba(74,108,247,0.3)]">
                            <LogoIcon className="w-40 text-neutral-900 dark:text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                            {T.title}
                        </h1>
                         <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                            {T.subtitle}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-center">
                            <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}
                    
                    <form className="space-y-6" onSubmit={handleLogin}>
                         <div className="space-y-2">
                            <label htmlFor="email-input" className="text-xs font-bold text-neutral-600 dark:text-neutral-500 uppercase tracking-wider ml-1">Email Address</label>
                            <input
                                id="email-input"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-neutral-50 dark:bg-black/40 border border-neutral-300 dark:border-white/10 rounded-xl px-4 py-3.5 text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-start/50 focus:border-brand-start/50 transition-all font-medium"
                                placeholder={T.emailPlaceholder}
                                disabled={isLoading}
                             />
                        </div>
                       
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative w-full flex justify-center items-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-brand-start to-brand-end text-white font-bold shadow-[0_0_20px_rgba(74,108,247,0.3)] hover:shadow-[0_0_30px_rgba(74,108,247,0.5)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                            >
                                {isLoading ? <Spinner /> : (
                                    <>
                                        {T.loginButton}
                                        <SparklesIcon className="w-4 h-4 text-white/70" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-white/5 text-center">
                        <p className="text-xs text-neutral-600 dark:text-neutral-500 mb-4">{T.noAccount}</p>
                        <a
                            href="https://monoklix.com/step/checkout/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-block py-3 px-4 border border-neutral-300 dark:border-white/10 bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-xl text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all"
                        >
                            {T.registerButton}
                        </a>
                    </div>
                </div>
                
                 <p className="text-center text-[10px] text-neutral-500 dark:text-neutral-600 font-mono mt-6 uppercase tracking-widest">
                    System Secured • {APP_VERSION}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
