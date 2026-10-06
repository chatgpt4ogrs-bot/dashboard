/**
 * Cria (ou redefine a senha de) um super usuário.
 * Uso: npm run user:create -- <email> <senha>
 */
import { upsertUser } from '../auth.ts';
import { loadConfig } from '../config.ts';
import { closeDatabase, connectDatabase, describeDatabaseError } from '../database.ts';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Uso: npm run user:create -- <email> <senha>');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('E-mail inválido.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('A senha precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}

const config = await loadConfig();
if (!config) {
  console.error('O sistema ainda não foi configurado. Faça a configuração inicial pelo navegador.');
  process.exit(1);
}

try {
  await connectDatabase(config.database);
  const { user, created } = await upsertUser({ email, password, role: 'super_admin' });
  console.log(created ? `Super usuário ${user.email} criado.` : `Senha de ${user.email} redefinida.`);
} catch (error) {
  console.error(`Falha: ${describeDatabaseError(error)}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
