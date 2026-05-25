'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Database, Layers, Eye, Settings, GitBranch, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface DatabaseDetail {
  name: string;
  metrics: {
    dataSources: number;
    baseViews: number;
    derivedViews: number;
    interfaceViews: number;
    cachedViews: number;
    associations: number;
    totalViews: number;
  };
  dataSources: any[];
  views: any[];
  cachedViews: any[];
  associations: any[];
}

export default function DatabaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const databaseName = decodeURIComponent(params.name as string);

  const [database, setDatabase] = useState<DatabaseDetail | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDatabaseDetails();
  }, [databaseName]);

  const loadDatabaseDetails = async () => {
    try {
      const response = await fetch(`/api/analysis/databases/${encodeURIComponent(databaseName)}`);
      const data = await response.json();
      if (data.success) {
        setDatabase(data.database);
      }
    } catch (error) {
      console.error('Failed to load database details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading database details...</p>
        </div>
      </div>
    );
  }

  if (!database) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Database not found</h2>
          <Link href="/databases" className="text-indigo-600 hover:text-indigo-700">
            Back to databases
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6">
          <Link
            href="/databases"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Databases
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Database className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{database.name}</h1>
              <p className="text-gray-600">Database Overview and Details</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-2 mb-6">
          <div className="flex flex-wrap gap-2">
            <TabButton
              icon={<BarChart3 className="w-4 h-4" />}
              label="Overview"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            />
            <TabButton
              icon={<Layers className="w-4 h-4" />}
              label="Data Sources"
              active={activeTab === 'datasources'}
              onClick={() => setActiveTab('datasources')}
              count={database.dataSources.length}
            />
            <TabButton
              icon={<Eye className="w-4 h-4" />}
              label="Views"
              active={activeTab === 'views'}
              onClick={() => setActiveTab('views')}
              count={database.views.length}
            />
            <TabButton
              icon={<Settings className="w-4 h-4" />}
              label="Cache"
              active={activeTab === 'cache'}
              onClick={() => setActiveTab('cache')}
              count={database.cachedViews.length}
            />
            <TabButton
              icon={<GitBranch className="w-4 h-4" />}
              label="Associations"
              active={activeTab === 'associations'}
              onClick={() => setActiveTab('associations')}
              count={database.associations.length}
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-6">
          {activeTab === 'overview' && <OverviewTab database={database} />}
          {activeTab === 'datasources' && <DataSourcesTab dataSources={database.dataSources} />}
          {activeTab === 'views' && <ViewsTab views={database.views} />}
          {activeTab === 'cache' && <CacheTab cachedViews={database.cachedViews} />}
          {activeTab === 'associations' && <AssociationsTab associations={database.associations} />}
        </div>
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({ icon, label, active, onClick, count }: any) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
        ${active
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${active ? 'bg-white/20' : 'bg-gray-300'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Overview Tab
function OverviewTab({ database }: { database: DatabaseDetail }) {
  const metrics = database.metrics;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Database Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Data Sources" value={metrics.dataSources} color="blue" />
        <MetricCard title="Base Views" value={metrics.baseViews} color="green" />
        <MetricCard title="Derived Views" value={metrics.derivedViews} color="purple" />
        <MetricCard title="Interface Views" value={metrics.interfaceViews} color="red" />
        <MetricCard title="Cached Views" value={metrics.cachedViews} color="teal" />
        <MetricCard title="Associations" value={metrics.associations} color="amber" />
        <MetricCard title="Total Views" value={metrics.totalViews} color="indigo" large />
      </div>
    </div>
  );
}

function MetricCard({ title, value, color, large }: any) {
  const colorClasses: any = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    red: 'from-red-500 to-red-600',
    teal: 'from-teal-500 to-teal-600',
    amber: 'from-amber-500 to-amber-600',
    indigo: 'from-indigo-500 to-indigo-600'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 text-white shadow-lg ${large ? 'lg:col-span-4' : ''}`}>
      <div className="text-sm font-medium opacity-90 mb-2">{title}</div>
      <div className={`font-bold ${large ? 'text-5xl' : 'text-3xl'}`}>{value}</div>
    </div>
  );
}

// Data Sources Tab
function DataSourcesTab({ dataSources }: { dataSources: any[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Data Sources ({dataSources.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Folder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dataSources.map((ds, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{ds.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">
                    {ds.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{ds.folder || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Views Tab
function ViewsTab({ views }: { views: any[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Views ({views.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kind</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Folder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {views.map((v, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                    v.kind === 'view' ? 'bg-green-100 text-green-800' :
                    v.kind === 'derived' ? 'bg-purple-100 text-purple-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {v.kind}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{v.folder || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Cache Tab
function CacheTab({ cachedViews }: { cachedViews: any[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Cached Views ({cachedViews.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">View Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cache Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cache Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cachedViews.map((c, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-md text-xs font-medium">
                    {c.cache_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.cache_type || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Associations Tab
function AssociationsTab({ associations }: { associations: any[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Associations ({associations.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kind</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Endpoints</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {associations.map((a, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-medium">
                    {a.kind}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {a.endpoints ? JSON.parse(a.endpoints).length : 0} endpoints
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
