
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { type User, type TokenUltraRegistration } from '../types';
import { registerTokenUltra, saveUserRecaptchaToken, getTokenUltraRegistration, hasActiveTokenUltra } from '../services/userService';
import { CheckCircleIcon, AlertTriangleIcon, TelegramIcon, XIcon, ClockIcon } from './Icons';
import Spinner from './common/Spinner';

interface RegisterTokenUltraProps {
  currentUser: User;
  onUserUpdate?: (user: User) => void;
}

const RegisterTokenUltra: React.FC<RegisterTokenUltraProps> = ({ currentUser, onUserUpdate }) => {
  const [telegramId, setTelegramId] = useState(currentUser.telegramId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!telegramId.trim()) {
      setErrorMessage('Please enter your Telegram ID');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage(null);

    try {
      const result = await registerTokenUltra(
        currentUser.id,
        telegramId.trim()
      );

      if (result.success) {
        setSubmitStatus('success');
        if (onUserUpdate) {
          onUserUpdate(result.user);
        }
        // Invalidate cache
        sessionStorage.removeItem(`token_ultra_active_${currentUser.id}`);
        sessionStorage.removeItem(`token_ultra_active_timestamp_${currentUser.id}`);
        
        // Force refresh token ultra status cache
        await hasActiveTokenUltra(currentUser.id, true);
        // Show Telegram share modal
        setShowTelegramModal(true);
      } else {
        setSubmitStatus('error');
        // FIX: Cast to any to access 'message' property on union type where narrowing might fail.
        setErrorMessage((result as any).message || 'Failed to register. Please try again.');
      }
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          Register Token Ultra
        </h2>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
          Register to get your personal Ultra AI token. Complete the form below and make a payment of RM20.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left Panel: Registration Form */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Registration Form
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field (Read-only) */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={currentUser.fullName || currentUser.username}
              disabled
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
            />
          </div>

          {/* Email Field (Read-only) */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={currentUser.email}
              disabled
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
            />
          </div>

          {/* Telegram ID Field */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Telegram ID <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
              PM telegram bot ini untuk dapatkan Telegram ID anda:{' '}
              <a 
                href="https://t.me/MKAITokenBot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                https://t.me/MKAITokenBot
              </a>
            </p>
            <input
              type="text"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="Enter your Telegram ID (e.g., @username or 123456789)"
              required
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Your Telegram ID will be used for payment confirmation and token delivery.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {submitStatus === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-start gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 dark:text-green-200">
                Registration submitted successfully! We will process your request and contact you via Telegram.
              </p>
            </div>
          )}
          </form>
        </div>

        {/* Right Panel: Payment Barcode */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Payment Information
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
              <strong>Payment Amount:</strong> RM20.00
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Please scan the barcode below to complete your payment.
            </p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 mb-4">
            <img 
              src="https://monoklix.com/wp-content/uploads/2025/12/WhatsApp-Image-2025-12-29-at-5.30.38-PM.jpeg" 
              alt="Payment Barcode" 
              className="w-full h-auto rounded-lg"
            />
          </div>
          
          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || submitStatus === 'success'}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Spinner />
                <span>Submitting...</span>
              </>
            ) : submitStatus === 'success' ? (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                <span>Submitted</span>
              </>
            ) : (
              <span>Submit Payment Proof</span>
            )}
          </button>
        </div>
      </div>

      {/* Telegram Share Modal */}
      {showTelegramModal && (
        <TelegramShareModal
          userName={currentUser.fullName || currentUser.username}
          userEmail={currentUser.email}
          telegramId={telegramId}
          userId={currentUser.id}
          onClose={() => setShowTelegramModal(false)}
          onUserUpdate={onUserUpdate}
        />
      )}
    </div>
  );
};

// Telegram Share Modal Component
interface TelegramShareModalProps {
  userName: string;
  userEmail: string;
  telegramId: string;
  userId: string;
  onClose: () => void;
  onUserUpdate?: (user: User) => void;
}

const TelegramShareModal: React.FC<TelegramShareModalProps> = ({
  userName,
  userEmail,
  telegramId,
  userId,
  onClose,
  onUserUpdate,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const message = `Token Ultra Registration

Name: ${userName}
Email: ${userEmail}
Telegram ID: ${telegramId}

Please find payment proof attached.`;

  const telegramUrl = `https://t.me/monoklix_support?text=${encodeURIComponent(message)}`;

  const handleClose = () => {
    // Set message in sessionStorage before reload
    sessionStorage.setItem('token_ultra_ready_message', 'Akaun TOKEN ULTRA AI anda sudah siap. Terus Login untuk generate token.');
    // Reload page
    window.location.reload();
  };

  const handleOpenTelegram = async () => {
    // Update recaptcha token dengan default API key
    setIsUpdating(true);
    try {
      const defaultApiKey = '414f452fca8c16dedc687934823c7e97';
      const result = await saveUserRecaptchaToken(userId, defaultApiKey);
      
      if (result.success && onUserUpdate) {
        onUserUpdate(result.user);
      }
    } catch (error) {
      console.error('Failed to update recaptcha token:', error);
      // Continue anyway, don't block user from opening Telegram
    } finally {
      setIsUpdating(false);
    }

    // Open Telegram
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-zoomIn"
      aria-modal="true"
      role="dialog"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border-[0.5px] border-neutral-200/80 dark:border-neutral-800/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <TelegramIcon className="w-6 h-6 text-blue-500" />
            Share to Telegram
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Share your registration details to <strong>@monoklix_support</strong> via Telegram. The message is pre-filled with your information.
          </p>

          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 border-[0.5px] border-neutral-200/80 dark:border-neutral-700/80">
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Message Preview:
            </p>
            <div className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap font-mono bg-white dark:bg-neutral-900 p-3 rounded border-[0.5px] border-neutral-200/80 dark:border-neutral-700/80">
              {message}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border-[0.5px] border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Important:</strong> Please attach your payment proof image (barcode/receipt screenshot) when sending the message in Telegram.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleOpenTelegram}
              disabled={isUpdating}
              className="flex-1 bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <>
                  <Spinner />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <TelegramIcon className="w-4 h-4" />
                  Open Telegram
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RegisterTokenUltra;
