import React, { useState, useEffect } from 'react';
import type { User } from '../types';
import { getAllUsers, blockUser, unblockUser } from '../services/users';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'blocked'>('all');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleBlock = async (userId: string) => {
    try {
      await blockUser(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, isBlocked: true } : u));
    } catch (err: any) {
      setError(err.message || 'Failed to block user');
    }
  };

  const handleUnblock = async (userId: string) => {
    try {
      await unblockUser(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, isBlocked: false } : u));
    } catch (err: any) {
      setError(err.message || 'Failed to unblock user');
    }
  };

  const filteredUsers = filter === 'all' 
    ? users 
    : filter === 'blocked' 
      ? users.filter(u => u.isBlocked)
      : users.filter(u => !u.isBlocked);

  if (loading) {
    return <div style={styles.loading}>Loading users...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Users Moderation</h1>
        <div style={styles.filters}>
          {(['all', 'active', 'blocked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterButton,
                ...(filter === f ? styles.filterButtonActive : {}),
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'blocked' && ` (${users.filter(u => u.isBlocked).length})`}
              {f === 'active' && ` (${users.filter(u => !u.isBlocked).length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div style={{ ...styles.cell, flex: 2 }}>Phone Number</div>
          <div style={styles.cell}>Display Name</div>
          <div style={styles.cell}>Joined</div>
          <div style={styles.cell}>Status</div>
          <div style={styles.cell}>Actions</div>
        </div>

        {filteredUsers.length === 0 ? (
          <div style={styles.emptyState}>No users found</div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} style={styles.tableRow}>
              <div style={{ ...styles.cell, flex: 2 }}>
                <div style={styles.phoneNumber}>{user.phoneNumber}</div>
                <div style={styles.userId}>ID: {user.id}</div>
              </div>
              <div style={styles.cell}>{user.displayName || '-'}</div>
              <div style={styles.cell}>
                {user.createdAt?.toLocaleDateString() || '-'}
              </div>
              <div style={styles.cell}>
                <span style={{ 
                  ...styles.statusBadge, 
                  backgroundColor: user.isBlocked ? '#F44336' : '#4CAF50' 
                }}>
                  {user.isBlocked ? 'Blocked' : 'Active'}
                </span>
              </div>
              <div style={styles.cell}>
                {user.isBlocked ? (
                  <button
                    onClick={() => handleUnblock(user.id)}
                    style={{ ...styles.actionButton, backgroundColor: '#4CAF50' }}
                  >
                    Unblock
                  </button>
                ) : (
                  <button
                    onClick={() => handleBlock(user.id)}
                    style={{ ...styles.actionButton, backgroundColor: '#F44336' }}
                  >
                    Block
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
  },
  filters: {
    display: 'flex',
    gap: '8px',
  },
  filterButton: {
    backgroundColor: '#333333',
    color: '#B0B0B0',
    border: '1px solid #404040',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  filterButtonActive: {
    backgroundColor: '#D4A574',
    color: '#1a1a1a',
    borderColor: '#D4A574',
  },
  error: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid #F44336',
    borderRadius: '8px',
    padding: '12px',
    color: '#F44336',
    marginBottom: '16px',
  },
  loading: {
    color: '#B0B0B0',
    textAlign: 'center',
    padding: '48px',
  },
  table: {
    backgroundColor: '#252525',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    backgroundColor: '#333333',
    padding: '16px',
    fontWeight: '600',
    color: '#B0B0B0',
    fontSize: '14px',
  },
  tableRow: {
    display: 'flex',
    padding: '16px',
    borderBottom: '1px solid #333333',
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    color: '#ffffff',
    fontSize: '14px',
  },
  phoneNumber: {
    fontWeight: '500',
    marginBottom: '4px',
  },
  userId: {
    color: '#808080',
    fontSize: '12px',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButton: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    fontSize: '12px',
    fontWeight: '500',
    color: '#ffffff',
    cursor: 'pointer',
  },
  emptyState: {
    color: '#808080',
    textAlign: 'center',
    padding: '48px',
  },
};
