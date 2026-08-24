import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function inspectUser() {
  console.log('Fetching users from auth.admin.listUsers()...');
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error('List users error:', error);
    return;
  }

  console.log(`Total Auth Users: ${data.users.length}`);
  const testUser = data.users.find(u => u.email?.includes('test1') || u.user_metadata?.username === 'test1');
  if (testUser) {
    console.log('Found test1 user:', JSON.stringify(testUser, null, 2));
  } else {
    console.log('test1 user not found in auth.users!');
    console.log('All user emails:', data.users.map(u => u.email));
  }
}

inspectUser();
