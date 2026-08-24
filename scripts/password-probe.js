import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

// Test with multiple passwords to find what's stored
const passwords = ['Ravva@1234', 'ravva@1234', 'Ravva1234', 'Ravva@1234!'];

async function main() {
  for (const pw of passwords) {
    const { data, error } = await client.auth.signInWithPassword({
      email: 'test1@vkit.local',
      password: pw
    });
    if (error) {
      console.log(`Password "${pw}" -> FAIL: ${error.message} (${error.status})`);
    } else {
      console.log(`Password "${pw}" -> SUCCESS! User: ${data.user.id}`);
    }
    await client.auth.signOut();
  }
}

main().catch(console.error);
