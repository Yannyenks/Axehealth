-- CreateEnum
CREATE TYPE "TriageSeverity" AS ENUM ('ROUGE', 'ORANGE', 'VERT');

-- CreateEnum
CREATE TYPE "PreConsultationStatus" AS ENUM ('EN_COURS', 'EN_ATTENTE_REVUE', 'REVUE', 'CONVERTIE', 'ABANDONNEE');

-- CreateEnum
CREATE TYPE "PreConsultationSpeaker" AS ENUM ('PATIENT', 'IA');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "refreshToken" TEXT;

-- CreateTable
CREATE TABLE "PreConsultationSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "PreConsultationStatus" NOT NULL DEFAULT 'EN_COURS',
    "severity" "TriageSeverity",
    "motifPatient" TEXT,
    "summary" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "consultationId" TEXT,
    "appointmentId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreConsultationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreConsultationMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "PreConsultationSpeaker" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreConsultationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreConsultationSession_consultationId_key" ON "PreConsultationSession"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "PreConsultationSession_appointmentId_key" ON "PreConsultationSession"("appointmentId");

-- CreateIndex
CREATE INDEX "PreConsultationSession_organizationId_idx" ON "PreConsultationSession"("organizationId");

-- CreateIndex
CREATE INDEX "PreConsultationSession_organizationId_status_idx" ON "PreConsultationSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PreConsultationSession_organizationId_severity_status_idx" ON "PreConsultationSession"("organizationId", "severity", "status");

-- CreateIndex
CREATE INDEX "PreConsultationSession_patientId_idx" ON "PreConsultationSession"("patientId");

-- CreateIndex
CREATE INDEX "PreConsultationMessage_sessionId_idx" ON "PreConsultationMessage"("sessionId");

-- CreateIndex
CREATE INDEX "PreConsultationMessage_sessionId_createdAt_idx" ON "PreConsultationMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_organizationId_email_key" ON "Patient"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "PreConsultationSession" ADD CONSTRAINT "PreConsultationSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreConsultationSession" ADD CONSTRAINT "PreConsultationSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreConsultationSession" ADD CONSTRAINT "PreConsultationSession_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreConsultationSession" ADD CONSTRAINT "PreConsultationSession_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreConsultationSession" ADD CONSTRAINT "PreConsultationSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreConsultationMessage" ADD CONSTRAINT "PreConsultationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PreConsultationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

