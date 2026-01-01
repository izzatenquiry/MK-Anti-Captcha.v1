
import React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { updateUserStatus, forceUserLogout, updateUserSubscription, saveUserPersonalAuthToken, removeUser, updateUserBatch02 } from '../../services/userService';
import { assignEmailCodeToUser, getAllFlowAccounts, resetEmailCodeFromUser, type FlowAccount } from '../../services/flowAccountService';
import { getAllTokenUltraRegistrations, type TokenUltraRegistrationWithUser } from '../../services/tokenUltraService';
import { type User, type UserStatus, type UserRole, type Language, type TokenUltraRegistration } from '../../types';
import { UsersIcon, XIcon, DownloadIcon, UploadIcon, CheckCircleIcon, AlertTriangleIcon, VideoIcon, TrashIcon, DatabaseIcon, KeyIcon, PencilIcon } from '../Icons';
import Spinner from '../common/Spinner';
import ConfirmationModal from '../common/ConfirmationModal';

const formatStatus = (user: User): { text: string; color: 'green' | 'yellow' | 'red' | 'blue' } => {
    switch(user.status) {
        case 'admin':
            return { text: 'Admin', color: 'blue' };
        case 'lifetime':
            return { text: 'Lifetime', color: 'green' };
        case 'subscription':
            return { text: 'Subscription', color: 'green' };
        case 'trial':
            return { text: 'Trial', color: 'yellow' };
        case 'inactive':
            return { text: 'Inactive', color: 'red' };
        default:
            return { text: 'Unknown', color: 'red' };
    }
};

const statusColors: Record<'green' | 'yellow' | 'red' | 'blue', string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    blue: 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300',
};

const TrialCountdown: React.FC<{ expiry: number }> = ({ expiry }) => {
    const calculateRemainingTime = useCallback(() => {
        const now = Date.now();
        const timeLeft = expiry - now;

        if (timeLeft <= 0) {
            return { text: 'Expired', color: 'red' as const };
        }

        const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
        const seconds = Math.floor((timeLeft / 1000) % 60);

        return { text: `Expires in ${minutes}m ${seconds}s`, color: 'yellow' as const };
    }, [expiry]);
    
    const [timeInfo, setTimeInfo] = useState(calculateRemainingTime());

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeInfo(calculateRemainingTime());
        }, 1000);

        return () => clearInterval(timer);
    }, [expiry, calculateRemainingTime]);

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[timeInfo.color]}`}>
            {timeInfo.text}
        </span>
    );
};

const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

interface AdminDashboardViewProps {
  language: Language;
}

const StatBox: React.FC<{ title: string; icon: React.ReactNode; data: { label: string; value: number }[]; total: number; color: string; }> = ({ title, icon, data, total, color }) => {
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h4 className="font-bold text-neutral-800 dark:text-neutral-200">{title}</h4>
            </div>
            <div className="space-y-3 text-sm overflow-y-auto custom-scrollbar pr-2 flex-1 max-h-48">
                {sortedData.length > 0 ? sortedData.map(({ label, value }) => {
                    const percentage = total > 0 ? (value / total) * 100 : 0;
                    return (
                        <div key={label}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-mono text-neutral-600 dark:text-neutral-400 truncate max-w-[60%]">{label}</span>
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{value}</span>
                            </div>
                            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                                <div 
                                    className={`h-1.5 rounded-full ${color}`}
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                }) : <p className="text-xs text-neutral-500">No active users.</p>}
            </div>
        </div>
    );
};

const UsageDashboard: React.FC<{ users: User[] }> = ({ users }) => {
    const stats = useMemo(() => {
        const now = new Date().getTime();
        const oneHour = 60 * 60 * 1000;
        
        const activeUsers = users.filter(user => 
            user.role !== 'admin' && user.lastSeenAt && (now - new Date(user.lastSeenAt).getTime()) < oneHour
        );
        const totalActive = activeUsers.length;

        const appVersionStats = activeUsers.reduce((acc, user) => {
            const version = user.appVersion || 'Unknown';
            acc[version] = (acc[version] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const proxyServerStats = activeUsers.reduce((acc, user) => {
            const server = user.proxyServer ? user.proxyServer.replace('https://', '').replace('.monoklix.com', '') : 'None';
            acc[server] = (acc[server] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const allNonAdminUsers = users.filter(u => u.role !== 'admin');
        const totalUsers = allNonAdminUsers.length;
        const batchStats = allNonAdminUsers.reduce((acc, user) => {
            if (user.batch_02 === 'batch_02') {
                acc.batch02 += 1;
            } else {
                acc.batch01 += 1;
            }
            return acc;
        }, { batch01: 0, batch02: 0 });

        return {
            appVersionData: Object.entries(appVersionStats).map(([label, value]) => ({ label, value })),
            proxyServerData: Object.entries(proxyServerStats).map(([label, value]) => ({ label, value })),
            batchData: [
                { label: 'Batch 01', value: batchStats.batch01 },
                { label: 'Batch 02', value: batchStats.batch02 }
            ],
            totalActive,
            totalUsers
        };
    }, [users]);
    
    return (
        <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-neutral-800 dark:text-neutral-200">Usage Dashboard</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatBox 
                    title="App Version (Active)" 
                    icon={<CheckCircleIcon className="w-5 h-5 text-green-500" />}
                    data={stats.appVersionData}
                    total={stats.totalActive}
                    color="bg-gradient-to-r from-green-400 to-green-600"
                />
                
                <StatBox 
                    title="Proxy Server (Active)" 
                    icon={<UsersIcon className="w-5 h-5 text-blue-500" />}
                    data={stats.proxyServerData}
                    total={stats.totalActive}
                    color="bg-gradient-to-r from-blue-400 to-blue-600"
                />

                <StatBox 
                    title="Batch Number (All Users)" 
                    icon={<DatabaseIcon className="w-5 h-5 text-purple-500" />}
                    data={stats.batchData}
                    total={stats.totalUsers}
                    color="bg-gradient-to-r from-purple-400 to-purple-600"
                />
            </div>
        </div>
    );
};


const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ language }) => {
    const [registrations, setRegistrations] = useState<TokenUltraRegistrationWithUser[] | null>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState<TokenUltraRegistrationWithUser | null>(null);
    const [newStatus, setNewStatus] = useState<UserStatus>('trial');
    const [subscriptionDuration, setSubscriptionDuration] = useState<1 | 6 | 12>(6);
    const [personalToken, setPersonalToken] = useState<string>('');
    const [batch02, setBatch02] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);
    const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
    const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
    const [isAssigningEmailCode, setIsAssigningEmailCode] = useState<string | null>(null);
    const [flowAccounts, setFlowAccounts] = useState<FlowAccount[]>([]);
    const [selectedFlowAccountCode, setSelectedFlowAccountCode] = useState<string>('');
    const [assignMode, setAssignMode] = useState<'auto' | 'manual'>('auto');

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const allRegistrations = await getAllTokenUltraRegistrations();
            // Removed sensitive data logging - only log count, not full data
            // console.log('Fetched registrations:', allRegistrations?.length || 0, allRegistrations);
            if (allRegistrations !== null) {
                setRegistrations(allRegistrations);
            } else {
                setRegistrations(null);
            }
        } catch (error) {
            console.error('Error fetching registrations:', error instanceof Error ? error.message : 'Unknown error');
            // Removed full error object logging to avoid exposing sensitive data
            setRegistrations(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Fetch flow accounts when modal opens (for both new assign and reassign)
    useEffect(() => {
        if (isModalOpen && selectedRegistration) {
            getAllFlowAccounts().then(accounts => {
                const availableAccounts = accounts
                    .filter(acc => acc.status === 'active' && acc.current_users_count < 10)
                    .sort((a, b) => {
                        // Sort by user count (ascending), then by code
                        if (a.current_users_count !== b.current_users_count) {
                            return a.current_users_count - b.current_users_count;
                        }
                        return a.code.localeCompare(b.code);
                    });
                setFlowAccounts(availableAccounts);
                if (availableAccounts.length > 0 && assignMode === 'auto') {
                    // Auto-select the account with lowest user count
                    setSelectedFlowAccountCode(availableAccounts[0].code);
                } else if (availableAccounts.length > 0 && assignMode === 'manual' && !selectedFlowAccountCode) {
                    // If manual mode and no selection, select first available
                    setSelectedFlowAccountCode(availableAccounts[0].code);
                }
            });
        }
    }, [isModalOpen, selectedRegistration, assignMode]);

    const openEditModal = (registration: TokenUltraRegistrationWithUser) => {
        setSelectedRegistration(registration);
        if (registration.user) {
            setNewStatus(registration.user.status as UserStatus);
            setSubscriptionDuration(6); // Default to 6 months
            setPersonalToken(registration.user.personal_auth_token || '');
        } else {
            setNewStatus('trial');
            setSubscriptionDuration(6);
            setPersonalToken('');
        }
        setBatch02('');
        setAssignMode('auto');
        setSelectedFlowAccountCode('');
        setIsModalOpen(true);
    };

    const veoAuthorizedUsersCount = useMemo(() => {
        if (!registrations) return 0;
        // Filter for users who have a non-empty, non-whitespace personal auth token.
        return registrations.filter(r => r.user?.personal_auth_token && r.user.personal_auth_token.trim()).length;
    }, [registrations]);


    const handleSaveChanges = async () => {
        if (!selectedRegistration || !selectedRegistration.user) return;
        setStatusMessage({ type: 'loading', message: 'Saving changes...' });

        // Status update logic with VEO check
        const statusPromise = new Promise<{ success: boolean, message?: string }>(async (resolve) => {
            const targetStatus = newStatus;
            const currentStatus = selectedRegistration.user.status as UserStatus;
            const isUpgradingToVeo = (targetStatus === 'lifetime' || targetStatus === 'subscription') &&
                                    (currentStatus !== 'lifetime' && currentStatus !== 'subscription');

            // Only block if we are upgrading a user who does NOT already have a token, and the limit is reached.
            if (isUpgradingToVeo && !selectedRegistration.user.personal_auth_token && veoAuthorizedUsersCount >= 4) {
                return resolve({ success: false, message: 'Cannot upgrade user status. Veo 3.0 authorization is limited to fewer than 5 users.' });
            }
            
            // Check if status actually needs to be updated
            if (targetStatus === currentStatus && targetStatus !== 'subscription') {
                return resolve({ success: true });
            }
            
            let success = false;
            if (targetStatus === 'subscription') {
                success = await updateUserSubscription(selectedRegistration.user_id, subscriptionDuration);
            } else {
                success = await updateUserStatus(selectedRegistration.user_id, targetStatus);
            }
            resolve({ success });
        });

        // Token update logic
        const tokenPromise = new Promise<{ success: boolean; message?: string }>(async (resolve) => {
            const currentToken = selectedRegistration.user.personal_auth_token || '';
            const newToken = personalToken.trim();
            if (newToken === currentToken) return resolve({ success: true });

            const result = await saveUserPersonalAuthToken(selectedRegistration.user_id, newToken || null);
            if (result.success === false) {
                resolve({ success: false, message: result.message });
            } else {
                resolve({ success: true });
            }
        });
        
        const batchPromise = updateUserBatch02(selectedRegistration.user_id, batch02.trim() || null);

        const [statusResult, tokenResult, batchResult] = await Promise.all([statusPromise, tokenPromise, batchPromise]);

        const errorMessages = [];
        if (!statusResult.success) {
            errorMessages.push(statusResult.message || 'Failed to update status.');
        }
        if (tokenResult.success === false) {
            errorMessages.push(tokenResult.message || 'Failed to update token.');
        }
        if (!batchResult) {
            errorMessages.push('Failed to update batch.');
        }

        if (errorMessages.length > 0) {
            setStatusMessage({ type: 'error', message: errorMessages.join(' ') });
        } else {
            setStatusMessage({ type: 'success', message: `User ${selectedRegistration.username} updated successfully.` });
            fetchUsers();
        }

        setIsModalOpen(false);
        setSelectedRegistration(null);
        setTimeout(() => setStatusMessage(null), 5000);
    };
    
    const handleForceLogout = () => {
        if (!selectedRegistration) return;
        setIsConfirmLogoutOpen(true);
    };

    const executeForceLogout = async () => {
        if (!selectedRegistration) return;
        
        if (await forceUserLogout(selectedRegistration.user_id)) {
            await fetchUsers();
            setStatusMessage({ type: 'success', message: `Session for ${selectedRegistration.username} has been terminated.` });
        } else {
             setStatusMessage({ type: 'error', message: 'Failed to terminate session.' });
        }
        setIsModalOpen(false);
        setIsConfirmLogoutOpen(false);
        setSelectedRegistration(null);
        setTimeout(() => setStatusMessage(null), 4000);
    };


const handleRemoveUser = () => {
        if (!selectedRegistration) return;
        setIsConfirmRemoveOpen(true);
    };
    
    const executeRemoveUser = async () => {
        if (!selectedRegistration) return;
        
        const result = await removeUser(selectedRegistration.user_id);
        if (result.success) {
            setStatusMessage({ type: 'success', message: `User ${selectedRegistration.username} has been removed.` });
            fetchUsers();
        } else {
             setStatusMessage({ type: 'error', message: `Failed to remove user: ${result.message}` });
        }
        setIsModalOpen(false);
        setIsConfirmRemoveOpen(false);
        setSelectedRegistration(null);
        setTimeout(() => setStatusMessage(null), 4000);
    };

    const filteredRegistrations = useMemo(() => {
        if (!registrations) return [];

        const now = new Date().getTime();
        const oneHour = 60 * 60 * 1000;
        
        let displayedRegistrations: TokenUltraRegistrationWithUser[];

        if (searchTerm.trim() === '') {
            // No search term, show all registrations
            displayedRegistrations = registrations;
        } else {
            // Search term exists, search in email, username, or telegram_id
            displayedRegistrations = registrations.filter(reg =>
                (reg.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (reg.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (reg.telegram_id || '').includes(searchTerm) ||
                (reg.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort by expires_at (most recent expiry first), then by created_at
        return displayedRegistrations.sort((a, b) => {
            const aExpires = new Date(a.expires_at).getTime();
            const bExpires = new Date(b.expires_at).getTime();
            return aExpires - bExpires; // Sort ascending (soonest expiry first)
        });
    }, [registrations, searchTerm]);
    
    const activeUsersCount = useMemo(() => {
        if (!registrations) return 0;
        const now = new Date().getTime();
        const oneHour = 60 * 60 * 1000;
        return registrations.filter(reg => 
            reg.user && reg.user.last_seen_at && (now - new Date(reg.user.last_seen_at).getTime()) < oneHour
        ).length;
    }, [registrations]);

    if (loading) {
        return <div>Loading registrations...</div>;
    }

    if (registrations === null) {
        return (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg" role="alert">
                <strong className="font-bold">Critical Error:</strong>
                <span className="block sm:inline"> The registration database is corrupt and could not be read. Please contact support.</span>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-2">Token Ultra Registrations</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Manage Token Ultra registrations and email codes.</p>
                
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <input
                        type="text"
                        placeholder="Search by username or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full max-w-sm bg-white dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                    />
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 font-semibold py-2 px-3 rounded-lg">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span>{activeUsersCount} Active Users</span>
                        </div>
                    </div>
                </div>

                 {statusMessage && (
                    <div className={`p-3 rounded-md mb-4 text-sm ${statusMessage.type === 'loading' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : statusMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'}`}>
                        {statusMessage.message}
                    </div>
                )}

                <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-inner">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-neutral-500 dark:text-neutral-400">
                            <thead className="text-xs text-neutral-700 uppercase bg-neutral-100 dark:bg-neutral-800/50 dark:text-neutral-400">
                                <tr>
                                    <th scope="col" className="px-4 py-3">#</th>
                                    <th scope="col" className="px-6 py-3">
                                        Email
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Email CODE
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Expired Date
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Last Login
                                    </th>
                                     <th scope="col" className="px-6 py-3">
                                        Version
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Device
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Server
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Token
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRegistrations.length > 0 ? (
                                    filteredRegistrations.map((reg, index) => {
                                        const registrationStatus = reg.status;
                                        const registrationStatusColors: Record<'active' | 'expired' | 'expiring_soon', string> = {
                                            active: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
                                            expired: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
                                            expiring_soon: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
                                        };
                                        
                                        let activeInfo: { text: string; color: 'green' | 'gray' | 'red'; fullDate: string; } = { text: 'Never', color: 'red', fullDate: 'N/A' };
                                        if (reg.user?.last_seen_at) {
                                            const lastSeenDate = new Date(reg.user.last_seen_at);
                                            const diffMinutes = (new Date().getTime() - lastSeenDate.getTime()) / (1000 * 60);
                                            if (diffMinutes < 60) {
                                                activeInfo = { text: 'Active now', color: 'green', fullDate: lastSeenDate.toLocaleString() };
                                            } else {
                                                activeInfo = { text: getTimeAgo(lastSeenDate), color: 'gray', fullDate: lastSeenDate.toLocaleString() };
                                            }
                                        }
                                        const activeStatusColors: Record<'green' | 'gray' | 'red', string> = {
                                            green: 'bg-green-500',
                                            gray: 'bg-neutral-400',
                                            red: 'bg-red-500',
                                        };

                                        const expiresAt = new Date(reg.expires_at);
                                        const isExpired = expiresAt < new Date();

                                        return (
                                            <tr key={reg.id} className="bg-white dark:bg-neutral-950 border-b dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                                                <td className="px-4 py-4 font-medium text-neutral-600 dark:text-neutral-400">{index + 1}</td>
                                                <th scope="row" className="px-6 py-4 font-medium text-neutral-900 whitespace-nowrap dark:text-white">
                                                    <div>{reg.username || reg.user?.full_name || '-'}</div>
                                                    <div className="text-xs text-neutral-500">{reg.email || reg.user?.email || '-'}</div>
                                                </th>
                                                <td className="px-6 py-4 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                                                    {reg.email_code || '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`text-sm ${isExpired ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-neutral-600 dark:text-neutral-400'}`}>
                                                        {expiresAt.toLocaleDateString()}
                                                        <div className="text-xs text-neutral-500">{expiresAt.toLocaleTimeString()}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2" title={`Last seen: ${activeInfo.fullDate}`}>
                                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeStatusColors[activeInfo.color]}`}></span>
                                                        <span>{activeInfo.text}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {reg.user?.app_version || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-mono text-neutral-600 dark:text-neutral-300">
                                                    {reg.user?.last_device || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-300">
                                                    {reg.user?.proxy_server ? reg.user.proxy_server.replace('https://', '').replace('.monoklix.com', '') : '-'}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                                                    {reg.user?.personal_auth_token ? `...${reg.user.personal_auth_token.slice(-6)}` : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${registrationStatusColors[registrationStatus]}`}>
                                                            {registrationStatus === 'active' ? 'Active' : registrationStatus === 'expired' ? 'Expired' : 'Expiring Soon'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={() => openEditModal(reg)}
                                                        className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                                        title="Edit registration"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="text-center py-10">
                                            {registrations.length > 0 ? (
                                                <div>
                                                    <p className="mt-2 font-semibold">No registrations found.</p>
                                                    <p className="text-xs">{searchTerm ? `No registrations match your search for "${searchTerm}".` : 'No registrations found.'}</p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <UsersIcon className="w-12 h-12 mx-auto text-neutral-400" />
                                                    <p className="mt-2 font-semibold">No Token Ultra registrations yet.</p>
                                                    <p className="text-xs">When users register for Token Ultra, they will appear here.</p>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {isModalOpen && selectedRegistration && createPortal(
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Edit User</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="mb-4 text-sm">Updating profile for <span className="font-semibold">{selectedRegistration.username}</span>.</p>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="status-select" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                    Account Status
                                </label>
                                <select
                                    id="status-select"
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                                    className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                >
                                    <option value="trial">Trial</option>
                                    <option value="subscription">Subscription</option>
                                    <option value="lifetime">Lifetime</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                             <div>
                                <label htmlFor="token-input" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                    Personal Auth Token
                                </label>
                                <input
                                    id="token-input"
                                    type="text"
                                    value={personalToken}
                                    onChange={(e) => setPersonalToken(e.target.value)}
                                    placeholder="User's personal __SESSION token"
                                    className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono text-xs"
                                />
                            </div>
                             {/* Assign Flow Account */}
                            {!selectedRegistration.email_code ? (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                        Flow Account
                                    </label>
                                    
                                    {/* Mode Toggle */}
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAssignMode('auto');
                                                if (flowAccounts.length > 0) {
                                                    // Find account with lowest user count
                                                    const sorted = [...flowAccounts].sort((a, b) => 
                                                        a.current_users_count - b.current_users_count
                                                    );
                                                    setSelectedFlowAccountCode(sorted[0].code);
                                                }
                                            }}
                                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                                                assignMode === 'auto'
                                                    ? 'bg-primary-600 text-white shadow-sm'
                                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                                            }`}
                                        >
                                            Auto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssignMode('manual')}
                                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                                                assignMode === 'manual'
                                                    ? 'bg-primary-600 text-white shadow-sm'
                                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                                            }`}
                                        >
                                            Manual
                                        </button>
                                    </div>

                                    {/* Manual Selection Dropdown */}
                                    {assignMode === 'manual' && (
                                        <div className="mb-3">
                                            <select
                                                value={selectedFlowAccountCode}
                                                onChange={(e) => setSelectedFlowAccountCode(e.target.value)}
                                                className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 text-sm"
                                            >
                                                <option value="">Select Flow Account</option>
                                                {flowAccounts.map(account => (
                                                    <option key={account.id} value={account.code}>
                                                        {account.code} - {account.email} ({account.current_users_count}/10)
                                                    </option>
                                                ))}
                                            </select>
                                            {flowAccounts.length === 0 && (
                                                <p className="text-xs text-red-500 mt-1">No available flow accounts. Add accounts in Flow Account tab.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Auto Mode Info */}
                                    {assignMode === 'auto' && flowAccounts.length > 0 && (
                                        <div className="mb-3 p-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded text-xs text-primary-800 dark:text-primary-200">
                                            Will assign to: <strong>{flowAccounts[0].code}</strong> ({flowAccounts[0].current_users_count}/10 users)
                                        </div>
                                    )}

                                    <button
                                        onClick={async () => {
                                            if (!selectedRegistration) return;
                                            
                                            if (assignMode === 'manual' && !selectedFlowAccountCode) {
                                                setStatusMessage({ type: 'error', message: 'Please select a flow account' });
                                                setTimeout(() => setStatusMessage(null), 3000);
                                                return;
                                            }

                                            setIsAssigningEmailCode(selectedRegistration.user_id);
                                            // Always use selectedFlowAccountCode if available, otherwise use first from sorted list
                                            const codeToUse = selectedFlowAccountCode || (flowAccounts.length > 0 ? flowAccounts[0].code : undefined);
                                            const result = await assignEmailCodeToUser(
                                                selectedRegistration.user_id,
                                                codeToUse
                                            );
                                            if (result.success) {
                                                setStatusMessage({ type: 'success', message: `Assigned ${result.emailCode} to user` });
                                                fetchUsers();
                                                setIsModalOpen(false);
                                            } else {
                                                setStatusMessage({ type: 'error', message: result.message });
                                            }
                                            setIsAssigningEmailCode(null);
                                            setTimeout(() => setStatusMessage(null), 5000);
                                        }}
                                        disabled={isAssigningEmailCode === selectedRegistration.user_id || (assignMode === 'manual' && !selectedFlowAccountCode) || flowAccounts.length === 0}
                                        className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        {isAssigningEmailCode === selectedRegistration.user_id ? 'Assigning...' : 'Assign Flow Account'}
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                        Current Flow Account Code
                                    </label>
                                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 font-mono font-semibold text-neutral-600 dark:text-neutral-400 mb-3">
                                        {selectedRegistration.email_code}
                                    </div>
                                    
                                    {/* Mode Toggle for Reassign */}
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAssignMode('auto');
                                                if (flowAccounts.length > 0) {
                                                    const sorted = [...flowAccounts].sort((a, b) => 
                                                        a.current_users_count - b.current_users_count
                                                    );
                                                    setSelectedFlowAccountCode(sorted[0].code);
                                                }
                                            }}
                                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                                                assignMode === 'auto'
                                                    ? 'bg-primary-600 text-white shadow-sm'
                                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                                            }`}
                                        >
                                            Auto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssignMode('manual')}
                                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                                                assignMode === 'manual'
                                                    ? 'bg-primary-600 text-white shadow-sm'
                                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                                            }`}
                                        >
                                            Manual
                                        </button>
                                    </div>

                                    {/* Manual Selection Dropdown for Reassign */}
                                    {assignMode === 'manual' && (
                                        <div className="mb-3">
                                            <select
                                                value={selectedFlowAccountCode}
                                                onChange={(e) => setSelectedFlowAccountCode(e.target.value)}
                                                className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 text-sm"
                                            >
                                                <option value="">Select Flow Account</option>
                                                {flowAccounts.map(account => (
                                                    <option key={account.id} value={account.code}>
                                                        {account.code} - {account.email} ({account.current_users_count}/10)
                                                    </option>
                                                ))}
                                            </select>
                                            {flowAccounts.length === 0 && (
                                                <p className="text-xs text-red-500 mt-1">No available flow accounts. Add accounts in Flow Account tab.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Auto Mode Info for Reassign */}
                                    {assignMode === 'auto' && flowAccounts.length > 0 && (
                                        <div className="mb-3 p-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded text-xs text-primary-800 dark:text-primary-200">
                                            Will reassign to: <strong>{flowAccounts[0].code}</strong> ({flowAccounts[0].current_users_count}/10 users)
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={async () => {
                                                if (!selectedRegistration) return;
                                                
                                                if (!confirm(`Are you sure you want to reset flow account for this user? This will clear the email code.`)) {
                                                    return;
                                                }

                                                setIsAssigningEmailCode(selectedRegistration.user_id);
                                                const result = await resetEmailCodeFromUser(selectedRegistration.user_id);
                                                if (result.success) {
                                                    setStatusMessage({ type: 'success', message: 'Flow account code reset successfully' });
                                                    fetchUsers();
                                                    setIsModalOpen(false);
                                                } else {
                                                    setStatusMessage({ type: 'error', message: result.message || 'Failed to reset email code' });
                                                }
                                                setIsAssigningEmailCode(null);
                                                setTimeout(() => setStatusMessage(null), 5000);
                                            }}
                                            disabled={isAssigningEmailCode === selectedRegistration.user_id}
                                            className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-neutral-600 dark:bg-neutral-500 rounded-lg hover:bg-neutral-700 dark:hover:bg-neutral-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            {isAssigningEmailCode === selectedRegistration.user_id ? 'Resetting...' : 'Reset'}
                                        </button>
                                        
                                        <button
                                            onClick={async () => {
                                                if (!selectedRegistration) return;
                                                
                                                if (assignMode === 'manual' && !selectedFlowAccountCode) {
                                                    setStatusMessage({ type: 'error', message: 'Please select a flow account' });
                                                    setTimeout(() => setStatusMessage(null), 3000);
                                                    return;
                                                }
                                                
                                                // First reset, then assign new
                                                setIsAssigningEmailCode(selectedRegistration.user_id);
                                                
                                                // Reset first
                                                const resetResult = await resetEmailCodeFromUser(selectedRegistration.user_id);
                                                if (!resetResult.success) {
                                                    setStatusMessage({ type: 'error', message: resetResult.message || 'Failed to reset email code' });
                                                    setIsAssigningEmailCode(null);
                                                    setTimeout(() => setStatusMessage(null), 5000);
                                                    return;
                                                }

                                                // Then assign new - always use selectedFlowAccountCode if available
                                                const codeToUse = selectedFlowAccountCode || (flowAccounts.length > 0 ? flowAccounts[0].code : undefined);
                                                const assignResult = await assignEmailCodeToUser(
                                                    selectedRegistration.user_id,
                                                    codeToUse
                                                );
                                                
                                                if (assignResult.success) {
                                                    setStatusMessage({ type: 'success', message: `Reassigned ${assignResult.emailCode} to user` });
                                                    fetchUsers();
                                                    setIsModalOpen(false);
                                                } else {
                                                    setStatusMessage({ type: 'error', message: assignResult.message });
                                                }
                                                setIsAssigningEmailCode(null);
                                                setTimeout(() => setStatusMessage(null), 5000);
                                            }}
                                            disabled={isAssigningEmailCode === selectedRegistration.user_id || (assignMode === 'manual' && !selectedFlowAccountCode) || flowAccounts.length === 0}
                                            className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            {isAssigningEmailCode === selectedRegistration.user_id ? 'Reassigning...' : 'Reassign'}
                                        </button>
                                    </div>
                                    
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                        Reset: Clear current code | Reassign: Assign new flow account
                                    </p>
                                </div>
                            )}
                            {newStatus === 'subscription' && (
                                <div className="mt-4 p-3 bg-neutral-100 dark:bg-neutral-700/50 rounded-md">
                                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                        Subscription Duration
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center">
                                            <input type="radio" name="duration" value={1} checked={subscriptionDuration === 1} onChange={() => setSubscriptionDuration(1)} className="form-radio" />
                                            <span className="ml-2">1 Month</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input type="radio" name="duration" value={6} checked={subscriptionDuration === 6} onChange={() => setSubscriptionDuration(6)} className="form-radio" />
                                            <span className="ml-2">6 Months</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input type="radio" name="duration" value={12} checked={subscriptionDuration === 12} onChange={() => setSubscriptionDuration(12)} className="form-radio" />
                                            <span className="ml-2">12 Months</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Action Buttons Section */}
                        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={handleForceLogout}
                                    className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-neutral-600 dark:bg-neutral-500 rounded-lg hover:bg-neutral-700 dark:hover:bg-neutral-400 transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <XIcon className="w-4 h-4" />
                                    Logout
                                </button>
                                <button
                                    onClick={handleRemoveUser}
                                    className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    Remove
                                </button>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full px-4 py-2.5 text-sm font-semibold bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveChanges}
                                    className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all shadow-sm"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                , document.body
            )}
            
            {isConfirmLogoutOpen && selectedRegistration && createPortal(
                <ConfirmationModal
                    isOpen={isConfirmLogoutOpen}
                    title="Confirm Force Logout"
                    message={`Are you sure you want to terminate ${selectedRegistration.username}'s current session? They will be logged out immediately, but their account will remain active.`}
                    onConfirm={executeForceLogout}
                    onCancel={() => setIsConfirmLogoutOpen(false)}
                    confirmText="Logout"
                    confirmButtonClass="bg-red-600 hover:bg-red-700"
                    language={language}
                />,
                document.body
            )}

            {isConfirmRemoveOpen && selectedRegistration && createPortal(
                <ConfirmationModal
                    isOpen={isConfirmRemoveOpen}
                    title="Confirm Remove User"
                    message={`Are you sure you want to permanently remove ${selectedRegistration.username}? This action cannot be undone.`}
                    onConfirm={executeRemoveUser}
                    onCancel={() => setIsConfirmRemoveOpen(false)}
                    confirmText="Remove User"
                    confirmButtonClass="bg-red-600 hover:bg-red-700"
                    language={language}
                />,
                document.body
            )}

        </>
    );
};

export default AdminDashboardView;