import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyMigration007() {
  console.log('Applying Migration 007 to Live Supabase DB...');
  const sql = readFileSync('./supabase/migrations/007_fix_recursion_and_summary_rpc.sql', 'utf-8');

  // Try applying via REST exec_sql if available, or direct query
  const projectRef = 'qzcggsqfsocniolsdaph';
  
  // Method: Use REST endpoint with service key
  const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (res.ok) {
    const data = await res.json();
    console.log('✅ Migration 007 applied successfully via REST:', data);
  } else {
    console.log('REST exec_sql returned:', res.status, await res.text());
  }
}

applyMigration007().catch(console.error);
