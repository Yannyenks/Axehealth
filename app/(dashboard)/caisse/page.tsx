"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Registre {
  id: string;
  name: string;
  sessionOuverte: { id: string } | null;
}

interface Payment {
  id: string;
  montant: string;
  mode: string;
  validatedAt: string | null;
  cashierId: string;
}

interface CashSession {
  id: string;
  cashRegister: { id: string; name: string };
  cashier: { id: string; firstName: string; lastName: string };
  payments: Payment[];
}

interface Invoice {
  id: string;
  numero: string;
  montantTotal: string;
  montantPartPatient: string;
  montantPaye: string;
  patient: { firstName: string; lastName: string; patientNumber: string };
}

const MOBILE_MONEY_MODES = ["MTN_MOMO", "ORANGE_MONEY", "WAVE"];

export default function CaissePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState({ cashRegisterId: "", montantOuverture: "0" });
  const [payForm, setPayForm] = useState({ cashSessionId: "", invoiceId: "", mode: "ESPECES", montant: "", phoneNumber: "" });
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [closeForm, setCloseForm] = useState({ cashSessionId: "", montantClotureReel: "", pin: "" });

  const registres = useQuery({ queryKey: ["caisse", "registres"], queryFn: () => api.get<{ registres: Registre[] }>("/api/caisse/registres") });
  const sessions = useQuery({
    queryKey: ["caisse", "sessions", "ouvertes"],
    queryFn: () => api.get<{ sessions: CashSession[] }>("/api/caisse/sessions?status=OUVERTE"),
  });
  const invoices = useQuery({
    queryKey: ["factures", "en-attente"],
    queryFn: () => api.get<{ invoices: Invoice[] }>("/api/factures?status=EN_ATTENTE_PAIEMENT"),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["caisse"] });
    queryClient.invalidateQueries({ queryKey: ["factures"] });
  };

  function reportError(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Une erreur est survenue");
  }

  const openSession = useMutation({
    mutationFn: () => api.post("/api/caisse/sessions", { cashRegisterId: openForm.cashRegisterId, montantOuverture: Number(openForm.montantOuverture) }),
    onSuccess: () => {
      invalidateAll();
      setOpenForm({ cashRegisterId: "", montantOuverture: "0" });
    },
    onError: reportError,
  });

  const registerPayment = useMutation({
    mutationFn: () => {
      const isMobileMoney = MOBILE_MONEY_MODES.includes(payForm.mode);
      const path = isMobileMoney ? "/api/caisse/paiements/mobile-money" : "/api/caisse/paiements";
      const body: Record<string, unknown> = {
        invoiceId: payForm.invoiceId,
        cashSessionId: payForm.cashSessionId,
        mode: payForm.mode,
        montant: Number(payForm.montant),
      };
      if (isMobileMoney) body.phoneNumber = payForm.phoneNumber;
      return api.post(path, body);
    },
    onSuccess: () => {
      invalidateAll();
      setPayForm({ cashSessionId: "", invoiceId: "", mode: "ESPECES", montant: "", phoneNumber: "" });
      setError(null);
    },
    onError: reportError,
  });

  const validatePayment = useMutation({
    mutationFn: ({ paymentId, pin }: { paymentId: string; pin: string }) => api.post(`/api/caisse/paiements/${paymentId}/valider`, { pin }),
    onSuccess: invalidateAll,
    onError: reportError,
  });

  const closeSession = useMutation({
    mutationFn: () =>
      api.post("/api/caisse/cloture", {
        cashSessionId: closeForm.cashSessionId,
        montantClotureReel: Number(closeForm.montantClotureReel),
        pin: closeForm.pin,
      }),
    onSuccess: () => {
      invalidateAll();
      setCloseForm({ cashSessionId: "", montantClotureReel: "", pin: "" });
    },
    onError: reportError,
  });

  const registresLibres = registres.data?.registres.filter((r) => !r.sessionOuverte) ?? [];
  const openSessions = sessions.data?.sessions ?? [];
  const allPayments = openSessions.flatMap((s) => s.payments.map((p) => ({ ...p, sessionLabel: s.cashRegister.name })));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Caisse</h1>
        <p className="text-sm text-muted-foreground">Encaissement, double validation aveugle, clôture</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {registresLibres.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ouvrir une session de caisse</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Caisse</Label>
              <Select value={openForm.cashRegisterId} onChange={(e) => setOpenForm({ ...openForm, cashRegisterId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {registresLibres.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fond de caisse (FCFA)</Label>
              <Input type="number" min="0" value={openForm.montantOuverture} onChange={(e) => setOpenForm({ ...openForm, montantOuverture: e.target.value })} />
            </div>
            <Button disabled={!openForm.cashRegisterId || openSession.isPending} onClick={() => openSession.mutate()}>
              Ouvrir
            </Button>
          </CardContent>
        </Card>
      )}

      {openSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encaisser un paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Session de caisse</Label>
                <Select value={payForm.cashSessionId} onChange={(e) => setPayForm({ ...payForm, cashSessionId: e.target.value })}>
                  <option value="">Sélectionner…</option>
                  {openSessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.cashRegister.name} — {s.cashier.firstName} {s.cashier.lastName}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Facture</Label>
                <Select
                  value={payForm.invoiceId}
                  onChange={(e) => {
                    const invoice = invoices.data?.invoices.find((i) => i.id === e.target.value);
                    const reste = invoice ? Number(invoice.montantPartPatient) - Number(invoice.montantPaye) : 0;
                    setPayForm({ ...payForm, invoiceId: e.target.value, montant: reste > 0 ? String(reste) : "" });
                  }}
                >
                  <option value="">Sélectionner…</option>
                  {invoices.data?.invoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.numero} — {i.patient.firstName} {i.patient.lastName} ({Number(i.montantPartPatient) - Number(i.montantPaye)} FCFA restant)
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mode de paiement</Label>
                <Select value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                  <option value="ESPECES">Espèces</option>
                  <option value="CARTE">Carte</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="MTN_MOMO">MTN Mobile Money</option>
                  <option value="ORANGE_MONEY">Orange Money</option>
                  <option value="WAVE">Wave</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Montant (FCFA)</Label>
                <Input type="number" min="0" value={payForm.montant} onChange={(e) => setPayForm({ ...payForm, montant: e.target.value })} />
              </div>
              {MOBILE_MONEY_MODES.includes(payForm.mode) && (
                <div className="space-y-1.5">
                  <Label>Numéro Mobile Money</Label>
                  <Input value={payForm.phoneNumber} onChange={(e) => setPayForm({ ...payForm, phoneNumber: e.target.value })} />
                </div>
              )}
            </div>
            <Button
              disabled={!payForm.cashSessionId || !payForm.invoiceId || !payForm.montant || registerPayment.isPending}
              onClick={() => registerPayment.mutate()}
            >
              {registerPayment.isPending ? "Encaissement…" : "Encaisser"}
            </Button>
          </CardContent>
        </Card>
      )}

      {allPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paiements en attente de validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allPayments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="text-sm">
                  <span className="font-medium">{p.montant} FCFA</span> · {p.mode} · {p.sessionLabel}
                  {p.validatedAt ? (
                    <Badge variant="success" className="ml-2">Validé</Badge>
                  ) : p.cashierId === user?.id ? (
                    <Badge variant="secondary" className="ml-2">En attente d'un second utilisateur</Badge>
                  ) : (
                    <Badge variant="warning" className="ml-2">À valider</Badge>
                  )}
                </div>
                {!p.validatedAt && p.cashierId !== user?.id && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="PIN"
                      className="h-9 w-24"
                      value={pinInputs[p.id] ?? ""}
                      onChange={(e) => setPinInputs({ ...pinInputs, [p.id]: e.target.value })}
                    />
                    <Button
                      size="sm"
                      disabled={!pinInputs[p.id] || validatePayment.isPending}
                      onClick={() => validatePayment.mutate({ paymentId: p.id, pin: pinInputs[p.id] })}
                    >
                      Valider
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {openSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clôturer une session</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Session</Label>
              <Select value={closeForm.cashSessionId} onChange={(e) => setCloseForm({ ...closeForm, cashSessionId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {openSessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.cashRegister.name} — {s.cashier.firstName} {s.cashier.lastName}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Montant réel compté (FCFA)</Label>
              <Input type="number" min="0" value={closeForm.montantClotureReel} onChange={(e) => setCloseForm({ ...closeForm, montantClotureReel: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>PIN</Label>
              <Input type="password" value={closeForm.pin} onChange={(e) => setCloseForm({ ...closeForm, pin: e.target.value })} />
            </div>
            <Button
              variant="secondary"
              disabled={!closeForm.cashSessionId || !closeForm.montantClotureReel || !closeForm.pin || closeSession.isPending}
              onClick={() => closeSession.mutate()}
            >
              Clôturer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
