-- ============================================================
-- VK IT Solutions — Employee Work Session Tracker
-- Migration 003: Business Logic Functions (RPCs)
-- ============================================================

-- ============================================================
-- FUNCTION: start_work_session
-- Called by employee to start a new work session
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
  -- 1. Get authenticated user profile
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

  -- 2. Determine today's date in IST (Asia/Kolkata = UTC+5:30)
  v_today := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

  -- 3. Check for existing active session
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

  -- 4. Validate starting form number
  IF p_starting_form <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Starting form number must be a positive number.');
  END IF;

  -- 5. Find today's last completed session
  SELECT * INTO v_last_session
    FROM public.work_sessions
    WHERE employee_id = v_profile.id
      AND work_date = v_today
      AND status = 'completed'
    ORDER BY session_number DESC
    LIMIT 1;

  IF FOUND THEN
    -- Must start exactly where the last session ended + 1
    v_expected_start := v_last_session.ending_form_number + 1;
    IF p_starting_form != v_expected_start THEN
      RETURN json_build_object(
        'success', false,
        'error', format('Invalid starting form number. Your next session must start at %s.', v_expected_start),
        'expected_start', v_expected_start
      );
    END IF;
  END IF;

  -- 6. Calculate session number for today
  SELECT COALESCE(MAX(session_number), 0) + 1 INTO v_session_number
    FROM public.work_sessions
    WHERE employee_id = v_profile.id AND work_date = v_today;

  -- 7. Create the new session
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

-- ============================================================
-- FUNCTION: complete_work_session
-- Called by employee to finish an active session
-- ============================================================
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
  -- 1. Get authenticated user profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found.');
  END IF;

  IF v_profile.role != 'employee' THEN
    RETURN json_build_object('success', false, 'error', 'Only employees can complete work sessions.');
  END IF;

  -- 2. Find the active session
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

  -- 3. Validate ending form number
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

  -- 4. Calculate total forms (server-side, cannot be manipulated by client)
  v_total_forms := (p_ending_form - v_session.starting_form_number) + 1;

  IF v_total_forms <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Total forms calculated to zero or less. Please check your numbers.');
  END IF;

  -- 5. Update the session
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

-- ============================================================
-- FUNCTION: get_my_active_session
-- Returns the current user's active session if any
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_active_session()
RETURNS JSON AS $$
DECLARE
  v_session public.work_sessions%ROWTYPE;
  v_today DATE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  
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

-- ============================================================
-- FUNCTION: get_expected_next_form
-- Returns expected next starting form for current employee today
-- ============================================================
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

-- ============================================================
-- FUNCTION: get_admin_daily_summary (Admin only)
-- Returns summary of all employees for a given date
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_daily_summary(p_date DATE DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_role TEXT;
  v_date DATE;
  v_result JSON;
BEGIN
  -- Security check
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
