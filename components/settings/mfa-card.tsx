"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Step = "idle" | "setup" | "backup-codes" | "disable";

export function MfaCard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; otpAuthUri: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  function reportError(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Une erreur est survenue");
  }

  const startSetup = useMutation({
    mutationFn: () => api.post<{ secret: string; otpAuthUri: string }>("/api/auth/mfa/setup"),
    onSuccess: (data) => {
      setSetupData(data);
      setStep("setup");
      setError(null);
    },
    onError: reportError,
  });

  const confirmSetup = useMutation({
    mutationFn: () => api.post<{ backupCodes: string[] }>("/api/auth/mfa/activer", { code: confirmCode }),
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setStep("backup-codes");
      setError(null);
    },
    onError: reportError,
  });

  const disableMfa = useMutation({
    mutationFn: () => api.post("/api/auth/mfa/desactiver", { totpCode: disableCode || undefined, password: disablePassword || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setStep("idle");
      setDisableCode("");
      setDisablePassword("");
      setError(null);
    },
    onError: reportError,
  });

  function finishActivation() {
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    setStep("idle");
    setSetupData(null);
    setConfirmCode("");
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Authentification à deux facteurs</CardTitle>
          <p className="text-xs text-muted-foreground">Code TOTP (Google Authenticator, Authy…) en complément du mot de passe</p>
        </div>
        <Badge variant={user?.totpEnabled ? "success" : "secondary"}>{user?.totpEnabled ? "Activée" : "Désactivée"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {step === "idle" && !user?.totpEnabled && (
          <Button disabled={startSetup.isPending} onClick={() => startSetup.mutate()}>
            Activer le MFA
          </Button>
        )}

        {step === "idle" && user?.totpEnabled && (
          <Button variant="secondary" onClick={() => setStep("disable")}>
            Désactiver le MFA
          </Button>
        )}

        {step === "disable" && (
          <div className="max-w-sm space-y-3">
            <p className="text-sm text-muted-foreground">Confirmez avec un code TOTP actuel ou votre mot de passe.</p>
            <div className="space-y-1.5">
              <Label>Code TOTP</Label>
              <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123456" />
            </div>
            <div className="space-y-1.5">
              <Label>ou mot de passe</Label>
              <Input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" disabled={(!disableCode && !disablePassword) || disableMfa.isPending} onClick={() => disableMfa.mutate()}>
                Confirmer la désactivation
              </Button>
              <Button variant="outline" onClick={() => setStep("idle")}>Annuler</Button>
            </div>
          </div>
        )}

        {step === "setup" && setupData && (
          <div className="max-w-md space-y-3">
            <p className="text-sm text-muted-foreground">
              Dans votre application d'authentification, ajoutez un compte manuellement avec cette clé secrète :
            </p>
            <code className="block rounded-md bg-muted p-3 text-sm font-mono break-all">{setupData.secret}</code>
            <p className="text-xs text-muted-foreground">
              Type : basé sur le temps (TOTP) · 6 chiffres · intervalle 30s
            </p>
            <div className="space-y-1.5">
              <Label>Code affiché par l'application, pour confirmer</Label>
              <Input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} placeholder="123456" className="max-w-40" />
            </div>
            <Button disabled={confirmCode.length !== 6 || confirmSetup.isPending} onClick={() => confirmSetup.mutate()}>
              Confirmer l'activation
            </Button>
          </div>
        )}

        {step === "backup-codes" && (
          <div className="max-w-md space-y-3">
            <p className="text-sm font-medium text-warning">
              Notez ces codes de secours maintenant — ils ne seront plus jamais affichés. Chacun ne fonctionne qu'une fois.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm">
              {backupCodes.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </div>
            <Button onClick={finishActivation}>J'ai noté mes codes de secours</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
