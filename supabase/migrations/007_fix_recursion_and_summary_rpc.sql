-- 007_fix_recursion_and_summary_rpc.sql
-- Fixes two backend bugs:
-- 1. "infinite recursion detected in policy for relation profiles"
--    Fix: Use SECURITY DEFINER function public.get_my_role() in policies instead of inline SELECT on profiles.
-- 2. "function max(json) does not exist" in get_admin_daily_summary RPC
--    Fix: Rewrite get_admin_daily_summary without MAX(jsonb) aggregation.

-- ============================================================
-- 1. SECURITY DEFINER ROLE HELPER (bypasses RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, anon;

-- ============================================================
-- 2. PROFILES RLS POLICIES (fixed to use get_my_role())
-- ============================================================
DROP POLICY IF EXISTS "admin_can_read_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_can_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_can_delete_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "employees_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow_profile_insert_service" ON public.profiles;
DROP POLICY IF EXISTS "employees_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;

CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.get_my_role() = 'admin');

CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.get_my_role() = 'admin')
  WITH CHECK (id = auth.uid() OR public.get_my_role() = 'admin');

CREATE POLICY "profiles_delete_policy"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'admin' AND id != auth.uid());

CREATE POLICY "profiles_insert_policy"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR public.get_my_role() = 'admin');

-- ============================================================
-- 3. WORK SESSIONS RLS POLICIES (fixed to use get_my_role())
-- ============================================================
DROP POLICY IF EXISTS "employees_read_own_sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "employees_insert_own_sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "employees_update_own_active_sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "admin_delete_sessions" ON public.work_sessions;

CREATE POLICY "work_sessions_select_policy"
  ON public.work_sessions FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR public.get_my_role() = 'admin');

CREATE POLICY "work_sessions_insert_policy"
  ON public.work_sessions FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid() AND public.get_my_role() = 'employee');

CREATE POLICY "work_sessions_update_policy"
  ON public.work_sessions FOR UPDATE
  TO authenticated
  USING (
    (employee_id = auth.uid() AND status = 'working')
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    (employee_id = auth.uid())
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "work_sessions_delete_policy"
  ON public.work_sessions FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 4. FIX get_admin_daily_summary RPC (no MAX(json))
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_daily_summary(p_date DATE DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_role TEXT;
  v_date DATE;
  v_result JSON;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL OR v_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Admin access required.');
  END IF;

  v_date := COALESCE(p_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE);

  SELECT json_build_object(
    'success', true,
    'date', v_date,
    'summary', (
      SELECT COALESCE(json_agg(emp_summary ORDER BY emp_summary->>'full_name'), '[]'::json)
      FROM (
        SELECT json_build_object(
          'employee_id', p.id,
          'full_name', p.full_name,
          'username', p.username,
          'is_active', p.is_active,
          'sessions_today', COALESCE(
            (SELECT COUNT(*) FROM public.work_sessions ws WHERE ws.employee_id = p.id AND ws.work_date = v_date AND ws.status = 'completed'), 0
          ),
          'total_forms_today', COALESCE(
            (SELECT SUM(total_forms) FROM public.work_sessions ws WHERE ws.employee_id = p.id AND ws.work_date = v_date AND ws.status = 'completed'), 0
          ),
          'active_session', (
            SELECT row_to_json(ws_act) FROM (
              SELECT id, session_number, starting_form_number, start_time
              FROM public.work_sessions
              WHERE employee_id = p.id AND status = 'working'
              LIMIT 1
            ) ws_act
          ),
          'last_status', CASE 
            WHEN EXISTS (SELECT 1 FROM public.work_sessions ws WHERE ws.employee_id = p.id AND ws.status = 'working') THEN 'working'
            WHEN EXISTS (SELECT 1 FROM public.work_sessions ws WHERE ws.employee_id = p.id AND ws.work_date = v_date AND ws.status = 'completed') THEN 'completed'
            ELSE 'not_working'
          END
        ) AS emp_summary
        FROM public.profiles p
        WHERE p.role = 'employee' AND p.is_active = true
      ) sub
    ),
    'totals', (
      SELECT json_build_object(
        'total_employees_active', COALESCE(COUNT(DISTINCT employee_id), 0),
        'currently_working', COALESCE(COUNT(*) FILTER (WHERE status = 'working'), 0),
        'total_completed_sessions', COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0),
        'grand_total_forms', COALESCE(SUM(total_forms) FILTER (WHERE status = 'completed'), 0)
      )
      FROM public.work_sessions
      WHERE work_date = v_date
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_admin_daily_summary(DATE) TO authenticated;

SELECT 'Migration 007 applied successfully: RLS recursion fixed + RPC max(json) fixed' AS result;
