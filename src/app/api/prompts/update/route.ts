import { NextRequest, NextResponse } from 'next/server';
import { updateCustomPrompt } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Prompt ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { name, searchObjective, lookingFor, detectionCriteria } = body;
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (searchObjective !== undefined) updates.searchObjective = searchObjective;
    if (lookingFor !== undefined) updates.lookingFor = lookingFor;
    if (detectionCriteria !== undefined) updates.detectionCriteria = detectionCriteria;
    
    const prompt = await updateCustomPrompt(id, updates);
    
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    console.error('Error updating prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

