'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClientComponentClient, User } from '@supabase/auth-helpers-nextjs';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: string | null;
    avatar_url: string | null;
}

interface UserProfileContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    error: string | null;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
    const supabase = createClientComponentClient();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUserProfile = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            setUser(authUser);

            if (authUser) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, name, role, avatar_url')
                    .eq('id', authUser.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') throw profileError;

                if (profileData) {
                    setProfile({
                        id: profileData.id,
                        name: profileData.name || authUser.email?.split('@')[0] || "Usuário",
                        email: authUser.email || "N/A",
                        role: profileData.role,
                        avatar_url: profileData.avatar_url
                    });
                }
            } else {
                setProfile(null);
            }
        } catch (err: any) {
            setError(err.message || "Erro ao carregar perfil do usuário.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchUserProfile();
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
                fetchUserProfile();
            }
        });
        return () => authListener.subscription.unsubscribe();
    }, [supabase, fetchUserProfile]);

    const value = { user, profile, loading, error };

    return (
        <UserProfileContext.Provider value={value}>
            {children}
        </UserProfileContext.Provider>
    );
};

export const useUserProfile = (): UserProfileContextType => {
    const context = useContext(UserProfileContext);
    if (context === undefined) {
        throw new Error('useUserProfile must be used within a UserProfileProvider');
    }
    return context;
};