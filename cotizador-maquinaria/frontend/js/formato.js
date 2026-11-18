// Formatos de dinero, cantidades y fechas. Los mismos en la pantalla y en el documento.

/** Pesos redondeados: tarjetas, chips y totales de pantalla. */
export const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

/** Pesos con centavos: el documento, donde la suma tiene que cuadrar. */
export const money2 = (n) =>
  `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Precio en pantalla: entero como `money`, con centavos solo si los tiene ($10.50 el litro no es «$11»). */
export const precioEnPantalla = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return Number.isInteger(v) ? money(v) : money2(v);
};

/**
 * Cantidad de un renglón. Toneladas y m³ con dos decimales; las jornadas con
 * los que hagan falta (1 día y 1 hora son 1.125 JOR: con dos decimales,
 * cantidad × P.U. ya no daba el importe). Horas, viajes y piezas, enteros.
 */
export const cantidad = (valor, unidad) => {
  const n = Number(valor) || 0;
  if (unidad === 'JOR') return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (unidad === 'TON' || unidad === 'M3') return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
};

export const fechaLarga = (d = new Date()) =>
  new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

export const fechaCorta = (valor) => {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Escapa texto para meterlo en HTML. */
export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** "San Nicolás" = "san nicolas" (para comparar municipios). */
export const normalizar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bgral\b\.?/g, 'general')
    .replace(/\bcd\b\.?/g, 'ciudad')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
