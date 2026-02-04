import React, { useState, useEffect } from 'react';
import type { LandPlot } from '../types';
import { getAllPlots, approvePlot, hidePlot, setPendingPlot } from '../services/plots';

export const PlotsPage: React.FC = () => {
  const [plots, setPlots] = useState<LandPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'hidden'>('all');

  const loadPlots = async () => {
    try {
      setLoading(true);
      const data = await getAllPlots();
      setPlots(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load plots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlots();
  }, []);

  const handleApprove = async (plotId: string) => {
    try {
      await approvePlot(plotId);
      setPlots(plots.map(p => p.id === plotId ? { ...p, status: 'approved' } : p));
    } catch (err: any) {
      setError(err.message || 'Failed to approve plot');
    }
  };

  const handleHide = async (plotId: string) => {
    try {
      await hidePlot(plotId);
      setPlots(plots.map(p => p.id === plotId ? { ...p, status: 'hidden' } : p));
    } catch (err: any) {
      setError(err.message || 'Failed to hide plot');
    }
  };

  const handleSetPending = async (plotId: string) => {
    try {
      await setPendingPlot(plotId);
      setPlots(plots.map(p => p.id === plotId ? { ...p, status: 'pending' } : p));
    } catch (err: any) {
      setError(err.message || 'Failed to set plot to pending');
    }
  };

  const filteredPlots = filter === 'all' 
    ? plots 
    : plots.filter(p => p.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'hidden': return '#F44336';
      default: return '#FF9800';
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading plots...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Plots Moderation</h1>
        <div style={styles.filters}>
          {(['all', 'pending', 'approved', 'hidden'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterButton,
                ...(filter === f ? styles.filterButtonActive : {}),
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && ` (${plots.filter(p => p.status === f).length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div style={{ ...styles.cell, flex: 2 }}>Title</div>
          <div style={styles.cell}>Region</div>
          <div style={styles.cell}>Zone</div>
          <div style={styles.cell}>Price</div>
          <div style={styles.cell}>Status</div>
          <div style={{ ...styles.cell, flex: 1.5 }}>Actions</div>
        </div>

        {filteredPlots.length === 0 ? (
          <div style={styles.emptyState}>No plots found</div>
        ) : (
          filteredPlots.map(plot => (
            <div key={plot.id} style={styles.tableRow}>
              <div style={{ ...styles.cell, flex: 2 }}>
                <div style={styles.plotTitle}>{plot.title}</div>
                <div style={styles.plotSubtitle}>{plot.cadastralNumber}</div>
              </div>
              <div style={styles.cell}>{plot.region}</div>
              <div style={styles.cell}>
                <span style={{ ...styles.zoneBadge, backgroundColor: plot.zone === 'A' ? '#4CAF50' : plot.zone === 'B' ? '#FF9800' : '#F44336' }}>
                  Zone {plot.zone}
                </span>
              </div>
              <div style={styles.cell}>${plot.totalPrice?.toLocaleString()}</div>
              <div style={styles.cell}>
                <span style={{ ...styles.statusBadge, backgroundColor: getStatusColor(plot.status) }}>
                  {plot.status}
                </span>
              </div>
              <div style={{ ...styles.cell, flex: 1.5, gap: '8px', display: 'flex' }}>
                {plot.status !== 'approved' && (
                  <button
                    onClick={() => handleApprove(plot.id)}
                    style={{ ...styles.actionButton, backgroundColor: '#4CAF50' }}
                  >
                    Approve
                  </button>
                )}
                {plot.status !== 'hidden' && (
                  <button
                    onClick={() => handleHide(plot.id)}
                    style={{ ...styles.actionButton, backgroundColor: '#F44336' }}
                  >
                    Hide
                  </button>
                )}
                {plot.status !== 'pending' && (
                  <button
                    onClick={() => handleSetPending(plot.id)}
                    style={{ ...styles.actionButton, backgroundColor: '#FF9800' }}
                  >
                    Pending
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
  plotTitle: {
    fontWeight: '500',
    marginBottom: '4px',
  },
  plotSubtitle: {
    color: '#808080',
    fontSize: '12px',
  },
  zoneBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#ffffff',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
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
