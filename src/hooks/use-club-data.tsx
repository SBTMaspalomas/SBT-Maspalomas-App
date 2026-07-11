import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clubStore } from "@/lib/clubStore";
import { useAuth } from "@/lib/auth-context";

export function useClubData() {
  const { session, role } = useAuth();

  useEffect(() => {
    if (!session) return;

    const loadData = async () => {
      // Cargar equipos
      const { data: teams } = await supabase.from("teams").select("*");
      if (teams) {
        clubStore.set((s) => {
          s.teams = teams.map(t => ({
            id: t.id,
            name: t.name,
            category: t.category || "",
            coachId: "" // Se podría vincular con coach_teams
          }));
        });
      }

      // Cargar jugadores si es admin o coach
      if (role === "admin" || role === "coach") {
        const { data: players } = await supabase.from("players").select("*");
        if (players) {
          clubStore.set((s) => {
            s.players = players.map(p => ({
              id: p.id,
              firstName: p.full_name.split(" ")[0],
              lastName: p.full_name.split(" ").slice(1).join(" "),
              birthDate: p.birth_date || "",
              docType: "DNI",
              docNumber: (p as any).id_card_number || "",
              teamId: p.team_id || "",
              parentId: p.family_id || "",
              auth_image: true,
              auth_travel: true,
              auth_medical: true,
              docStatus: "approved",
              payments: [],
              attendance: {}
            }));
          });
        }
      }

      // Cargar anuncios/eventos
      const { data: events } = await supabase.from("club_events").select("*");
      if (events) {
        clubStore.set((s) => {
          s.announcements = events.map(e => ({
            id: e.id,
            title: e.title,
            body: e.description || "",
            at: new Date(e.event_date).getTime()
          }));
        });
      }
    };

    loadData();

    // Suscripciones Realtime (opcional por ahora)
    const channel = supabase.channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, role]);
}
