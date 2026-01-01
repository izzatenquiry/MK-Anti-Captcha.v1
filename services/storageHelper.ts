/**
 * Helper functions for safe session storage operations
 * Handles quota exceeded errors and large data gracefully
 */

const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB (conservative limit)

/**
 * Safely set item in session storage with error handling
 */
export const safeSetSessionStorage = (key: string, value: string): boolean => {
    try {
        // Check if value is too large
        const size = new Blob([value]).size;
        if (size > MAX_STORAGE_SIZE) {
            console.warn(`[Storage] Value too large for ${key}: ${(size / 1024 / 1024).toFixed(2)}MB`);
            return false;
        }

        // Try to set item
        sessionStorage.setItem(key, value);
        return true;
    } catch (e: any) {
        // Handle QuotaExceededError specifically
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn(`[Storage] Quota exceeded for ${key}. Attempting cleanup...`);
            
            // Try to clear old session keys
            try {
                const keysToKeep = ['monoklix_session_api_key', 'selectedProxyServer', 'veoAuthTokens'];
                const allKeys = Object.keys(sessionStorage);
                const keysToRemove = allKeys.filter(k => !keysToKeep.includes(k));
                
                // Remove oldest keys first (simple approach: remove first 50% of non-essential keys)
                keysToRemove.slice(0, Math.floor(keysToRemove.length / 2)).forEach(k => {
                    sessionStorage.removeItem(k);
                });
                
                // Try again
                sessionStorage.setItem(key, value);
                return true;
            } catch (retryError) {
                console.error(`[Storage] Failed to save ${key} even after cleanup:`, retryError);
                return false;
            }
        } else if (e.name === 'SecurityError' || e.code === 18) {
            // Private browsing mode or security restriction
            console.warn(`[Storage] Security error for ${key}. Session storage may not be available.`);
            return false;
        } else {
            console.error(`[Storage] Failed to save ${key}:`, e);
            return false;
        }
    }
};

/**
 * Safely get item from session storage
 */
export const safeGetSessionStorage = (key: string): string | null => {
    try {
        return sessionStorage.getItem(key);
    } catch (e: any) {
        console.error(`[Storage] Failed to get ${key}:`, e);
        return null;
    }
};

/**
 * Safely remove item from session storage
 */
export const safeRemoveSessionStorage = (key: string): boolean => {
    try {
        sessionStorage.removeItem(key);
        return true;
    } catch (e: any) {
        console.error(`[Storage] Failed to remove ${key}:`, e);
        return false;
    }
};

/**
 * Check available storage space (approximate)
 */
export const getStorageUsage = (): { used: number; available: number } => {
    try {
        let used = 0;
        for (let key in sessionStorage) {
            if (sessionStorage.hasOwnProperty(key)) {
                used += sessionStorage[key].length + key.length;
            }
        }
        return {
            used,
            available: MAX_STORAGE_SIZE - used
        };
    } catch (e) {
        return { used: 0, available: MAX_STORAGE_SIZE };
    }
};




