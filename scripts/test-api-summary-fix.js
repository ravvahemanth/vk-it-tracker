import { getAdminDailySummary } from '../src/services/api.js';
import { supabase } from '../src/services/supabase.js';

async function testApiSummary() {
  console.log('Logging in as admin@vkit.local via app api...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@vkit.local',
    password: 'Krrish@@1999'
  });
  if (error) {
    console.error('Login error:', error);
    return;
  }
  
  console.log('Calling getAdminDailySummary()...');
  const res = await getAdminDailySummary();
  console.log('Result success:', res.success);
  console.log('Result date:', res.date);
  console.log('Totals:', JSON.stringify(res.totals));
  console.log('Employees count:', res.summary?.length);
  if (res.summary?.length > 0) {
    console.log('First employee:', res.summary[0].full_name, 'username:', res.summary[0].username);
  }
}

testApiSummary().catch(console.error);
