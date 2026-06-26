import { Request, Response } from 'express';
import { fixedAssetService } from '../services/fixedAsset.service';

export const getSummary = async (_req: Request, res: Response) => {
  try {
    res.json(await fixedAssetService.summary());
  } catch (error: any) {
    console.error('Error getting fixed assets summary:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAssets = async (req: Request, res: Response) => {
  try {
    const { status, category } = req.query;
    const assets = await fixedAssetService.getAll({
      status: status as string | undefined,
      category: category as string | undefined,
    });
    res.json(assets);
  } catch (error: any) {
    console.error('Error getting fixed assets:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAssetById = async (req: Request, res: Response) => {
  try {
    const asset = await fixedAssetService.getById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json(asset);
  } catch (error: any) {
    console.error('Error getting fixed asset:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createAsset = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const data = req.body;
    if (!data.name || !data.category || !data.cost || !data.acquisitionDate) {
      return res.status(400).json({ error: 'Campos requeridos: name, category, cost, acquisitionDate' });
    }
    const asset = await fixedAssetService.create({
      ...data,
      cost: Number(data.cost),
      quantity: data.quantity !== undefined ? Number(data.quantity) : undefined,
      acquisitionDate: new Date(data.acquisitionDate),
      createdBy: userId,
    });
    res.status(201).json(asset);
  } catch (error: any) {
    console.error('Error creating fixed asset:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAsset = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const asset = await fixedAssetService.update(req.params.id, {
      ...data,
      cost: data.cost !== undefined ? Number(data.cost) : undefined,
      quantity: data.quantity !== undefined ? Number(data.quantity) : undefined,
      acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : undefined,
      disposalDate: data.disposalDate ? new Date(data.disposalDate) : undefined,
    });
    res.json(asset);
  } catch (error: any) {
    console.error('Error updating fixed asset:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteAsset = async (req: Request, res: Response) => {
  try {
    await fixedAssetService.remove(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting fixed asset:', error);
    res.status(500).json({ error: error.message });
  }
};
