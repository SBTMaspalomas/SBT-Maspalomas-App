import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  FileText,
  Eye,
} from "lucide-react";

interface Payment {
  id: string;
  player_id: string;
  player_name: string;
  amount: number;
  period: string;
  status: "pending" | "paid" | "rejected";
  receipt_url?: string;
  created_at: string;
  paid_at?: string;
}

interface Player {
  id: string;
  full_name: string;
  team_id?: string;
  family_id?: string;
}

interface Team {
  id: string;
  name: string;
}

const statusConfig = {
  pending: {
    label: "Pendiente",
    icon: Clock,
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  paid: {
    label: "Pagado",
    icon: CheckCircle2,
    color: "bg-green-50 text-green-700 border-green-200",
  },
  rejected: { label: "Rechazado", icon: XCircle, color: "bg-red-50 text-red-700 border-red-200" },
};

// ==================== ADMIN DASHBOARD ====================
export function PaymentsAdmin() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [paymentsRes, playersRes, teamsRes] = await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("players").select("id, full_name, team_id, family_id"),
      supabase.from("teams").select("id, name"),
    ]);

    setPayments((paymentsRes.data || []) as Payment[]);
    setPlayers((playersRes.data || []) as Player[]);
    setTeams((teamsRes.data || []) as Team[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updatePaymentStatus = async (
    paymentId: string,
    status: "pending" | "paid" | "rejected",
  ) => {
    const { error } = await supabase
      .from("payments")
      .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
      .eq("id", paymentId);

    if (error) {
      toast.error("Error al actualizar pago");
      return;
    }

    toast.success(`Pago marcado como ${statusConfig[status].label}`);
    setShowDetails(false);
    loadData();
  };

  const stats = {
    total: payments.length,
    pending: payments.filter((p) => p.status === "pending").length,
    paid: payments.filter((p) => p.status === "paid").length,
    rejected: payments.filter((p) => p.status === "rejected").length,
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-bold">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Pendientes</div>
          <div className="text-lg font-bold text-yellow-600">{stats.pending}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Pagados</div>
          <div className="text-lg font-bold text-green-600">{stats.paid}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Rechazados</div>
          <div className="text-lg font-bold text-red-600">{stats.rejected}</div>
        </Card>
      </div>

      {/* Amount Summary */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Monto Total</div>
            <div className="text-2xl font-bold">{totalAmount.toFixed(2)}€</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Monto Pagado</div>
            <div className="text-2xl font-bold text-green-600">{paidAmount.toFixed(2)}€</div>
          </div>
        </div>
      </Card>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay pagos registrados
            </p>
          ) : (
            payments.map((payment) => {
              const config = statusConfig[payment.status];
              const Icon = config.icon;
              const player = players.find((p) => p.id === payment.player_id);

              return (
                <button
                  key={payment.id}
                  onClick={() => {
                    setSelectedPayment(payment);
                    setShowDetails(true);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{payment.player_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {payment.period} · {payment.amount}€
                      </div>
                    </div>
                    <Badge variant="outline" className={config.color}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPayment?.player_name}</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Período:</span>
                  <p className="font-medium">{selectedPayment.period}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Monto:</span>
                  <p className="font-medium">{selectedPayment.amount}€</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <p className="font-medium">{statusConfig[selectedPayment.status].label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha:</span>
                  <p className="font-medium">
                    {new Date(selectedPayment.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
              </div>

              {selectedPayment.receipt_url && (
                <div className="border border-border rounded p-3">
                  <div className="text-sm font-medium mb-2">Comprobante</div>
                  <a
                    href={selectedPayment.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    Ver comprobante
                  </a>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => updatePaymentStatus(selectedPayment.id, "pending")}
                  className="flex-1"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Pendiente
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => updatePaymentStatus(selectedPayment.id, "paid")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprobar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => updatePaymentStatus(selectedPayment.id, "rejected")}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== PARENT/FAMILY DASHBOARD ====================
export function PaymentsParent({ playerId }: { playerId?: string } = {}) {
  const { user, family } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    // Familia: cuotas por family_id. Jugador SENIOR (sin familia): por player_id.
    if (!family?.id && !playerId) return;

    setLoading(true);
    let query = supabase.from("payments").select("*").order("created_at", { ascending: false });
    query = family?.id ? query.eq("family_id", family.id) : query.eq("player_id", playerId!);
    const { data, error } = await query;

    if (!error) {
      setPayments((data || []) as Payment[]);
    }
    setLoading(false);
  }, [family?.id, playerId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleUploadReceipt = async (paymentId: string, file: File) => {
    if (!file) return;

    setUploadingId(paymentId);

    // Upload to Storage
    const filePath = `payments/${paymentId}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("player-docs")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Error al subir comprobante");
      setUploadingId(null);
      return;
    }

    // Get public URL
    const { data } = supabase.storage.from("player-docs").getPublicUrl(filePath);

    // Update payment with receipt URL
    const { error: updateError } = await supabase
      .from("payments")
      .update({ receipt_url: data.publicUrl, status: "pending" })
      .eq("id", paymentId);

    if (updateError) {
      toast.error("Error al guardar comprobante");
      setUploadingId(null);
      return;
    }

    toast.success("Comprobante subido correctamente");
    setUploadingId(null);
    loadPayments();
  };

  const stats = {
    total: payments.length,
    pending: payments.filter((p) => p.status === "pending").length,
    paid: payments.filter((p) => p.status === "paid").length,
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = totalAmount - paidAmount;

  return (
    <div className="space-y-4">
      {/* Status Summary */}
      <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Estado General</div>
            <div className="text-2xl font-bold mt-1">
              {stats.paid === stats.total ? "✓ Al día" : `${stats.pending} pendientes`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Deuda pendiente</div>
            <div className="text-2xl font-bold text-orange-600">{pendingAmount.toFixed(2)}€</div>
          </div>
        </div>
      </Card>

      {/* Amount Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-bold">{totalAmount.toFixed(2)}€</div>
        </Card>
        <Card className="p-3 border-green-200">
          <div className="text-xs text-green-700">Pagado</div>
          <div className="text-lg font-bold text-green-600">{paidAmount.toFixed(2)}€</div>
        </Card>
        <Card className="p-3 border-orange-200">
          <div className="text-xs text-orange-700">Pendiente</div>
          <div className="text-lg font-bold text-orange-600">{pendingAmount.toFixed(2)}€</div>
        </Card>
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>Mis Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay pagos pendientes
            </p>
          ) : (
            payments.map((payment) => {
              const config = statusConfig[payment.status];
              const Icon = config.icon;

              return (
                <div key={payment.id} className={`p-3 rounded-lg border ${config.color}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{payment.period}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {payment.player_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{payment.amount}€</div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Upload Receipt Button */}
                  {payment.status === "pending" && !payment.receipt_url && (
                    <div className="mt-2">
                      <label className="flex items-center justify-center gap-2 px-3 py-2 rounded border border-dashed border-border hover:border-primary cursor-pointer transition">
                        <Upload className="h-4 w-4" />
                        <span className="text-xs">Subir comprobante</span>
                        <input
                          type="file"
                          hidden
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadReceipt(payment.id, file);
                          }}
                          disabled={uploadingId === payment.id}
                        />
                      </label>
                    </div>
                  )}

                  {/* View Receipt */}
                  {payment.receipt_url && (
                    <div className="mt-2">
                      <a
                        href={payment.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-background hover:bg-muted transition text-xs"
                      >
                        <Eye className="h-4 w-4" />
                        Ver comprobante
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
