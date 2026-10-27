import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StaffLogin } from "@/components/auth/staff-login";

// Espace de connexion d'une clinique : le compte doit appartenir à cet établissement.
export default async function ClinicLoginPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug }, select: { name: true, isActive: true } });
  if (!org || !org.isActive) notFound();

  return <StaffLogin organizationSlug={params.orgSlug} clinicName={org.name} />;
}
