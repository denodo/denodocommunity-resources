'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Search, Filter, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface DatabaseMetrics {
  views: number;
  dataSources: number;
  baseViews: number;
  derivedViews: number;
  interfaceViews: number;
  cachedViews: number;
  associations: number;
  cachePercentage: number | string;
}

interface DatabaseRow {
  name: string;
  isSystemDatabase?: boolean;
  metrics: DatabaseMetrics;
}

export default function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<DatabaseRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    try {
      const response = await fetch('/api/analysis/databases');
      const data = await response.json();
      setDatabases(data.databases || []);
    } catch (error) {
      console.error('Failed to load databases:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter databases
  const filteredDatabases = databases.filter(db => {
    const matchesSearch = db.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    if (filterType === 'cached') {
      const percentage = typeof db.metrics.cachePercentage === 'string' ? 0.1 : db.metrics.cachePercentage;
      return matchesSearch && percentage > 0;
    }
    if (filterType === 'uncached') {
      const percentage = typeof db.metrics.cachePercentage === 'string' ? 0.1 : db.metrics.cachePercentage;
      return matchesSearch && percentage === 0;
    }

    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading databases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div className="flex items-center gap-3">
                <img
                  src="/denodo_logo2.png"
                  alt="Denodo"
                  className="h-8 w-auto drop-shadow-md"
                />
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">VDB Breakdown</h1>
                  <p className="text-sm text-gray-600">
                    Detailed view of all {databases.length} virtual databases
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search databases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
              >
                <option value="all">All Databases</option>
                <option value="cached">With Cache</option>
                <option value="uncached">No Cache</option>
              </select>
            </div>
          </div>
        </div>

        {/* Databases Table */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Database Name</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Data Sources</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Base Views</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Derived Views</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Interface Views</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Cached Views</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Associations</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Total Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDatabases.map((db, index) => {
                  const isSystemDb = db.isSystemDatabase || db.name === 'admin';
                  const cachePercentage = typeof db.metrics.cachePercentage === 'string'
                    ? db.metrics.cachePercentage
                    : db.metrics.cachePercentage;

                  return (
                    <tr
                      key={db.name}
                      onClick={() => router.push(`/databases/${encodeURIComponent(db.name)}`)}
                      className={`
                        cursor-pointer transition-all hover:bg-indigo-50
                        ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        ${isSystemDb ? 'opacity-60' : ''}
                      `}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Database className={`w-5 h-5 ${isSystemDb ? 'text-gray-400' : 'text-indigo-600'}`} />
                          <div>
                            <div className="font-semibold text-gray-900">{db.name}</div>
                            {isSystemDb && (
                              <span className="text-xs text-gray-500 uppercase tracking-wide">System Database</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 bg-blue-100 text-blue-800 rounded-lg font-semibold text-sm">
                          {db.metrics.dataSources}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 bg-green-100 text-green-800 rounded-lg font-semibold text-sm">
                          {db.metrics.baseViews}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 bg-purple-100 text-purple-800 rounded-lg font-semibold text-sm">
                          {db.metrics.derivedViews}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 bg-red-100 text-red-800 rounded-lg font-semibold text-sm">
                          {db.metrics.interfaceViews}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center justify-center w-12 h-8 bg-teal-100 text-teal-800 rounded-lg font-semibold text-sm">
                            {db.metrics.cachedViews}
                          </span>
                          {(typeof cachePercentage === 'string' || cachePercentage > 0) && (
                            <span className="text-xs text-teal-600 font-medium">
                              {cachePercentage}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 bg-amber-100 text-amber-800 rounded-lg font-semibold text-sm">
                          {db.metrics.associations}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[3rem] h-8 bg-indigo-100 text-indigo-800 rounded-lg font-bold text-sm px-3">
                          {db.metrics.views}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredDatabases.length === 0 && (
            <div className="text-center py-16">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No databases found</h3>
              <p className="text-sm text-gray-500">
                {searchTerm || filterType !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'No databases were found in the uploaded VQL file'}
              </p>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="mt-6 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Showing {filteredDatabases.length} of {databases.length} databases</span>
            <span>Click any row to view detailed information</span>
          </div>
        </div>
      </div>
    </div>
  );
}
