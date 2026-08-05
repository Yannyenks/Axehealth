import path from 'path'
import fs from 'fs/promises'
import { DocumentType, DossierStatus } from '@prisma/client'
import { prisma } from '../config/database'
import { NotFoundError, BusinessError } from '../utils/errors'
import { env } from '../config/env'

export class DocumentService {
  private uploadDir = path.resolve(env.UPLOAD_DIR)
  private maxSizeBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024
  private allowedMimeTypes = env.ALLOWED_MIME_TYPES.split(',')

  async ensureUploadDir() {
    await fs.mkdir(this.uploadDir, { recursive: true })
  }

  validateFile(mimetype: string, size: number) {
    if (!this.allowedMimeTypes.includes(mimetype)) {
      throw new BusinessError(`Type de fichier non autorisé: ${mimetype}. Types acceptés: PDF, JPEG, PNG, WebP`)
    }
    if (size > this.maxSizeBytes) {
      throw new BusinessError(`Fichier trop volumineux (max ${env.MAX_FILE_SIZE_MB} MB)`)
    }
  }

  async saveFile(buffer: Buffer, originalName: string, mimetype: string): Promise<{ url: string; filename: string }> {
    await this.ensureUploadDir()
    const ext = path.extname(originalName) || this.mimeToExt(mimetype)
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    const filepath = path.join(this.uploadDir, filename)
    await fs.writeFile(filepath, buffer)
    return { url: `/uploads/${filename}`, filename }
  }

  async create(data: {
    dossierId: string
    uploadeParId: string
    nom: string
    type: DocumentType
    mimetype: string
    taille: number
    url: string
    etape?: DossierStatus
    workflowStepId?: string
    description?: string
  }) {
    const dossier = await prisma.dossier.findUnique({ where: { id: data.dossierId } })
    if (!dossier) throw new NotFoundError('Dossier', data.dossierId)

    const doc = await prisma.document.create({
      data: {
        nom: data.nom,
        type: data.type,
        taille: data.taille,
        url: data.url,
        mimetype: data.mimetype,
        dossierId: data.dossierId,
        uploadeParId: data.uploadeParId,
        etape: data.etape,
        workflowStepId: data.workflowStepId,
        description: data.description,
      },
      include: { uploader: { select: { nom: true, prenom: true } } },
    })

    await prisma.auditLog.create({
      data: {
        dossierId: data.dossierId,
        userId: data.uploadeParId,
        action: 'DOCUMENT_UPLOADE',
        details: { nom: data.nom, type: data.type },
      },
    })

    return doc
  }

  async findByDossier(dossierId: string) {
    return prisma.document.findMany({
      where: { dossierId },
      include: { uploader: { select: { nom: true, prenom: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async delete(id: string, userId: string) {
    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) throw new NotFoundError('Document', id)

    // Remove physical file
    try {
      const filepath = path.join(this.uploadDir, path.basename(doc.url))
      await fs.unlink(filepath)
    } catch {
      // File may already be gone — continue
    }

    await prisma.document.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        dossierId: doc.dossierId,
        userId,
        action: 'DOCUMENT_SUPPRIME',
        details: { nom: doc.nom },
      },
    })
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    }
    return map[mime] || '.bin'
  }
}
