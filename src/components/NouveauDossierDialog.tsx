import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Ship, MapPin, User, Package, Calendar, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const NouveauDossierDialog = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client: "", compagnie: "", conteneur: "", marchandise: "",
    site: "Douala", dateArrivee: "", priorite: "moyenne", notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client || !form.compagnie || !form.conteneur || !form.marchandise) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    const numero = `DOS-2025-${String(Math.floor(Math.random() * 9000 + 1000)).padStart(4, "0")}`;
    toast({ title: "Dossier créé", description: `${numero} — ${form.client}` });
    setOpen(false);
    setForm({ client: "", compagnie: "", conteneur: "", marchandise: "", site: "Douala", dateArrivee: "", priorite: "moyenne", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground font-display font-semibold gap-2 hover:opacity-90">
          <Plus className="w-4 h-4" /> Nouveau dossier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Créer un nouveau dossier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> Client *
              </Label>
              <Input placeholder="Nom du client" value={form.client} onChange={e => setForm({...form, client: e.target.value})} className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-muted-foreground" /> Compagnie maritime *
              </Label>
              <Select value={form.compagnie} onValueChange={v => setForm({...form, compagnie: v})}>
                <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MSC">MSC</SelectItem>
                  <SelectItem value="COSCO">COSCO</SelectItem>
                  <SelectItem value="MAERSK">MAERSK</SelectItem>
                  <SelectItem value="CMA-CGM">CMA-CGM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" /> N° Conteneur *
              </Label>
              <Input placeholder="Ex: MSCU7654321" value={form.conteneur} onChange={e => setForm({...form, conteneur: e.target.value})} className="bg-muted/50 font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-muted-foreground" /> Type de marchandise *
              </Label>
              <Input placeholder="Ex: Matériaux de construction" value={form.marchandise} onChange={e => setForm({...form, marchandise: e.target.value})} className="bg-muted/50" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Site
              </Label>
              <Select value={form.site} onValueChange={v => setForm({...form, site: v})}>
                <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Douala">Douala</SelectItem>
                  <SelectItem value="Kribi">Kribi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Arrivée estimée
              </Label>
              <Input type="date" value={form.dateArrivee} onChange={e => setForm({...form, dateArrivee: e.target.value})} className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Priorité</Label>
              <Select value={form.priorite} onValueChange={v => setForm({...form, priorite: v})}>
                <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="moyenne">Moyenne</SelectItem>
                  <SelectItem value="basse">Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Notes (optionnel)</Label>
            <Textarea placeholder="Informations complémentaires..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="bg-muted/50 h-20" />
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">Responsable assigné : <span className="font-medium text-foreground">Mme YASMINE</span></p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">Créer le dossier</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NouveauDossierDialog;
