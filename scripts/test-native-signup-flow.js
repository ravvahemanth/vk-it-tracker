import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const newUsername = 'ravva1';
  const newPassword = 'Ravva@1234';
  const newName = 'Ravva Employee Native';

  // Test domain options
  const domains = ['vkit-solutions.com', 'vkit.com', 'vkit.local'];

  for (const domain of domains) {
    const email = `${newUsername}@${domain}`;
    console.log(`\nTesting email "${email}" with password "${newPassword}"...`);

    const { data: signUpData, error: signUpErr } = await client.auth.signUp({
      email,
      password: newPassword,
      options: {
        data: {
          full_name: newName,
          username: newUsername,
          role: 'employee'
        }
      }
    });

    if (signUpErr) {
      console.error(`❌ SignUp failed for ${domain}:`, signUpErr.message);
    } else {
      console.log(`✅ SignUp SUCCESS for ${domain}! User ID: ${signUpData.user.id}`);

      // Test Login
      console.log(`Testing login for ${email}...`);
      const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
        email,
        password: newPassword
      });

      if (loginErr) {
        console.error(`❌ Login failed for ${email}:`, loginErr.message);
      } else {
        console.log(`🎉🎉 SUCCESS! Employee logged in successfully! User ID: ${loginData.user.id}`);
        break;
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
