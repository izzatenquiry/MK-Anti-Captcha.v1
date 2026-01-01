
import React, { useState, useEffect, useRef } from 'react';
import eventBus from '../services/eventBus';
import { XIcon, TrashIcon, TerminalIcon } from './Icons';
import { getTranslations } from '../services/translations';

interface LogEntry {
  level: 'log' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
}

interface ConsoleLogSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConsoleLogSidebar: React.FC<ConsoleLogSidebarProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const T = getTranslations().consoleLogSidebar;

  useEffect(() => {
    const handleLog = (data: LogEntry) => {
      setLogs(prevLogs => [...prevLogs, data].slice(-200));
    };
    eventBus.on('consoleLog', handleLog);
    return () => {
      eventBus.remove('consoleLog', handleLog);
    };
  }, []);

  // Handle scroll events to detect if user manually scrolled
  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If user scrolled to bottom (within 50px), enable auto-scroll
      shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom when new logs arrive (only if user hasn't scrolled up)
  useEffect(() => {
    if (logContainerRef.current && shouldAutoScrollRef.current) {
      const container = logContainerRef.current;
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [logs]);

  const clearLogs = () => setLogs([]);

  const getLevelColor = (level: LogEntry['level']) => {
      switch(level) {
          case 'error': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50';
          case 'warn': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50';
          case 'debug': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50';
          default: return 'text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-white/5';
      }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Panel - Full width for mobile, 30% for desktop */}
      <aside
        className={`fixed top-4 bottom-4 z-[70]
                   left-4 right-4 w-auto md:left-auto md:right-4 md:w-[30%] md:max-w-md
                   bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-2xl border-[0.5px] border-neutral-200/80 dark:border-white/5 shadow-2xl rounded-3xl
                   flex flex-col overflow-hidden transition-transform duration-300 cubic-bezier(0.2, 0.8, 0.2, 1)
                   ${isOpen ? 'translate-x-0' : 'translate-x-[120%]'}
                   `}
      >
        {/* Header Decoration */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-50"></div>

        <div className="flex flex-col h-full p-4 sm:p-6 min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0 border-b-[0.5px] border-neutral-200/80 dark:border-white/5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-white/10 rounded-lg">
                        <TerminalIcon className="w-5 h-5 text-primary-600 dark:text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">System Activity Log</h2>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Real-time status updates from the AI engine.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={clearLogs} 
                        className="p-2 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        title="Clear"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Log Container */}
            <div 
                ref={logContainerRef} 
                className="flex-1 overflow-y-auto custom-scrollbar bg-neutral-50 dark:bg-black/40 rounded-2xl border-[0.5px] border-neutral-200/80 dark:border-white/5 p-3 sm:p-4 space-y-2 min-h-0"
            >
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400 dark:text-neutral-600">
                        <TerminalIcon className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-xs italic">Console output will appear here.</p>
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className={`p-3 rounded-xl border-[0.5px] text-[10px] sm:text-xs font-mono break-words ${getLevelColor(log.level)}`}>
                            <div className="flex justify-between items-center opacity-70 mb-1">
                                <span className="font-bold uppercase tracking-wider">{log.level}</span>
                                <span>{log.timestamp.toLocaleTimeString()}</span>
                            </div>
                            <div className="whitespace-pre-wrap leading-relaxed">{log.message}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </aside>
    </>
  );
};

export default ConsoleLogSidebar;
