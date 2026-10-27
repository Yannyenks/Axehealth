import { StaffLogin } from "@/components/auth/staff-login";

// Connexion générique (compatibilité). L'accès recommandé passe par l'espace de la clinique : /c/<slug>.
export default function LoginPage() {
  return <StaffLogin />;
}
