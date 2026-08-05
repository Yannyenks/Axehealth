import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Dossiers from "./pages/Dossiers";
import DossierDetail from "./pages/DossierDetail";
import Employes from "./pages/Employes";
import EmployeDetail from "./pages/EmployeDetail";
import Alertes from "./pages/Alertes";
import Finance from "./pages/Finance";
import Kribi from "./pages/Kribi";
import Exploitation from "./pages/Exploitation";
import Parametres from "./pages/Parametres";
import Messagerie from "./pages/Messagerie";
import Reporting from "./pages/Reporting";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/exploitation" element={<Exploitation />} />
          <Route path="/dossiers" element={<Dossiers />} />
          <Route path="/dossiers/:id" element={<DossierDetail />} />
          <Route path="/employes" element={<Employes />} />
          <Route path="/employes/:name" element={<EmployeDetail />} />
          <Route path="/alertes" element={<Alertes />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/kribi" element={<Kribi />} />
          <Route path="/messagerie" element={<Messagerie />} />
          <Route path="/reporting" element={<Reporting />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
