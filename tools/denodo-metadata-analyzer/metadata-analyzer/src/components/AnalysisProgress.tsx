'use client';

import React from 'react';
import { Loader, Database, FileText, Settings, CheckCircle, X, Zap } from 'lucide-react';

interface AnalysisProgressProps {
  stage: string;
  progress: number;
  parser?: string;
  onCancel?: () => void;
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  stage,
  progress,
  parser,
  onCancel
}) => {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>
            <Loader
              size={48}
              color="#667eea"
              style={{
                animation: 'spin 2s linear infinite'
              }}
            />
          </div>
          <h2 style={styles.title}>Analyzing Denodo Metadata</h2>
          <p style={styles.subtitle}>
            Processing your VQL file with advanced parsing algorithms
          </p>
        </div>

        {/* Main Progress Section */}
        <div style={styles.content}>
          {/* Circular Progress */}
          <div style={styles.progressContainer}>
            <svg width="160" height="160" style={styles.progressCircle}>
              {/* Background circle */}
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#667eea"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
                transform="rotate(-90 80 80)"
                style={{
                  transition: 'stroke-dashoffset 0.5s ease'
                }}
              />
            </svg>
            <div style={styles.progressText}>
              <div style={styles.progressNumber}>{Math.round(progress)}%</div>
              <div style={styles.progressLabel}>Complete</div>
            </div>
          </div>

          {/* Current Stage */}
          <div style={styles.stageContainer}>
            <div style={styles.stageDot} />
            <div style={styles.stageInfo}>
              <div style={styles.stageName}>{stage}</div>
              {parser && (
                <div style={styles.parserName}>Using {parser}</div>
              )}
            </div>
          </div>

          {/* Progress Steps */}
          <div style={styles.steps}>
            <ProgressStep
              icon={<FileText size={20} />}
              title="Reading"
              completed={progress >= 10}
              active={progress < 10}
            />
            <div style={styles.stepConnector} />
            <ProgressStep
              icon={<Database size={20} />}
              title="Parsing"
              completed={progress >= 60}
              active={progress >= 10 && progress < 60}
            />
            <div style={styles.stepConnector} />
            <ProgressStep
              icon={<Settings size={20} />}
              title="Storing"
              completed={progress >= 90}
              active={progress >= 60 && progress < 90}
            />
            <div style={styles.stepConnector} />
            <ProgressStep
              icon={<CheckCircle size={20} />}
              title="Complete"
              completed={progress >= 100}
              active={progress >= 90 && progress < 100}
            />
          </div>

          {/* Performance Info Cards */}
          <div style={styles.infoCards}>
            <div style={styles.infoCard}>
              <div style={styles.infoCardIcon}>
                <Zap size={16} color="#667eea" />
              </div>
              <div style={styles.infoCardContent}>
                <div style={styles.infoCardLabel}>Engine</div>
                <div style={styles.infoCardValue}>DuckDB WASM</div>
              </div>
            </div>
            <div style={styles.infoCard}>
              <div style={styles.infoCardIcon}>
                <Settings size={16} color="#10b981" />
              </div>
              <div style={styles.infoCardContent}>
                <div style={styles.infoCardLabel}>Workers</div>
                <div style={styles.infoCardValue}>Web Workers</div>
              </div>
            </div>
            <div style={styles.infoCard}>
              <div style={styles.infoCardIcon}>
                <Database size={16} color="#f59e0b" />
              </div>
              <div style={styles.infoCardContent}>
                <div style={styles.infoCardLabel}>Status</div>
                <div style={styles.infoCardValue}>
                  {progress >= 100 ? 'Done' : 'Processing'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerInfo}>
            <p style={styles.footerText}>
              🔒 Your data remains private and secure in your browser.
              Processing large VQL files may take a few moments.
            </p>
          </div>

          {progress < 100 && onCancel && (
            <button
              onClick={onCancel}
              style={styles.cancelButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#9ca3af';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              <X size={14} />
              Cancel Analysis
            </button>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

// Progress Step Component
interface ProgressStepProps {
  icon: React.ReactNode;
  title: string;
  completed: boolean;
  active: boolean;
}

const ProgressStep: React.FC<ProgressStepProps> = ({
  icon,
  title,
  completed,
  active
}) => {
  const getIconStyle = () => {
    if (completed) return styles.stepIconCompleted;
    if (active) return styles.stepIconActive;
    return {};
  };

  const getTitleStyle = () => {
    if (completed || active) return styles.stepTitleActive;
    return {};
  };

  return (
    <div style={styles.step}>
      <div style={{ ...styles.stepIcon, ...getIconStyle() }}>
        {icon}
      </div>
      <div style={{ ...styles.stepTitle, ...getTitleStyle() }}>
        {title}
      </div>
    </div>
  );
};

// Styles
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'slideIn 0.3s ease-out'
  },

  modal: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '600px',
    width: '90%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    animation: 'slideIn 0.3s ease-out',
    maxHeight: '85vh',
    overflow: 'auto'
  },

  header: {
    textAlign: 'center',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid #e5e7eb'
  },

  headerIcon: {
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'center'
  },

  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '8px',
    margin: '0 0 8px 0'
  },

  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
    lineHeight: 1.5
  },

  content: {
    marginBottom: '24px'
  },

  progressContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '32px'
  },

  progressCircle: {
    transform: 'rotate(-90deg)'
  },

  progressText: {
    position: 'absolute',
    textAlign: 'center'
  },

  progressNumber: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#667eea',
    lineHeight: 1
  },

  progressLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 500
  },

  stageContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '1px solid #e5e7eb'
  },

  stageDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#667eea',
    flexShrink: 0,
    animation: 'pulse 2s infinite'
  },

  stageInfo: {
    flex: 1
  },

  stageName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '2px'
  },

  parserName: {
    fontSize: '12px',
    color: '#6b7280'
  },

  steps: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    padding: '0 8px'
  },

  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    flex: 1
  },

  stepConnector: {
    height: '2px',
    flex: '0 0 40px',
    background: '#e5e7eb',
    margin: '0 8px',
    marginBottom: '32px'
  },

  stepIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: '#f3f4f6',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
    border: '2px solid #e5e7eb'
  },

  stepIconCompleted: {
    background: '#10b981',
    color: 'white',
    borderColor: '#10b981'
  },

  stepIconActive: {
    background: '#667eea',
    color: 'white',
    borderColor: '#667eea',
    animation: 'pulse 2s infinite'
  },

  stepTitle: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: 500,
    textAlign: 'center'
  },

  stepTitleActive: {
    color: '#111827',
    fontWeight: 600
  },

  infoCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px'
  },

  infoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    transition: 'all 0.2s ease'
  },

  infoCardIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },

  infoCardContent: {
    flex: 1,
    minWidth: 0
  },

  infoCardLabel: {
    fontSize: '10px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 600,
    marginBottom: '2px'
  },

  infoCardValue: {
    fontSize: '13px',
    color: '#111827',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },

  footer: {
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center'
  },

  footerInfo: {
    marginBottom: '16px'
  },

  footerText: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0,
    lineHeight: 1.6
  },

  cancelButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'white',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none'
  }
};

export default AnalysisProgress;
