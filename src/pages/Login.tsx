import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; // 👈 IMPORT
import './Login.css';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login: authLogin } = useAuth(); // 👈 GET AUTH FUNCTION
    const [role, setRole] = useState('PI');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const roleOptions = [
        { value: 'PI', label: 'Principal Investigator' },
        { value: 'Coordinator', label: 'Study Coordinator' },
        { value: 'Safety_Monitor', label: 'Safety Monitor' },
        { value: 'Data_Manager', label: 'Data Manager' },
        { value: 'Statistician', label: 'Statistician' },
        { value: 'System_Admin', label: 'System Administrator' }
    ];

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // ✅ USE AUTHCONTEXT LOGIN
            await authLogin(username, password, role);
            
            // ✅ NAVIGATE AFTER SUCCESSFUL LOGIN
            navigate('/dashboard');
            
        } catch (err: any) {
            console.error('Login error:', err);
            
            // ✅ BETTER ERROR HANDLING
            if (err.message.includes('Invalid username') || err.message.includes('401')) {
                setError('Invalid username, password, or role');
            } else if (err.message.includes('Cannot connect') || err.message.includes('Network')) {
                setError('Cannot connect to server. Please check if backend is running.');
            } else {
                setError(err.message || 'Login failed. Please try again.');
            }
            
            // Clear any stale data on error
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('user_id');
            
        } finally {
            setLoading(false);
        }
    };

    // Test credentials for development
    const fillTestCredentials = (testUser: string) => {
        const credentials: Record<string, { user: string, pass: string, role: string }> = {
            'investigator': { user: 'dr_smith', pass: 'password123', role: 'PI' },
            'coordinator': { user: 'nurse_jones', pass: 'password123', role: 'Coordinator' },
            'safety': { user: 'safety_lee', pass: 'password123', role: 'Safety_Monitor' },
            'admin': { user: 'admin', pass: 'password123', role: 'System_Admin' }
        };

        const creds = credentials[testUser];
        if (creds) {
            setUsername(creds.user);
            setPassword(creds.pass);
            setRole(creds.role);
            setError('');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-icon">
                        <ShieldCheck size={32} />
                    </div>
                    <h1>MEDITRIALS</h1>
                    <p>Clinical Research Suite</p>
                    <p className="text-sm text-gray-500 mt-1">v1.0 • Secure Login</p>
                </div>

                {error && (
                    <div className="error-message">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label>Role</label>
                        <div className="select-wrapper">
                            <select 
                                value={role} 
                                onChange={(e) => setRole(e.target.value)}
                                disabled={loading}
                            >
                                {roleOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-actions">
                        <label className="checkbox-label">
                            <input type="checkbox" disabled={loading} />
                            <span>Remember me</span>
                        </label>
                        <a href="#" className="forgot-link">Forgot Password?</a>
                    </div>

                    <button 
                        type="submit" 
                        className="login-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={16} className="animate-spin mr-2" />
                                Authenticating...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>

                    {/* Quick Test Buttons */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Quick Test:</p>
                        <div className="flex flex-wrap gap-2">
                            {['investigator', 'coordinator', 'safety', 'admin'].map((userType) => (
                                <button 
                                    key={userType}
                                    type="button"
                                    onClick={() => fillTestCredentials(userType)}
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded disabled:opacity-50"
                                    disabled={loading}
                                >
                                    As {userType.charAt(0).toUpperCase() + userType.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </form>

                <div className="login-footer">
                    <p>Secure Access Only. IP Logged.</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Connected to: Local PostgreSQL Database
                    </p>
                </div>
            </div>
        </div>
    );
};