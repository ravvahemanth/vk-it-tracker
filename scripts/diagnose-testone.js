import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const username = 'testone';
  const password = 'Ravva@1234';
  const email = `${username}@vkit.local`;

  console.log(`Testing direct sign-in for: ${email} / ${password}`);
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('❌ Login FAILED:', error.message, error.status, error.code);
  } else {
    console.log('✅ Login SUCCESS! User ID:', data.user.id);
  }

  // Also test password reset approach
  console.log('\n--- Also test via admin rpc check ---');
  const adminLogin = await client.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });
  if (adminLogin.error) {
    console.error('Admin login failed:', adminLogin.error.message);
    return;
  }
  console.log('Admin logged in. Checking if testone profile exists...');
  const { data: profiles } = await client.from('profiles').select('id, username, full_name, role');
  const testoneProfile = profiles?.find(p => p.username === 'testone');
  console.log('testone profile:', testoneProfile || 'NOT FOUND');

  // Try password reset
  if (testoneProfile) {
    console.log(`\nResetting password for testone (ID: ${testoneProfile.id}) to "${password}"...`);
    const { data: resetData, error: resetErr } = await client.rpc('admin_reset_employee_password', {
      p_employee_id: testoneProfile.id,
      p_new_password: password
    });
    console.log('Reset result:', resetData, resetErr);

    // Sign out admin and try again
    await client.auth.signOut();

    console.log('\nRetrying login after password reset...');
    const { data: retryData, error: retryErr } = await client.auth.signInWithPassword({ email, password });
    if (retryErr) {
      console.error('❌ STILL FAILING:', retryErr.message, retryErr.code);
    } else {
      console.log('🎉 SUCCESS after reset! User ID:', retryData.user.id);
    }
  }
}

main().catch(console.error);
