import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const adminEmail = 'admin@vkit.local';
  const adminPass = 'Krrish@@1999';

  console.log(`Checking admin user (${adminEmail})...`);

  // 1. List users to check if admin user exists
  const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing users:', listErr);
    process.exit(1);
  }

  const existingAdmin = usersData.users.find(u => u.email === adminEmail);

  let adminUserId = null;

  if (existingAdmin) {
    adminUserId = existingAdmin.id;
    console.log(`Admin user found (ID: ${adminUserId}). Updating password to: ${adminPass}`);
    const { error: updateErr } = await supabase.auth.admin.updateUserById(adminUserId, {
      password: adminPass,
      email_confirm: true,
      user_metadata: { full_name: 'System Administrator', username: 'admin', role: 'admin' }
    });
    if (updateErr) {
      console.error('Error updating admin user password:', updateErr);
      process.exit(1);
    }
    console.log('✅ Admin user password updated successfully!');
  } else {
    console.log(`Admin user not found. Creating admin user...`);
    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPass,
      email_confirm: true,
      user_metadata: { full_name: 'System Administrator', username: 'admin', role: 'admin' }
    });
    if (createErr) {
      console.error('Error creating admin user:', createErr);
      process.exit(1);
    }
    adminUserId = createData.user.id;
    console.log(`✅ Admin user created (ID: ${adminUserId})`);
  }

  // 2. Ensure Profile exists in public.profiles
  console.log('Ensuring admin profile in public.profiles table...');
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: adminUserId,
    full_name: 'System Administrator',
    username: 'admin',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (profileErr) {
    console.error('Error updating admin profile:', profileErr);
  } else {
    console.log('✅ Admin profile verified in public.profiles table!');
  }

  // 3. Test Admin Login with Supabase Auth
  console.log('\nTesting Admin sign-in with password...');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const client = createClient(supabaseUrl, anonKey);
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPass
  });

  if (loginErr) {
    console.error('❌ Admin login test FAILED:', loginErr.message);
  } else {
    console.log(`🎉 SUCCESS: Admin logged in successfully! User ID: ${loginData.user.id}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
