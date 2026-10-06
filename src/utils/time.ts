import { getLocale, getMessages } from '../i18n';

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return getMessages().time.lessThanMinute;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}

/** "Agora" para menos de 1 minuto; caso contrário, a duração decorrida (ex.: "18 min"). */
export function formatElapsed(since: string, now: string | number): string {
  const ms = (typeof now === 'number' ? now : Date.parse(now)) - Date.parse(since);
  return ms < 60_000 ? getMessages().time.now : formatDuration(ms);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short' });
}

/** "10:09:32" se for hoje; caso contrário, data e hora (ex.: "04/10/2026 10:09:32"). */
export function formatCheckTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(getLocale());
  return date.toDateString() === new Date().toDateString() ? time : `${date.toLocaleDateString(getLocale())} ${time}`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

/** Data "AAAA-MM-DD" (sem fuso) no formato do idioma (ex.: "DD/MM/AAAA"). */
export function formatPlainDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(getLocale(), { timeZone: 'UTC' });
}

/** Ex.: "12 dias 04h 31min", "3h 05min", "12min". */
export function formatUptime(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${getMessages().time.days(days)} ${pad(hours)}h ${pad(minutes)}min`;
  if (hours > 0) return `${hours}h ${pad(minutes)}min`;
  return `${minutes}min`;
}
