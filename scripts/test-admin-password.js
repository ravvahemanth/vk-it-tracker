import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminLogin() {
  console.log('Testing Admin Login Credentials...');
  
  // Test 1: Capital K (Correct)
  const { data: d1, error: e1 } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });
  console.log('1. Password "Krrish@@1999" (Capital K):', !e1 ? '✅ SUCCESS!' : `❌ FAILED: ${e1.message}`);

  // Test 2: Lowercase k
  const { data: d2, error: e2 } = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'krrish@@1999'
  });
  console.log('2. Password "krrish@@1999" (lowercase k):', !e2 ? '✅ SUCCESS!' : `❌ FAILED: ${e2.message}`);
}

testAdminLogin().catch(console.error);
