import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { DocumentService } from '../services/document.service'
import { authenticate } from '../middleware/authenticate'
import { ValidationError } from '../utils/errors'
import { prisma } from '../config/database'

const docService = new DocumentService()

export const documentRoutes: FastifyPluginAsync = async (fastify) => {
  // Upload document for a dossier step
  fastify.post('/upload', { preHandler: [authenticate] }, async (request, reply) => {
    const parts = request.parts()
    let fileBuffer: Buffer | null = null
    let filename = ''
    let mimetype = ''
    const fields: Record<string, string> = {}

    for await (const part of parts) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer()
        filename = part.filename
        mimetype = part.mimetype
      } else {
        fields[part.fieldname] = part.value as string
      }
    }

    if (!fileBuffer) throw new ValidationError('Aucun fichier fourni')
    if (!fields.dossierId) throw new ValidationError('dossierId requis')
    if (!fields.type) throw new ValidationError('type de document requis')

    docService.validateFile(mimetype, fileBuffer.byteLength)
    const { url } = await docService.saveFile(fileBuffer, filename, mimetype)

    const doc = await docService.create({
      dossierId: fields.dossierId,
      uploadeParId: request.currentUser.id,
      nom: fields.nom || filename,
      type: fields.type as any,
      mimetype,
      taille: fileBuffer.byteLength,
      url,
      etape: fields.etape as any,
      workflowStepId: fields.workflowStepId,
      description: fields.description,
    })

    return reply.status(201).send({ success: true, data: doc })
  })

  fastify.get('/dossier/:dossierId', { preHandler: [authenticate] }, async (request, reply) => {
    const { dossierId } = request.params as { dossierId: string }
    const docs = await docService.findByDossier(dossierId)
    return reply.send({ success: true, data: docs })
  })

  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await docService.delete(id, request.currentUser.id)
    return reply.send({ success: true, message: 'Document supprimé' })
  })
}
