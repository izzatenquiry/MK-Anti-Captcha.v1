
import React, { useState } from 'react';
import Tabs, { type Tab } from '../common/Tabs';
import MasterDashboardView from './MasterDashboardView';
import ETutorialAdminView from './ETutorialAdminView';
import FlowAccountView from './FlowAccountView';
import AdminDashboardView from './AdminDashboardView';
import { type User, type Language } from '../../types';

type AdminTabId = 'flowAccounts' | 'userDb' | 'server-status' | 'content-admin';

interface AdminSuiteViewProps {
    currentUser: User;
    language: Language;
}

const AdminSuiteView: React.FC<AdminSuiteViewProps> = ({ currentUser, language }) => {
    const [activeTab, setActiveTab] = useState<AdminTabId>('flowAccounts');

    const tabs: Tab<AdminTabId>[] = [
        { id: 'flowAccounts', label: 'Flow Account' },
        { id: 'userDb', label: 'User Database' },
        { id: 'server-status', label: 'Server Status' },
        { id: 'content-admin', label: 'Content Admin' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'flowAccounts':
                return <FlowAccountView language={language} />;
            case 'userDb':
                return <AdminDashboardView language={language} />;
            case 'server-status':
                return <MasterDashboardView currentUser={currentUser} language={language} />;
            case 'content-admin':
                return <ETutorialAdminView />;
            default:
                return null;
        }
    };

    return (
        <div className="h-auto lg:h-full flex flex-col">
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

export default AdminSuiteView;
