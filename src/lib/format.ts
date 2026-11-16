/** Moeda em reais. Aceita vazio/null (vira R$ 0,00). */
export const formatBRL = (valor?: number | null): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

/**
 * Link do WhatsApp para um telefone brasileiro (com ou sem máscara, com ou sem 55). Sem telefone,
 * abre o WhatsApp sem destinatário, para a pessoa escolher o contato.
 */
export function linkWhatsApp(telefone?: string | null, texto?: string): string {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  const fone = !digitos ? '' : digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;
  return `https://wa.me/${fone}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

/** `AAAA-MM-DD…` → `DD/MM/AAAA`, só cortando o texto (nunca passa por Date, que recuaria um dia em BRT). */
export const formatData = (iso?: string | null): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
