-- Allow authenticated users to insert their own family during registration
CREATE POLICY "families_meta_insert_own"
  ON public.families_meta FOR INSERT TO authenticated
  WITH CHECK (head_profile_id = auth.uid());

-- Allow authenticated users to update their own family
CREATE POLICY "families_meta_update_own"
  ON public.families_meta FOR UPDATE TO authenticated
  USING (head_profile_id = auth.uid())
  WITH CHECK (head_profile_id = auth.uid());

-- Allow authenticated users (parents) to insert players linked to their family
CREATE POLICY "players_insert_own_family"
  ON public.players FOR INSERT TO authenticated
  WITH CHECK (
    family_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM public.families_meta f WHERE f.id = family_id AND f.head_profile_id = auth.uid())
  );

-- Allow profiles upsert (the existing insert_own policy should cover this, but ensure update works)
-- profiles_insert_own and profiles_update_own already exist, so this should be fine.

-- Grant INSERT on families_meta and players to authenticated role
GRANT INSERT, UPDATE ON public.families_meta TO authenticated;
GRANT INSERT ON public.players TO authenticated;
