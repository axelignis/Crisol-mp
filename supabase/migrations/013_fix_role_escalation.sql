-- ============================================================
-- CRISOL -- Migracion 013: Fix role escalation in user trigger
-- CR-02: Never trust client-supplied role from raw_user_meta_data.
-- Always default to 'buyer'; admin promotes via DB manually.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_handle_new_auth_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
