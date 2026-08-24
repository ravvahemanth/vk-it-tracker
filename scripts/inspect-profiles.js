import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function inspectProfiles() {
  console.log('Inspecting ALL profiles in live Supabase DB...\n');
  
  const { data: profiles, error } = await serviceClient
    .from('profiles')
    .select('*');
    
  if (error) {
    console.error('Error querying profiles:', error);
    return;
  }
  
  console.log(`Total profiles found: ${profiles?.length || 0}`);
  profiles?.forEach(p => {
    console.log(`- Username: ${p.username} | Role: ${p.role} | is_active: ${p.is_active} | id: ${p.id}`);
  });
}

inspectProfiles().catch(console.error);
