import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Calendar, User, AlertCircle, Info, Megaphone } from "lucide-react";

interface News {
  id: string;
  title: string;
  content: string;
  type: "info" | "alert" | "announcement";
  created_by: string;
  created_at: string;
  author_name?: string;
}

const typeConfig = {
  info: { label: "Información", icon: Info, color: "bg-blue-50 text-blue-700 border-blue-200" },
  alert: { label: "Alerta", icon: AlertCircle, color: "bg-red-50 text-red-700 border-red-200" },
  announcement: { label: "Anuncio", icon: Megaphone, color: "bg-green-50 text-green-700 border-green-200" },
};

export function NewsBoard() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "info" as "info" | "alert" | "announcement",
  });

  const loadNews = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("club_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading news:", error);
      setLoading(false);
      return;
    }

    setNews((data || []) as News[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNews();
    // Check if user is admin
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        setIsAdmin(roles?.some((r) => r.role === "admin") ?? false);
      }
    };
    checkAdmin();
  }, [loadNews]);

  const handleCreateNews = async () => {
    if (!formData.title || !formData.content) {
      toast.error("Completa todos los campos");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("No autenticado");
      return;
    }

    const { error } = await supabase.from("club_events").insert({
      title: formData.title,
      content: formData.content,
      type: formData.type,
      created_by: user.id,
    });

    if (error) {
      toast.error("Error al crear noticia");
      return;
    }

    toast.success("Noticia publicada");
    setFormData({ title: "", content: "", type: "info" });
    setOpenDialog(false);
    loadNews();
  };

  const handleDeleteNews = async (id: string) => {
    const { error } = await supabase.from("club_events").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar");
      return;
    }
    toast.success("Noticia eliminada");
    loadNews();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Cartelera del Club</h2>
          <p className="text-sm text-muted-foreground">Noticias y avisos importantes</p>
        </div>
        {isAdmin && (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Noticia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publicar Noticia</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "info" | "alert" | "announcement" })}
                    className="w-full rounded border border-border bg-background p-2 text-sm"
                  >
                    <option value="info">Información</option>
                    <option value="alert">Alerta</option>
                    <option value="announcement">Anuncio</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Título</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Cambio de horario de entrenamientos"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Contenido</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Escribe el contenido de la noticia..."
                    className="w-full rounded border border-border bg-background p-2 text-sm"
                    rows={5}
                  />
                </div>

                <Button onClick={handleCreateNews} className="w-full">
                  Publicar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* News List */}
      <div className="space-y-2">
        {loading ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </Card>
        ) : news.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay noticias publicadas</p>
          </Card>
        ) : (
          news.map((item) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;
            const date = new Date(item.created_at);
            const dateStr = date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
            const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

            return (
              <Card key={item.id} className={`p-4 border-l-4 ${config.color}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <h3 className="font-semibold text-sm">{item.title}</h3>
                    </div>
                    <p className="text-sm text-foreground/80 mb-3">{item.content}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {dateStr} a las {timeStr}
                      </div>
                      {item.author_name && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.author_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteNews(item.id)}
                      className="text-destructive hover:bg-destructive/10 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
