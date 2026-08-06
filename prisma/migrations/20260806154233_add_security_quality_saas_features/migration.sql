-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "antecedents" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PatientSatisfaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT,
    "score" INTEGER NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientSatisfaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientSatisfaction_organizationId_idx" ON "PatientSatisfaction"("organizationId");

-- CreateIndex
CREATE INDEX "PatientSatisfaction_organizationId_createdAt_idx" ON "PatientSatisfaction"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OrganizationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSatisfaction" ADD CONSTRAINT "PatientSatisfaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSatisfaction" ADD CONSTRAINT "PatientSatisfaction_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSatisfaction" ADD CONSTRAINT "PatientSatisfaction_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
