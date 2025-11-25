'use client';

import { useEffect, useState, useMemo } from 'react';
import { ANALYSIS_PROMPTS } from '@/lib/analysis-prompts';

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

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 className="text-2xl font-bold text-black">Analytics Dashboard</h2>
      </div>
      
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 border border-gray-300 p-4 rounded-lg">
          <div className="text-2xl font-bold text-black">{stats.totalImages}</div>
          <div className="text-sm text-gray-600">Total Images</div>
        </div>
        <div className="bg-gray-50 border border-gray-300 p-4 rounded-lg">
          <div className="text-2xl font-bold text-black">{stats.successful}</div>
          <div className="text-sm text-gray-600">Successful</div>
        </div>
        <div className="bg-gray-50 border border-gray-300 p-4 rounded-lg">
          <div className="text-2xl font-bold text-black">{stats.failed}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>

      {/* By Prompt */}
      <div className="bg-gray-50 rounded-lg border border-gray-300 p-6">
        <h3 className="text-xl font-semibold mb-4 text-black">Analysis by Prompt</h3>
        <div className="space-y-3">
          {stats.byPrompt.map((prompt) => (
            <div key={prompt.promptId} className="border-b border-gray-300 pb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-black">{prompt.promptName}</span>
                <span className="text-sm text-gray-600">
                  {prompt.matches} matches / {prompt.totalAnalyzed} analyzed
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-600">
                  Total Count: <span className="font-semibold text-black">{prompt.totalCount}</span>
                </span>
                <span className="text-gray-600">
                  Average: <span className="font-semibold text-black">{prompt.averageCount.toFixed(2)}</span>
                </span>
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-black h-2 rounded-full"
                  style={{ width: `${(prompt.matches / prompt.totalAnalyzed) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By Camera Type */}
      <div className="bg-gray-50 rounded-lg border border-gray-300 p-6">
        <h3 className="text-xl font-semibold mb-4 text-black">Analysis by Camera Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.byCameraType.map((type) => (
            <div key={type.cameraType} className="p-4 bg-white rounded-lg border border-gray-300">
              <div className="font-semibold text-black">{type.cameraType}</div>
              <div className="text-sm text-gray-600 mt-1">
                {type.count} images • {type.successful} successful
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

