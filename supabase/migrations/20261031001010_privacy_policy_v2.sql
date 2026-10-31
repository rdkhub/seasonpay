-- Política de privacidad actualizada (cuentas con usuario y contraseña, sin correo).
-- Al cambiar la versión, la app vuelve a pedir el consentimiento.
update public.app_config set value = '"2026-10-30"' where key = 'privacy_policy_version';
