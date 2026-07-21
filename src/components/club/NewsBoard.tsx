import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pin, PinOff, Plus, Trash2, Megaphone } from "lucide-react";
import { toast } from "sonner";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  author_id: string | null;
  created_at: string;
}

export function NewsBoard() {
  const { user, role } = useAuth();
  const canManage = role === "admin" || role === "coach";

  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const loadData = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, pinned, author_id, created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setAnnouncements([]);
      setLoadError("No se pudo cargar la cartelera.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as AnnouncementRow[];
    setAnnouncements(rows);

    // Resolver nombres de autor (admin/coach) para mostrarlos en cada anuncio.
    const authorIds = Array.from(
      new Set(rows.map((r) => r.author_id).filter((id): id is string => Boolean(id))),
    );
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p) => {
        if (p.full_name) map[p.id] = p.full_name;
      });
      setAuthorNames(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresco en vivo: la cartelera se actualiza cuando cualquier admin/coach
  // publica, edita o borra un anuncio.
  useEffect(() => {
    const channel = supabase
      .channel("announcements-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        loadData();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const post = async () => {
    if (!newTitle.trim()) {
      toast.error("El anuncio necesita un título");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      title: newTitle.trim(),
      body: newBody.trim() || null,
      author_id: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error("No se pudo publicar el anuncio");
      return;
    }
    setNewTitle("");
    setNewBody("");
    toast.success("Anuncio publicado");
    loadData();
  };

  const togglePin = async (a: AnnouncementRow) => {
    const { error } = await supabase
      .from("announcements")
      .update({ pinned: !a.pinned })
      .eq("id", a.id);
    if (error) {
      toast.error("No se pudo actualizar el anuncio");
      return;
    }
    loadData();
  };

  const remove = async (a: AnnouncementRow) => {
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) {
      toast.error("No se pudo eliminar el anuncio");
      return;
    }
    toast.success("Anuncio eliminado");
    loadData();
  };

  const authorLabel = useCallback(
    (id: string | null) => (id ? (authorNames[id] ?? "Equipo del club") : "Equipo del club"),
    [authorNames],
  );

  const hasAnnouncements = useMemo(() => announcements.length > 0, [announcements]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <CardTitle>Cartelera del Club</CardTitle>
          {saving && <span className="text-xs text-muted-foreground">Guardando…</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
            <div className="text-sm font-semibold">Publicar anuncio</div>
            <Input
              placeholder="Título (ej: Entrenamiento suspendido)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Cuerpo del mensaje…"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
            />
            <Button size="sm" onClick={post} disabled={saving}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Publicar
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando cartelera…</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !hasAnnouncements ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay anuncios publicados.
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`rounded-lg border p-3 ${a.pinned ? "border-primary/40 bg-primary/5" : "border-border bg-surface"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {a.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <div className="font-semibold">{a.title}</div>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {authorLabel(a.author_id)} · {new Date(a.created_at).toLocaleString("es-ES")}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title={a.pinned ? "Desfijar" : "Fijar arriba"}
                        onClick={() => togglePin(a)}
                      >
                        {a.pinned ? (
                          <PinOff className="h-3.5 w-3.5" />
                        ) : (
                          <Pin className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Eliminar"
                        onClick={() => remove(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {a.body && <div className="mt-2 whitespace-pre-wrap text-sm">{a.body}</div>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
