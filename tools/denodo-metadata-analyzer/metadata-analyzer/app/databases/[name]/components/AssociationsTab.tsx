'use client';

import React, { useState, useMemo } from 'react';
import { GitBranch, ChevronLeft, ChevronRight, Search, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Endpoint {
  alias: string;
  table: string;
  cardinality: string;
  isPrincipal?: boolean;
}

interface Mapping {
  leftColumn?: string;
  rightColumn?: string;
  displayMapping?: string;
}

interface Association {
  id: number;
  name: string;
  kind?: string;
  database: string;
  folder?: string;
  endpoints?: Endpoint[];
  mapping?: {
    parsedMappings?: Mapping[];
    rawMapping?: string;
  };
}

interface AssociationsTabProps {
  associations: Association[];
}

// Helper function to determine relationship type from endpoints
const getRelationshipType = (endpoints?: Endpoint[] | string): string => {
  let parsedEndpoints: Endpoint[] = [];
  if (typeof endpoints === 'string') {
    try {
      parsedEndpoints = JSON.parse(endpoints);
    } catch {
      return 'Unknown';
    }
  } else if (Array.isArray(endpoints)) {
    parsedEndpoints = endpoints;
  } else {
    return 'Unknown';
  }

  if (!parsedEndpoints || parsedEndpoints.length < 2) {
    return 'Unknown';
  }

  const cardinalityCounts: { one?: number; many?: number } = {};
  parsedEndpoints.forEach(endpoint => {
    if (!endpoint.cardinality) return;
    const cardinality = endpoint.cardinality.trim();
    if (cardinality.includes('0,1') || cardinality.includes('1')) {
      cardinalityCounts['one'] = (cardinalityCounts['one'] || 0) + 1;
    } else if (cardinality.includes('0,*') || cardinality.includes('*')) {
      cardinalityCounts['many'] = (cardinalityCounts['many'] || 0) + 1;
    }
  });

  const oneCount = cardinalityCounts['one'] || 0;
  const manyCount = cardinalityCounts['many'] || 0;

  if (oneCount === 2 && manyCount === 0) return 'One-to-One';
  if (oneCount === 1 && manyCount === 1) return 'One-to-Many';
  if (oneCount === 0 && manyCount === 2) return 'Many-to-Many';
  if (oneCount + manyCount > 0) return `${oneCount}:${manyCount}`;
  return 'Complex';
};

const getRelationshipColor = (type: string) => {
  if (type === 'One-to-One') return { bg: '#eff6ff', text: '#2563eb' };
  if (type === 'One-to-Many') return { bg: '#f0fdf4', text: '#059669' };
  if (type === 'Many-to-Many') return { bg: '#fdf4ff', text: '#a855f7' };
  return { bg: '#f9fafb', text: '#6b7280' };
};

const AssociationsTab: React.FC<AssociationsTabProps> = ({ associations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Parse JSON fields in associations
  const parsedAssociations = useMemo(() => {
    return associations.map(a => {
      let endpoints = a.endpoints;
      let mapping = a.mapping;

      if (typeof endpoints === 'string') {
        try {
          endpoints = JSON.parse(endpoints);
        } catch {
          endpoints = [];
        }
      }

      if (typeof mapping === 'string') {
        try {
          mapping = JSON.parse(mapping);
        } catch {
          mapping = undefined;
        }
      }

      return { ...a, endpoints, mapping };
    });
  }, [associations]);

  // Filter associations
  const filteredAssociations = useMemo(() => {
    if (!searchTerm) return parsedAssociations;
    return parsedAssociations.filter(a =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.folder?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [parsedAssociations, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredAssociations.length / itemsPerPage);
  const paginatedAssociations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAssociations.slice(start, start + itemsPerPage);
  }, [filteredAssociations, currentPage]);

  // Reset to page 1 when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (associations.length === 0) {
    return (
      <div style={{
        padding: '60px 20px',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <GitBranch size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: '#9ca3af' }} />
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
          No Associations
        </h3>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
          This database has no association definitions found.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={16} style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9ca3af'
          }} />
          <input
            type="text"
            placeholder="Search associations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 34px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
      </div>

      {/* Results Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        <div>
          Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredAssociations.length)} of {filteredAssociations.length} association{filteredAssociations.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      </div>

      {/* Table */}
      {filteredAssociations.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#9ca3af',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <GitBranch size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: '14px' }}>No associations found matching your search</div>
        </div>
      ) : (
        <>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={headerStyle}>Association Name</th>
                  <th style={headerStyle}>Tables Used</th>
                  <th style={headerStyle}>Cardinality</th>
                  <th style={headerStyle}>Column Mappings</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssociations.map((association, idx) => {
                  const endpoints = association.endpoints || [];

                  // Format tables as "alias" → table for each endpoint
                  const tablesDisplay = endpoints.map(e =>
                    `"${e.alias}" → ${e.table}`
                  ).join('\n') || '-';

                  // Get cardinalities for each endpoint
                  const cardinalitiesDisplay = endpoints.map(e =>
                    `(${e.cardinality})`
                  ).join('\n') || '-';

                  const mappings = association.mapping?.parsedMappings || [];
                  const mappingText = mappings.map(m =>
                    m.displayMapping || `${m.leftColumn} = ${m.rightColumn}`
                  ).join(', ') || '-';

                  return (
                    <tr
                      key={association.id}
                      style={{
                        borderBottom: idx < paginatedAssociations.length - 1 ? '1px solid #f3f4f6' : 'none',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <td style={cellStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{
                            fontWeight: '500',
                            color: '#111827',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <GitBranch size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
                            {association.name}
                          </div>
                          {association.folder && (
                            <div style={{ fontSize: '11px', color: '#9ca3af', paddingLeft: '20px' }}>
                              {association.folder}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={cellStyle}>
                        <div style={{
                          fontSize: '12px',
                          color: '#374151',
                          fontFamily: 'Monaco, Consolas, monospace',
                          whiteSpace: 'pre-line',
                          lineHeight: '1.6'
                        }}>
                          {tablesDisplay}
                        </div>
                      </td>
                      <td style={cellStyle}>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontFamily: 'Monaco, Consolas, monospace',
                          whiteSpace: 'pre-line',
                          lineHeight: '1.6'
                        }}>
                          {cardinalitiesDisplay}
                        </div>
                      </td>
                      <td style={cellStyle}>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'Monaco, Consolas, monospace'
                        }} title={mappingText}>
                          {mappingText}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              padding: '12px 0'
            }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                Page {currentPage} of {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  style={getButtonStyle(currentPage === 1)}
                  title="First page"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={getButtonStyle(currentPage === 1)}
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <div style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: '#111827',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {currentPage} / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={getButtonStyle(currentPage === totalPages)}
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  style={getButtonStyle(currentPage === totalPages)}
                  title="Last page"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#6b7280',
  whiteSpace: 'nowrap'
};

const cellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '13px',
  color: '#374151',
  verticalAlign: 'middle'
};

const getButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  backgroundColor: disabled ? '#f9fafb' : 'white',
  color: disabled ? '#d1d5db' : '#374151',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  transition: 'all 0.2s',
  opacity: disabled ? 0.5 : 1
});

export default AssociationsTab;
