export function formatLastSeen(ts) {
  if (!ts) return 'Desconectado';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace unos segundos';
  if (mins === 1) return 'Hace 1 min';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? 'Hace 1 hora' : `Hace ${hrs} horas`;
}

export function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
