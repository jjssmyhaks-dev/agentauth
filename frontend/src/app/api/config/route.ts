import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Fallback: read from config.json if env vars not set
  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      const configPath = join(process.cwd(), 'config.json');
      const raw = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      supabaseUrl = supabaseUrl || config.supabaseUrl || '';
      supabaseAnonKey = supabaseAnonKey || config.supabaseAnonKey || '';
    } catch {
      // No config file — vars remain empty
    }
  }

  return NextResponse.json({
    supabaseUrl,
    supabaseAnonKey,
    configured: Boolean(supabaseUrl && supabaseAnonKey),
  });
}
