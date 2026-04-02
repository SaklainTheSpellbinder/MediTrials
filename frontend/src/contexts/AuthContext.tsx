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

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (username: string, password: string, role: string) => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role }),
            });

            const data = await response.json();

            // 2. BETTER ERROR HANDLING
            // fetch() doesn't throw on 401/500, so we must check response.ok
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // 3. DATA STRUCTURE MATCHING
            // Our backend sends { user: {...} }, not { success: true }
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                // Note: If you implement JWT later, ensure backend sends 'token'
                localStorage.setItem('token', data.token || 'mock-session-token');
                localStorage.setItem('user_id', String(data.user.user_id));
                setUser(data.user);
            }
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
        setUser(null);
        // Optional: Call backend logout to log the exit event
        // Use POST for actions like logout
        fetch('http://localhost:5000/api/auth/logout', { method: 'POST' }).catch(err => console.log('Logout log failed', err));
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