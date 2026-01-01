import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAllFlowAccounts, addFlowAccount, updateFlowAccount, removeFlowAccount, type FlowAccount } from '../../services/flowAccountService';
import { TrashIcon, PlusIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, XIcon, PencilIcon } from '../Icons';
import Spinner from '../common/Spinner';
import ConfirmationModal from '../common/ConfirmationModal';
import { type Language } from '../../types';

interface FlowAccountViewProps {
  language: Language;
}

const FlowAccountView: React.FC<FlowAccountViewProps> = ({ language }) => {
  const [accounts, setAccounts] = useState<FlowAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<FlowAccount | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCode, setNewCode] = useState('');
  
  // Edit form state
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    const allAccounts = await getAllFlowAccounts();
    setAccounts(allAccounts);
    setLoading(false);
  };

  // Generate next available code (G1, G2, G3, etc.)
  const generateNextCode = (existingAccounts: FlowAccount[]): string => {
    // Get all existing codes (both active and inactive to avoid duplicates)
    const existingCodes = existingAccounts
      .map(acc => acc.code)
      .filter(code => /^G\d+$/.test(code)); // Only match G1, G2, G3, etc.

    // Extract numbers from codes (G1 -> 1, G2 -> 2, etc.)
    const numbers = existingCodes
      .map(code => {
        const match = code.match(/^G(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0)
      .sort((a, b) => a - b);

    // Start checking from 1, but typically continue from existing codes
    let nextNumber = 1;
    
    if (numbers.length > 0) {
      const maxNumber = Math.max(...numbers);
      // Start from the next number after max, or check for gaps
      nextNumber = maxNumber + 1;
      
      // Check for gaps in the sequence (if any code was deleted)
      for (let i = 1; i <= maxNumber; i++) {
        if (!numbers.includes(i)) {
          nextNumber = i;
          break;
        }
      }
    }

    return `G${nextNumber}`;
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Auto-generate code when modal opens
  useEffect(() => {
    if (isAddModalOpen) {
      const nextCode = generateNextCode(accounts);
      setNewCode(nextCode);
    }
  }, [isAddModalOpen, accounts]);

  const handleAddAccount = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      setStatusMessage({ type: 'error', message: 'Please fill in email and password' });
      return;
    }

    // Auto-generate code if not set
    const codeToUse = newCode.trim() || generateNextCode(accounts);

    const result = await addFlowAccount(newEmail, newPassword, codeToUse);
    
    if (result.success) {
      setStatusMessage({ type: 'success', message: `Flow account added successfully with code ${codeToUse}` });
      setIsAddModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewCode('');
      fetchAccounts();
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage({ type: 'error', message: result.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleRemoveAccount = async () => {
    if (!selectedAccount) return;

    const result = await removeFlowAccount(selectedAccount.id);
    
    if (result.success) {
      setStatusMessage({ type: 'success', message: 'Flow account removed successfully' });
      setIsRemoveModalOpen(false);
      setSelectedAccount(null);
      fetchAccounts();
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage({ type: 'error', message: result.message || 'Failed to remove account' });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleEditAccount = async () => {
    if (!selectedAccount) return;

    if (!editEmail.trim()) {
      setStatusMessage({ type: 'error', message: 'Email is required' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    const updates: { email?: string; password?: string } = {};
    if (editEmail.trim() !== selectedAccount.email) {
      updates.email = editEmail.trim();
    }
    if (editPassword.trim() && editPassword.trim() !== selectedAccount.password) {
      updates.password = editPassword.trim();
    }

    if (Object.keys(updates).length === 0) {
      setStatusMessage({ type: 'error', message: 'No changes detected' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    const result = await updateFlowAccount(selectedAccount.id, updates);
    
    if (result.success) {
      setStatusMessage({ type: 'success', message: 'Flow account updated successfully' });
      setIsEditModalOpen(false);
      setSelectedAccount(null);
      setEditEmail('');
      setEditPassword('');
      fetchAccounts();
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage({ type: 'error', message: result.message || 'Failed to update account' });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const togglePasswordVisibility = (id: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm h-full overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Flow Account Management</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Manage Google Flow accounts. Each account can be assigned to up to 10 users (G1, G2, G3, etc.).
        </p>
      </div>

      {statusMessage && (
        <div className={`mb-4 p-3 rounded-lg ${
          statusMessage.type === 'success' 
            ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' 
            : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircleIcon className="w-5 h-5" />
            ) : (
              <XIcon className="w-5 h-5" />
            )}
            <span>{statusMessage.message}</span>
          </div>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Add Flow Account
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-500 dark:text-neutral-400">
          <thead className="text-xs text-neutral-700 uppercase bg-neutral-100 dark:bg-neutral-800/50 dark:text-neutral-400">
            <tr>
              <th scope="col" className="px-6 py-3">Code</th>
              <th scope="col" className="px-6 py-3">Email</th>
              <th scope="col" className="px-6 py-3">Password</th>
              <th scope="col" className="px-6 py-3">Users Count</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length > 0 ? (
              accounts.map((account) => (
                <tr
                  key={account.id}
                  className="bg-white dark:bg-neutral-950 border-b dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                >
                  <td className="px-6 py-4 font-mono font-semibold text-neutral-900 dark:text-white">
                    {account.code}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                    {account.email}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-neutral-600 dark:text-neutral-300">
                        {showPasswords[account.id] ? account.password : '••••••••'}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(account.id)}
                        className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                        title={showPasswords[account.id] ? 'Hide password' : 'Show password'}
                      >
                        {showPasswords[account.id] ? (
                          <EyeOffIcon className="w-4 h-4" />
                        ) : (
                          <EyeIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      account.current_users_count >= 10
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                        : account.current_users_count >= 7
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                    }`}>
                      {account.current_users_count} / 10
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      account.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                    }`}>
                      {account.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setEditEmail(account.email);
                          setEditPassword('');
                          setShowEditPassword(false);
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 text-orange-600 dark:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                        title="Edit account"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setIsRemoveModalOpen(true);
                        }}
                        className="p-2 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={account.current_users_count > 0}
                        title={account.current_users_count > 0 ? 'Cannot remove account with active users' : 'Remove account'}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-10">
                  <p className="text-neutral-500 dark:text-neutral-400">No flow accounts found. Add your first account to get started.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Account Modal */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Add Flow Account</h3>
              <button onClick={() => {
                setIsAddModalOpen(false);
                setNewEmail('');
                setNewPassword('');
                setNewCode('');
              }} className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code (Auto-generated)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newCode}
                    readOnly
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 font-mono font-semibold text-neutral-600 dark:text-neutral-400 cursor-not-allowed"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Auto</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Code will be automatically generated (G1, G2, G3, etc.) based on existing codes
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddAccount}
                className="flex-1 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                Add Account
              </button>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewEmail('');
                  setNewPassword('');
                  setNewCode('');
                }}
                className="flex-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold py-2 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Account Modal */}
      {isEditModalOpen && selectedAccount && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Edit Flow Account ({selectedAccount.code})</h3>
              <button onClick={() => {
                setIsEditModalOpen(false);
                setSelectedAccount(null);
                setEditEmail('');
                setEditPassword('');
                setShowEditPassword(false);
              }} className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code (Read-only)</label>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 font-mono font-semibold text-neutral-600 dark:text-neutral-400 cursor-not-allowed">
                  {selectedAccount.code}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Password (Leave empty to keep current)</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password (optional)"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    {showEditPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Leave password empty if you don't want to change it
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEditAccount}
                className="flex-1 bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedAccount(null);
                  setEditEmail('');
                  setEditPassword('');
                  setShowEditPassword(false);
                }}
                className="flex-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold py-2 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Remove Confirmation Modal */}
      {isRemoveModalOpen && selectedAccount && (
        <ConfirmationModal
          isOpen={isRemoveModalOpen}
          onClose={() => {
            setIsRemoveModalOpen(false);
            setSelectedAccount(null);
          }}
          onConfirm={handleRemoveAccount}
          title="Remove Flow Account"
          message={`Are you sure you want to remove flow account "${selectedAccount.code}" (${selectedAccount.email})? This action cannot be undone.`}
          confirmText="Remove"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          language={language}
        />
      )}
    </div>
  );
};

export default FlowAccountView;