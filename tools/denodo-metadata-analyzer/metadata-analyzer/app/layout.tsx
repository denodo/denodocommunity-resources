'use client';

import './globals.css';
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Database, Monitor, AlertTriangle, TrendingUp, Settings, Upload, BarChart2, Layers } from 'lucide-react';
import { ComplexityProvider } from '@/contexts/ComplexityContext';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Always show sidebar except on root path /
  const showSidebar = pathname !== '/';

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/databases', label: 'VDB Breakdown', icon: Database },
    { href: '/global-stats', label: 'Global Stats', icon: Monitor },
    { href: '/duplicates', label: 'Duplicates', icon: AlertTriangle },
    { href: '/data-sources', label: 'Data Sources', icon: BarChart2 },
    { href: '/web-services', label: 'Web Services', icon: Database },
    { href: '/view-complexity', label: 'View Complexity', icon: TrendingUp },
    { href: '/server-config', label: 'Server Config', icon: Settings },
    { href: '/solution-manager', label: 'Solution Manager', icon: Layers },
  ];

  if (!showSidebar) {
    return (
      <html lang="en">
        <head>
          <title>Denodo Metadata Analyzer</title>
          <link rel="icon" href="/denodo_logo2.png" />
        </head>
        <body>
          <ComplexityProvider>
            {children}
          </ComplexityProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>Denodo Metadata Analyzer</title>
        <link rel="icon" href="/denodo_logo2.png" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <ComplexityProvider>
          <div style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          backgroundColor: '#f8f9fa'
        }}>
          {/* Sidebar matching VDB Breakdown style */}
          <aside style={{
            width: '220px',
            backgroundColor: '#2c3e50',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Logo Header with icon */}
            <div style={{
              padding: '20px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                backgroundColor: 'white',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}>
                <img
                  src="/denodo_logo2.png"
                  alt="Denodo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <span style={{
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.3px'
              }}>Metadata Analyzer</span>
            </div>

            {/* Navigation */}
            <nav style={{
              flex: 1,
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              overflowY: 'auto'
            }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      backgroundColor: isActive ? '#5dade2' : 'transparent',
                      color: isActive ? 'white' : '#b0bec5'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#b0bec5';
                      }
                    }}
                  >
                    <Icon size={18} style={{ flexShrink: 0 }} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* New Analysis Button */}
            <div style={{
              padding: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Link
                href="/"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'background-color 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2980b9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3498db';
                }}
              >
                <Upload size={16} />
                <span>New Analysis</span>
              </Link>
            </div>
          </aside>

          {/* Main Content */}
          <main style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {children}
          </main>
        </div>
        </ComplexityProvider>
      </body>
    </html>
  );
}
