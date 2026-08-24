import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Searching for users matching "test"...');

  // List profiles matching test
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*');
  
  if (profErr) {
    console.error('Error selecting profiles:', profErr);
  } else {
    console.log('Profiles in DB:', profiles.map(p => ({ id: p.id, name: p.full_name, username: p.username, role: p.role })));
  }

  // Create or Update 'test1' user with password 'Ravva@1234'
  const targetUsername = 'test1';
  const targetEmail = 'test1@vkit.local';
  const targetPassword = 'Ravva@1234';

  console.log(`\nEnsuring employee account for username "${targetUsername}" (${targetEmail}) with password "${targetPassword}"...`);

  // Check if profile exists
  let targetProfile = profiles?.find(p => p.username === 'test1' || p.username === 'test 1' || p.full_name?.toLowerCase().includes('test'));

  let userId = targetProfile?.id;

  if (!userId) {
    console.log('User not found. Creating user in auth.users...');
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: targetEmail,
      password: targetPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Test 1 Employee', username: targetUsername, role: 'employee' }
    });

    if (createErr) {
      console.error('Error creating user:', createErr);
      process.exit(1);
    }
    userId = newUser.user.id;
    console.log(`Created user with ID: ${userId}`);
  } else {
    console.log(`Found user ID ${userId}. Updating email to ${targetEmail} and password to ${targetPassword}...`);
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: targetEmail,
      password: targetPassword,
      email_confirm: true,
      user_metadata: { full_name: targetProfile.full_name || 'Test 1 Employee', username: targetUsername, role: 'employee' }
    });
    if (updateErr) {
      console.error('Error updating user password:', updateErr);
    } else {
      console.log('Successfully updated user password!');
    }
  }

  // Upsert Profile
  const { error: profileUpsertErr } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    full_name: targetProfile?.full_name || 'Test 1 Employee',
    username: targetUsername,
    role: 'employee',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (profileUpsertErr) {
    console.error('Error upserting profile:', profileUpsertErr);
  } else {
    console.log('✅ Profile updated in public.profiles table!');
  }

  // Test Login with Anon Client
  console.log('\nTesting sign-in with password for test1...');
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
    email: targetEmail,
    password: targetPassword
  });

  if (loginErr) {
    console.error('❌ Sign in FAILED:', loginErr.message);
  } else {
    console.log(`🎉 SUCCESS: User logged in successfully! User ID: ${loginData.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
