'use client';

import React, { useEffect, useState } from 'react';
import { DuckDBClient } from '../../src/lib/database/duckdb-client';
import { colors, spacing, borderRadius, shadows } from '../../src/lib/theme';

type WebService = {
  name: string;
  type: 'REST' | 'SOAP' | string;
  database: string;
  folder?: string | null;
  resourceName?: string | null;
  schemaName?: string | null;
};

export default function WebServicesPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'REST' | 'SOAP'>('REST');
  const [restServices, setRestServices] = useState<WebService[]>([]);
  const [soapServices, setSoapServices] = useState<WebService[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const client = new DuckDBClient();
        await client.initialize();
        const hasData = await client.loadFromParquet();
        if (!hasData) {
          window.location.href = '/';
          return;
        }

        const rest = await client.query<WebService>("SELECT name, type, database, folder, resource_name, schema_name FROM webservices WHERE type = 'REST'");
        const soap = await client.query<WebService>("SELECT name, type, database, folder, resource_name, schema_name FROM webservices WHERE type = 'SOAP'");

        setRestServices(rest);
        setSoapServices(soap);
      } catch (e) {
        console.error('Failed to load web services:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const TabButton = ({ id, label, count }: { id: 'REST' | 'SOAP'; label: string; count: number }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.xs,
          padding: `${spacing.sm} ${spacing.md}`,
          background: isActive ? colors.accent : 'transparent',
          border: 'none',
          borderRadius: borderRadius.md,
          fontSize: '13px',
          fontWeight: 600,
          color: isActive ? colors.white : colors.gray700,
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLButtonElement).style.background = colors.gray100;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }
        }}
      >
        <span>{label}</span>
        <span style={{
          fontSize: '11px',
          opacity: 0.9,
          backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : colors.gray200,
          padding: '2px 6px',
          borderRadius: borderRadius.sm
        }}>({count})</span>
      </button>
    );
  };

  const Table = ({ rows, isRest }: { rows: WebService[]; isRest: boolean }) => {
    const columns = [
      { key: 'name', label: 'Web Service Name' },
      { key: 'database', label: 'Database' },
      { key: 'folder', label: 'Folder' },
      isRest ? { key: 'resourceName', label: 'Resource Name' } : { key: 'schemaName', label: 'Schema Name' }
    ];

    return (
      <div style={{ width: '100%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns.length}, minmax(160px, 1fr))`,
          gap: spacing.sm,
          padding: spacing.md,
          background: colors.gray100,
          borderBottom: `1px solid ${colors.gray200}`,
          fontSize: '11px',
          fontWeight: 600,
          color: colors.gray700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {columns.map(c => (
            <div key={c.key} style={{ padding: spacing.xs }}>{c.label}</div>
          ))}
        </div>
        {rows.map((r, idx) => (
          <div key={idx} style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(160px, 1fr))`,
            gap: spacing.sm,
            padding: spacing.md,
            borderBottom: `1px solid ${colors.gray200}`
          }}>
            <div style={{ fontWeight: 600, color: colors.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.database || '-'} </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.folder || '-'} </div>
            {isRest ? (
              <div style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: '1.3' }}>{r.resourceName || '-'}</div>
            ) : (
              <div style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: '1.3' }}>{r.schemaName || '-'}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: colors.gray50 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: colors.gray600 }}>Loading web services...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.gray50, padding: spacing.lg }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, boxShadow: shadows.sm, border: `1px solid ${colors.gray200}` }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: colors.gray900, margin: 0 }}>Web Services</h1>
          <p style={{ fontSize: '14px', color: colors.gray600, marginTop: 8 }}>REST and SOAP services detected from VQL</p>
        </div>

        <div style={{ background: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, boxShadow: shadows.sm, border: `1px solid ${colors.gray200}` }}>
          <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.md }}>
            <TabButton id="REST" label="REST" count={restServices.length} />
            <TabButton id="SOAP" label="SOAP" count={soapServices.length} />
          </div>

          {activeTab === 'REST' ? (
            <Table rows={restServices} isRest={true} />
          ) : (
            <Table rows={soapServices} isRest={false} />
          )}
        </div>
      </div>
    </div>
  );
}
