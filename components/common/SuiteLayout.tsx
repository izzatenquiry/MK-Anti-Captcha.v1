
import React from 'react';

interface SuiteLayoutProps {
    title: string;
    subtitle?: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}

const SuiteLayout: React.FC<SuiteLayoutProps> = ({ title, subtitle, icon: Icon, children }) => {
    return (
        <div className="w-full max-w-[1600px] mx-auto flex flex-col md:pb-6 relative">
            {/* Content Container - Holo Card */}
            {/* UPDATED: Removed fixed h-full and overflow-hidden to allow content to expand */}
            <div className="flex-1 holo-card p-3 sm:p-4 lg:p-6 flex flex-col relative z-10 animate-zoomIn" style={{ animationDelay: '100ms' }}>
                {/* Subtle grid pattern overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                
                <div className="relative z-10 flex flex-col h-full">
                    {children}
                </div>
            </div>
            
            {/* Background Decorations (Orbs) */}
            <div className="fixed top-20 right-0 w-[500px] h-[500px] bg-brand-start/10 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse-slow"></div>
            <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-brand-end/10 rounded-full blur-[100px] -z-10 pointer-events-none animate-float"></div>
        </div>
    );
};

export default SuiteLayout;
