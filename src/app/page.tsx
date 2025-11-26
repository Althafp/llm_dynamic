'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalImages: number; // Count from date with most images
  totalLocations: number; // Same as totalImages (date with most images)
  totalAnalyses: number;
  recentAnalyses: number;
  successRate: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalImages: 0,
    totalLocations: 0,
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
        const dates = datesData.dates || [];
        // We only need the list of available dates for the sidebar card
        // No need to fetch images for every date here (keeps dashboard fast)
        setAvailableDates(dates);
      }

      // Load recent analysis results
      const resultsResponse = await fetch('/api/results/list');
      const resultsData = await resultsResponse.json();
      if (resultsData.success) {
        const results = resultsData.results || [];
        setRecentResults(results.slice(0, 5)); // Last 5

        // Total Locations = maximum images processed in any single analysis run
        const totalLocations = results.reduce(
          (max: number, r: any) => Math.max(max, r.totalImages || 0),
          0
        );

        setStats(prev => ({
          ...prev,
          totalAnalyses: results.length,
          recentAnalyses: results.slice(0, 7).length,
          totalLocations,
        }));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-black">Dashboard</h1>
          <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-black text-white rounded-full border border-gray-700">
            Guntur Experimental
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1">Overview of your CCTV analysis system</p>
      </div>

      {/* Main Content */}
      <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <svg className="animate-spin h-12 w-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600">Loading dashboard...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-6 border border-gray-300 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300">
                      <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-black mb-1">{stats.totalLocations}</div>
                  <div className="text-sm text-gray-600">Total Locations</div>
                </div>

                <div className="bg-white rounded-lg p-6 border border-gray-300 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300">
                      <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-black mb-1">{stats.totalAnalyses}</div>
                  <div className="text-sm text-gray-600">Total Analyses</div>
                </div>

                <div className="bg-white rounded-lg p-6 border border-gray-300 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300">
                      <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-black mb-1">{stats.recentAnalyses}</div>
                  <div className="text-sm text-gray-600">Recent Analyses</div>
                </div>

                {/* Removed Success Rate card as requested */}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-6 border border-gray-300 shadow-sm">
                  <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick Actions
                  </h2>
                  <div className="space-y-3">
                    <Link
                      href="/analysis"
                      className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-300 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-black group-hover:text-gray-700">Start New Analysis</div>
                          <div className="text-sm text-gray-600">Analyze images with GPT-4o Vision</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                    <Link
                      href="/results"
                      className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-300 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-black group-hover:text-gray-700">View Previous Results</div>
                          <div className="text-sm text-gray-600">Browse historical analysis data</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 border border-gray-300 shadow-sm">
                  <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Available Dates
                  </h2>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableDates.length === 0 ? (
                      <p className="text-gray-600 text-sm">No dates available</p>
                    ) : (
                      availableDates.slice(0, 10).map((date) => (
                        <div
                          key={date}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all cursor-pointer"
                          onClick={() => router.push(`/analysis?date=${date}`)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-black font-medium">{date}</span>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="bg-white rounded-lg p-6 border border-gray-300 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-black flex items-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Recent Analyses
                    </h2>
                    <Link
                      href="/results"
                      className="text-sm text-gray-600 hover:text-black font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {recentResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all cursor-pointer"
                        onClick={() => router.push(`/results?path=${encodeURIComponent(result.path)}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-black font-medium mb-1">
                              {new Date(result.created).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600">
                              {result.date} • {result.cameraType} • {result.totalImages} images
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-gray-800 font-semibold">{result.successful}</div>
                              <div className="text-xs text-gray-500">success</div>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}
