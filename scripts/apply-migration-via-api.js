/**
 * apply-migration-via-api.js
 * Uses the Supabase Management API to run SQL on the live database.
 * Run: node scripts/apply-migration-via-api.js
 */
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const PROJECT_REF = 'qzcggsqfsocniolsdaph';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const SQL_TO_RUN = readFileSync('./supabase/migrations/007_fix_recursion_and_summary_rpc.sql', 'utf-8');

async function runSQLViaManagementAPI(sql) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function runSQLViaRPC(sql) {
  // Try the Supabase REST API directly 
  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  console.log('=== Applying Migration 007 to Live Supabase DB ===');
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`SQL length: ${SQL_TO_RUN.length} characters\n`);

  // Try Management API first
  console.log('Method 1: Supabase Management API...');
  try {
    const result = await runSQLViaManagementAPI(SQL_TO_RUN);
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));

    if (result.status >= 200 && result.status < 300) {
      console.log('\n✅ Migration 007 applied successfully via Management API!');
      return;
    } else {
      console.log('\n⚠️  Management API failed. Trying RPC...');
    }
  } catch (err) {
    console.log('Management API error:', err.message);
  }

  // Fallback: try RPC
  console.log('\nMethod 2: REST exec_sql RPC...');
  try {
    const result = await runSQLViaRPC(SQL_TO_RUN);
    console.log(`Status: ${result.status}`);
    console.log('Response:', result.body.substring(0, 200));
    
    if (result.status >= 200 && result.status < 300) {
      console.log('\n✅ Migration applied via RPC!');
    } else {
      console.log('\n❌ Both methods failed.');
      console.log('👉 Please apply the SQL manually via:');
      console.log('   https://supabase.com/dashboard/project/qzcggsqfsocniolsdaph/sql/new');
      console.log('   File: supabase/migrations/007_fix_recursion_and_summary_rpc.sql');
    }
  } catch (err) {
    console.log('RPC error:', err.message);
    console.log('\n👉 Please apply the SQL manually via:');
    console.log('   https://supabase.com/dashboard/project/qzcggsqfsocniolsdaph/sql/new');
    console.log('   File: supabase/migrations/007_fix_recursion_and_summary_rpc.sql');
  }
}

main().catch(console.error);
