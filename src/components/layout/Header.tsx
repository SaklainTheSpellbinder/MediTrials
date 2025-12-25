import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import './Header.css';
import { useAuth } from '../../contexts/AuthContext';

export const Header: React.FC = ()=>{
    const {user} = useAuth();
    return (
        <header className="header">
            <div className="header-search">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search patients, protocols, or adverse events..."
                    className="search-input"
                />
            </div>

            <div className="header-actions">
                <div className="role-badge">
                    {user?.role || 'User'}
                </div>

                <button className="icon-btn relative">
                    <Bell size={20} />
                    <span className="notification-badge">3</span>
                </button>

                <div className="user-profile">
                    <div className="avatar">
                        <User size={18} />
                    </div>
                    <span className="user-name">{user?.username|| 'Guest'}</span>
                </div>
                
            </div>
        </header>
    );
};
