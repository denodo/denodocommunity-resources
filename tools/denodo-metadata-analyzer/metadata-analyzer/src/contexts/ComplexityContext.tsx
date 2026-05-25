"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type ComplexityResults = {
  success: boolean;
  analyzed_successfully: number;
  csv_data?: string;
  top_views: any[];
  timestamp?: number; // Add timestamp to track when analysis was done
};

type ComplexityContextType = {
  complexityResults: ComplexityResults | null;
  setComplexityResults: (results: ComplexityResults | null) => void;
  clearComplexityResults: () => void;
  analysisTimestamp: number | null;
  updateAnalysisTimestamp: (timestamp: number) => void;
};

const ComplexityContext = createContext<ComplexityContextType | undefined>(undefined);

export function ComplexityProvider({ children }: { children: React.ReactNode }) {
  const [complexityResults, setComplexityResultsState] = useState<ComplexityResults | null>(() => {
    // Initialize from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('complexity_results');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const [analysisTimestamp, setAnalysisTimestamp] = useState<number | null>(() => {
    // Initialize from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('analysis_timestamp');
      if (stored) {
        return parseInt(stored, 10);
      }
    }
    return null;
  });

  const setComplexityResults = useCallback((results: ComplexityResults | null) => {
    setComplexityResultsState(results);
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (results) {
        localStorage.setItem('complexity_results', JSON.stringify(results));
      } else {
        localStorage.removeItem('complexity_results');
      }
    }
  }, []);

  const clearComplexityResults = useCallback(() => {
    setComplexityResultsState(null);
    // Clear from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('complexity_results');
    }
  }, []);

  const updateAnalysisTimestamp = useCallback((timestamp: number) => {
    setAnalysisTimestamp(timestamp);
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('analysis_timestamp', timestamp.toString());
    }
  }, []);

  return (
    <ComplexityContext.Provider
      value={{
        complexityResults,
        setComplexityResults,
        clearComplexityResults,
        analysisTimestamp,
        updateAnalysisTimestamp
      }}
    >
      {children}
    </ComplexityContext.Provider>
  );
}

export function useComplexity() {
  const context = useContext(ComplexityContext);
  if (context === undefined) {
    throw new Error('useComplexity must be used within a ComplexityProvider');
  }
  return context;
}
