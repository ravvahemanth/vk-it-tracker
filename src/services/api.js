import { supabase, adminSupabase } from './supabase';

/**
 * Returns the best available Supabase client for admin reads.
 * Prefers the service-role client (bypasses RLS completely).
 * Falls back to the regular anon client (relies on RLS + admin session).
 * NOTE: The regular client requires an active authenticated session.
 */
function getAdminClient() {
  return adminSupabase || supabase;
}

/**
 * Ensures a valid session exists before making a query.
 * If no session exists, waits for one (up to 3 seconds).
 */
async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  // Wait briefly for session to restore from storage
  return new Promise((resolve) => {
    const unsub = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) { unsub.data.subscription.unsubscribe(); resolve(s); }
    });
    setTimeout(() => { unsub.data.subscription.unsubscribe(); resolve(null); }, 3000);
  });
}

// ============================================================
// AUTH SERVICES
// ============================================================

/**
 * Login using username (looks up email internally)
 */
export async function loginWithUsername(username, password) {
  const rawInput = username.trim().toLowerCase();
  const cleanUser = rawInput.includes('@') ? rawInput : rawInput.replace(/\s+/g, '');
  const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}@vkit.local`;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Fallback try with spaces preserved (for legacy usernames created with spaces like "test 1")
    if (!rawInput.includes('@') && rawInput !== cleanUser) {
      const spaceEmail = `${rawInput}@vkit.local`;
      const fallback = await supabase.auth.signInWithPassword({ email: spaceEmail, password });
      if (!fallback.error) return fallback.data;
    }
    throw error;
  }
  return data;
}

/**
 * Logout current user
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// ============================================================
// PROFILE SERVICES
// ============================================================

/**
 * Get profile for authenticated user
 */
export async function getMyProfile() {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('getMyProfile error:', error);
    return null;
  }
  return data;
}

/**
 * Get all employee profiles (admin only).
 * Uses service-role client if available (bypasses RLS).
 * Otherwise uses the authenticated supabase client (admin RLS allows reading all profiles).
 */
export async function getAllProfiles() {
  // If service role client is available, use it (bypasses RLS entirely)
  if (adminSupabase) {
    const { data, error } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('role', 'employee')
      .order('full_name');
    if (!error) return data || [];
    console.error('getAllProfiles (service role) error:', error);
    // Fall through to anon client
  }

  // Ensure session exists before querying (important for production)
  const session = await ensureSession();
  if (!session) {
    console.warn('getAllProfiles: no active session, cannot query profiles');
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('full_name');

  if (error) {
    console.error('getAllProfiles (anon) error:', error.code, error.message);
    throw error;
  }
  return data || [];
}

// ============================================================
// SESSION SERVICES
// ============================================================

/**
 * Start a new work session via secure RPC
 */
export async function startWorkSession(startingFormNumber) {
  const { data, error } = await supabase.rpc('start_work_session', {
    p_starting_form: startingFormNumber,
  });
  if (error) throw error;
  return data;
}

/**
 * Complete an active work session via secure RPC
 */
export async function completeWorkSession(sessionId, endingFormNumber) {
  const { data, error } = await supabase.rpc('complete_work_session', {
    p_session_id: sessionId,
    p_ending_form: endingFormNumber,
  });
  if (error) throw error;
  return data;
}

/**
 * Get current user's active session
 */
export async function getMyActiveSession() {
  const { data, error } = await supabase.rpc('get_my_active_session');
  if (error) throw error;
  return data;
}

/**
 * Get expected next starting form number for current user
 */
export async function getExpectedNextForm() {
  const { data, error } = await supabase.rpc('get_expected_next_form');
  if (error) throw error;
  return data;
}

/**
 * Get current user's sessions for a specific date
 */
export async function getMySessions(date) {
  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('work_date', date)
    .order('session_number');
  if (error) throw error;
  return data;
}

/**
 * Get current user's session history (all dates)
 */
export async function getMySessionHistory(page = 0, pageSize = 20) {
  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .order('work_date', { ascending: false })
    .order('session_number', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return data;
}

/**
 * Get sessions for a specific date (employee's own only, enforced by RLS)
 */
export async function getMySessionsByDate(date) {
  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('work_date', date)
    .order('session_number');
  if (error) throw error;
  return data;
}

// ============================================================
// ADMIN SERVICES
// ============================================================

/**
 * Get admin daily summary.
 * 
 * Priority:
 *  1. Try the get_admin_daily_summary RPC (most efficient)
 *  2. Fall back to pure-JS aggregation via direct table queries (works even if RPC is broken)
 *
 * The JS fallback uses adminSupabase (service role key) when available to bypass RLS,
 * or falls back to the anon client when running as admin.
 */
export async function getAdminDailySummary(date) {
  const targetDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // 1. Try RPC call first
  try {
    const { data, error } = await supabase.rpc('get_admin_daily_summary', {
      p_date: targetDate,
    });
    if (!error && data && data.success !== false) {
      return data;
    }
    if (error) {
      console.warn('get_admin_daily_summary RPC error (falling back to JS):', error.message);
    }
  } catch (rpcErr) {
    console.warn('get_admin_daily_summary RPC threw (falling back to JS):', rpcErr.message);
  }

  // 2. Pure-JS Fallback: Query tables directly
  return await buildSummaryFromTables(targetDate);
}

/**
 * Build admin daily summary by querying tables directly.
 * This is the fallback when the RPC is unavailable or broken.
 * Uses service-role client if available (bypasses RLS).
 * Otherwise ensures an active session exists before querying with the anon client.
 */
async function buildSummaryFromTables(targetDate) {
  let client;

  if (adminSupabase) {
    // Service role bypasses RLS entirely — best option
    client = adminSupabase;
  } else {
    // No service role key → must use authenticated anon client
    // Ensure session is active before making RLS-protected queries
    const session = await ensureSession();
    if (!session) {
      console.warn('buildSummaryFromTables: no session available, returning empty');
      return makeSafeEmptyResult(targetDate);
    }
    client = supabase;
  }

  try {
    // Fetch all active employees
    const { data: profiles, error: profErr } = await client
      .from('profiles')
      .select('id, full_name, username, is_active, role')
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('full_name');

    if (profErr) {
      console.error('buildSummaryFromTables profiles error:', profErr.code, profErr.message);
      return makeSafeEmptyResult(targetDate);
    }

    // Fetch all sessions for this date
    const { data: sessions, error: sessErr } = await client
      .from('work_sessions')
      .select('id, employee_id, session_number, starting_form_number, status, total_forms, start_time, work_date')
      .eq('work_date', targetDate);

    if (sessErr) {
      console.error('buildSummaryFromTables sessions error:', sessErr);
      // Return employees with zero metrics rather than failing
      return buildResultWithNoSessions(profiles || [], targetDate);
    }

    // Group sessions by employee
    const sessionsByEmp = {};
    (sessions || []).forEach(s => {
      if (!sessionsByEmp[s.employee_id]) sessionsByEmp[s.employee_id] = [];
      sessionsByEmp[s.employee_id].push(s);
    });

    const summary = (profiles || []).map(p => {
      const empSessions = sessionsByEmp[p.id] || [];
      const completed = empSessions.filter(s => s.status === 'completed');
      const active = empSessions.find(s => s.status === 'working') || null;
      const totalForms = completed.reduce((sum, s) => sum + Number(s.total_forms || 0), 0);

      let lastStatus = 'not_working';
      if (active) lastStatus = 'working';
      else if (completed.length > 0) lastStatus = 'completed';

      return {
        employee_id: p.id,
        full_name: p.full_name,
        username: p.username,
        is_active: p.is_active,
        sessions_today: completed.length,
        total_forms_today: totalForms,
        active_session: active ? {
          id: active.id,
          session_number: active.session_number,
          starting_form_number: active.starting_form_number,
          start_time: active.start_time,
        } : null,
        last_status: lastStatus,
      };
    });

    const allSessions = sessions || [];
    const completedAll = allSessions.filter(s => s.status === 'completed');
    const workingAll = allSessions.filter(s => s.status === 'working');
    const activeEmpIds = new Set(allSessions.map(s => s.employee_id));

    return {
      success: true,
      date: targetDate,
      summary,
      totals: {
        total_employees_active: activeEmpIds.size,
        currently_working: workingAll.length,
        total_completed_sessions: completedAll.length,
        grand_total_forms: completedAll.reduce((sum, s) => sum + Number(s.total_forms || 0), 0),
      },
    };
  } catch (err) {
    console.error('buildSummaryFromTables fatal error:', err);
    return makeSafeEmptyResult(targetDate);
  }
}

function buildResultWithNoSessions(profiles, targetDate) {
  return {
    success: true,
    date: targetDate,
    summary: profiles.map(p => ({
      employee_id: p.id,
      full_name: p.full_name,
      username: p.username,
      is_active: p.is_active,
      sessions_today: 0,
      total_forms_today: 0,
      active_session: null,
      last_status: 'not_working',
    })),
    totals: {
      total_employees_active: 0,
      currently_working: 0,
      total_completed_sessions: 0,
      grand_total_forms: 0,
    },
  };
}

function makeSafeEmptyResult(targetDate) {
  return {
    success: true,
    date: targetDate,
    summary: [],
    totals: {
      total_employees_active: 0,
      currently_working: 0,
      total_completed_sessions: 0,
      grand_total_forms: 0,
    },
  };
}

/**
 * Get all sessions with filters (admin).
 * Uses service-role client if available, otherwise ensures session exists.
 */
export async function getAdminSessions({ date, employeeId, status, page = 0, pageSize = 50 } = {}) {
  let clientToUse;
  if (adminSupabase) {
    clientToUse = adminSupabase;
  } else {
    const session = await ensureSession();
    if (!session) return [];
    clientToUse = supabase;
  }

  let query = clientToUse
    .from('work_sessions')
    .select(`
      *,
      profiles:employee_id (
        full_name,
        username
      )
    `)
    .order('work_date', { ascending: false })
    .order('start_time', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (date) query = query.eq('work_date', date);
  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get all sessions for Excel export (admin).
 * Uses service-role client if available, otherwise ensures session exists.
 */
export async function getAdminSessionsForExport({ date, employeeId, status } = {}) {
  let clientToUse;
  if (adminSupabase) {
    clientToUse = adminSupabase;
  } else {
    const session = await ensureSession();
    if (!session) return [];
    clientToUse = supabase;
  }

  let query = clientToUse
    .from('work_sessions')
    .select(`
      *,
      profiles:employee_id (
        full_name,
        username
      )
    `)
    .order('work_date', { ascending: false })
    .order('employee_id')
    .order('session_number');

  if (date) query = query.eq('work_date', date);
  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ============================================================
// DYNAMIC EMPLOYEE MANAGEMENT SERVICES (ADMIN)
// ============================================================

/**
 * Create a new employee (admin only)
 * Uses GoTrue Admin API to properly create auth user with correct identity schema
 */
export async function adminCreateEmployee({ fullName, username, password, isActive = true }) {
  try {
    if (!adminSupabase) {
      return {
        success: false,
        error: 'Admin operations require VITE_SUPABASE_SERVICE_ROLE_KEY. Please add it to Vercel environment variables and redeploy.',
      };
    }

    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
    const email = `${cleanUsername}@vkit.local`;

    // Validate inputs
    if (!fullName?.trim()) return { success: false, error: 'Full name is required.' };
    if (!cleanUsername) return { success: false, error: 'Username is required.' };
    if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters long.' };

    // Check if username already exists
    const { data: existingProfile } = await (adminSupabase || supabase)
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();
    if (existingProfile) {
      return { success: false, error: `Username "${cleanUsername}" is already taken.` };
    }

    // Create auth user via GoTrue Admin API
    const { data: createdUser, error: authErr } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        username: cleanUsername,
        role: 'employee',
      },
    });

    if (authErr) {
      console.error('GoTrue admin.createUser error:', authErr);
      return { success: false, error: authErr.message || 'Failed to create auth user.' };
    }

    const newUserId = createdUser.user.id;

    // Upsert profile
    const { data: profileData, error: profErr } = await adminSupabase
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: fullName.trim(),
        username: cleanUsername,
        role: 'employee',
        is_active: isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (profErr) {
      console.warn('Profile upsert notice:', profErr.message);
      const { data: existProf } = await adminSupabase.from('profiles').select('*').eq('id', newUserId).single();
      return { success: true, message: `Employee "${fullName.trim()}" created successfully.`, profile: existProf };
    }

    return {
      success: true,
      message: `Employee "${fullName.trim()}" created successfully.`,
      profile: profileData,
    };
  } catch (err) {
    console.error('adminCreateEmployee error:', err);
    return { success: false, error: err.message || 'Failed to create employee account' };
  }
}

/**
 * Update an existing employee (admin only)
 */
export async function adminUpdateEmployee({ employeeId, fullName, username, isActive }) {
  try {
    const { data, error } = await supabase.rpc('admin_update_employee', {
      p_employee_id: employeeId,
      p_full_name: fullName,
      p_username: username,
      p_is_active: isActive,
    });
    if (error) {
      console.error('RPC admin_update_employee error:', error);
      return { success: false, error: error.message || 'Database error updating employee' };
    }
    return data;
  } catch (err) {
    console.error('adminUpdateEmployee error:', err);
    return { success: false, error: err.message || 'Failed to update employee' };
  }
}

/**
 * Reset employee password (admin only)
 */
export async function adminResetEmployeePassword({ employeeId, newPassword }) {
  try {
    if (!adminSupabase) {
      return {
        success: false,
        error: 'Admin operations require VITE_SUPABASE_SERVICE_ROLE_KEY. Please add it to Vercel environment variables and redeploy.',
      };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const { error: authErr } = await adminSupabase.auth.admin.updateUserById(
      employeeId,
      { password: newPassword }
    );

    if (authErr) {
      console.error('GoTrue admin.updateUserById error:', authErr);
      return { success: false, error: authErr.message || 'Failed to reset password.' };
    }

    return { success: true, message: 'Password reset successfully.' };
  } catch (err) {
    console.error('adminResetEmployeePassword error:', err);
    return { success: false, error: err.message || 'Failed to reset employee password' };
  }
}

/**
 * Toggle employee status (Active / Inactive)
 */
export async function adminToggleEmployeeStatus({ employeeId, isActive }) {
  try {
    const { data, error } = await supabase.rpc('admin_toggle_employee_status', {
      p_employee_id: employeeId,
      p_is_active: isActive,
    });
    if (error) {
      console.error('RPC admin_toggle_employee_status error:', error);
      return { success: false, error: error.message || 'Database error updating status' };
    }
    return data;
  } catch (err) {
    console.error('adminToggleEmployeeStatus error:', err);
    return { success: false, error: err.message || 'Failed to toggle employee status' };
  }
}

/**
 * Permanently delete employee account and all their data (admin only)
 */
export async function adminDeleteEmployee(employeeId) {
  try {
    if (!adminSupabase) {
      return {
        success: false,
        error: 'Admin operations require VITE_SUPABASE_SERVICE_ROLE_KEY. Please add it to Vercel environment variables and redeploy.',
      };
    }

    // 1. Delete work sessions first (foreign key)
    const { error: sessErr } = await adminSupabase
      .from('work_sessions')
      .delete()
      .eq('employee_id', employeeId);
    if (sessErr) {
      console.warn('Session cleanup notice:', sessErr.message);
    }

    // 2. Delete profile
    const { error: profErr } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', employeeId);
    if (profErr) {
      console.warn('Profile delete error:', profErr.message);
    }

    // 3. Delete auth user
    const { error: authErr } = await adminSupabase.auth.admin.deleteUser(employeeId);
    if (authErr) {
      console.error('GoTrue admin.deleteUser error:', authErr);
      return { success: false, error: `Profile deleted but auth removal failed: ${authErr.message}` };
    }

    return { success: true, message: 'Employee account and all data deleted successfully.' };
  } catch (err) {
    console.error('adminDeleteEmployee error:', err);
    return { success: false, error: err.message || 'Failed to delete employee account' };
  }
}
