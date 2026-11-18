// Lo que se está editando (renglones), que no es lo mismo que una partida.
//
// Los campos donde se teclea guardan CADENAS aunque sean números: mientras
// alguien escribe "0.5" pasa por "0.", y convertirlo en cada tecla borraba el
// campo. Se convierte a partidas en un solo lugar: aPartidas.
import { productoDe } from './motor.js';

export const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

let siguiente = 1;
export const nuevoUid = () => siguiente++;

export function lineaDeMaterial(cat, id) {
  const prod = productoDe(cat, id);
  return {
    uid: nuevoUid(), tipo: 'material', id: prod ? id : 'custom',
    nombre: prod?.nombre ?? '', precio: prod ? String(prod.precio_ton) : '', toneladas: '',
    fleteTon: 0, fleteZona: '', camion: '',
  };
}

export const lineaDeZona = (cat) => ({
  uid: nuevoUid(), tipo: 'zona', zonaId: cat.zonas[0]?.id ?? '', productoId: cat.productos[0]?.id ?? '', viajes: 1,
});

/**
 * Las tres formas de pedir: lo recoge en planta, por viaje a su obra o pedido
 * grande. Se deduce de lo que ya trae (al cotizar sobre una guardada). Lo
 * puesto en obra solo va en el pedido grande: solo, se abre ahí.
 */
export function formaDe(lineas, enObra = () => false) {
  if (lineas.some((l) => l.tipo === 'zona')) return 'viaje';
  if (lineas.some((l) => l.tipo === 'material' && !enObra(l.id) && l.camion)) return 'grande';
  if (lineas.some((l) => l.tipo === 'material' && !enObra(l.id))) return 'planta';
  if (lineas.some((l) => l.tipo === 'material')) return 'grande';
  return null;
}

/** De lo que se edita a lo que entiende el motor (fuente única: pantalla y guardado). */
export function aPartidas(lineas) {
  return lineas.map((l) => {
    if (l.tipo === 'material') {
      return {
        tipo: 'material', id: l.id, nombre: l.nombre.trim(), precio: num(l.precio), toneladas: num(l.toneladas),
        flete_ton: l.fleteTon, flete_zona: l.fleteZona.trim(), ...(l.camion ? { camion: l.camion } : {}),
      };
    }
    if (l.tipo === 'banco') return { tipo: 'banco', precio_m3: num(l.precioM3), m3: num(l.m3) };
    return { tipo: 'zona', zona_id: l.zonaId, producto_id: l.productoId, viajes: l.viajes, ...(l.precio ? { precio: l.precio } : {}) };
  });
}

/** Rehidrata una cotización guardada para cotizar sobre ella. */
export function aLineas(partidas) {
  return partidas.map((p) => {
    if (p.tipo === 'material') {
      return {
        uid: nuevoUid(), tipo: 'material', id: p.id, nombre: p.nombre ?? '', precio: p.precio ? String(p.precio) : '',
        toneladas: p.toneladas ? String(p.toneladas) : '', fleteTon: p.flete_ton ?? 0, fleteZona: p.flete_zona ?? '', camion: p.camion ?? '',
      };
    }
    if (p.tipo === 'banco') return { uid: nuevoUid(), tipo: 'banco', precioM3: String(p.precio_m3 ?? ''), m3: String(p.m3 ?? '') };
    return { uid: nuevoUid(), tipo: 'zona', zonaId: p.zona_id ?? '', productoId: p.producto_id ?? '', viajes: p.viajes ?? 1, precio: p.precio ?? null };
  });
}

export const CONTEXTO_VACIO = { cliente: '', obra: '', atencion: '', municipio: '', notas: '' };
