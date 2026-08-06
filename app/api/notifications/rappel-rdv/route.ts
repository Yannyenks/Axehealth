import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError, NotFoundError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp";
import { sendSms } from "@/lib/integrations/sms";

const schema = z.object({ appointmentId: z.string().cuid() });

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.notifications.send);

    const { appointmentId } = schema.parse(await req.json());

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId: session.organizationId },
      include: { patient: true, practitioner: { select: { firstName: true, lastName: true } } },
    });
    if (!appointment) throw new NotFoundError("Rendez-vous introuvable");
    if (!appointment.patient.phone) throw new NotFoundError("Le patient n'a pas de numéro de téléphone renseigné");

    const message = `Rappel: vous avez un rendez-vous le ${appointment.scheduledAt.toLocaleString("fr-FR")} avec Dr ${appointment.practitioner.lastName}.`;

    const whatsapp = await sendWhatsAppMessage(appointment.patient.phone, message);
    const sms = whatsapp.sent ? { sent: false } : await sendSms(appointment.patient.phone, message);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "APPOINTMENT_REMINDER_SENT",
      entityType: "Appointment",
      entityId: appointment.id,
      metadata: { viaWhatsApp: whatsapp.sent, viaSms: sms.sent },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ viaWhatsApp: whatsapp.sent, viaSms: sms.sent });
  } catch (error) {
    return handleApiError(error);
  }
}
