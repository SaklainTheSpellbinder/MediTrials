import React from 'react';
import { LogOut, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const SidebarUserSection: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login'); // Better than window.location.href for React apps
    };

    if (!user) return null;

    return (
        <div className="sidebar-footer-container">
            {/* User Info Display */}
            {/* <div className="user-profile-summary">
                <div className="user-avatar">
                    {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                    <p className="user-name">{user.username}</p>
                    <p className="user-role">{user.role}</p>
                </div>
            </div> */}

            {/* Actions */}
            <nav className="footer-nav">
                <Link to="/settings" className="nav-item">
                    <Settings size={20} />
                    <span>Settings</span>
                </Link>
                
                <button onClick={handleLogout} className="nav-item logout-button">
                    <LogOut size={20} />
                    <span>Log Out</span>
                </button>
            </nav>
        </div>
    );
};