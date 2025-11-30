import { NextResponse } from 'next/server';
import { DEFAULT_PROMPTS } from '@/lib/analysis-prompts';
import { listCustomPrompts } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

/**
 * Get all prompts (default + custom)
 * This API route merges default prompts with custom prompts from GCP
 */
export async function GET() {
  try {
    const customPrompts = await listCustomPrompts();
    
    // Convert custom prompts to AnalysisPrompt format
    const customAnalysisPrompts = customPrompts.map(cp => ({
      id: cp.id,
      name: cp.name,
      searchObjective: cp.searchObjective,
      lookingFor: cp.lookingFor,
      detectionCriteria: cp.detectionCriteria,
    }));
    
    // Merge default and custom prompts (custom prompts come after default)
    const allPrompts = [...DEFAULT_PROMPTS, ...customAnalysisPrompts];
    
    return NextResponse.json({ success: true, prompts: allPrompts });
  } catch (error) {
    console.error('Error loading all prompts:', error);
    // Return default prompts only if custom prompts fail to load
    return NextResponse.json({ 
      success: true, 
      prompts: DEFAULT_PROMPTS,
      error: 'Failed to load custom prompts, showing default prompts only'
    });
  }
}

