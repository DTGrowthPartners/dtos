import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authMiddleware } from '../middlewares/auth.middleware';

/** Documentaciones: wiki interna — proyectos con sus documentos (fichas técnicas, guías, APIs). */
const router = Router();
const prisma = new PrismaClient();

// Imágenes adjuntas a documentos. Viven fuera de dist para sobrevivir los builds.
const UPLOADS_DIR = path.join(__dirname, '../../uploads/docs');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// GET público ANTES del auth: las etiquetas <img> no mandan Authorization.
// El nombre es aleatorio (12 bytes hex) → no adivinable.
router.get('/files/:name', (req, res) => {
  const name = req.params.name;
  if (!/^[a-f0-9]{24}\.(png|jpe?g|gif|webp)$/i.test(name)) return res.status(400).json({ message: 'Nombre inválido' });
  const file = path.join(UPLOADS_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).json({ message: 'No existe' });
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(file);
});

router.use(authMiddleware);

// POST /api/docs/upload — sube una imagen y devuelve su URL para el markdown
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
router.post('/upload', upload.single('file'), (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ message: 'Archivo requerido (campo "file")' });
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' } as Record<string, string>)[f.mimetype];
  if (!ext) return res.status(400).json({ message: 'Solo imágenes png, jpg, gif o webp' });
  const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), f.buffer);
  res.json({ url: `/api/docs/files/${name}`, name });
});

// GET /api/docs/projects — proyectos con resumen de sus documentos (sin contenido)
router.get('/projects', async (_req, res) => {
  const projects = await prisma.docProject.findMany({
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    include: {
      docs: {
        orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, titulo: true, tipo: true, updatedAt: true },
      },
    },
  });
  res.json(projects);
});

// POST /api/docs/projects
router.post('/projects', async (req, res) => {
  try {
    const { nombre, descripcion, color } = req.body || {};
    if (!nombre?.trim()) return res.status(400).json({ message: 'El nombre es obligatorio' });
    const project = await prisma.docProject.create({
      data: {
        nombre: String(nombre).trim(),
        descripcion: descripcion?.trim() || null,
        color: typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#7c3aed',
        createdBy: req.user!.userId,
      },
    });
    res.status(201).json(project);
  } catch (e: any) { res.status(400).json({ message: e?.message }); }
});

// PUT /api/docs/projects/:id
router.put('/projects/:id', async (req, res) => {
  try {
    const { nombre, descripcion, color, orden } = req.body || {};
    const project = await prisma.docProject.update({
      where: { id: req.params.id },
      data: {
        nombre: nombre?.trim() || undefined,
        descripcion: descripcion !== undefined ? (descripcion?.trim() || null) : undefined,
        color: typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined,
        orden: typeof orden === 'number' ? orden : undefined,
      },
    });
    res.json(project);
  } catch (e: any) { res.status(400).json({ message: e?.message }); }
});

// DELETE /api/docs/projects/:id — borra el proyecto y sus documentos (cascade)
router.delete('/projects/:id', async (req, res) => {
  try {
    await prisma.docProject.delete({ where: { id: req.params.id } });
    res.json({ message: 'Proyecto eliminado' });
  } catch (e: any) { res.status(400).json({ message: e?.message }); }
});

// GET /api/docs/entries/:id — documento completo (con contenido)
router.get('/entries/:id', async (req, res) => {
  const doc = await prisma.docEntry.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });
  res.json(doc);
});

// POST /api/docs/projects/:id/entries
router.post('/projects/:id/entries', async (req, res) => {
  try {
    const { titulo, tipo, contenido } = req.body || {};
    if (!titulo?.trim()) return res.status(400).json({ message: 'El título es obligatorio' });
    const doc = await prisma.docEntry.create({
      data: {
        projectId: req.params.id,
        titulo: String(titulo).trim(),
        tipo: ['ficha-tecnica', 'guia', 'api', 'proceso', 'doc'].includes(tipo) ? tipo : 'doc',
        contenido: typeof contenido === 'string' ? contenido : '',
        updatedBy: req.user!.userId,
      },
    });
    res.status(201).json(doc);
  } catch (e: any) { res.status(400).json({ message: e?.message }); }
});

// PUT /api/docs/entries/:id
router.put('/entries/:id', async (req, res) => {
  try {
    const { titulo, tipo, contenido, orden } = req.body || {};
    const doc = await prisma.docEntry.update({
      where: { id: req.params.id },
      data: {
        titulo: titulo?.trim() || undefined,
        tipo: ['ficha-tecnica', 'guia', 'api', 'proceso', 'doc'].includes(tipo) ? tipo : undefined,
        contenido: typeof contenido === 'string' ? contenido : undefined,
        orden: typeof orden === 'number' ? orden : undefined,
        updatedBy: req.user!.userId,
      },
    });
    res.json(doc);
  } catch (e: any) { res.status(400).json({ message: e?.message }); }
});

// DELETE /api/docs/entries/:id
router.delete('/entries/:id', async (req, res) => {
  try {
    await prisma.docEntry.delete({ where: { id: req.params.id } });
    res.json({ message: 'Documento eliminado' });
  } catch (e: any) { res.status(400).json({ message: e?.message }); }
});

export default router;
