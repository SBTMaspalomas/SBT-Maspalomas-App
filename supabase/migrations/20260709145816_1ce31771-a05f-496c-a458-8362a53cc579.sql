
CREATE OR REPLACE FUNCTION public.derive_age_category(_category TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _category IS NULL THEN 'U14+'
    WHEN lower(_category) ~ '(benjam|premini|minibask|mini)' THEN 'U12'
    ELSE 'U14+'
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_team_channel(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.derive_age_category(text) FROM PUBLIC, anon;

DROP POLICY IF EXISTS "private_messages_update_read" ON public.private_messages;
CREATE POLICY "private_messages_update_read" ON public.private_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.families_meta f WHERE f.id = receiver_family_id AND f.head_profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.families_meta f WHERE f.id = receiver_family_id AND f.head_profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
