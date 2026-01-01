
import React, { useState, useEffect } from 'react';
import { XIcon, ServerIcon, CheckCircleIcon } from '../Icons';
import { getAvailableServersForUser } from '../../services/userService';
import { type User } from '../../types';

interface ServerSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    onServerChanged: () => void;
}

const ServerSelectionModal: React.FC<ServerSelectionModalProps> = ({ isOpen, onClose, currentUser, onServerChanged }) => {
    const [servers, setServers] = useState<string[]>([]);
    const [selected, setSelected] = useState<string | null>(sessionStorage.getItem('selectedProxyServer'));

    useEffect(() => {
        if (isOpen) {
            getAvailableServersForUser(currentUser).then(setServers);
            setSelected(sessionStorage.getItem('selectedProxyServer'));
        }
    }, [isOpen, currentUser]);

    const handleSelect = (url: string) => {
        sessionStorage.setItem('selectedProxyServer', url);
        setSelected(url);
        onServerChanged();
        onClose();
        // Removed window.location.reload() to prevent redirection to login
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-zoomIn" onClick={onClose}>
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border-[0.5px] border-neutral-200/80 dark:border-neutral-800/80" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <ServerIcon className="w-6 h-6 text-primary-500" />
                        Select Generation Server
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"><XIcon className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {servers
                        .filter(server => {
                            // Hide localhost server if user is not on localhost
                            const isLocalhost = server === 'http://localhost:3001' || server === 'https://localhost:3001';
                            const isUserOnLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                            
                            // Show localhost server only if user is on localhost
                            if (isLocalhost && !isUserOnLocalhost) {
                                return false;
                            }
                            return true;
                        })
                        .map((server, idx) => {
                            // Check if this is localhost server
                            const isLocalhost = server === 'http://localhost:3001' || server === 'https://localhost:3001';
                            
                            // Format server display name
                            // Localhost is not counted in server numbering
                            // Server 1 = s1.monoklix.com, Server 2 = s2.monoklix.com, etc.
                            let displayName: string;
                            let displayUrl: string;
                            
                            if (isLocalhost) {
                                displayName = 'Localhost Server';
                                displayUrl = 'localhost:3001';
                            } else {
                                // Count only non-localhost servers for numbering
                                // Find the index of this server in the non-localhost list
                                const nonLocalhostServers = servers.filter(s => 
                                    s !== 'http://localhost:3001' && s !== 'https://localhost:3001'
                                );
                                const serverIndex = nonLocalhostServers.indexOf(server);
                                displayName = `Server ${serverIndex + 1}`;
                                
                                if (server.includes('monoklix.com')) {
                                    displayUrl = server.replace('https://', '').replace('.monoklix.com', '');
                                } else {
                                    displayUrl = server.replace('https://', '').replace('http://', '');
                                }
                            }
                            
                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleSelect(server)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border-[0.5px] transition-all ${
                                        selected === server 
                                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500/80 ring-1 ring-primary-500/50' 
                                        : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200/80 dark:border-neutral-700/80 hover:border-primary-300/80 dark:hover:border-primary-700/80'
                                    }`}
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-sm">{displayName}</span>
                                        <span className="text-xs text-neutral-500 font-mono">{displayUrl}</span>
                                    </div>
                                    {selected === server && <CheckCircleIcon className="w-5 h-5 text-primary-500" />}
                                </button>
                            );
                        })}
                </div>
            </div>
        </div>
    );
};

export default ServerSelectionModal;
