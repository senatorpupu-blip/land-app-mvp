import React, { useState, useEffect } from 'react';
import type { Report } from '../types';
import { getAllReports, resolveReport, resolveReportAndHidePlot } from '../services/reports';

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await getAllReports();
      setReports(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleResolve = async (reportId: string) => {
    try {
      await resolveReport(reportId);
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    } catch (err: any) {
      setError(err.message || 'Failed to resolve report');
    }
  };

  const handleResolveAndHide = async (reportId: string, plotId: string) => {
    try {
      await resolveReportAndHidePlot(reportId, plotId);
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    } catch (err: any) {
      setError(err.message || 'Failed to resolve report and hide plot');
    }
  };

  const filteredReports = filter === 'all' 
    ? reports 
    : reports.filter(r => r.status === filter);

  if (loading) {
    return <div style={styles.loading}>Loading reports...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Reports</h1>
        <div style={styles.filters}>
          {(['all', 'pending', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterButton,
                ...(filter === f ? styles.filterButtonActive : {}),
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && ` (${reports.filter(r => r.status === f).length})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div style={styles.cell}>Plot ID</div>
          <div style={{ ...styles.cell, flex: 2 }}>Reason</div>
          <div style={styles.cell}>Reporter</div>
          <div style={styles.cell}>Date</div>
          <div style={styles.cell}>Status</div>
          <div style={{ ...styles.cell, flex: 1.5 }}>Actions</div>
        </div>

        {filteredReports.length === 0 ? (
          <div style={styles.emptyState}>No reports found</div>
        ) : (
          filteredReports.map(report => (
            <div key={report.id} style={styles.tableRow}>
              <div style={styles.cell}>
                <div style={styles.plotId}>{report.plotId.slice(0, 8)}...</div>
              </div>
              <div style={{ ...styles.cell, flex: 2 }}>{report.reason}</div>
              <div style={styles.cell}>
                <div style={styles.reporterId}>{report.reporterId.slice(0, 8)}...</div>
              </div>
              <div style={styles.cell}>
                {report.createdAt?.toLocaleDateString() || '-'}
              </div>
              <div style={styles.cell}>
                <span style={{ 
                  ...styles.statusBadge, 
                  backgroundColor: report.status === 'resolved' ? '#4CAF50' : '#FF9800' 
                }}>
                  {report.status}
                </span>
              </div>
              <div style={{ ...styles.cell, flex: 1.5, gap: '8px', display: 'flex' }}>
                {report.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleResolve(report.id)}
                      style={{ ...styles.actionButton, backgroundColor: '#4CAF50' }}
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => handleResolveAndHide(report.id, report.plotId)}
                      style={{ ...styles.actionButton, backgroundColor: '#F44336' }}
                    >
                      Hide Plot
                    </button>
                  </>
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
  plotId: {
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  reporterId: {
    fontFamily: 'monospace',
    fontSize: '12px',
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
