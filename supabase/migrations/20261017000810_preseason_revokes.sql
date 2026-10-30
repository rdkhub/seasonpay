-- Permisos mínimos. Va aparte porque los revoke en la misma migración se cancelaban.
revoke update, delete on public.feedback, public.survey_responses, public.events from anon, authenticated;
revoke select on public.feedback, public.survey_responses, public.events from anon;
revoke all on public.push_subscriptions, public.push_reminders_sent, public.admins from anon, authenticated;
revoke insert, update, delete on public.app_config, public.provider_rates from anon, authenticated;
revoke all on public.metrics_registered, public.metrics_retention, public.metrics_payment_errors,
  public.metrics_feature_usage, public.metrics_weekly_active from anon;
revoke execute on function public.internal_get_secret(text) from public, anon, authenticated;
revoke execute on function public.internal_set_secret(text, text) from public, anon, authenticated;
grant execute on function public.internal_get_secret(text) to service_role;
grant execute on function public.internal_set_secret(text, text) to service_role;
