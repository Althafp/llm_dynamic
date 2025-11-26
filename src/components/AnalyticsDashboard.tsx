'use client';

import { useEffect, useState, useMemo } from 'react';
import { ANALYSIS_PROMPTS } from '@/lib/analysis-prompts';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsStats {
  totalImages: number;
  successful: number;
  failed: number;
  byPrompt: Array<{
    promptId: string;
    promptName: string;
    totalAnalyzed: number;
    matches: number;
    totalCount: number;
    averageCount: number;
  }>;
  byCameraType: Array<{
    cameraType: string;
    count: number;
    successful: number;
  }>;
  byDate: Record<string, number>;
}

interface AnalyticsDashboardProps {
  results: any[];
}

export default function AnalyticsDashboard({ results }: AnalyticsDashboardProps) {
  // Compute analytics on the client side instead of making API call
  const stats = useMemo<AnalyticsStats | null>(() => {
    if (!results || results.length === 0) return null;

    const totalImages = results.length;
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    // Group by prompt
    const promptStats: Record<string, {
      totalAnalyzed: number;
      matches: number;
      totalCount: number;
    }> = {};

    ANALYSIS_PROMPTS.forEach(prompt => {
      promptStats[prompt.id] = {
        totalAnalyzed: 0,
        matches: 0,
        totalCount: 0,
      };
    });

    results.forEach(result => {
      if (result.results && Array.isArray(result.results)) {
        result.results.forEach((analysis: any) => {
          const promptId = analysis.promptId;
          if (promptStats[promptId]) {
            promptStats[promptId].totalAnalyzed++;
            if (analysis.match) {
              promptStats[promptId].matches++;
              promptStats[promptId].totalCount += typeof analysis.count === 'number' ? analysis.count : 0;
            }
          }
        });
      }
    });

    const byPrompt = ANALYSIS_PROMPTS.map(prompt => {
      const stats = promptStats[prompt.id] || { totalAnalyzed: 0, matches: 0, totalCount: 0 };
      return {
        promptId: prompt.id,
        promptName: prompt.name,
        totalAnalyzed: stats.totalAnalyzed,
        matches: stats.matches,
        totalCount: stats.totalCount,
        averageCount: stats.matches > 0 ? stats.totalCount / stats.matches : 0,
      };
    });

    // Group by camera type
    const cameraTypeStats: Record<string, { count: number; successful: number }> = {};
    results.forEach(result => {
      const cameraType = result.cameraType || 'UNKNOWN';
      if (!cameraTypeStats[cameraType]) {
        cameraTypeStats[cameraType] = { count: 0, successful: 0 };
      }
      cameraTypeStats[cameraType].count++;
      if (result.status === 'success') {
        cameraTypeStats[cameraType].successful++;
      }
    });

    const byCameraType = Object.entries(cameraTypeStats).map(([cameraType, stats]) => ({
      cameraType,
      count: stats.count,
      successful: stats.successful,
    }));

    // Group by date
    const byDate: Record<string, number> = {};
    results.forEach(result => {
      const date = result.date || 'UNKNOWN';
      byDate[date] = (byDate[date] || 0) + 1;
    });

    return {
      totalImages,
      successful,
      failed,
      byPrompt,
      byCameraType,
      byDate,
    };
  }, [results]);

  if (!stats) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <div className="p-4 text-center text-gray-600">
          No analytics data available
        </div>
      </div>
    );
  }

  const COLORS = ['#000000', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB'];

  // Prepare chart data
  const promptChartData = stats.byPrompt.map((p) => ({
    name: p.promptName.length > 15 ? p.promptName.substring(0, 15) + '...' : p.promptName,
    fullName: p.promptName,
    matches: p.matches,
    analyzed: p.totalAnalyzed,
    matchRate: p.totalAnalyzed > 0 ? ((p.matches / p.totalAnalyzed) * 100).toFixed(1) : 0,
  }));

  // Note: We focus on locations and matches; camera-type and success/fail breakdown
  // charts have been removed per UX requirements.

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 className="text-2xl font-bold text-black">Analytics Dashboard</h2>
      </div>
      
      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 border border-gray-300 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Total Locations</div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-black">{stats.totalImages}</div>
        </div>
        <div className="bg-gray-50 border border-gray-300 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Successful Analyses</div>
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-black">{stats.successful}</div>
        </div>
      </div>

      {/* Detections Found - Bar Chart */}
      <div className="bg-gray-50 rounded-lg border border-gray-300 p-6">
        <h3 className="text-lg font-semibold mb-4 text-black">Detections Found</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={promptChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" stroke="#6B7280" />
            <YAxis dataKey="name" type="category" width={150} stroke="#6B7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'matches') return [value, 'Matches'];
                if (name === 'analyzed') return [value, 'Analyzed'];
                return [value, name];
              }}
            />
            <Legend />
            <Bar dataKey="matches" fill="#000000" name="Matches" />
            <Bar dataKey="analyzed" fill="#9CA3AF" name="Total Analyzed" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Analytics Detection Percentage - Line Chart */}
      <div className="bg-gray-50 rounded-lg border border-gray-300 p-6">
        <h3 className="text-lg font-semibold mb-4 text-black">Analytics Detection Percentage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={promptChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" stroke="#6B7280" angle={-45} textAnchor="end" height={100} />
            <YAxis stroke="#6B7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
              }}
              formatter={(value: string) => [`${value}%`, 'Match Rate']}
            />
            <Line
              type="monotone"
              dataKey="matchRate"
              stroke="#000000"
              strokeWidth={3}
              dot={{ fill: '#000000', r: 5 }}
              name="Match Rate (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Prompt Stats Table */}
      <div className="bg-gray-50 rounded-lg border border-gray-300 p-6">
        <h3 className="text-lg font-semibold mb-4 text-black">Detailed Analysis by Prompt</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-3 px-4 font-semibold text-black">Analysis Type</th>
                <th className="text-right py-3 px-4 font-semibold text-black">Total Analyzed</th>
                <th className="text-right py-3 px-4 font-semibold text-black">Matches</th>
                <th className="text-right py-3 px-4 font-semibold text-black">Match Rate</th>
                <th className="text-right py-3 px-4 font-semibold text-black">Total Count</th>
                <th className="text-right py-3 px-4 font-semibold text-black">Average</th>
              </tr>
            </thead>
            <tbody>
              {stats.byPrompt.map((prompt) => (
                <tr key={prompt.promptId} className="border-b border-gray-200 hover:bg-gray-100">
                  <td className="py-3 px-4 font-medium text-black">{prompt.promptName}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{prompt.totalAnalyzed}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{prompt.matches}</td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    {prompt.totalAnalyzed > 0
                      ? `${((prompt.matches / prompt.totalAnalyzed) * 100).toFixed(1)}%`
                      : '0%'}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">{prompt.totalCount}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{prompt.averageCount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

