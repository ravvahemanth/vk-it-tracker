import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function inspect() {
  console.log('Inspecting auth.users via Admin API...');

  const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers();
  if (usersErr) {
    console.error('Error listing users:', usersErr);
    return;
  }

  console.log(`Found ${usersData.users.length} users in Auth:`);
  for (const u of usersData.users) {
    console.log(`- ID: ${u.id} | Email: ${u.email} | Created: ${u.created_at} | Confirmed: ${u.email_confirmed_at}`);
  }
}

inspect();
