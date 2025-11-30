'use client';

import PromptsManager from '@/components/PromptsManager';

export default function PromptsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Manage Prompts</h1>
            <p className="text-sm text-gray-600 mt-1">Add, edit, or delete custom analysis prompts</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <PromptsManager />
      </div>
    </div>
  );
}

