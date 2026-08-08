-- CreateEnum
CREATE TYPE "CreditNoteReason" AS ENUM ('ERREUR_FACTURATION', 'RETOUR_PRODUIT', 'GESTE_COMMERCIAL', 'AUTRE');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('CHUTE', 'ESCARRE', 'ERREUR_MEDICAMENTEUSE', 'INFECTION_NOSOCOMIALE', 'AUTRE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MINEUR', 'MODERE', 'MAJEUR', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CONGE_PAYE', 'CONGE_MALADIE', 'CONGE_MATERNITE', 'CONGE_SANS_SOLDE', 'AUTRE');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE', 'ANNULE');

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "montant" DECIMAL(14,2) NOT NULL,
    "motif" "CreditNoteReason" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hospitalizationId" TEXT,
    "type" "IncidentType" NOT NULL,
    "severite" "IncidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "actionsCorrectives" TEXT,
    "declaredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditNote_organizationId_idx" ON "CreditNote"("organizationId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "Incident_organizationId_idx" ON "Incident"("organizationId");

-- CreateIndex
CREATE INDEX "Incident_organizationId_type_idx" ON "Incident"("organizationId", "type");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_idx" ON "LeaveRequest"("organizationId");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_hospitalizationId_fkey" FOREIGN KEY ("hospitalizationId") REFERENCES "Hospitalization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
