
import React from 'react';
import { type View, type User } from '../types';
import { 
    HomeIcon, 
    ImageIcon, 
    VideoIcon, 
    FileTextIcon, 
    SettingsIcon, 
    LibraryIcon, 
    GalleryIcon, 
    ShieldCheckIcon,
    LogoutIcon,
    XIcon,
    LogoIcon,
    UserIcon,
    RefreshCwIcon
} from './Icons';
import { getTranslations } from '../services/translations';

interface NavigationProps {
  activeView: View;
  setActiveView: (view: View) => void;
  currentUser: User;
  onLogout: () => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
}

const MAIN_NAV_ITEMS = [
  { id: 'home', icon: HomeIcon, label: 'Home' },
  { id: 'ai-text-suite', icon: FileTextIcon, label: 'Text' },
  { id: 'ai-image-suite', icon: ImageIcon, label: 'Image' },
  { id: 'ai-video-suite', icon: VideoIcon, label: 'Video' },
  { id: 'gallery', icon: GalleryIcon, label: 'Gallery' },
];

const SYSTEM_MODULES = [
    { id: 'ai-prompt-library-suite', icon: LibraryIcon, label: 'Library' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
];

const Navigation: React.FC<NavigationProps> = ({ 
    activeView, 
    setActiveView, 
    currentUser, 
    onLogout, 
    isMenuOpen,
    setIsMenuOpen 
}) => {
  const T = getTranslations().sidebar;

  // --- 2100 MOBILE FLOATING DOCK (Bottom) ---
  const MobileDock = () => (
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
      <div className="bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-2xl rounded-3xl px-4 h-20 flex items-center justify-between relative overflow-hidden border-[0.5px] border-neutral-200/80 dark:border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-50"></div>

        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className="relative z-10 flex flex-col items-center justify-center w-full h-full group"
            >
              <div className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
                  isActive 
                  ? 'bg-gradient-to-br from-brand-start to-brand-end text-white shadow-[0_0_15px_rgba(74,108,247,0.4)] scale-105' 
                  : 'text-neutral-600 dark:text-neutral-500 hover:text-primary-600 dark:hover:text-white'
              }`}>
                 <item.icon className="w-6 h-6" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // --- 2100 HOLO DRAWER (Side Menu) ---
  const HoloDrawer = () => (
    <>
        {/* Backdrop */}
        <div 
            className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
                isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`} 
            onClick={() => setIsMenuOpen(false)}
        />
        
        {/* Drawer Panel - Mobile optimized size (full width, height auto) */}
        <div className={`fixed top-4 right-4 bottom-auto left-4 w-auto bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-2xl rounded-3xl z-[70] transform transition-transform duration-300 cubic-bezier(0.2, 0.8, 0.2, 1) flex flex-col overflow-hidden border-[0.5px] border-neutral-200/80 dark:border-white/5 shadow-2xl ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-[120%]'
        }`}>
            {/* Header */}
            <div className="p-4 sm:p-6 border-b-[0.5px] border-neutral-200/80 dark:border-white/5 relative shrink-0">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-50"></div>
                <div className="flex justify-between items-center">
                    <LogoIcon className="w-24 sm:w-28 text-neutral-900 dark:text-white" />
                    <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Menu Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                
                {/* System Modules Section */}
                <div className="mb-6">
                    <div className="text-[10px] font-bold text-brand-start uppercase tracking-[0.2em] mb-3 px-2">System Modules</div>
                    <div className="space-y-1">
                        {SYSTEM_MODULES.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => { setActiveView(item.id as View); setIsMenuOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    activeView === item.id 
                                    ? 'bg-primary-100 dark:bg-white/10 text-primary-600 dark:text-white border-[0.5px] border-primary-300/80 dark:border-white/5' 
                                    : 'text-neutral-700 dark:text-white hover:bg-neutral-100 dark:hover:bg-white/5 border-[0.5px] border-transparent'
                                }`}
                            >
                                <item.icon className={`w-5 h-5 shrink-0 ${activeView === item.id ? 'text-primary-600 dark:text-white' : 'text-neutral-700 dark:text-white'}`} />
                                <span className={activeView === item.id ? 'text-primary-600 dark:text-white' : 'text-neutral-700 dark:text-white'}>{item.label}</span>
                            </button>
                        ))}

                        {currentUser.role === 'admin' && (
                            <button
                                onClick={() => { setActiveView('admin-suite'); setIsMenuOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    activeView === 'admin-suite' 
                                    ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-[0.5px] border-purple-500/30' 
                                    : 'text-neutral-700 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 border-[0.5px] border-transparent'
                                }`}
                            >
                                <ShieldCheckIcon className="w-5 h-5" />
                                Admin Suite
                            </button>
                        )}
                    </div>
                </div>

                {/* Profile Card */}
                <div className="mt-2 pt-4 border-t-[0.5px] border-neutral-200/80 dark:border-white/5">
                    <div className="bg-neutral-50 dark:bg-white/5 border-[0.5px] border-neutral-200/80 dark:border-white/5 rounded-2xl p-4 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-start to-brand-end p-[1px] shrink-0">
                                <div className="w-full h-full rounded-full bg-white dark:bg-black overflow-hidden flex items-center justify-center">
                                     {currentUser.avatarUrl ? (
                                        <img src={currentUser.avatarUrl} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="w-5 h-5 text-neutral-400 dark:text-neutral-400" />
                                    )}
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{currentUser.fullName || currentUser.username}</p>
                                <p className="text-[10px] text-brand-start uppercase tracking-wider font-semibold">{currentUser.status}</p>
                            </div>
                        </div>
                    </div>

                    {/* Refresh App Button - Mobile only */}
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-white border-[0.5px] border-neutral-200 dark:border-white/5 transition-all group mb-3"
                        title="Refresh App"
                    >
                        <RefreshCwIcon className="w-4 h-4 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                        <span className="text-xs font-bold uppercase tracking-wider group-hover:text-primary-600 dark:group-hover:text-primary-400">Refresh App</span>
                    </button>

                    {/* Disconnect Button */}
                    <button 
                        onClick={onLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30 text-red-600 dark:text-red-400 border-[0.5px] border-red-200 dark:border-red-600/30 transition-all group"
                    >
                        <LogoutIcon className="w-4 h-4 group-hover:text-red-700 dark:group-hover:text-red-300" />
                        <span className="text-xs font-bold uppercase tracking-wider group-hover:text-red-700 dark:group-hover:text-red-300">Disconnect</span>
                    </button>
                </div>
            </div>
        </div>
    </>
  );

  // --- 2100 DESKTOP RAIL (Left) ---
  const DesktopRail = () => (
    <div className="hidden md:flex flex-col w-24 fixed left-4 top-4 bottom-4 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-2xl rounded-3xl z-40 border-[0.5px] border-neutral-200/80 dark:border-white/5 shadow-2xl items-center py-6">
        <div className="mb-8 shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-start to-brand-end rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(74,108,247,0.5)]">
                <span className="font-black text-white text-lg">M</span>
            </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 w-full px-2 overflow-y-auto custom-scrollbar no-scrollbar">
            {MAIN_NAV_ITEMS.map((item) => {
                 const isActive = activeView === item.id;
                 return (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id as View)}
                        className={`group relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 ${
                            isActive 
                            ? 'bg-primary-100 dark:bg-white/10 text-primary-600 dark:text-white shadow-inner border-[0.5px] border-primary-300/80 dark:border-white/5' 
                            : 'text-neutral-600 dark:text-neutral-500 hover:text-primary-600 dark:hover:text-white hover:bg-primary-50 dark:hover:bg-white/5'
                        }`}
                        title={item.label}
                    >
                        <item.icon className="w-6 h-6" />
                    </button>
                 );
            })}

            <div className="h-px w-1/2 bg-neutral-300 dark:bg-white/10 mx-auto my-2 shrink-0"></div>
            
            {SYSTEM_MODULES.map((item) => {
                 const isActive = activeView === item.id;
                 return (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id as View)}
                        className={`group relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 ${
                            isActive 
                            ? 'bg-primary-100 dark:bg-white/10 text-primary-600 dark:text-white border-[0.5px] border-primary-300/80 dark:border-white/5' 
                            : 'text-neutral-600 dark:text-neutral-500 hover:text-primary-600 dark:hover:text-white hover:bg-primary-50 dark:hover:bg-white/5'
                        }`}
                        title={item.label}
                    >
                        <item.icon className="w-5 h-5" />
                    </button>
                 );
            })}

            {currentUser.role === 'admin' && (
                <button
                    onClick={() => setActiveView('admin-suite')}
                    className={`group relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 ${
                        activeView === 'admin-suite'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-[0.5px] border-purple-300/80 dark:border-purple-700/50' 
                        : 'text-neutral-600 dark:text-neutral-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                    }`}
                    title="Admin Suite"
                >
                    <ShieldCheckIcon className="w-5 h-5" />
                </button>
            )}
        </div>

        <div className="mt-auto shrink-0 pt-4">
            <button 
                onClick={onLogout} 
                className="p-3 rounded-2xl text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-colors border-[0.5px] border-transparent hover:border-red-500/20"
                title="Disconnect"
            >
                <LogoutIcon className="w-5 h-5" />
            </button>
        </div>
    </div>
  );

  return (
    <>
      <DesktopRail />
      <MobileDock />
      <HoloDrawer />
    </>
  );
};

export default Navigation;
