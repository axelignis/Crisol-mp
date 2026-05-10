-- ============================================================
-- CRISOL — Migracion 022: shipment.courier admite 'flat_rate'
-- Phase 3 CR-04 fix.
--
-- El stage de checkout permite 'flat_rate' como cotizacion fallback
-- cuando los couriers reales no estan disponibles. Antes este valor
-- se reescribia a 'chilexpress' al insertar en shipment, lo que
-- contaminaba el audit trail. Ahora persistimos el courier literal
-- y dejamos que el artesano actualice manualmente al despachar.
-- Forward-only.
-- ============================================================

ALTER TABLE shipment DROP CONSTRAINT IF EXISTS shipment_courier_check;

ALTER TABLE shipment
  ADD CONSTRAINT shipment_courier_check
  CHECK (courier IN ('chilexpress', 'starken', 'dhl', 'fedex', 'pickup', 'flat_rate'));

COMMENT ON COLUMN shipment.courier IS
  'chilexpress | starken = nacional | dhl | fedex = internacional | pickup = retiro | flat_rate = tarifa fallback (artesano define el courier real al despachar).';
