"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface StockItem {
  id: string;
  code: string;
  nom: string;
  categorie: string;
  unite: string;
  prixVente: string;
  seuilReappro: number;
  quantiteDisponible: number;
}

const emptyItemForm = { code: "", nom: "", categorie: "MEDICAMENT", unite: "boîte", prixAchat: "0", prixVente: "0", seuilReappro: "10" };
const emptyLotForm = { stockItemId: "", numeroLot: "", quantite: "", datePeremption: "", site: "Dépôt principal" };
const emptyTransferForm = { stockItemId: "", siteSource: "", siteDestination: "", quantite: "" };

export default function PharmaciePage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showLotForm, setShowLotForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [lotForm, setLotForm] = useState(emptyLotForm);
  const [transferForm, setTransferForm] = useState(emptyTransferForm);

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacie", "stock"],
    queryFn: () => api.get<{ stockItems: StockItem[] }>("/api/pharmacie/stock"),
  });

  const { data: alertsData } = useQuery({
    queryKey: ["pharmacie", "alertes"],
    queryFn: () => api.get<{ peremption: { id: string; stockItem: { nom: string }; numeroLot: string; quantite: number; datePeremption: string }[]; reappro: StockItem[] }>(
      "/api/pharmacie/alertes",
    ),
  });

  function reportError(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Une erreur est survenue");
  }

  const createItem = useMutation({
    mutationFn: () =>
      api.post("/api/pharmacie/stock", {
        ...itemForm,
        prixAchat: Number(itemForm.prixAchat),
        prixVente: Number(itemForm.prixVente),
        seuilReappro: Number(itemForm.seuilReappro),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacie"] });
      setItemForm(emptyItemForm);
      setShowItemForm(false);
      setError(null);
    },
    onError: reportError,
  });

  const receiveLot = useMutation({
    mutationFn: () =>
      api.post(`/api/pharmacie/stock/${lotForm.stockItemId}/lots`, {
        numeroLot: lotForm.numeroLot,
        quantite: Number(lotForm.quantite),
        datePeremption: lotForm.datePeremption,
        site: lotForm.site,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacie"] });
      setLotForm(emptyLotForm);
      setShowLotForm(false);
      setError(null);
    },
    onError: reportError,
  });

  const transferStock = useMutation({
    mutationFn: () =>
      api.post("/api/pharmacie/transferts", {
        stockItemId: transferForm.stockItemId,
        siteSource: transferForm.siteSource,
        siteDestination: transferForm.siteDestination,
        quantite: Number(transferForm.quantite),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacie"] });
      setTransferForm(emptyTransferForm);
      setShowTransferForm(false);
      setError(null);
    },
    onError: reportError,
  });

  const alertCount = (alertsData?.peremption.length ?? 0) + (alertsData?.reappro.length ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Pharmacie & stocks</h1>
          <p className="text-sm text-muted-foreground">Catalogue, réception de lots, sorties en FEFO</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTransferForm((v) => !v)}>Transférer entre sites</Button>
          <Button variant="outline" onClick={() => setShowLotForm((v) => !v)}>Réceptionner un lot</Button>
          <Button onClick={() => setShowItemForm((v) => !v)}>Nouvel article</Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {alertCount > 0 && (
        <Card className="border-warning">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Alertes stock</CardTitle>
            <Badge variant="warning">{alertCount}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertsData?.peremption.map((lot) => (
              <p key={lot.id} className="text-sm">
                <span className="font-medium">{lot.stockItem.nom}</span> — lot {lot.numeroLot}, {lot.quantite} unités, péremption le{" "}
                {new Date(lot.datePeremption).toLocaleDateString("fr-FR")}
              </p>
            ))}
            {alertsData?.reappro.map((item) => (
              <p key={item.id} className="text-sm">
                <span className="font-medium">{item.nom}</span> — stock sous le seuil ({item.quantiteDisponible}/{item.seuilReappro})
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {showItemForm && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nom</Label>
              <Input value={itemForm.nom} onChange={(e) => setItemForm({ ...itemForm, nom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={itemForm.categorie} onChange={(e) => setItemForm({ ...itemForm, categorie: e.target.value })}>
                <option value="MEDICAMENT">Médicament</option>
                <option value="CONSOMMABLE">Consommable</option>
                <option value="DISPOSITIF_MEDICAL">Dispositif médical</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unité</Label>
              <Input value={itemForm.unite} onChange={(e) => setItemForm({ ...itemForm, unite: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Seuil réappro</Label>
              <Input type="number" min="0" value={itemForm.seuilReappro} onChange={(e) => setItemForm({ ...itemForm, seuilReappro: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Prix d'achat (FCFA)</Label>
              <Input type="number" min="0" value={itemForm.prixAchat} onChange={(e) => setItemForm({ ...itemForm, prixAchat: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Prix de vente (FCFA)</Label>
              <Input type="number" min="0" value={itemForm.prixVente} onChange={(e) => setItemForm({ ...itemForm, prixVente: e.target.value })} />
            </div>
            <div className="flex items-end sm:col-span-3">
              <Button disabled={!itemForm.code || !itemForm.nom || createItem.isPending} onClick={() => createItem.mutate()}>
                Créer l'article
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showLotForm && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Article</Label>
              <Select value={lotForm.stockItemId} onChange={(e) => setLotForm({ ...lotForm, stockItemId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {data?.stockItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.nom}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Numéro de lot</Label>
              <Input value={lotForm.numeroLot} onChange={(e) => setLotForm({ ...lotForm, numeroLot: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantité</Label>
              <Input type="number" min="1" value={lotForm.quantite} onChange={(e) => setLotForm({ ...lotForm, quantite: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de péremption</Label>
              <Input type="date" value={lotForm.datePeremption} onChange={(e) => setLotForm({ ...lotForm, datePeremption: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Site / dépôt</Label>
              <Input value={lotForm.site} onChange={(e) => setLotForm({ ...lotForm, site: e.target.value })} />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button
                disabled={!lotForm.stockItemId || !lotForm.numeroLot || !lotForm.quantite || !lotForm.datePeremption || receiveLot.isPending}
                onClick={() => receiveLot.mutate()}
              >
                Réceptionner
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showTransferForm && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Article</Label>
              <Select value={transferForm.stockItemId} onChange={(e) => setTransferForm({ ...transferForm, stockItemId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {data?.stockItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.nom}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Site source</Label>
              <Input value={transferForm.siteSource} onChange={(e) => setTransferForm({ ...transferForm, siteSource: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Site destination</Label>
              <Input value={transferForm.siteDestination} onChange={(e) => setTransferForm({ ...transferForm, siteDestination: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantité</Label>
              <Input type="number" min="1" value={transferForm.quantite} onChange={(e) => setTransferForm({ ...transferForm, quantite: e.target.value })} />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button
                disabled={!transferForm.stockItemId || !transferForm.siteSource || !transferForm.siteDestination || !transferForm.quantite || transferStock.isPending}
                onClick={() => transferStock.mutate()}
              >
                Transférer (FEFO)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>Seuil</TableHead>
                <TableHead>Prix de vente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.stockItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nom}</TableCell>
                  <TableCell>{item.categorie}</TableCell>
                  <TableCell>
                    {item.quantiteDisponible}
                    {item.quantiteDisponible <= item.seuilReappro && <Badge variant="warning" className="ml-2">Bas</Badge>}
                  </TableCell>
                  <TableCell>{item.seuilReappro}</TableCell>
                  <TableCell>{item.prixVente} FCFA</TableCell>
                </TableRow>
              ))}
              {data?.stockItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Aucun article</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
