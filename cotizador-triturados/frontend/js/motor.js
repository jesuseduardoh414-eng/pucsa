// =============================================================================
// MOTOR DEL COTIZADOR DE PUCSA TRITURADOS (el mismo que el de MAQSER24).
//
// Es UNO solo: lo usa la pantalla mientras se edita y con él se arma el
// documento que se guarda congelado.
//
// Tres formas de pedir (una cotización va de una sola):
//  - Lo recojo en planta: precio de lista por tonelada, cargado en planta.
//  - Por viaje a mi obra: volteo de 14 m³ (22 ton) a precio de zona
//    ($/ton × 22 + flete de la zona), ya puesto en obra.
//  - Pedido grande (volteo, tolva o full), desde 100 ton: material por
//    tonelada y el flete por tonelada que se escribe en cada cotización.
// Un material «puesto en obra» (`en_obra`, como fue la cal de patio) va solo en
// el pedido grande, con su mínimo y su flete dentro del precio. La cal pasó a
// Materiales de construcción (cotizador de PUCSA Maquinaria) el 2026-11-18.
// El IVA se agrega o no (con factura o remisionado).
// =============================================================================
import { normalizar } from './formato.js';

/** Lo que se escribe en `flete_zona` cuando el material no se lleva a obra. */
export const RECOGE_EN_PLANTA = 'Recoge en planta';

export const r2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const entero = (v, min, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const decimal = (v, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, n) : min;
};

export const productoDe = (cat, id) => cat.productos.find((p) => p.id === id) ?? null;
export const zonaDe = (cat, id) => cat.zonas.find((z) => z.id === id) ?? null;
export const esEnObra = (cat, id) => !!productoDe(cat, id)?.en_obra;

/** Precio por viaje de un material a una zona: el fijo de la tabla o flete + $/ton × ton por viaje. */
export function precioZona(cat, z, productoId) {
  if (!z) return null;
  const fijo = z.precios?.[productoId];
  if (fijo !== undefined && fijo !== null) return Number(fijo);
  const prod = productoDe(cat, productoId);
  if (!prod) return null;
  return r2(Number(z.flete) + Number(prod.precio_ton) * cat.ton_por_viaje);
}

/** Los camiones del pedido grande, con sus m³ y toneladas (como MAQSER24 desde 2026-11-12). */
export const CAMIONES_DE_FABRICA = [
  { id: 'camion7', nombre: 'Volteo de 7 m³', detalle: '7 m³ / 10 ton', precios_ton: {} },
  { id: 'camion14', nombre: 'Volteo de 14 m³', detalle: '14 m³ / 14 ton', precios_ton: {} },
  { id: 'tolva', nombre: 'Tolva', detalle: '30 m³ / 50 ton', precios_ton: {} },
  { id: 'full', nombre: 'Full', detalle: '60 m³ / 100 ton', precios_ton: {} },
];
export const camionesDe = (cat) => cat.camiones ?? CAMIONES_DE_FABRICA;
export const minimoCamionDe = (cat) => cat.minimo_camion_ton ?? 100;
export const camionDe = (cat, id) => (id ? camionesDe(cat).find((c) => c.id === id) : undefined) ?? null;

/** Lo que le falta al pedido grande para el mínimo (suman las toneladas en camión; lo puesto en obra no cuenta), o null. */
export function faltaMinimoCamion(cat, partidas) {
  const grandes = partidas.filter((p) => p.tipo === 'material' && !!p.camion && !esEnObra(cat, p.id));
  if (!grandes.length) return null;
  const ton = grandes.reduce((s, p) => s + Number(p.toneladas ?? 0), 0);
  const minimo = minimoCamionDe(cat);
  return ton >= minimo ? null
    : `El pedido grande (volteo, tolva o full) es desde ${minimo} toneladas (llevas ${ton.toLocaleString('es-MX')}). Para menos, elige «Por viaje a mi obra».`;
}

/**
 * La zona del municipio de la obra: primero la que ya lo tiene guardado,
 * luego la que lo menciona en su nombre ("Zona 3 · San Nicolás, Hidalgo").
 */
export function zonaDelMunicipio(cat, municipio) {
  const m = normalizar(municipio);
  if (!m) return null;
  const partes = (nombre) => nombre.split(/[·,]/).map(normalizar).filter(Boolean);
  const mty = m === 'monterrey' ? 'monterrey centro' : m;
  return (
    cat.zonas.find((z) => (z.municipios ?? []).some((x) => normalizar(x) === m)) ??
    cat.zonas.find((z) => partes(z.nombre).some((p) => p === m || p === mty)) ??
    cat.zonas.find((z) => partes(z.nombre).some((p) => m.startsWith(`${p} `) || p.startsWith(`${m} `))) ??
    null
  );
}

/** Las condiciones del documento. La del IVA cambia con la factura, por eso se escribe aquí. */
function condiciones(cat, partidas, conIva) {
  const bloques = [];
  const general = cat.condiciones.general;
  if (general) {
    bloques.push({
      titulo: general.titulo,
      puntos: [
        conIva ? `Costos más IVA (${Math.round(cat.iva * 100)}%).` : 'Costos remisionados sin cargo de IVA; más IVA en caso de requerir factura.',
        ...general.puntos,
      ],
    });
  }
  const enObra = (p) => p.tipo === 'material' && esEnObra(cat, p.id);
  // «Suministro por tonelada» solo cuando van por el material a la planta.
  if (partidas.some((p) => p.tipo === 'material' && !p.camion && !enObra(p)) && cat.condiciones.material) bloques.push(cat.condiciones.material);
  if (partidas.some(enObra) && cat.condiciones.cal) bloques.push(cat.condiciones.cal);
  // Lo puesto en obra tiene sus propias condiciones (y su flete va en su precio): no entra aquí.
  const grandes = partidas.filter((p) => p.tipo === 'material' && !!p.camion && !enObra(p));
  if (grandes.length) {
    const camiones = [...new Set(grandes.map((p) => (camionDe(cat, p.camion)?.nombre ?? p.camion ?? '').toLowerCase()))].join(' y ');
    const sinPrecio = grandes.some((p) => !(Number(p.flete_ton ?? 0) > 0));
    bloques.push({
      titulo: 'Pedido grande',
      puntos: [
        'Este costo es entregado en obra.',
        `Pedido desde ${minimoCamionDe(cat)} toneladas, entregado en ${camiones}.`,
        sinPrecio ? 'El flete se confirma por separado: no está incluido en este total.' : 'El flete es por tonelada, según el camión y el lugar de la obra.',
      ],
    });
  }
  if (partidas.some((p) => p.tipo === 'banco') && cat.condiciones.banco) bloques.push(cat.condiciones.banco);
  if (partidas.some((p) => p.tipo === 'zona') && cat.condiciones.zona) bloques.push(cat.condiciones.zona);
  // En el enlace no se pide la ubicación en Google Maps: el documento no la menciona.
  return bloques.map((b) => ({ ...b, puntos: b.puntos.filter((p) => !/google maps/i.test(p)) })).filter((b) => b.puntos.length);
}

/** El cálculo completo de una cotización. */
export function calcular(cat, partidas, opciones = {}) {
  const conIva = opciones.con_iva ?? cat.iva_por_defecto;
  const renglones = [];
  let materiales = 0;
  let fletes = 0;

  for (const p of partidas) {
    if (p.tipo === 'material') {
      const prod = productoDe(cat, p.id);
      // `custom`: el material que se nombra a mano; sin nombre sería un renglón mudo.
      const nombre = String(p.nombre ?? prod?.nombre ?? '').trim() || prod?.nombre || '';
      const precioTon = decimal(p.precio && Number(p.precio) > 0 ? p.precio : prod?.precio_ton ?? 0);
      const pedidas = decimal(p.toneladas);
      if (!nombre || pedidas <= 0 || precioTon <= 0) continue;
      // Ya puesta en obra (la cal): se cobra el mínimo si piden menos y nunca lleva flete aparte.
      const enObra = !!prod?.en_obra;
      const ton = enObra ? Math.max(pedidas, Number(prod?.minimo_ton ?? 0)) : pedidas;
      const importe = precioTon * ton;
      materiales += importe;
      // Lo puesto en obra dice en qué camión llega; su flete sigue en su precio.
      const camionEnObra = enObra ? camionDe(cat, p.camion) : null;
      renglones.push({
        clase: 'material', id: p.id, nombre,
        concepto: enObra ? `${nombre.toUpperCase()} · PUESTA EN OBRA${camionEnObra ? ` EN ${camionEnObra.nombre.toUpperCase()}` : ''}` : nombre.toUpperCase(),
        unidad: 'TON', cantidad: ton, pu: r2(precioTon), importe: r2(importe),
        ...(enObra && ton > pedidas ? { detalle: `Mínimo ${ton} ton (pidió ${pedidas})` } : {}),
      });
      if (enObra) continue;
      const camion = camionDe(cat, p.camion);
      const fleteTon = decimal(p.flete_ton);
      if (fleteTon > 0) {
        const etiqueta = String(p.flete_zona ?? '').trim();
        const importeFlete = fleteTon * ton;
        fletes += importeFlete;
        renglones.push({
          clase: 'flete',
          concepto: camion
            ? `FLETE EN ${camion.nombre.toUpperCase()}${etiqueta ? ` · ${etiqueta.toUpperCase()}` : ''}`
            : etiqueta ? `FLETE ${etiqueta.toUpperCase()}` : 'FLETE A OBRA',
          unidad: 'TON', cantidad: ton, pu: r2(fleteTon), importe: r2(importeFlete),
        });
      }
    } else if (p.tipo === 'banco') {
      const b = cat.material_banco ?? {};
      const m3 = decimal(p.m3);
      const precio = decimal(Number(p.precio_m3) > 0 ? p.precio_m3 : b.precio_m3_default);
      if (m3 <= 0 || precio <= 0) continue;
      materiales += precio * m3;
      renglones.push({
        clase: 'banco', nombre: b.nombre, concepto: `${String(b.nombre ?? 'Material de banco').toUpperCase()} (INCLUYE FLETE)`,
        unidad: b.unidad || 'M3', cantidad: m3, pu: r2(precio), importe: r2(precio * m3),
      });
    } else if (p.tipo === 'zona') {
      const z = zonaDe(cat, p.zona_id);
      const prod = productoDe(cat, p.producto_id);
      const precio = p.precio && Number(p.precio) > 0 ? decimal(p.precio) : precioZona(cat, z, p.producto_id);
      if (!z || !prod || precio === null) continue;
      const viajes = entero(p.viajes, 1);
      materiales += precio * viajes;
      renglones.push({
        clase: 'zona', id: `${z.id}:${prod.id}`, nombre: prod.nombre,
        concepto: `${prod.nombre.toUpperCase()} · ${z.nombre}`,
        unidad: cat.unidad_zona || 'VIAJE', cantidad: viajes, pu: r2(precio), importe: r2(precio * viajes),
      });
    }
  }

  const subtotal = r2(materiales + fletes);
  const iva = conIva ? r2(subtotal * cat.iva) : 0;
  return {
    renglones,
    desglose: { renta: 0, servicios: 0, fletes: r2(fletes), materiales: r2(materiales) },
    subtotal, iva, iva_tasa: cat.iva, con_iva: !!conIva, total: r2(subtotal + iva),
    condiciones: condiciones(cat, partidas, conIva),
  };
}

/** El tabulador sin lo oculto, para ELEGIR. Lo que ya trae la cotización se queda. */
export function soloVisibles(cat, enUso = []) {
  const usa = new Set(enUso);
  return { ...cat, productos: cat.productos.filter((p) => !p.oculto || usa.has(p.id)) };
}
