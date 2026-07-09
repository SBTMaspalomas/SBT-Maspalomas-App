
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS age_category TEXT;

CREATE OR REPLACE FUNCTION public.derive_age_category(_category TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _category IS NULL THEN 'U14+'
    WHEN lower(_category) ~ '(benjam|premini|minibask|mini)' THEN 'U12'
    ELSE 'U14+'
  END;
$$;

UPDATE public.teams SET age_category = public.derive_age_category(category) WHERE age_category IS NULL;

CREATE TABLE IF NOT EXISTS public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL CHECK (channel_type IN ('team','family','broadcast')),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_messages_channel_idx ON public.team_messages(channel_type, team_id, created_at);

GRANT SELECT, INSERT ON public.team_messages TO authenticated;
GRANT ALL ON public.team_messages TO service_role;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_team_channel(_user_id UUID, _team_id UUID, _channel TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _channel = 'broadcast' THEN true
    WHEN public.has_role(_user_id, 'admin') THEN true
    WHEN _team_id IS NULL THEN false
    WHEN EXISTS (SELECT 1 FROM public.coach_teams ct WHERE ct.user_id = _user_id AND ct.team_id = _team_id::text) THEN true
    WHEN _channel = 'family' AND EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.families_meta f ON f.id = p.family_id
      WHERE p.team_id = _team_id::text AND f.head_profile_id = _user_id
    ) THEN true
    WHEN _channel = 'team' AND EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.players p ON p.team_id = t.id::text
      JOIN public.families_meta f ON f.id = p.family_id
      WHERE t.id = _team_id AND f.head_profile_id = _user_id AND COALESCE(t.age_category,'U14+') <> 'U12'
    ) THEN true
    ELSE false
  END;
$$;

CREATE POLICY "team_messages_select" ON public.team_messages FOR SELECT TO authenticated
  USING (public.user_can_access_team_channel(auth.uid(), team_id, channel_type));

CREATE POLICY "team_messages_insert" ON public.team_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.user_can_access_team_channel(auth.uid(), team_id, channel_type)
    AND (
      channel_type <> 'broadcast'
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.coach_teams WHERE user_id = auth.uid())
    )
  );

CREATE TABLE IF NOT EXISTS public.private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_family_id UUID NOT NULL REFERENCES public.families_meta(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS private_messages_family_idx ON public.private_messages(receiver_family_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.private_messages TO authenticated;
GRANT ALL ON public.private_messages TO service_role;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "private_messages_select" ON public.private_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.families_meta f WHERE f.id = receiver_family_id AND f.head_profile_id = auth.uid())
  );

CREATE POLICY "private_messages_insert" ON public.private_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.families_meta f WHERE f.id = receiver_family_id AND f.head_profile_id = auth.uid())
    )
  );

CREATE POLICY "private_messages_update_read" ON public.private_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.families_meta f WHERE f.id = receiver_family_id AND f.head_profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
