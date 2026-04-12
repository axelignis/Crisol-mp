-- ============================================================
-- CRISOL -- Migracion 011: Custom access token hook
-- Inyecta user_role en JWT claims para RLS sin DB query.
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims    jsonb;
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public."user"
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"buyer"');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Permisos para supabase_auth_admin
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT ALL ON TABLE public."user" TO supabase_auth_admin;
