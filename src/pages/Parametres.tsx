import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { MOCK_ALERT_CONFIG } from "@/lib/mockData";
import { Settings, Bell, Shield, Database, Globe, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const Parametres = () => {
  const [alerts, setAlerts] = useState(MOCK_ALERT_CONFIG);

  const handleSave = () => {
    toast({ title: "Paramètres sauvegardés", description: "Les modifications ont été appliquées." });
  };

  return (
    <AppLayout title="Paramètres" subtitle="Configuration de la plateforme">
      <Tabs defaultValue="alertes" className="max-w-3xl">
        <TabsList className="mb-6">
          <TabsTrigger value="alertes" className="gap-1.5"><Bell className="w-3.5 h-3.5" /> Alertes</TabsTrigger>
          <TabsTrigger value="securite" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> Sécurité</TabsTrigger>
          <TabsTrigger value="general" className="gap-1.5"><Globe className="w-3.5 h-3.5" /> Général</TabsTrigger>
        </TabsList>

        <TabsContent value="alertes">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
            <h3 className="font-display font-semibold text-foreground mb-1">Seuils d'alertes automatiques</h3>
            <p className="text-sm text-muted-foreground mb-6">Configurez les déclencheurs de chaque type d'alerte</p>
            <div className="space-y-4">
              {alerts.map((cfg, i) => (
                <div key={cfg.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <Switch
                    checked={cfg.actif}
                    onCheckedChange={v => {
                      const next = [...alerts];
                      next[i] = { ...cfg, actif: v };
                      setAlerts(next);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">{cfg.unite}</p>
                  </div>
                  <Input
                    type="number"
                    value={cfg.seuil}
                    onChange={e => {
                      const next = [...alerts];
                      next[i] = { ...cfg, seuil: Number(e.target.value) };
                      setAlerts(next);
                    }}
                    className="w-20 text-center bg-card"
                    disabled={!cfg.actif}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={handleSave} className="gap-2 bg-primary text-primary-foreground">
                <Save className="w-4 h-4" /> Enregistrer
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="securite">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stat-card space-y-4">
            <h3 className="font-display font-semibold text-foreground mb-1">Politique de sécurité</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Double authentification (2FA)</p>
                  <p className="text-xs text-muted-foreground">Ajouter une couche de sécurité supplémentaire</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Expiration mot de passe</p>
                  <p className="text-xs text-muted-foreground">Forcer le changement tous les 90 jours</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Journal d'audit</p>
                  <p className="text-xs text-muted-foreground">Enregistrer toutes les actions utilisateurs</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Sauvegarde automatique</p>
                  <p className="text-xs text-muted-foreground">Sauvegarde quotidienne des données</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="general">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stat-card space-y-4">
            <h3 className="font-display font-semibold text-foreground mb-1">Paramètres généraux</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-foreground mb-2">Nom de l'entreprise</p>
                <Input defaultValue="FINITRANS — Transit & Dédouanement" className="bg-card" />
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-foreground mb-2">Devise par défaut</p>
                <Input defaultValue="FCFA" className="bg-card w-32" />
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-foreground mb-2">Fuseau horaire</p>
                <Input defaultValue="Africa/Douala (UTC+1)" className="bg-card" disabled />
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-foreground mb-2">Format numéro dossier</p>
                <Input defaultValue="DOS-{ANNEE}-{SEQUENCE}" className="bg-card font-mono text-sm" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} className="gap-2 bg-primary text-primary-foreground">
                <Save className="w-4 h-4" /> Enregistrer
              </Button>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Parametres;
