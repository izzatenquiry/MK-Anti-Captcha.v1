import { supabase, type Database } from './supabaseClient';
import { type TokenUltraRegistration } from '../types';

type TokenUltraRegistrationRow = Database['public']['Tables']['token_ultra_registrations']['Row'];
type UserProfileData = Database['public']['Tables']['users']['Row'];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'An unknown error occurred';
};

export interface TokenUltraRegistrationWithUser extends TokenUltraRegistration {
  user?: {
    id: string;
    email: string;
    full_name?: string | null;
    phone: string;
    role: string;
    status: string;
    last_seen_at?: string | null;
    app_version?: string | null;
    last_device?: string | null;
    proxy_server?: string | null;
    personal_auth_token?: string | null;
  };
}

/**
 * Get all token ultra registrations with user data
 */
export const getAllTokenUltraRegistrations = async (): Promise<TokenUltraRegistrationWithUser[] | null> => {
  try {
    // Get all token ultra registrations
    const { data: registrations, error: regError } = await supabase
      .from('token_ultra_registrations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (regError) {
      console.error('Error getting token ultra registrations:', getErrorMessage(regError));
      // Removed full error object logging to avoid exposing sensitive data
      return null;
    }

    // Removed sensitive data logging - only log counts
    // console.log('Raw registrations from DB:', registrations?.length || 0);

    if (!registrations || registrations.length === 0) {
      // Removed logging - sensitive data
      // console.log('No registrations found in database');
      return [];
    }

    // Get all unique user IDs
    const userIds = [...new Set(registrations.map(reg => reg.user_id))];

    // Get user data for all user IDs
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('id', userIds);

    if (usersError) {
      console.error('Error getting users:', getErrorMessage(usersError));
      // Removed full error object logging
      // Continue even if users fetch fails
    }

    // Removed sensitive data logging
    // console.log('Fetched users:', users?.length || 0, 'for', userIds.length, 'user IDs');

    // Create a map of user_id to user data
    const userMap = new Map<string, UserProfileData>();
    if (users) {
      users.forEach(user => {
        userMap.set(user.id, user);
      });
    }

    // Combine registrations with user data
    const result = registrations.map(reg => {
      const userData = userMap.get(reg.user_id);
      return {
        ...reg,
        user: userData ? {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          phone: userData.phone,
          role: userData.role,
          status: userData.status,
          last_seen_at: userData.last_seen_at,
          app_version: userData.app_version,
          last_device: userData.last_device,
          proxy_server: userData.proxy_server,
          personal_auth_token: userData.personal_auth_token,
        } : undefined,
      } as TokenUltraRegistrationWithUser;
    });

    // Removed sensitive data logging - only return result without logging
    // console.log('Final result count:', result.length);
    return result;
  } catch (error) {
    console.error('Exception getting token ultra registrations:', getErrorMessage(error));
    return null;
  }
};