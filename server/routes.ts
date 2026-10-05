import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type { CondominiumSummary } from '../shared/condominium.ts';
import { readDb, toPublicEquipment, updateDb, type EquipmentRecord } from './db.ts';
import { checkStatus, reboot } from './devices/index.ts';
import { parseCondominiumInput, parseEquipmentInput } from './validation.ts';

export const apiRouter = Router();

function notFound(res: Response, entity: string) {
  return res.status(404).json({ error: `${entity} não encontrado.` });
}

async function findEquipment(id: string): Promise<EquipmentRecord | undefined> {
  return (await readDb()).equipments.find((e) => e.id === id);
}

/* ---------- Condomínios ---------- */

apiRouter.get('/condominiums', async (_req, res) => {
  const db = await readDb();
  const list: CondominiumSummary[] = db.condominiums
    .map((c) => ({ ...c, equipmentCount: db.equipments.filter((e) => e.condominiumId === c.id).length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  res.json(list);
});

apiRouter.get('/condominiums/:id', async (req, res) => {
  const condominium = (await readDb()).condominiums.find((c) => c.id === req.params.id);
  if (!condominium) return notFound(res, 'Condomínio');
  res.json(condominium);
});

apiRouter.post('/condominiums', async (req, res) => {
  const input = parseCondominiumInput(req.body);
  const now = new Date().toISOString();
  const condominium = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  await updateDb((db) => db.condominiums.push(condominium));
  res.status(201).json(condominium);
});

apiRouter.put('/condominiums/:id', async (req, res) => {
  const input = parseCondominiumInput(req.body);
  const updated = await updateDb((db) => {
    const condominium = db.condominiums.find((c) => c.id === req.params.id);
    if (!condominium) return null;
    Object.assign(condominium, input, { updatedAt: new Date().toISOString() });
    return condominium;
  });
  if (!updated) return notFound(res, 'Condomínio');
  res.json(updated);
});

apiRouter.delete('/condominiums/:id', async (req, res) => {
  const removed = await updateDb((db) => {
    const before = db.condominiums.length;
    db.condominiums = db.condominiums.filter((c) => c.id !== req.params.id);
    db.equipments = db.equipments.filter((e) => e.condominiumId !== req.params.id);
    return db.condominiums.length < before;
  });
  if (!removed) return notFound(res, 'Condomínio');
  res.status(204).end();
});

/* ---------- Equipamentos ---------- */

apiRouter.get('/condominiums/:id/equipments', async (req, res) => {
  const db = await readDb();
  if (!db.condominiums.some((c) => c.id === req.params.id)) return notFound(res, 'Condomínio');
  const list = db.equipments
    .filter((e) => e.condominiumId === req.params.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map(toPublicEquipment);
  res.json(list);
});

apiRouter.post('/condominiums/:id/equipments', async (req, res) => {
  const input = parseEquipmentInput(req.body, { requirePassword: false });
  const now = new Date().toISOString();
  const record: EquipmentRecord = {
    ...input,
    password: input.password ?? '',
    id: randomUUID(),
    condominiumId: req.params.id,
    createdAt: now,
    updatedAt: now,
  };
  const created = await updateDb((db) => {
    if (!db.condominiums.some((c) => c.id === req.params.id)) return false;
    db.equipments.push(record);
    return true;
  });
  if (!created) return notFound(res, 'Condomínio');
  res.status(201).json(toPublicEquipment(record));
});

apiRouter.put('/equipments/:id', async (req, res) => {
  const { password, ...input } = parseEquipmentInput(req.body, { requirePassword: false });
  const updated = await updateDb((db) => {
    const equipment = db.equipments.find((e) => e.id === req.params.id);
    if (!equipment) return null;
    Object.assign(equipment, input, password !== undefined && { password }, { updatedAt: new Date().toISOString() });
    return equipment;
  });
  if (!updated) return notFound(res, 'Equipamento');
  res.json(toPublicEquipment(updated));
});

apiRouter.delete('/equipments/:id', async (req, res) => {
  const removed = await updateDb((db) => {
    const before = db.equipments.length;
    db.equipments = db.equipments.filter((e) => e.id !== req.params.id);
    return db.equipments.length < before;
  });
  if (!removed) return notFound(res, 'Equipamento');
  res.status(204).end();
});

apiRouter.get('/equipments/:id/password', async (req, res) => {
  const equipment = await findEquipment(req.params.id);
  if (!equipment) return notFound(res, 'Equipamento');
  res.set('Cache-Control', 'no-store').json({ password: equipment.password });
});

/* ---------- Integração com os dispositivos ---------- */

apiRouter.post('/equipments/:id/status', async (req, res) => {
  const equipment = await findEquipment(req.params.id);
  if (!equipment) return notFound(res, 'Equipamento');
  res.json(await checkStatus(equipment));
});

apiRouter.post('/equipments/:id/reboot', async (req, res) => {
  const equipment = await findEquipment(req.params.id);
  if (!equipment) return notFound(res, 'Equipamento');
  res.json(await reboot(equipment));
});
