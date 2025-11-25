'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalImages: number;
  totalAnalyses: number;
  recentAnalyses: number;
  successRate: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalImages: 0,
    totalAnalyses: 0,
    recentAnalyses: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load available dates
      const datesResponse = await fetch('/api/images/list');
      const datesData = await datesResponse.json();
      if (datesData.success) {
        setAvailableDates(datesData.dates || []);
        
        // Count total images for most recent date
        if (datesData.dates && datesData.dates.length > 0) {
          const recentDate = datesData.dates[0];
          const imagesResponse = await fetch(`/api/images/list?date=${recentDate}`);
          const imagesData = await imagesResponse.json();
          if (imagesData.success) {
            setStats(prev => ({ ...prev, totalImages: imagesData.images?.length || 0 }));
          }
        }
      }

      // Load recent analysis results
      const resultsResponse = await fetch('/api/results/list');
      const resultsData = await resultsResponse.json();
      if (resultsData.success) {
        const results = resultsData.results || [];
        setRecentResults(results.slice(0, 5)); // Last 5
        setStats(prev => ({
          ...prev,
          totalAnalyses: results.length,
          recentAnalyses: results.slice(0, 7).length,
          successRate: results.length > 0 
            ? Math.round((results.reduce((sum: number, r: any) => sum + r.successful, 0) / 
                         results.reduce((sum: number, r: any) => sum + r.totalImages, 0)) * 100)
            : 0,
        }));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <div className="w-full">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg border-b border-white/20">
          <div className="max-w-full mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">CCTV Analysis System</h1>
                  <p className="text-sm text-white/70">AI-Powered Image Analysis Dashboard</p>
                </div>
              </div>
              <nav className="flex gap-3">
                <Link
                  href="/analysis"
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  New Analysis
                </Link>
                <Link
                  href="/results"
                  className="px-6 py-2.5 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-all border border-white/20 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  View Results
                </Link>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-full mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <svg className="animate-spin h-12 w-12 text-white mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-white/70">Loading dashboard...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{stats.totalImages}</div>
                  <div className="text-sm text-white/70">Available Images</div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{stats.totalAnalyses}</div>
                  <div className="text-sm text-white/70">Total Analyses</div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{stats.recentAnalyses}</div>
                  <div className="text-sm text-white/70">Recent Analyses</div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{stats.successRate}%</div>
                  <div className="text-sm text-white/70">Success Rate</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick Actions
                  </h2>
                  <div className="space-y-3">
                    <Link
                      href="/analysis"
                      className="block p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white group-hover:text-blue-300">Start New Analysis</div>
                          <div className="text-sm text-white/60">Analyze images with GPT-4o Vision</div>
                        </div>
                        <svg className="w-5 h-5 text-white/40 group-hover:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                    <Link
                      href="/results"
                      className="block p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white group-hover:text-blue-300">View Previous Results</div>
                          <div className="text-sm text-white/60">Browse historical analysis data</div>
                        </div>
                        <svg className="w-5 h-5 text-white/40 group-hover:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Available Dates
                  </h2>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableDates.length === 0 ? (
                      <p className="text-white/60 text-sm">No dates available</p>
                    ) : (
                      availableDates.slice(0, 10).map((date) => (
                        <div
                          key={date}
                          className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                          onClick={() => router.push(`/analysis?date=${date}`)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{date}</span>
                            <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Results */}
              {recentResults.length > 0 && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Recent Analyses
                    </h2>
                    <Link
                      href="/results"
                      className="text-sm text-blue-300 hover:text-blue-200 font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {recentResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                        onClick={() => router.push(`/results?path=${encodeURIComponent(result.path)}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium mb-1">
                              {new Date(result.created).toLocaleString()}
                            </div>
                            <div className="text-sm text-white/60">
                              {result.date} • {result.cameraType} • {result.totalImages} images
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-green-300 font-semibold">{result.successful}</div>
                              <div className="text-xs text-white/50">success</div>
                            </div>
                            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

