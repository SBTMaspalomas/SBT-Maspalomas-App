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
      const { data: teams, error: teamsError } = await supabase.from("teams").select("*");
      if (teamsError) {
        console.error("useClubData: error cargando equipos", teamsError);
      } else if (teams) {
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
        const { data: players, error: playersError } = await supabase.from("players").select("*");
        if (playersError) {
          console.error("useClubData: error cargando jugadores", playersError);
        } else if (players) {
          clubStore.set((s) => {
            s.players = players.map(p => {
              const fullName = p.full_name ?? "";
              const parts = fullName.split(" ");
              return {
                id: p.id,
                firstName: parts[0] ?? "",
                lastName: parts.slice(1).join(" "),
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
              };
            });
          });
        }
      }

      // Cargar anuncios/eventos
      const { data: events, error: eventsError } = await supabase.from("club_events").select("*");
      if (eventsError) {
        console.error("useClubData: error cargando eventos", eventsError);
      } else if (events) {
        clubStore.set((s) => {
          s.announcements = events.map(e => {
            const ts = e.event_date ? new Date(e.event_date).getTime() : Date.now();
            return {
              id: e.id,
              title: e.title,
              body: e.description || "",
              at: Number.isNaN(ts) ? Date.now() : ts
            };
          });
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
