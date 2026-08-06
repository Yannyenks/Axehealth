import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import type { AddNursingNoteInput } from "@/lib/validations/hospitalisation";

export async function getBedMap(organizationId: string) {
  const rooms = await prisma.room.findMany({
    where: { organizationId },
    include: {
      department: { select: { name: true } },
      beds: {
        include: {
          hospitalizations: {
            where: { status: "EN_COURS" },
            include: { patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } } },
            take: 1,
          },
        },
      },
    },
    orderBy: { numero: "asc" },
  });

  return rooms.map((room) => ({
    ...room,
    beds: room.beds.map((bed) => ({
      ...bed,
      patientActuel: bed.hospitalizations[0]?.patient ?? null,
      hospitalizationId: bed.hospitalizations[0]?.id ?? null,
      hospitalizations: undefined,
    })),
  }));
}

export async function admitPatient(params: { organizationId: string; patientId: string; bedId: string; motifEntree?: string }) {
  const bed = await prisma.bed.findFirst({ where: { id: params.bedId, organizationId: params.organizationId } });
  if (!bed) throw new NotFoundError("Lit introuvable");
  if (bed.status !== "LIBRE") throw new ConflictError("Ce lit n'est pas disponible");

  const patient = await prisma.patient.findFirst({ where: { id: params.patientId, organizationId: params.organizationId } });
  if (!patient) throw new NotFoundError("Patient introuvable");

  return prisma.$transaction(async (tx) => {
    const hospitalization = await tx.hospitalization.create({
      data: {
        organizationId: params.organizationId,
        patientId: params.patientId,
        bedId: params.bedId,
        motifEntree: params.motifEntree,
      },
    });

    await tx.bed.update({ where: { id: params.bedId }, data: { status: "OCCUPE" } });

    return hospitalization;
  });
}

async function loadActiveHospitalization(organizationId: string, id: string) {
  const hospitalization = await prisma.hospitalization.findFirst({ where: { id, organizationId } });
  if (!hospitalization) throw new NotFoundError("Hospitalisation introuvable");
  if (hospitalization.status !== "EN_COURS") throw new ConflictError("Cette hospitalisation est déjà clôturée");
  return hospitalization;
}

export async function dischargePatient(params: { organizationId: string; hospitalizationId: string; motifSortie?: string }) {
  const hospitalization = await loadActiveHospitalization(params.organizationId, params.hospitalizationId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.hospitalization.update({
      where: { id: hospitalization.id },
      data: { status: "SORTIE", motifSortie: params.motifSortie, dischargedAt: new Date() },
    });

    await tx.bed.update({ where: { id: hospitalization.bedId }, data: { status: "LIBRE" } });

    return updated;
  });
}

export async function transferBed(params: { organizationId: string; hospitalizationId: string; newBedId: string }) {
  const hospitalization = await loadActiveHospitalization(params.organizationId, params.hospitalizationId);

  const newBed = await prisma.bed.findFirst({ where: { id: params.newBedId, organizationId: params.organizationId } });
  if (!newBed) throw new NotFoundError("Lit de destination introuvable");
  if (newBed.status !== "LIBRE") throw new ConflictError("Le lit de destination n'est pas disponible");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.hospitalization.update({
      where: { id: hospitalization.id },
      data: { status: "TRANSFERE", bedId: params.newBedId },
    });

    await tx.hospitalization.create({
      data: {
        organizationId: params.organizationId,
        patientId: hospitalization.patientId,
        bedId: params.newBedId,
        motifEntree: `Transfert depuis lit ${hospitalization.bedId}`,
      },
    });

    await tx.bed.update({ where: { id: hospitalization.bedId }, data: { status: "LIBRE" } });
    await tx.bed.update({ where: { id: params.newBedId }, data: { status: "OCCUPE" } });

    return updated;
  });
}

export async function addNursingNote(params: { organizationId: string; hospitalizationId: string; authorId: string; input: AddNursingNoteInput }) {
  const hospitalization = await prisma.hospitalization.findFirst({ where: { id: params.hospitalizationId, organizationId: params.organizationId } });
  if (!hospitalization) throw new NotFoundError("Hospitalisation introuvable");

  return prisma.nursingNote.create({
    data: {
      hospitalizationId: params.hospitalizationId,
      authorId: params.authorId,
      periode: params.input.periode,
      note: params.input.note,
    },
  });
}
