import { createContext, useState, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
    user_id: number;      
    username: string;
    full_name: string;   
    role: string;
    email: string;
    site_id?: number;
    institution_name?: string; 
}

interface AuthContextType {
    user: User | null;
    login: (username: string, password: string, role: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Session recovery endpoint: Check if user is logged in via httpOnly cookie
    useEffect(() => {
        const recoverSession = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/auth/me', {
                    method: 'GET',
                    credentials: 'include', // CRITICAL: Include httpOnly cookie
                    headers: { 'Content-Type': 'application/json' },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.user) {
                        setUser(data.user);
                    }
                }
            } catch (error) {
                console.error('Session recovery failed:', error);
            } finally {
                setLoading(false);
            }
        };

        recoverSession();
    }, []);

    const login = async (username: string, password: string, role: string) => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                credentials: 'include', // CRITICAL: Include httpOnly cookie in response
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // Backend sets httpOnly cookie automatically via Set-Cookie header
            // User data is in response body for immediate UI update
            if (data.user) {
                setUser(data.user);
            }
        } catch (error) {
            throw error;
        }
    };

    const logout = async () => {
        try {
            // Call backend to clear httpOnly cookie
            await fetch('http://localhost:5000/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear frontend state regardless of backend response
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            isAuthenticated: !!user,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};