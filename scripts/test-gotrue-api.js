/**
 * Check pg_net availability and test the GoTrue Admin API approach
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const projectRef = 'qzcggsqfsocniolsdaph';

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testGoTrueAPI() {
  console.log('\n=== TESTING GOTRUE ADMIN API DIRECTLY ===\n');
  
  // Method 1: Direct GoTrue Admin API call from Node
  const gotrueUrl = `https://${projectRef}.supabase.co/auth/v1/admin/users`;
  
  const response = await fetch(gotrueUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({
      email: 'apitest999@vkit.local',
      password: 'ApiTest@999!',
      email_confirm: true,
      user_metadata: {
        full_name: 'API Test 999',
        username: 'apitest999',
        role: 'employee'
      }
    })
  });

  const result = await response.json();
  console.log('GoTrue API status:', response.status);
  console.log('GoTrue API result:', JSON.stringify(result, null, 2).substring(0, 500));
  
  if (result.id) {
    // Test sign in
    const testClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signInData, error: signInErr } = await testClient.auth.signInWithPassword({
      email: 'apitest999@vkit.local',
      password: 'ApiTest@999!'
    });
    
    if (signInErr) {
      console.log('\nSign in FAILED:', signInErr.message);
    } else {
      console.log('\nSign in SUCCESS!', signInData.user.id);
      await testClient.auth.signOut();
    }
    
    // Clean up
    await fetch(`${gotrueUrl}/${result.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });
    console.log('Cleaned up test user');
  }
}

testGoTrueAPI().catch(console.error);
