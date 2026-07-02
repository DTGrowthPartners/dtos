import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/config/:key
router.get('/:key', authMiddleware, async (req, res) => {
  try {
    const record = await prisma.appConfig.findUnique({ where: { key: req.params.key } });
    res.json({ value: record ? JSON.parse(record.value) : null });
  } catch (e) {
    res.status(500).json({ error: 'Error leyendo configuración' });
  }
});

// PUT /api/config/:key
router.put('/:key', authMiddleware, async (req, res) => {
  try {
    const record = await prisma.appConfig.upsert({
      where: { key: req.params.key },
      update: { value: JSON.stringify(req.body.value) },
      create: { key: req.params.key, value: JSON.stringify(req.body.value) },
    });
    res.json({ value: JSON.parse(record.value) });
  } catch (e) {
    res.status(500).json({ error: 'Error guardando configuración' });
  }
});

export default router;
