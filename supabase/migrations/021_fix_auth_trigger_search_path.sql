-- ============================================================
-- CRISOL -- Migracion 021: Fix search_path en trigger de auth
-- BUG: fn_handle_new_auth_user() es SECURITY DEFINER pero no fija
-- search_path. El rol supabase_auth_admin tiene search_path=auth,
-- por lo que el INSERT INTO "user" busca auth.user (inexistente)
-- al usar supabase.auth.admin.createUser(). Esto rompe el seed
-- de usuarios E2E y cualquier path que pase por GoTrue admin API.
-- Fix: anclar search_path a public para resolver "user".
-- ============================================================

CREATE OR REPLACE FUNCTION fn_handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO "user" (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    'buyer'  -- ALWAYS default to buyer; admin promotes via DB
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
