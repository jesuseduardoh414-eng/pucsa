// =============================================================================
// MOTOR DEL COTIZADOR DE PUCSA MAQUINARIA (el mismo que el de MAQSER24).
//
// Es UNO solo: lo usa la pantalla mientras se edita y con él se arma el
// documento que se guarda congelado. La app anterior tenía el cálculo dos
// veces (Python y JavaScript) y ya no coincidían.
//
// Cobro por hora (sin tramos día/semana/mes): días × jornada + horas extra, al
// precio por hora del equipo, con un mínimo de horas por equipo. El agua y los
// acarreos se cobran según la zona del municipio de la obra. Carpeta asfáltica,
// materiales y venta de maquinaria todavía no tienen precio de lista: se
// cotizan con precio escrito a mano. Un servicio puede tener cantidad mínima
// (la cal de patio: se cobran 28 ton aunque pidan menos).
// =============================================================================
import { normalizar } from './formato.js';

export const LINEA_MAQUINARIA = 'maquinaria-pesada';
export const LINEA_TRANSPORTE = 'transporte-y-servicios-de-obra';
export const LINEA_ASFALTO = 'soluciones-asfalticas';
export const LINEA_MATERIALES = 'materiales-para-construccion';
export const LINEA_VENTA = 'venta-de-maquinaria';

/** Clave del servicio escrito a mano: no está en el tabulador. */
export const SERVICIO_A_MANO = 'custom';

/** Cómo se entrega lo escrito a mano (opcional; sale en el concepto). */
export const ENTREGAS_A_MANO = ['Recoge en planta', 'Camión torton', 'Tráiler', 'Tolva o pipa a granel'];

/** Los cotizadores de este proyecto, uno por categoría, en el orden del menú. */
export const COTIZADORES = [
  { clave: 'maquinaria', titulo: 'Renta de maquinaria', resumen: 'Por hora, con operador y diésel', linea: LINEA_MAQUINARIA, icono: 'excavadora', incluye: (r) => r.clase === 'equipo' },
  { clave: 'agua', titulo: 'Servicios de agua', resumen: 'Pipas de 10 y 20 m³, por viaje', linea: LINEA_TRANSPORTE, icono: 'agua', incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_TRANSPORTE && r.cond === 'pipa' },
  { clave: 'acarreos', titulo: 'Acarreos', resumen: 'Acarreo de material en volteo, por viaje', linea: LINEA_TRANSPORTE, icono: 'retiro', incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_TRANSPORTE && r.cond !== 'pipa' },
  { clave: 'carpeta-asfaltica', titulo: 'Carpeta asfáltica', resumen: 'Riego de impregnación y carpeta asfáltica', linea: LINEA_ASFALTO, icono: 'asfalto', incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_ASFALTO },
  // La cal de patio entra aquí desde 2026-11-18 (antes iba en triturados).
  { clave: 'materiales', titulo: 'Materiales de construcción', resumen: 'Block de concreto y cal de patio', linea: LINEA_MATERIALES, icono: 'block', incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_MATERIALES },
  { clave: 'venta-de-maquinaria', titulo: 'Venta de maquinaria', resumen: 'Equipos a la venta', linea: LINEA_VENTA, icono: 'venta', incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_VENTA },
];

/** Las condiciones que lleva lo escrito a mano de cada categoría sin precio de lista. */
const COND_DE_CATEGORIA = { 'carpeta-asfaltica': 'asfalto', materiales: 'materiales', 'venta-de-maquinaria': 'venta' };

export const cotizadorDe = (clave) => COTIZADORES.find((c) => c.clave === clave) ?? null;

// ---------------------------------------------------------------------------

export const r2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const entero = (v, min, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const decimal = (v, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, n) : min;
};

/** Lo que cuesta una hora del equipo (un tabulador viejo con `tarifas` se lee como tarifa día ÷ jornada). */
export function precioHoraDe(cat, eq) {
  if (eq.precio_hora !== undefined) return Number(eq.precio_hora) || 0;
  return eq.tarifas ? (Number(eq.tarifas.dia) || 0) / cat.jornada_horas : 0;
}
export const minimoHorasDe = (cat) => cat.minimo_horas ?? cat.jornada_horas;
export const cobraFlete = (cat) => cat.cobrar_flete !== false;
const horasTexto = (n) => `${n} ${n === 1 ? 'hora' : 'horas'}`;

export const equipoDe = (cat, id) => cat.equipos.find((e) => e.id === id) ?? null;
export const servicioDe = (cat, id) => cat.servicios.find((s) => s.id === id) ?? null;

// ---- Servicios con precio por zona (agua y acarreos) ----

export const porZona = (sv) => !!sv.precios_zona && Object.keys(sv.precios_zona).length > 0;
export const zonaPrecioDe = (cat, id) => (id && (cat.zonas_precio ?? []).find((z) => z.id === id)) || null;

/** La zona de un municipio ("San Nicolás" = "san nicolas"), o null. */
export function zonaDeMunicipio(cat, municipio) {
  const m = normalizar(String(municipio ?? '').split(',')[0] ?? '');
  if (!m) return null;
  return (cat.zonas_precio ?? []).find((z) => z.municipios.some((x) => normalizar(x) === m)) ?? null;
}

export const zonasDelServicio = (cat, sv) => (cat.zonas_precio ?? []).filter((z) => (sv.precios_zona?.[z.id] ?? 0) > 0);

/** Precio por viaje del servicio en esa zona; sin precio por zona, el de siempre; null si no se ofrece ahí. */
export function precioDeServicio(cat, sv, zonaId) {
  if (!porZona(sv)) return sv.precio;
  const precio = zonaId ? sv.precios_zona?.[zonaId] : undefined;
  return precio && precio > 0 && zonaPrecioDe(cat, zonaId) ? precio : null;
}

/** La zona que no se eligió a mano sale del municipio de la obra. */
export function conZonaDeLaObra(cat, partidas, municipio) {
  const zona = zonaDeMunicipio(cat, municipio);
  return partidas.map((p) => {
    if (p.tipo !== 'servicio' || p.zona) return p;
    const sv = servicioDe(cat, p.id);
    return sv && porZona(sv) && zona ? { ...p, zona: zona.id } : p;
  });
}

/** Qué falta para cobrar el agua o el acarreo por zona. Null si todo está. */
export function faltaZona(cat, partidas, municipio) {
  for (const p of partidas) {
    if (p.tipo !== 'servicio') continue;
    const sv = servicioDe(cat, p.id);
    if (!sv || !porZona(sv) || Number(p.precio) > 0) continue;
    if (precioDeServicio(cat, sv, p.zona) !== null) continue;
    const donde = String(municipio ?? '').trim();
    const zonas = zonasDelServicio(cat, sv).map((z) => z.nombre).join(' y ');
    return p.zona || !donde
      ? `«${sv.nombre}»: elige la zona de la obra (${zonas}).`
      : `«${sv.nombre}» no se ofrece en ${donde}: solo en los municipios de ${zonas}.`;
  }
  return null;
}

/**
 * Lo que cuesta UNA partida de equipo. Se exporta porque la pantalla pinta este
 * mismo desglose mientras se mueven los días: es el mismo motor, no otro.
 */
export function calcularEquipo(cat, p) {
  const eq = equipoDe(cat, p.id);
  const jornada = cat.jornada_horas;
  const dias = entero(p.dias, 0);
  const horas = entero(p.horas, 0, jornada - 1);
  const cantidad = entero(p.cantidad, 1);
  const negociado = p.precio_hora !== null && p.precio_hora !== undefined && Number(p.precio_hora) > 0;
  const tarifaHora = negociado ? decimal(p.precio_hora) : eq ? precioHoraDe(cat, eq) : 0;
  const tarifaDia = tarifaHora * jornada;
  // Sin duración no se cobra: es un renglón recién agregado que aún no se configura.
  const activo = dias >= 1 || horas >= 1;
  const minimo = minimoHorasDe(cat);
  const horasPedidas = dias * jornada + horas;
  const horasPorEquipo = activo ? Math.max(horasPedidas, minimo) : 0;
  const notaMinimo = activo && horasPedidas < minimo ? `Mínimo ${horasTexto(minimo)} por equipo: se cobran ${horasTexto(minimo)}.` : null;
  const horasTotales = horasPorEquipo * cantidad;
  const tiempo = horasTotales * tarifaHora;
  const fleteNegociado = p.flete !== null && p.flete !== undefined && Number(p.flete) > 0;
  const fleteUnit = !cobraFlete(cat) ? 0 : fleteNegociado ? decimal(p.flete) : eq ? Number(cat.fletes[eq.flete_tipo] ?? 0) : 0;
  const flete = activo ? fleteUnit * cantidad : 0;
  return { eq, jornada, dias, horas, cantidad, tarifaDia, tarifaHora, horasPedidas, horasPorEquipo, horasTotales, minimo, notaMinimo, tiempo, fleteUnit, flete, activo, negociado };
}

/** Así empieza la leyenda para negociar. */
export const LEYENDA_NEGOCIAR = 'Si desea negociar el costo';

/** Los dos puntos de la renta que escribe el tabulador: cómo se cobra y la leyenda para negociar. */
function puntosDeRenta(cat) {
  const minimo = minimoHorasDe(cat);
  const tel = String(cat.empresa.telefono ?? '').trim();
  return {
    primero: `El costo de la renta del equipo es por hora de trabajo${minimo > 0 ? `, con un mínimo de ${horasTexto(minimo)} por equipo` : ''}.`,
    ultimo: `${LEYENDA_NEGOCIAR}, comuníquese a la línea de ${cat.empresa.nombre || 'PUCSA'}${tel ? `: ${tel}` : ''}.`,
  };
}

const COND_ORDEN = ['renta', 'retiro', 'banco', 'pipa'];

function condiciones(cat, partidas) {
  const claves = new Set();
  for (const p of partidas) {
    if (p.tipo === 'equipo') claves.add('renta');
    else {
      const sv = servicioDe(cat, p.id);
      if (sv) claves.add(sv.cond || 'renta');
      // Lo escrito a mano de una categoría sin precio de lista lleva las condiciones de esa categoría.
      else if (p.id === SERVICIO_A_MANO && p.categoria && COND_DE_CATEGORIA[p.categoria]) claves.add(COND_DE_CATEGORIA[p.categoria]);
    }
  }
  const orden = [...COND_ORDEN, ...[...claves].filter((k) => !COND_ORDEN.includes(k))];
  const renta = puntosDeRenta(cat);
  return orden
    .filter((k) => claves.has(k) && cat.condiciones[k])
    .map((k) => (k === 'renta'
      ? { ...cat.condiciones[k], puntos: [renta.primero, ...cat.condiciones[k].puntos, renta.ultimo] }
      : cat.condiciones[k]));
}

/** El concepto del renglón escrito a mano: su nombre y, si se dijo, cómo se entrega. */
export function conceptoAMano(nombre, entrega) {
  const e = String(entrega ?? '').trim();
  if (!e) return nombre.toUpperCase();
  return `${nombre} · ${e === 'Recoge en planta' ? e : `entrega en ${e}`}`.toUpperCase();
}

/** El cálculo completo de una cotización. */
export function calcular(cat, partidas, opciones = {}) {
  const modo = opciones.modo_unidad ?? 'horas';
  const jornada = cat.jornada_horas;
  const renglones = [];
  let renta = 0;
  let servicios = 0;
  let fletes = 0;

  for (const p of partidas) {
    if (p.tipo === 'equipo') {
      const c = calcularEquipo(cat, p);
      if (!c.eq || !c.activo) continue;
      renta += c.tiempo;
      fletes += c.flete;
      const unidad = modo === 'dias' ? 'JOR' : 'HRS';
      // Las horas COBRADAS (con el mínimo), no las pedidas: cantidad × P.U. = importe.
      const cantidad = modo === 'dias' ? Math.round((c.horasTotales / jornada) * 10_000) / 10_000 : c.horasTotales;
      const pu = modo === 'dias' ? r2(c.tarifaDia) : r2(c.tarifaHora);
      renglones.push({
        clase: 'equipo', id: c.eq.id, nombre: c.eq.nombre,
        concepto: `RENTA DE ${c.eq.nombre.toUpperCase()} ( CON OPERACIÓN, INCLUYE DIÉSEL )`,
        unidad, cantidad, pu, importe: r2(c.tiempo),
        detalle: [c.notaMinimo ?? 'Por hora', c.cantidad > 1 ? `${c.cantidad} equipos` : ''].filter(Boolean).join(' · '),
      });
      if (cobraFlete(cat)) {
        renglones.push({
          clase: 'flete', id: c.eq.id,
          concepto: `FLETE ${c.eq.flete_tipo.toUpperCase()} A OBRA (IDA Y VUELTA)`,
          unidad: 'SERV', cantidad: c.cantidad, pu: r2(c.fleteUnit), importe: r2(c.flete),
        });
      }
    } else if (p.tipo === 'servicio') {
      const sv = servicioDe(cat, p.id);
      if (!sv) {
        // Escrito a mano: nombre y precio obligatorios; sin ellos sería un renglón mudo o en cero.
        const nombre = String(p.nombre ?? '').trim();
        const precio = decimal(p.precio);
        const cantidad = entero(p.cantidad, 1);
        if (p.id !== SERVICIO_A_MANO || !nombre || precio <= 0) continue;
        servicios += precio * cantidad;
        renglones.push({
          clase: 'servicio', id: SERVICIO_A_MANO, nombre,
          concepto: conceptoAMano(nombre, p.entrega),
          unidad: String(p.unidad || 'servicio').toUpperCase(),
          cantidad, pu: r2(precio), importe: r2(precio * cantidad),
        });
        continue;
      }
      // Con mínimo (la cal, 28 ton): si piden menos, se cobra el mínimo.
      const cantidad = Math.max(entero(p.cantidad, 1), sv.minimo ?? 0);
      // Un precio en 0 es "el del catálogo", no "gratis". Por zona, el de su zona.
      const zona = porZona(sv) ? zonaPrecioDe(cat, p.zona) : null;
      const precio = decimal(p.precio && Number(p.precio) > 0 ? p.precio : precioDeServicio(cat, sv, p.zona) ?? 0);
      const importe = precio * cantidad;
      const concepto = sv.cond === 'retiro' ? `${sv.nombre.toUpperCase()} (TIRO LIBRE)` : sv.nombre.toUpperCase();
      if (importe <= 0) {
        // Sin precio de lista: sale «Por cotizar», sin sumar, en vez de perderse. Lo que se
        // cobra por zona y no tiene zona sigue sin salir (la pantalla pide la zona).
        if (!porZona(sv)) {
          renglones.push({ clase: 'servicio', id: sv.id, nombre: sv.nombre, concepto, unidad: String(sv.unidad || 'viaje').toUpperCase(), cantidad, pu: 0, importe: 0, porCotizar: true });
        }
        continue;
      }
      servicios += importe;
      renglones.push({
        clase: 'servicio', id: sv.id, nombre: sv.nombre,
        concepto: zona ? `${concepto} · ${zona.nombre.toUpperCase()}` : concepto,
        unidad: String(sv.unidad || 'viaje').toUpperCase(),
        cantidad, pu: r2(precio), importe: r2(importe),
      });
    }
  }

  const subtotal = r2(renta + servicios + fletes);
  const iva = r2(subtotal * cat.iva);
  return {
    renglones,
    desglose: { renta: r2(renta), servicios: r2(servicios), fletes: r2(fletes), materiales: 0 },
    subtotal, iva, iva_tasa: cat.iva, con_iva: true, total: r2(subtotal + iva),
    condiciones: condiciones(cat, partidas),
  };
}

/** ¿Hay algo que cobrar? Un carrito de renglones en cero no es una cotización. */
export const tieneImporte = (calc) => calc.renglones.length > 0 && calc.total > 0;

// ---- Unidades ----

/** "3 viajes", "1 pieza", "2 viajes Torton". */
export function conUnidad(cantidad, unidad) {
  const u = unidad || 'viaje';
  const [primera, ...resto] = u.split(' ');
  if (cantidad === 1 || !/[a-zíá]$/i.test(primera)) return `${cantidad} ${u}`;
  const plural = /[aeiouáéíóú]$/i.test(primera) ? `${primera}s` : `${primera}es`;
  return [String(cantidad), plural, ...resto].join(' ');
}

/** Línea de un servicio (con respaldo por su bloque de condiciones). */
export function lineaDeServicio(sv) {
  if (sv.linea) return sv.linea;
  return sv.cond === 'pipa' || sv.cond === 'retiro' ? LINEA_TRANSPORTE : LINEA_MAQUINARIA;
}

// ---- Categorías ----

function filtrar(cat, incluye) {
  return {
    ...cat,
    equipos: cat.equipos.filter(() => incluye({ clase: 'equipo', linea: LINEA_MAQUINARIA })),
    servicios: cat.servicios.filter((s) => incluye({ clase: 'servicio', linea: lineaDeServicio(s), cond: s.cond })),
  };
}

/** El tabulador con solo lo de esas categorías (varias en UNA cotización). */
export function catalogoDeVarios(cat, claves) {
  const cs = claves.map(cotizadorDe).filter(Boolean);
  return filtrar(cat, (r) => cs.some((c) => c.incluye(r)));
}

/** El tabulador sin lo oculto, para ELEGIR. Lo que ya trae la cotización se queda. */
export function soloVisibles(cat, enUso = []) {
  const usa = new Set(enUso);
  const ve = (r) => !r.oculto || usa.has(r.id);
  return { ...cat, equipos: cat.equipos.filter(ve), servicios: cat.servicios.filter(ve) };
}

/** ¿La categoría tiene algo con precio de lista? Si no, se cotiza con precio a mano. */
export function categoriaConPrecio(cat, clave) {
  const c = cotizadorDe(clave);
  if (!c) return false;
  const f = filtrar(cat, c.incluye);
  return f.equipos.some((e) => !e.oculto) || f.servicios.some((s) => !s.oculto);
}

function categoriaDePartida(cat, p) {
  if (p.tipo === 'equipo') return 'maquinaria';
  if (p.tipo === 'servicio' && p.id === SERVICIO_A_MANO) return p.categoria && cotizadorDe(p.categoria) ? p.categoria : null;
  const sv = p.tipo === 'servicio' ? servicioDe(cat, p.id) : null;
  if (!sv) return null;
  const r = { clase: 'servicio', linea: lineaDeServicio(sv), cond: sv.cond };
  return COTIZADORES.find((c) => c.incluye(r))?.clave ?? null;
}

export const categoriasDePartidas = (cat, partidas) =>
  [...new Set(partidas.map((p) => categoriaDePartida(cat, p)).filter(Boolean))];

/** "renta de maquinaria y servicios de agua". */
export function categoriasEnTexto(claves) {
  const t = claves.map((k) => cotizadorDe(k)?.titulo.toLowerCase()).filter(Boolean);
  return t.length <= 1 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}`;
}

/** El título del documento según lo que lleva: «Cotización de renta de maquinaria y servicios de agua». */
export function tituloDe(cat, partidas) {
  const texto = categoriasEnTexto(categoriasDePartidas(cat, partidas));
  return `Cotización de ${texto || 'maquinaria'}`;
}

/** El saludo según lo que se cotiza: solo agua o solo block no es "renta de maquinaria". */
export function saludoDe(cat, partidas) {
  if (!partidas.length) return cat.saludo;
  const claves = new Set(partidas.map((p) => categoriaDePartida(cat, p)));
  if (claves.has(null)) return cat.saludo;
  const lista = [...claves];
  if (lista.length === 1 && lista[0] === 'maquinaria') return cat.saludo;
  const texto = categoriasEnTexto(lista);
  return texto ? cat.saludo.replace(/renta de maquinaria/i, texto) : cat.saludo;
}
