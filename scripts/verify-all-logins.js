import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin(username, password) {
  const rawInput = username.trim().toLowerCase();
  const cleanUser = rawInput.includes('@') ? rawInput : rawInput.replace(/\s+/g, '');
  const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}@vkit.local`;

  let res = await client.auth.signInWithPassword({ email, password });
  if (res.error && !rawInput.includes('@') && rawInput !== cleanUser) {
    const spaceEmail = `${rawInput}@vkit.local`;
    res = await client.auth.signInWithPassword({ email: spaceEmail, password });
  }

  if (res.error) {
    return { success: false, error: res.error.message };
  }
  return { success: true, userId: res.data.user.id, email: res.data.user.email };
}

async function verifyAll() {
  console.log('====================================================');
  console.log('       VK IT TRACKER — LIVE LOGIN VERIFICATION      ');
  console.log('====================================================\n');

  const accounts = [
    { username: 'admin', pass: 'Krrish@@1999', label: 'Admin Account' },
    { username: 'manoj', pass: 'VKIt@Manoj2026!', label: 'Manoj Employee Account' },
    { username: 'test 1', pass: 'Ravva@1234', label: 'Test 1 (with space)' },
    { username: 'test1', pass: 'Ravva@1234', label: 'Test1 (no space)' },
  ];

  for (const acc of accounts) {
    const result = await testLogin(acc.username, acc.pass);
    if (result.success) {
      console.log(`✅ SUCCESS [${acc.label}]`);
      console.log(`   Username: "${acc.username}"`);
      console.log(`   Password: "${acc.pass}"`);
      console.log(`   Email:    "${result.email}"`);
      console.log(`   User ID:  ${result.userId}\n`);
    } else {
      console.log(`❌ FAILED [${acc.label}]`);
      console.log(`   Username: "${acc.username}"`);
      console.log(`   Password: "${acc.pass}"`);
      console.log(`   Error:    ${result.error}\n`);
    }
  }
}

verifyAll();
