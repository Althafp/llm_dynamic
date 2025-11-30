import { NextRequest, NextResponse } from 'next/server';
import { addCustomPrompt } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, searchObjective, lookingFor, detectionCriteria } = body;
    
    if (!name || !searchObjective || !lookingFor || !detectionCriteria) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    const prompt = await addCustomPrompt({
      name,
      searchObjective,
      lookingFor,
      detectionCriteria,
    });
    
    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    console.error('Error creating prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}

