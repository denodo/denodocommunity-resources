'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Server,
  Shield,
  Zap,
  Settings,
  Cpu,
  Code,
  Globe,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Database
} from 'lucide-react';
import { DuckDBClient } from '../../src/lib/database/duckdb-client';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/lib/theme';

interface ServerConfigData {
  [key: string]: string | number | boolean | undefined;
}

interface ConfigItemProps {
  label: string;
  value: any;
  isStatus?: boolean;
  warning?: boolean;
}

interface ConfigSectionProps {
  title: string;
  icon: React.ElementType;
  bgGradient: string;
  children: React.ReactNode;
}

export default function ServerConfigPage() {
  const router = useRouter();
  const [serverConfig, setServerConfig] = useState<ServerConfigData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const client = new DuckDBClient();
        await client.initialize();
        const hasData = await client.loadFromParquet();

        if (!hasData) {
          setLoading(false);
          return;
        }

        const result = await client.query('SELECT * FROM server_configuration ORDER BY timestamp DESC LIMIT 1');

        if (result && result.length > 0) {
          const configRow = result[0];
          let parsedConfig: ServerConfigData = {};

          if (configRow.configuration) {
            if (typeof configRow.configuration === 'string') {
              parsedConfig = JSON.parse(configRow.configuration);
            } else {
              parsedConfig = configRow.configuration;
            }
          }

          // Resolve property references (both regular and WEBCONTAINER properties)
          const propsStr = localStorage.getItem('uploaded_properties');
          if (propsStr) {
            const properties = JSON.parse(propsStr);
            for (const [key, value] of Object.entries(parsedConfig)) {
              if (typeof value === 'string' && value.includes('${config.')) {
                // Handle both ${config.PROPERTY.xyz} and ${config.WEBCONTAINER.PROPERTY.xyz}
                const match = value.match(/\$\{config\.((?:WEBCONTAINER\.)?PROPERTY)\.([^}]+)\}/);
                if (match) {
                  const fullPropertyKey = `config.${match[1]}.${match[2]}`;
                  if (properties[fullPropertyKey]) {
                    parsedConfig[key] = properties[fullPropertyKey];
                  }
                }
              }
            }
          }

          setServerConfig(parsedConfig);
        }
      } catch (error) {
        console.error('Failed to load server configuration:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#fafbfc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: `3px solid ${colors.gray200}`,
            borderTopColor: colors.accent,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }}></div>
          <p style={{
            color: colors.gray600,
            fontSize: '13px',
            fontWeight: typography.fontWeight.medium
          }}>Loading configuration...</p>
        </div>
      </div>
    );
  }

  const hasConfig = Object.keys(serverConfig).length > 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafbfc',
      padding: '20px 16px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: colors.gray600,
            background: 'none',
            border: 'none',
            fontSize: '13px',
            fontWeight: typography.fontWeight.medium,
            cursor: 'pointer',
            marginBottom: '16px',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = colors.accent}
          onMouseLeave={(e) => e.currentTarget.style.color = colors.gray600}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        {/* Header Card */}
        <div style={{
          background: colors.white,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.sm,
          border: `1px solid ${colors.gray200}`,
          padding: '16px 20px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
              borderRadius: borderRadius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: shadows.sm
            }}>
              <Server size={22} color={colors.white} />
            </div>
            <div>
              <h1 style={{
                fontSize: '20px',
                fontWeight: typography.fontWeight.semibold,
                color: colors.gray900,
                margin: '0 0 2px 0',
                letterSpacing: '-0.01em'
              }}>Server Configuration</h1>
              <p style={{
                fontSize: '13px',
                color: colors.gray500,
                margin: 0
              }}>Denodo Virtual DataPort system settings</p>
            </div>
          </div>
        </div>

        {/* Configuration Sections */}
        {hasConfig ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Cache Configuration */}
            <ConfigSection
              title="CACHE Configuration"
              icon={Database}
              bgGradient="linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)"
            >
              <ConfigItem label="Cache Status" value={serverConfig.cacheStatus} isStatus />
              <ConfigItem label="Cache Maintenance" value={serverConfig.cacheMaintenance} isStatus warning={serverConfig.cacheMaintenance === 'ON'} />
              <ConfigItem label="Cache Data Source" value={serverConfig.serverCacheDataSource} />
              <ConfigItem label="Time To Live (seconds)" value={serverConfig.timeToLiveInSecs} />
            </ConfigSection>

            {/* Security */}
            <ConfigSection
              title="Security & Authentication"
              icon={Shield}
              bgGradient="linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%)"
            >
              <ConfigItem label="Kerberos Authentication" value={serverConfig.useKerberos} isStatus />
              <ConfigItem label="LDAP Authentication" value={serverConfig.useLDAP} isStatus />
              <ConfigItem label="LDAP Datasource" value={serverConfig.LDAPDatasourceName} />
              <ConfigItem label="OAuth2 Authentication" value={serverConfig.useOAuth2} isStatus />
              <ConfigItem label="SAML Authentication" value={serverConfig.useSAML} isStatus />
              <ConfigItem label="SSO Token" value={serverConfig.ssoTokenEnabled} isStatus />
              <ConfigItem label="Vault Integration" value={serverConfig.vaultEnabled} isStatus />
            </ConfigSection>

            {/* Optimization */}
            <ConfigSection
              title="Query Optimization"
              icon={Zap}
              bgGradient="linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)"
            >
              <ConfigItem label="Cost Optimization" value={serverConfig.costoptimization} isStatus />
              <ConfigItem label="Data Movement" value={serverConfig.dataMovement} isStatus />
              <ConfigItem label="Dynamic Optimization" value={serverConfig.simplify} isStatus />
              <ConfigItem label="Summary Rewrite" value={serverConfig.summaryRewrite} isStatus />
            </ConfigSection>

            {/* Connection */}
            <ConfigSection
              title="Connection & Threading"
              icon={Settings}
              bgGradient="linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%)"
            >
              <ConfigItem label="Maximum Thread Pool" value={serverConfig.maxThreads} />
              <ConfigItem label="JDBC Max Active" value={serverConfig.jdbcMaxActive} />
            </ConfigSection>

            {/* System */}
            <ConfigSection
              title="System Settings"
              icon={Cpu}
              bgGradient="linear-gradient(135deg, #99f6e4 0%, #5eead4 100%)"
            >
              <ConfigItem label="Identifier Charset" value={serverConfig.identifiersCharset} />
              <ConfigItem label="I18n Default" value={serverConfig.i18nDefault} />
            </ConfigSection>

            {/* VCS */}
            <ConfigSection
              title="Version Control"
              icon={Code}
              bgGradient="linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%)"
            >
              <ConfigItem label="VCS Integration" value={serverConfig.useVCS} isStatus />
              {(serverConfig.useVCS === 'true' || serverConfig.useVCS === true) && (
                <>
                  <ConfigItem label="VCS System" value={serverConfig.vcsSystem} />
                  <ConfigItem label="VCS URL" value={serverConfig.vcsUrl} />
                </>
              )}
            </ConfigSection>

            {/* Web Container */}
            <ConfigSection
              title="Web Container"
              icon={Globe}
              bgGradient="linear-gradient(135deg, #a5f3fc 0%, #67e8f9 100%)"
            >
              <ConfigItem label="Tomcat Port" value={serverConfig.tomcatPort} />
              <ConfigItem label="Tomcat JVM Options" value={serverConfig.tomcatJvmOptions} />
            </ConfigSection>
          </div>
        ) : (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.md,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            padding: '48px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #f1f5f9 0%, #dbeafe 100%)',
              borderRadius: borderRadius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Server size={32} color={colors.gray400} />
            </div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: typography.fontWeight.semibold,
              color: colors.gray900,
              margin: '0 0 6px 0'
            }}>No Configuration Found</h3>
            <p style={{
              fontSize: '13px',
              color: colors.gray500,
              margin: 0
            }}>Configuration could not be extracted from the VQL file.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Config Section Component - Horizontal LEFT-RIGHT Layout
function ConfigSection({ title, icon: Icon, bgGradient, children }: ConfigSectionProps) {
  const items = React.Children.toArray(children).filter(child => child !== null);
  if (items.length === 0) return null;

  return (
    <div style={{
      background: colors.white,
      borderRadius: borderRadius.md,
      boxShadow: shadows.sm,
      border: `1px solid ${colors.gray200}`,
      overflow: 'hidden'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr' }}>
        {/* LEFT: Category Panel */}
        <div style={{
          background: bgGradient,
          padding: '18px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'rgba(255, 255, 255, 0.5)',
            borderRadius: borderRadius.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <Icon size={22} color={colors.gray800} />
          </div>
          <h2 style={{
            fontSize: '14px',
            fontWeight: typography.fontWeight.semibold,
            color: colors.gray800,
            margin: 0,
            lineHeight: '1.3'
          }}>{title}</h2>
        </div>

        {/* RIGHT: Config Items */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items}
          </div>
        </div>
      </div>
    </div>
  );
}

// Config Item Component
function ConfigItem({ label, value, isStatus = false, warning = false }: ConfigItemProps) {
  if (!value || value === '') return null;

  // Don't show unresolved property references for non-status fields
  if (!isStatus && typeof value === 'string' && value.startsWith('${config.')) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      background: colors.gray50,
      borderRadius: '6px',
      transition: 'background 0.15s ease'
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = colors.gray100}
    onMouseLeave={(e) => e.currentTarget.style.background = colors.gray50}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          fontSize: '13px',
          fontWeight: typography.fontWeight.medium,
          color: colors.gray700
        }}>{label}:</span>
        {warning && (
          <span style={{
            fontSize: '10px',
            background: '#fef3c7',
            color: '#92400e',
            padding: '1px 6px',
            borderRadius: borderRadius.full,
            fontWeight: typography.fontWeight.semibold
          }}>
            Not recommended
          </span>
        )}
      </div>

      {isStatus ? (
        <StatusBadge value={value} />
      ) : (
        <span style={{
          fontSize: '12px',
          fontWeight: typography.fontWeight.semibold,
          color: colors.gray900,
          background: colors.white,
          padding: '4px 10px',
          borderRadius: '4px',
          border: `1px solid ${colors.gray300}`,
          fontFamily: 'monospace'
        }}>
          {value}
        </span>
      )}
    </div>
  );
}

// Status Badge Component
function StatusBadge({ value }: { value: any }) {
  const isEnabled = value === 'true' || value === true || (typeof value === 'string' && value.toUpperCase() === 'ON');

  if (isEnabled) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        background: '#d1fae5',
        color: '#065f46',
        borderRadius: '4px',
        border: '1px solid #6ee7b7',
        fontWeight: typography.fontWeight.semibold,
        fontSize: '12px'
      }}>
        <CheckCircle2 size={14} color="#059669" />
        <span>Enabled</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 10px',
      background: colors.gray100,
      color: colors.gray600,
      borderRadius: '4px',
      border: `1px solid ${colors.gray300}`,
      fontWeight: typography.fontWeight.semibold,
      fontSize: '12px'
    }}>
      <XCircle size={14} color={colors.gray500} />
      <span>Disabled</span>
    </div>
  );
}
