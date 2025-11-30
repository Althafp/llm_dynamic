'use client';

import { useState, useEffect } from 'react';
import { AnalysisPrompt, DEFAULT_PROMPTS } from '@/lib/analysis-prompts';

interface PromptsManagerProps {
  refreshTrigger?: number;
}

export default function PromptsManager({ refreshTrigger }: PromptsManagerProps) {
  const [defaultPrompts] = useState<AnalysisPrompt[]>(DEFAULT_PROMPTS);
  const [customPrompts, setCustomPrompts] = useState<AnalysisPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AnalysisPrompt | null>(null);
  const [formData, setFormData] = useState<Omit<AnalysisPrompt, 'id'>>({
    name: '',
    searchObjective: '',
    lookingFor: '',
    detectionCriteria: '',
  });

  useEffect(() => {
    loadPrompts();
  }, [refreshTrigger]);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/prompts/list');
      const data = await response.json();
      if (data.success) {
        setCustomPrompts(data.prompts || []);
      }
    } catch (error) {
      console.error('Error loading prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPrompt(null);
    setFormData({
      name: '',
      searchObjective: '',
      lookingFor: '',
      detectionCriteria: '',
    });
    setShowAddForm(true);
  };

  const handleEdit = (prompt: AnalysisPrompt) => {
    // Check if it's a default prompt
    const isDefault = defaultPrompts.some(dp => dp.id === prompt.id);
    if (isDefault) {
      alert('Default prompts cannot be edited. You can only edit custom prompts.');
      return;
    }
    
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      searchObjective: prompt.searchObjective,
      lookingFor: prompt.lookingFor,
      detectionCriteria: prompt.detectionCriteria,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    // Check if it's a default prompt
    const isDefault = defaultPrompts.some(dp => dp.id === id);
    if (isDefault) {
      alert('Default prompts cannot be deleted. You can only delete custom prompts.');
      return;
    }

    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      const response = await fetch(`/api/prompts/delete?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        loadPrompts();
      } else {
        alert(data.error || 'Failed to delete prompt');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      alert('Failed to delete prompt');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.searchObjective || !formData.lookingFor || !formData.detectionCriteria) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const url = editingPrompt 
        ? `/api/prompts/update?id=${encodeURIComponent(editingPrompt.id)}`
        : '/api/prompts/create';
      
      const method = editingPrompt ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setShowAddForm(false);
        setEditingPrompt(null);
        loadPrompts();
      } else {
        alert(data.error || 'Failed to save prompt');
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('Failed to save prompt');
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingPrompt(null);
    setFormData({
      name: '',
      searchObjective: '',
      lookingFor: '',
      detectionCriteria: '',
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800">Prompts</h2>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
            {defaultPrompts.length + customPrompts.length}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAdd}
            className="px-3 py-1 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-all flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Prompt
          </button>
          <button
            onClick={loadPrompts}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
          >
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-800 placeholder-gray-400"
                placeholder="e.g., Crowd Detection"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Objective</label>
              <textarea
                value={formData.searchObjective}
                onChange={(e) => setFormData({ ...formData, searchObjective: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-800 placeholder-gray-400"
                placeholder="Detect and measure the presence of..."
                rows={2}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Looking For</label>
              <input
                type="text"
                value={formData.lookingFor}
                onChange={(e) => setFormData({ ...formData, lookingFor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-800 placeholder-gray-400"
                placeholder="e.g., crowd clusters or dense gatherings"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detection Criteria</label>
              <textarea
                value={formData.detectionCriteria}
                onChange={(e) => setFormData({ ...formData, detectionCriteria: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-800 placeholder-gray-400"
                placeholder="Identify large groups of people..."
                rows={4}
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium"
              >
                {editingPrompt ? 'Update' : 'Add'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <svg className="animate-spin h-6 w-6 text-purple-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 mt-2">Loading prompts...</p>
        </div>
      ) : (
        <div className={`space-y-4 ${expanded ? 'max-h-none' : 'max-h-[600px] overflow-y-auto'}`}>
          {/* Default Prompts Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Default Prompts</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                {defaultPrompts.length}
              </span>
              <span className="text-xs text-gray-500">(Built-in, cannot be edited)</span>
            </div>
            <div className="space-y-2">
              {defaultPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="border border-blue-200 bg-blue-50 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-800">{prompt.name}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {prompt.id}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                          Default
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Objective:</span> {prompt.searchObjective}
                        </div>
                        <div>
                          <span className="font-medium">Looking For:</span> {prompt.lookingFor}
                        </div>
                        <div>
                          <span className="font-medium">Criteria:</span> {prompt.detectionCriteria.substring(0, 100)}
                          {prompt.detectionCriteria.length > 100 && '...'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Prompts Section */}
          <div className="border-t border-gray-300 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Custom Prompts</h3>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                {customPrompts.length}
              </span>
            </div>
            {customPrompts.length === 0 ? (
              <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">No custom prompts yet. Click "Add Prompt" to create one.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-800">{prompt.name}</span>
                          <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">
                            {prompt.id}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            <span className="font-medium">Objective:</span> {prompt.searchObjective}
                          </div>
                          <div>
                            <span className="font-medium">Looking For:</span> {prompt.lookingFor}
                          </div>
                          <div>
                            <span className="font-medium">Criteria:</span> {prompt.detectionCriteria.substring(0, 100)}
                            {prompt.detectionCriteria.length > 100 && '...'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(prompt)}
                          className="px-3 py-1 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(prompt.id)}
                          className="px-3 py-1 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

