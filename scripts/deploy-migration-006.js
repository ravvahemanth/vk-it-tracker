/**
 * Deploy migration 006 to live Supabase database
 * - Auto-create profile trigger
 * - Fixed admin_delete_employee
 * - Fixed RLS policies for profiles
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = 'qzcggsqfsocniolsdaph';

async function deployMigration() {
  console.log('\n=== DEPLOYING MIGRATION 006 ===\n');

  const sql = readFileSync('./supabase/migrations/006_trigger_and_delete_fix.sql', 'utf-8');

  // Use Supabase Management API to run SQL
  // The service role key can be used as a JWT for the REST API
  const response = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.log('REST API approach failed:', response.status, text);
    console.log('\nTrying via pg endpoint...');
  } else {
    const data = await response.json();
    console.log('Migration applied:', data);
    return;
  }

  // Alternative: Use db.supabase.co/pg endpoint (if available)
  // This endpoint runs SQL directly via the Postgres connection
  const pgResponse = await fetch(`https://${projectRef}.supabase.co/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!pgResponse.ok) {
    const pgText = await pgResponse.text();
    console.log('PG endpoint failed:', pgResponse.status, pgText.substring(0, 200));
    
    console.log('\n⚠️  Cannot auto-deploy via API. Please manually run the following SQL in Supabase SQL Editor:');
    console.log('\n--- SQL TO RUN ---');
    console.log(sql);
    return;
  }
  
  console.log('Migration deployed via pg endpoint!');
}

deployMigration().catch(console.error);
