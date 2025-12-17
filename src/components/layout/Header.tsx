import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import './Header.css';

interface HeaderProps {
    userRole?: string;
    userName?: string;
}

export const Header: React.FC<HeaderProps> = ({
    userRole = 'Investigator',
    userName = 'Dr. Smith'
}) => {
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
                    {userRole}
                </div>

                <button className="icon-btn relative">
                    <Bell size={20} />
                    <span className="notification-badge">3</span>
                </button>

                <div className="user-profile">
                    <div className="avatar">
                        <User size={18} />
                    </div>
                    <span className="user-name">{userName}</span>
                </div>
            </div>
        </header>
    );
};
