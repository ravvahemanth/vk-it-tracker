-- ============================================================
-- VK IT Solutions — Full Database Setup
-- Run this ENTIRE script in Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Paste & Run)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. WORK SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  session_number INTEGER NOT NULL,
  starting_form_number BIGINT NOT NULL CHECK (starting_form_number > 0),
  ending_form_number BIGINT CHECK (ending_form_number >= starting_form_number),
  total_forms INTEGER CHECK (total_forms > 0),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'working' CHECK (status IN ('working', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. CONSTRAINTS & INDEXES
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_employee
  ON public.work_sessions (employee_id)
  WHERE status = 'working';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_session_number
  ON public.work_sessions (employee_id, work_date, session_number);

CREATE INDEX IF NOT EXISTS idx_sessions_employee_date
  ON public.work_sessions (employee_id, work_date);

CREATE INDEX IF NOT EXISTS idx_sessions_work_date
  ON public.work_sessions (work_date);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS work_sessions_updated_at ON public.work_sessions;
CREATE TRIGGER work_sessions_updated_at
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles Policies
DROP POLICY IF EXISTS "employees_read_own_profile" ON public.profiles;
CREATE POLICY "employees_read_own_profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "allow_profile_insert_service" ON public.profiles;
CREATE POLICY "allow_profile_insert_service"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "employees_update_own_profile" ON public.profiles;
CREATE POLICY "employees_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = 'employee');

DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;
CREATE POLICY "admin_update_all_profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Work Sessions Policies
DROP POLICY IF EXISTS "employees_read_own_sessions" ON public.work_sessions;
CREATE POLICY "employees_read_own_sessions"
  ON public.work_sessions FOR SELECT
  USING (employee_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "employees_insert_own_sessions" ON public.work_sessions;
CREATE POLICY "employees_insert_own_sessions"
  ON public.work_sessions FOR INSERT
  WITH CHECK (employee_id = auth.uid() AND public.get_my_role() = 'employee');

DROP POLICY IF EXISTS "employees_update_own_active_sessions" ON public.work_sessions;
CREATE POLICY "employees_update_own_active_sessions"
  ON public.work_sessions FOR UPDATE
  USING (
    (employee_id = auth.uid() AND status = 'working')
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    (employee_id = auth.uid())
    OR public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "no_delete_sessions" ON public.work_sessions;
CREATE POLICY "no_delete_sessions"
  ON public.work_sessions FOR DELETE
  USING (false);

-- ============================================================
-- 6. BUSINESS LOGIC FUNCTIONS (RPCs)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_work_session(p_starting_form BIGINT)
RETURNS JSON AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_today DATE;
  v_active_session public.work_sessions%ROWTYPE;
  v_last_session public.work_sessions%ROWTYPE;
  v_expected_start BIGINT;
  v_session_number INTEGER;
  v_new_session public.work_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found. Please contact admin.');
  END IF;

  IF v_profile.role != 'employee' THEN
    RETURN json_build_object('success', false, 'error', 'Only employees can start work sessions.');
  END IF;

  IF NOT v_profile.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Your account is inactive. Please contact admin.');
  END IF;

  v_today := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

  SELECT * INTO v_active_session
    FROM public.work_sessions
    WHERE employee_id = v_profile.id AND status = 'working';

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You already have an active work session. Please complete it before starting a new one.',
      'active_session', row_to_json(v_active_session)
    );
  END IF;

  IF p_starting_form <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Starting form number must be a positive number.');
  END IF;

  SELECT * INTO v_last_session
    FROM public.work_sessions
    WHERE employee_id = v_profile.id
      AND work_date = v_today
      AND status = 'completed'
    ORDER BY session_number DESC
    LIMIT 1;

  IF FOUND THEN
    v_expected_start := v_last_session.ending_form_number + 1;
    IF p_starting_form != v_expected_start THEN
      RETURN json_build_object(
        'success', false,
        'error', format('Invalid starting form number. Your next session must start at %s.', v_expected_start),
        'expected_start', v_expected_start
      );
    END IF;
  END IF;

  SELECT COALESCE(MAX(session_number), 0) + 1 INTO v_session_number
    FROM public.work_sessions
    WHERE employee_id = v_profile.id AND work_date = v_today;

  INSERT INTO public.work_sessions (
    employee_id,
    work_date,
    session_number,
    starting_form_number,
    start_time,
    status
  ) VALUES (
    v_profile.id,
    v_today,
    v_session_number,
    p_starting_form,
    NOW(),
    'working'
  )
  RETURNING * INTO v_new_session;

  RETURN json_build_object(
    'success', true,
    'session', row_to_json(v_new_session),
    'message', 'Work session started successfully.'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A session already exists. Please refresh and try again.'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', format('An unexpected error occurred: %s', SQLERRM)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.complete_work_session(
  p_session_id UUID,
  p_ending_form BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_session public.work_sessions%ROWTYPE;
  v_total_forms INTEGER;
  v_updated_session public.work_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found.');
  END IF;

  IF v_profile.role != 'employee' THEN
    RETURN json_build_object('success', false, 'error', 'Only employees can complete work sessions.');
  END IF;

  SELECT * INTO v_session
    FROM public.work_sessions
    WHERE id = p_session_id
      AND employee_id = v_profile.id
      AND status = 'working';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Active session not found. It may have already been completed.'
    );
  END IF;

  IF p_ending_form IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ending form number is required.');
  END IF;

  IF p_ending_form <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Ending form number must be a positive number.');
  END IF;

  IF p_ending_form < v_session.starting_form_number THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Ending form number cannot be less than starting form number (%s).', v_session.starting_form_number)
    );
  END IF;

  v_total_forms := (p_ending_form - v_session.starting_form_number) + 1;

  IF v_total_forms <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Total forms calculated to zero or less. Please check your numbers.');
  END IF;

  UPDATE public.work_sessions SET
    ending_form_number = p_ending_form,
    total_forms = v_total_forms,
    end_time = NOW(),
    status = 'completed'
  WHERE id = v_session.id
  RETURNING * INTO v_updated_session;

  RETURN json_build_object(
    'success', true,
    'session', row_to_json(v_updated_session),
    'total_forms', v_total_forms,
    'message', format('Session completed successfully. %s forms recorded.', v_total_forms)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', format('An unexpected error occurred: %s', SQLERRM)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_active_session()
RETURNS JSON AS $$
DECLARE
  v_session public.work_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
    FROM public.work_sessions
    WHERE employee_id = auth.uid() AND status = 'working'
    LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object('has_active', true, 'session', row_to_json(v_session));
  ELSE
    RETURN json_build_object('has_active', false, 'session', null);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_expected_next_form()
RETURNS JSON AS $$
DECLARE
  v_today DATE;
  v_last_session public.work_sessions%ROWTYPE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

  SELECT * INTO v_last_session
    FROM public.work_sessions
    WHERE employee_id = auth.uid()
      AND work_date = v_today
      AND status = 'completed'
    ORDER BY session_number DESC
    LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'has_previous', true,
      'last_ending_form', v_last_session.ending_form_number,
      'expected_next', v_last_session.ending_form_number + 1,
      'last_session_number', v_last_session.session_number
    );
  ELSE
    RETURN json_build_object(
      'has_previous', false,
      'last_ending_form', null,
      'expected_next', null,
      'last_session_number', 0
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_admin_daily_summary(p_date DATE DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_role TEXT;
  v_date DATE;
  v_result JSON;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  v_date := COALESCE(p_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE);

  SELECT json_build_object(
    'success', true,
    'date', v_date,
    'summary', (
      SELECT json_agg(emp_summary ORDER BY emp_summary->>'full_name')
      FROM (
        SELECT json_build_object(
          'employee_id', p.id,
          'full_name', p.full_name,
          'username', p.username,
          'is_active', p.is_active,
          'sessions_today', COALESCE(s.session_count, 0),
          'total_forms_today', COALESCE(s.total_forms_sum, 0),
          'active_session', s.active_session,
          'last_status', CASE 
            WHEN s.active_session IS NOT NULL THEN 'working'
            WHEN s.session_count > 0 THEN 'completed'
            ELSE 'not_working'
          END
        ) AS emp_summary
        FROM public.profiles p
        LEFT JOIN (
          SELECT
            employee_id,
            COUNT(*) FILTER (WHERE status = 'completed') AS session_count,
            SUM(total_forms) FILTER (WHERE status = 'completed') AS total_forms_sum,
            (MAX(CASE WHEN status = 'working' THEN jsonb_build_object(
              'id', id::TEXT,
              'session_number', session_number,
              'starting_form_number', starting_form_number,
              'start_time', start_time
            ) ELSE NULL END))::json AS active_session
          FROM public.work_sessions
          WHERE work_date = v_date
          GROUP BY employee_id
        ) s ON s.employee_id = p.id
        WHERE p.role = 'employee' AND p.is_active = true
      ) sub
    ),
    'totals', (
      SELECT json_build_object(
        'total_employees_active', COUNT(DISTINCT employee_id),
        'currently_working', COUNT(*) FILTER (WHERE status = 'working'),
        'total_completed_sessions', COUNT(*) FILTER (WHERE status = 'completed'),
        'grand_total_forms', COALESCE(SUM(total_forms) FILTER (WHERE status = 'completed'), 0)
      )
      FROM public.work_sessions
      WHERE work_date = v_date
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 7. DYNAMIC EMPLOYEE MANAGEMENT RPCs (ADMIN)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_full_name TEXT,
  p_username TEXT,
  p_password TEXT,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
  v_new_id UUID;
  v_clean_username TEXT;
  v_email TEXT;
  v_new_profile public.profiles%ROWTYPE;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Only administrators can create employee accounts.');
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Full name is required.');
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Username is required.');
  END IF;

  v_clean_username := lower(trim(p_username));

  IF length(p_password) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 8 characters long.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_clean_username) THEN
    RETURN json_build_object('success', false, 'error', format('Username "%s" is already taken.', v_clean_username));
  END IF;

  v_email := v_clean_username || '@vkit.local';
  v_new_id := uuid_generate_v4();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('full_name', trim(p_full_name), 'username', v_clean_username, 'role', 'employee'),
    NOW(), NOW()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_new_id, v_new_id, json_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true),
    'email', v_email, NOW(), NOW(), NOW()
  );

  INSERT INTO public.profiles (id, full_name, username, role, is_active, created_at, updated_at)
  VALUES (v_new_id, trim(p_full_name), v_clean_username, 'employee', COALESCE(p_is_active, true), NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, username = EXCLUDED.username, is_active = EXCLUDED.is_active, updated_at = NOW()
  RETURNING * INTO v_new_profile;

  RETURN json_build_object(
    'success', true,
    'message', format('Employee account for %s created successfully.', trim(p_full_name)),
    'profile', row_to_json(v_new_profile)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', format('Username or email already exists.', v_clean_username));
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to create user: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_update_employee(
  p_employee_id UUID, p_full_name TEXT, p_username TEXT, p_is_active BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT; v_clean_username TEXT; v_email TEXT; v_updated_profile public.profiles%ROWTYPE;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Only administrators can update employee accounts.');
  END IF;

  v_clean_username := lower(trim(p_username));

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_clean_username AND id != p_employee_id) THEN
    RETURN json_build_object('success', false, 'error', format('Username "%s" is already taken by another account.', v_clean_username));
  END IF;

  v_email := v_clean_username || '@vkit.local';

  UPDATE public.profiles SET
    full_name = trim(p_full_name), username = v_clean_username, is_active = p_is_active, updated_at = NOW()
  WHERE id = p_employee_id
  RETURNING * INTO v_updated_profile;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee profile not found.');
  END IF;

  UPDATE auth.users SET
    email = v_email,
    raw_user_meta_data = json_build_object('full_name', trim(p_full_name), 'username', v_clean_username, 'role', 'employee'),
    updated_at = NOW()
  WHERE id = p_employee_id;

  RETURN json_build_object(
    'success', true,
    'message', format('Employee %s updated successfully.', trim(p_full_name)),
    'profile', row_to_json(v_updated_profile)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to update employee: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reset_employee_password(
  p_employee_id UUID, p_new_password TEXT
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  IF length(p_new_password) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 8 characters long.');
  END IF;

  UPDATE auth.users SET
    encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = NOW()
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee account not found.');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Password updated successfully.');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to reset password: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_toggle_employee_status(
  p_employee_id UUID, p_is_active BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  v_caller_role TEXT; v_updated_profile public.profiles%ROWTYPE;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  UPDATE public.profiles SET is_active = p_is_active, updated_at = NOW()
  WHERE id = p_employee_id
  RETURNING * INTO v_updated_profile;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found.');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', format('Employee %s.', CASE WHEN p_is_active THEN 'activated' ELSE 'deactivated' END),
    'profile', row_to_json(v_updated_profile)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', format('Failed to toggle status: %s', SQLERRM));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

