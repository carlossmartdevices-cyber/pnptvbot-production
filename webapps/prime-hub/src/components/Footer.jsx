import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Users, Radio, Film } from 'lucide-react';

const tabs = [
  { path: '/nearby', label: 'Nearby', icon: MapPin },
  { path: '/hangouts', label: 'Hangouts', icon: Users },
  { path: '/live', label: 'Live', icon: Radio },
  { path: '/videorama', label: 'Videorama', icon: Film },
];

export default function Footer() {
  const location = useLocation();

  return (
    <nav className="app-footer">
      {tabs.map(({ path, label, icon: Icon }) => (
        <Link
          key={path}
          to={path}
          className={`footer-tab ${location.pathname === path ? 'active' : ''}`}
        >
          <Icon size={22} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
