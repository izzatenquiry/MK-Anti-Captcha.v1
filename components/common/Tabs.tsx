
import React from 'react';

export interface Tab<T extends string> {
  id: T;
  label: string;
  adminOnly?: boolean;
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  activeTab: T;
  // FIX: Correctly typed the `setActiveTab` prop to be compatible with React's `useState` dispatcher (`React.Dispatch<React.SetStateAction<T>>`).
  setActiveTab: React.Dispatch<React.SetStateAction<T>>;
  isAdmin?: boolean;
}

const Tabs = <T extends string>({ tabs, activeTab, setActiveTab, isAdmin = false }: TabsProps<T>) => {
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);
  
  return (
    <div className="p-0.5 sm:p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center gap-0.5 sm:gap-1 overflow-x-auto border-[0.5px] border-neutral-200/80 dark:border-neutral-700/80 shadow-inner flex-nowrap">
        {visibleTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-2.5 text-sm sm:text-sm lg:text-base font-semibold rounded-xl transition-all duration-300 whitespace-nowrap relative z-10 ${
                    activeTab === tab.id
                        ? 'bg-primary-600 dark:bg-primary-700 text-white shadow-md ring-[0.5px] ring-primary-700/50 dark:ring-primary-600/50'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}>
                {tab.label}
                {tab.count !== undefined && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-neutral-200 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-400'}`}>{tab.count}</span>
                )}
            </button>
        ))}
    </div>
  );
};

export default Tabs;