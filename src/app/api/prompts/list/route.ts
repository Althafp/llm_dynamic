import { NextResponse } from 'next/server';
import { listCustomPrompts } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const prompts = await listCustomPrompts();
    return NextResponse.json({ success: true, prompts });
  } catch (error) {
    console.error('Error listing prompts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list prompts' },
      { status: 500 }
    );
  }
}

