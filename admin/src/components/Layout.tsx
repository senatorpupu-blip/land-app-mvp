import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <div style={styles.logo}>
          <h2 style={styles.logoText}>Admin Panel</h2>
          <p style={styles.logoSubtext}>Land Plots</p>
        </div>

        <div style={styles.navLinks}>
          <NavLink
            to="/"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            Plots
          </NavLink>
          <NavLink
            to="/users"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            Users
          </NavLink>
          <NavLink
            to="/reports"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            Reports
          </NavLink>
        </div>

        <div style={styles.userSection}>
          <div style={styles.userEmail}>{user?.email}</div>
          <button onClick={handleSignOut} style={styles.signOutButton}>
            Sign Out
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#1a1a1a',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#252525',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #333333',
  },
  logo: {
    marginBottom: '32px',
  },
  logoText: {
    color: '#D4A574',
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
  },
  logoSubtext: {
    color: '#808080',
    fontSize: '12px',
    margin: '4px 0 0 0',
  },
  navLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  navLink: {
    color: '#B0B0B0',
    textDecoration: 'none',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  navLinkActive: {
    backgroundColor: '#333333',
    color: '#D4A574',
  },
  userSection: {
    borderTop: '1px solid #333333',
    paddingTop: '16px',
  },
  userEmail: {
    color: '#808080',
    fontSize: '12px',
    marginBottom: '12px',
    wordBreak: 'break-all',
  },
  signOutButton: {
    width: '100%',
    backgroundColor: 'transparent',
    border: '1px solid #404040',
    borderRadius: '8px',
    padding: '10px',
    color: '#B0B0B0',
    fontSize: '14px',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    overflow: 'auto',
  },
};
