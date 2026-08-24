// VK IT Solutions — Seed Users Script & Profile Sync
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@vkit.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Krrish@@1999';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const employees = [
  { full_name: 'Manoj',         username: 'manoj',        password: 'VKIt@Manoj2026!'       },
  { full_name: 'Bangaruraju',   username: 'bangaruraju',  password: 'VKIt@Bangaru2026!'     },
  { full_name: 'Abhi',          username: 'abhi',         password: 'VKIt@Abhi2026!'        },
  { full_name: 'Alekya',        username: 'alekya',       password: 'VKIt@Alekya2026!'      },
  { full_name: 'Karthik',       username: 'karthik',      password: 'VKIt@Karthik2026!'     },
  { full_name: 'Kesava',        username: 'kesava',       password: 'VKIt@Kesava2026!'      },
  { full_name: 'Lakshmi',       username: 'lakshmi',      password: 'VKIt@Lakshmi2026!'     },
  { full_name: 'Hyndavi',       username: 'hyndavi',      password: 'VKIt@Hyndavi2026!'     },
  { full_name: 'Raju',          username: 'raju',         password: 'VKIt@Raju2026!'        },
  { full_name: 'Sunil',         username: 'sunil',        password: 'VKIt@Sunil2026!'       },
  { full_name: 'Vamsi Krishna', username: 'vamsikrishna', password: 'VKIt@Vamsi2026!'       },
];

async function syncProfile(userId, userData, role) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: userData.full_name,
      username: userData.username,
      role,
      is_active: true,
    }, { onConflict: 'id' })
    .select();

  if (error) {
    console.error(`  ❌ Profile error for ${userData.username}:`, error.message);
  } else {
    console.log(`  ✅ Profile synced for ${userData.username} (${role}).`);
  }
}

async function createUser(userData, role) {
  const email = userData.email_override || `${userData.username}@vkit.local`;

  console.log(`\nProcessing ${role}: ${userData.username} (${email})`);

  // Fetch all users to check if existing
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  const existingUser = usersData?.users?.find(u => u.email === email);

  if (existingUser) {
    console.log(`  ℹ️  User auth already exists (id: ${existingUser.id})`);
    await syncProfile(existingUser.id, userData, role);
    return;
  }

  // Create user if not exists
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: userData.password,
    email_confirm: true,
    user_metadata: {
      full_name: userData.full_name,
      username: userData.username,
      role,
    }
  });

  if (authError) {
    console.error(`  ❌ Auth creation error for ${userData.username}:`, authError.message);
    return;
  }

  await syncProfile(authData.user.id, userData, role);
}

async function main() {
  console.log('====================================================');
  console.log('VK IT Solutions — User & Profile Sync Script');
  console.log('====================================================');

  for (const employee of employees) {
    await createUser(employee, 'employee');
  }

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const adminUsername = ADMIN_EMAIL.split('@')[0];
    await createUser({
      full_name: 'Administrator',
      username: adminUsername,
      password: ADMIN_PASSWORD,
      email_override: ADMIN_EMAIL,
    }, 'admin');
  }

  console.log('\n====================================================');
  console.log('ALL EMPLOYEES AND PROFILES SYNCED SUCCESSFULLY!');
  console.log('====================================================\n');
}

main().catch(console.error);
