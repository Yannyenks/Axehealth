import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Bell, AlertTriangle, DollarSign, Clock, FileWarning, Users, Check, TrendingDown } from "lucide-react";
import { MOCK_ALERTS } from "@/lib/mockData";
import { useNavigate } from "react-router-dom";

const typeIcons = {
  detention: AlertTriangle,
  paiement: DollarSign,
  blocage: Clock,
  document: FileWarning,
  charge: Users,
  di_seuil: TrendingDown,
};

const NotificationPanel = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = MOCK_ALERTS.filter(a => !a.lu).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="bg-card w-[400px]">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center justify-between">
            Notifications
            <span className="text-xs font-normal text-muted-foreground">{unread} non lues</span>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
          {MOCK_ALERTS.map(alert => {
            const Icon = typeIcons[alert.type];
            return (
              <div
                key={alert.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  alert.lu ? "bg-muted/30" : "bg-muted/70 border-l-2 border-l-secondary"
                }`}
                onClick={() => {
                  if (alert.dossierId) {
                    navigate(`/dossiers/${alert.dossierId}`);
                    setOpen(false);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.severity === "critical" ? "bg-destructive/10 text-destructive" :
                    alert.severity === "warning" ? "bg-warning/10 text-warning" :
                    "bg-secondary/10 text-secondary"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{alert.date}</span>
                      {alert.lu && <Check className="w-3 h-3 text-success" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationPanel;
