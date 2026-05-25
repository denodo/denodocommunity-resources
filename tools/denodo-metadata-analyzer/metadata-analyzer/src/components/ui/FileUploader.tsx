'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileText, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { colors, spacing, borderRadius, shadows, typography } from '../../lib/theme';

interface FileUploaderProps {
  onFileUpload: (files: { vql?: File; properties?: File }) => void;
  isAnalyzing: boolean;
  hasExistingAnalysis?: boolean;
  error?: string | null;
}

export default function FileUploader({
  onFileUpload,
  isAnalyzing,
  hasExistingAnalysis = false,
  error: externalError = null
}: FileUploaderProps) {
  const [vqlFile, setVqlFile] = useState<File | null>(null);
  const [propertiesFile, setPropertiesFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  }, []);

  // Process dropped or selected files
  const processFiles = (files: File[]) => {
    files.forEach(file => {
      if (file.name.toLowerCase().endsWith('.vql')) {
        setVqlFile(file);
      } else if (file.name.toLowerCase().endsWith('.properties')) {
        setPropertiesFile(file);
      }
    });
  };

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // Start analysis
  const handleStartAnalysis = useCallback(() => {
    if (!vqlFile) {
      setError('VQL file is required');
      return;
    }

    const files = { vql: vqlFile, properties: propertiesFile || undefined };
    onFileUpload(files);
  }, [vqlFile, propertiesFile, onFileUpload]);

  // Remove file
  const removeFile = (type: 'vql' | 'properties') => {
    if (type === 'vql') {
      setVqlFile(null);
    } else {
      setPropertiesFile(null);
    }
    setError(null);
  };

  const currentError = error || externalError;

  return (
    <div style={styles.container}>
      {/* File Drop Zone */}
      <div
        style={{
          ...styles.dropZone,
          ...(dragActive ? styles.dropZoneActive : {}),
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload size={48} style={{ color: dragActive ? colors.accent : colors.gray400 }} />
        <h3 style={styles.dropZoneTitle}>
          Drop files here or click to select
        </h3>
        <p style={styles.dropZoneText}>
          Support for .vql and .properties files
        </p>

        <input
          type="file"
          multiple
          accept=".vql,.properties"
          onChange={handleFileChange}
          style={styles.fileInput}
          disabled={isAnalyzing}
        />
      </div>

      {/* File List */}
      {(vqlFile || propertiesFile) && (
        <div style={styles.fileList}>
          <h3 style={styles.fileListTitle}>Selected Files</h3>

          {vqlFile && (
            <div style={styles.fileItem}>
              <FileText size={18} style={{ color: colors.accent }} />
              <div style={styles.fileInfo}>
                <div style={styles.fileName}>{vqlFile.name}</div>
                <div style={styles.fileSize}>
                  {(vqlFile.size / 1024 / 1024).toFixed(2)} MB • VQL File
                </div>
              </div>
              <CheckCircle size={18} style={{ color: colors.success }} />
              {!isAnalyzing && (
                <button
                  onClick={() => removeFile('vql')}
                  style={styles.removeButton}
                >
                  ×
                </button>
              )}
            </div>
          )}

          {propertiesFile && (
            <div style={styles.fileItem}>
              <Settings size={18} style={{ color: colors.accent }} />
              <div style={styles.fileInfo}>
                <div style={styles.fileName}>{propertiesFile.name}</div>
                <div style={styles.fileSize}>
                  {(propertiesFile.size / 1024).toFixed(2)} KB • Properties File
                </div>
              </div>
              <CheckCircle size={18} style={{ color: colors.success }} />
              {!isAnalyzing && (
                <button
                  onClick={() => removeFile('properties')}
                  style={styles.removeButton}
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {currentError && (
        <div style={styles.errorMessage}>
          <AlertCircle size={18} />
          <span>{currentError}</span>
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button
          onClick={handleStartAnalysis}
          disabled={!vqlFile || isAnalyzing}
          style={{
            ...styles.analyzeButton,
            ...(!vqlFile || isAnalyzing ? styles.analyzeButtonDisabled : {})
          }}
        >
          {isAnalyzing ? (
            <>
              <div style={styles.spinner}></div>
              Analyzing...
            </>
          ) : (
            <>
              <Upload size={18} />
              Start Analysis
            </>
          )}
        </button>

        {!vqlFile && (
          <p style={styles.requirementText}>
            VQL file is required. Properties file is optional but recommended for duplicate connection detection and server configuration analysis.
          </p>
        )}
      </div>

      {/* Instructions */}
      <div style={styles.instructions}>
        <h4 style={styles.instructionsTitle}>Instructions</h4>
        <ul style={styles.instructionsList}>
          <li><strong>VQL File:</strong> Export from Denodo Design Studio (File → Export → VQL)</li>
          <li><strong>Properties File:</strong> Optional - from Denodo Control Center (Configuration → Export)</li>
          <li><strong>File Size:</strong> Supports files up to 2GB for comprehensive analysis</li>
          <li><strong>Privacy:</strong> All processing happens locally in your browser using DuckDB WASM</li>
        </ul>
      </div>

      {hasExistingAnalysis && (
        <div style={styles.existingAnalysisNote}>
          <AlertCircle size={14} />
          <span>Previous analysis data will be cleared when you start a new analysis.</span>
        </div>
      )}
    </div>
  );
}

// Component styles using our modern theme system
const styles = {
  container: {
    maxWidth: '900px', // Increased for better logo space
    margin: '0 auto',
    padding: spacing.lg
  },

  dropZone: {
    position: 'relative' as const,
    border: `2px dashed ${colors.gray300}`,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    textAlign: 'center' as const,
    backgroundColor: colors.gray50,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginBottom: spacing.lg
  },

  dropZoneActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
    transform: 'scale(1.02)',
    boxShadow: shadows.lg
  },

  dropZoneTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray800,
    margin: `${spacing.md} 0 ${spacing.sm} 0`
  },

  dropZoneText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray600,
    margin: 0
  },

  fileInput: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer'
  },

  fileList: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    boxShadow: shadows.sm
  },

  fileListTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray800,
    margin: `0 0 ${spacing.md} 0`
  },

  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm
  },

  fileInfo: {
    flex: 1
  },

  fileName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray800
  },

  fileSize: {
    fontSize: typography.fontSize.sm,
    color: colors.gray600
  },

  removeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    color: colors.gray400,
    cursor: 'pointer',
    padding: '0',
    width: '20px', // Reduced from 24px
    height: '20px', // Reduced from 24px
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s ease'
  },

  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.errorLight + '20',
    color: colors.error,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    border: `1px solid ${colors.errorLight}`
  },

  actions: {
    textAlign: 'center' as const,
    marginBottom: spacing.xl
  },

  analyzeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    backgroundColor: colors.primarySolid,
    border: 'none',
    borderRadius: borderRadius.sm,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: shadows.sm
  },

  analyzeButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    transform: 'none'
  },

  spinner: {
    width: '18px',
    height: '18px',
    border: `2px solid ${colors.gray300}`,
    borderTop: `2px solid ${colors.white}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },

  requirementText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray600,
    marginTop: spacing.md,
    margin: `${spacing.md} 0 0 0`
  },

  instructions: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    boxShadow: shadows.sm
  },

  instructionsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray800,
    margin: `0 0 ${spacing.md} 0`
  },

  instructionsList: {
    margin: 0,
    paddingLeft: spacing.lg,
    color: colors.gray700,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.relaxed
  },

  existingAnalysisNote: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warningLight + '20',
    color: colors.warning,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.sm,
    border: `1px solid ${colors.warningLight}`
  }
};