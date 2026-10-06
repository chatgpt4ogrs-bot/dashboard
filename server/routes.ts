import { Router, type Response } from 'express';
import type { AuthUser } from '../shared/auth.ts';
import type { EquipmentInput } from '../shared/condominium.ts';
import {
  createCondominium,
  createEquipment,
  deleteCondominium,
  deleteEquipment,
  getCondominium,
  getEquipment,
  listCondominiumSummaries,
  listEquipmentsByCondominium,
  toPublicEquipment,
  updateCondominium,
  updateEquipment,
  type EquipmentRecord,
} from './db.ts';
import { checkStatus, reboot } from './devices/index.ts';
import { addEvents, listEvents, toActor } from './events.ts';
import { getDashboardSummary, getEquipmentDetails, recordCheck, recordReboot, runCycle } from './monitor.ts';
import { parseCondominiumInput, parseEquipmentInput } from './validation.ts';

export const apiRouter = Router();

function notFound(res: Response, entity: string) {
  return res.status(404).json({ error: `${entity} não encontrado.` });
}

const actor = (res: Response) => toActor(res.locals.user as AuthUser | undefined);

const FIELD_LABELS: Record<keyof Omit<EquipmentInput, 'password'>, string> = {
  name: 'Nome',
  brand: 'Fabricante',
  type: 'Tipo',
  host: 'IP/URL',
  port: 'Porta',
  useHttps: 'HTTPS',
  username: 'Usuário',
  notes: 'Observações',
  model: 'Modelo',
  firmware: 'Firmware',
  serial: 'Serial',
  mac: 'MAC',
  installedAt: 'Data de instalação',
  lastMaintenanceAt: 'Última manutenção',
  responsible: 'Responsável',
  managementSync: 'Sincronização de gestão',
};

function changedEquipmentFields(before: EquipmentRecord, after: EquipmentRecord): string[] {
  const changed = (Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[])
    .filter((key) => (before[key] ?? '') !== (after[key] ?? ''))
    .map((key) => FIELD_LABELS[key]);
  if (before.password !== after.password) changed.push('Senha');
  return changed;
}

/* ---------- Condomínios ---------- */

apiRouter.get('/condominiums', async (_req, res) => {
  res.json(await listCondominiumSummaries());
});

apiRouter.get('/condominiums/:id', async (req, res) => {
  const condominium = await getCondominium(req.params.id);
  if (!condominium) return notFound(res, 'Condomínio');
  res.json(condominium);
});

apiRouter.post('/condominiums', async (req, res) => {
  const condominium = await createCondominium(parseCondominiumInput(req.body));
  res.status(201).json(condominium);
});

apiRouter.put('/condominiums/:id', async (req, res) => {
  const updated = await updateCondominium(req.params.id, parseCondominiumInput(req.body));
  if (!updated) return notFound(res, 'Condomínio');
  res.json(updated);
});

apiRouter.delete('/condominiums/:id', async (req, res) => {
  const removed = await deleteCondominium(req.params.id);
  if (!removed) return notFound(res, 'Condomínio');
  await addEvents(
    removed.equipments.map((e) => ({
      equipmentId: e.id,
      type: 'deleted' as const,
      actor: actor(res),
      detail: `${e.name} (condomínio ${removed.condominium.name} excluído)`,
    })),
  );
  res.status(204).end();
});

/* ---------- Equipamentos ---------- */

apiRouter.get('/condominiums/:id/equipments', async (req, res) => {
  const list = await listEquipmentsByCondominium(req.params.id);
  if (!list) return notFound(res, 'Condomínio');
  res.json(list.map(toPublicEquipment));
});

apiRouter.post('/condominiums/:id/equipments', async (req, res) => {
  const input = parseEquipmentInput(req.body, { requirePassword: false });
  const record = await createEquipment(req.params.id, input);
  if (!record) return notFound(res, 'Condomínio');
  await addEvents([{ equipmentId: record.id, type: 'created', actor: actor(res), detail: `${record.host}:${record.port}` }]);
  res.status(201).json(toPublicEquipment(record));
});

apiRouter.put('/equipments/:id', async (req, res) => {
  const { password, ...input } = parseEquipmentInput(req.body, { requirePassword: false });
  const result = await updateEquipment(req.params.id, input, password);
  if (!result) return notFound(res, 'Equipamento');
  const changed = changedEquipmentFields(result.before, result.after);
  if (changed.length) {
    await addEvents([{ equipmentId: result.after.id, type: 'updated', actor: actor(res), detail: changed.join(', ') }]);
  }
  res.json(toPublicEquipment(result.after));
});

apiRouter.delete('/equipments/:id', async (req, res) => {
  const removed = await deleteEquipment(req.params.id);
  if (!removed) return notFound(res, 'Equipamento');
  await addEvents([{ equipmentId: removed.id, type: 'deleted', actor: actor(res), detail: removed.name }]);
  res.status(204).end();
});

apiRouter.get('/equipments/:id/events', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const after = typeof req.query.after === 'string' ? req.query.after : undefined;
  res.json(await listEvents(req.params.id, { limit, after }));
});

apiRouter.get('/equipments/:id/details', async (req, res) => {
  const details = await getEquipmentDetails(req.params.id);
  if (!details) return notFound(res, 'Equipamento');
  res.json(details);
});

apiRouter.get('/equipments/:id/password', async (req, res) => {
  const equipment = await getEquipment(req.params.id);
  if (!equipment) return notFound(res, 'Equipamento');
  res.set('Cache-Control', 'no-store').json({ password: equipment.password });
});

/* ---------- Integração com os dispositivos ---------- */

apiRouter.post('/equipments/:id/status', async (req, res) => {
  const equipment = await getEquipment(req.params.id);
  if (!equipment) return notFound(res, 'Equipamento');
  const result = await checkStatus(equipment);
  await recordCheck(equipment.id, result, actor(res));
  res.json(result);
});

apiRouter.post('/equipments/:id/reboot', async (req, res) => {
  const equipment = await getEquipment(req.params.id);
  if (!equipment) return notFound(res, 'Equipamento');
  const result = await reboot(equipment);
  await recordReboot(equipment.id, result.ok, result.message, actor(res));
  res.json(result);
});

/* ---------- Dashboard ---------- */

apiRouter.get('/dashboard', async (_req, res) => {
  res.json(await getDashboardSummary());
});

apiRouter.post('/dashboard/refresh', async (_req, res) => {
  await runCycle();
  res.json(await getDashboardSummary());
});
