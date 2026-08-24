import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

async function loginWithUsername(username, password) {
  const rawInput = username.trim().toLowerCase();
  const cleanUser = rawInput.includes('@') ? rawInput : rawInput.replace(/\s+/g, '');
  const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}@vkit.local`;

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    if (!rawInput.includes('@') && rawInput !== cleanUser) {
      const spaceEmail = `${rawInput}@vkit.local`;
      const fallback = await client.auth.signInWithPassword({ email: spaceEmail, password });
      if (!fallback.error) return fallback.data;
    }
    throw error;
  }
  return data;
}

async function test() {
  console.log('Testing loginWithUsername("test 1", "Ravva@1234")...');
  try {
    const data = await loginWithUsername('test 1', 'Ravva@1234');
    console.log('🎉 SUCCESS logging in with "test 1"! User ID:', data.user.id);
  } catch (err) {
    console.error('❌ FAIL "test 1":', err.message);
  }

  console.log('\nTesting loginWithUsername("test1", "Ravva@1234")...');
  try {
    const data = await loginWithUsername('test1', 'Ravva@1234');
    console.log('🎉 SUCCESS logging in with "test1"! User ID:', data.user.id);
  } catch (err) {
    console.error('❌ FAIL "test1":', err.message);
  }
}

test();
