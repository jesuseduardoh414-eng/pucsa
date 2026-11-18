// Lo que se está editando (renglones), que no es lo mismo que una partida.
//
// Los campos donde se teclea guardan CADENAS aunque sean números: mientras
// alguien escribe "0.5" pasa por "0.", y convertirlo en cada tecla borraba el
// campo. Se convierte a partidas (números de verdad) en un solo lugar: aPartidas.
import { porZona, SERVICIO_A_MANO } from './motor.js';

/** Cadena → número, tolerando vacío y basura. */
export const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

let siguiente = 1;
export const nuevoUid = () => siguiente++;

export const lineaDeEquipo = (id) => ({ uid: nuevoUid(), tipo: 'equipo', id, dias: 1, horas: 0, cantidad: 1, precioHora: '' });

export function lineaDeServicio(cat, id) {
  const sv = cat.servicios.find((s) => s.id === id);
  return {
    uid: nuevoUid(), tipo: 'servicio', id,
    // Por zona nace sin precio escrito: vale el de su zona, que sale del municipio de la obra.
    precio: sv && porZona(sv) ? '' : String(sv?.precio ?? 0),
    // Con mínimo (la cal, 28 ton) nace en el mínimo.
    cantidad: Math.max(1, sv?.minimo ?? 1), zona: '', nombre: '', unidad: '',
  };
}

/** Lo que no está en el tabulador: nombre, unidad y precio a mano. */
export const lineaDeServicioAMano = (base = {}) => ({
  uid: nuevoUid(), tipo: 'servicio', id: SERVICIO_A_MANO, precio: '', cantidad: 1, zona: '', nombre: '', unidad: 'servicio', entrega: '', ...base,
});

/** De lo que se edita a lo que entiende el motor (fuente única: pantalla y guardado). */
export function aPartidas(lineas) {
  return lineas.map((l) => {
    if (l.tipo === 'equipo') {
      return { tipo: 'equipo', id: l.id, dias: l.dias, horas: l.horas, cantidad: l.cantidad, precio_hora: num(l.precioHora) || null };
    }
    return {
      tipo: 'servicio', id: l.id, precio: num(l.precio), cantidad: l.cantidad,
      ...(l.zona ? { zona: l.zona } : {}),
      ...(l.id === SERVICIO_A_MANO
        ? { nombre: l.nombre.trim(), unidad: l.unidad || 'servicio', ...(l.categoria ? { categoria: l.categoria } : {}), ...(l.entrega?.trim() ? { entrega: l.entrega.trim() } : {}) }
        : {}),
    };
  });
}

/** Rehidrata una cotización guardada para cotizar sobre ella. */
export function aLineas(partidas) {
  return partidas.map((p) => {
    if (p.tipo === 'equipo') {
      return { uid: nuevoUid(), tipo: 'equipo', id: p.id, dias: p.dias ?? 0, horas: p.horas ?? 0, cantidad: p.cantidad ?? 1, precioHora: p.precio_hora ? String(p.precio_hora) : '' };
    }
    return {
      uid: nuevoUid(), tipo: 'servicio', id: p.id, precio: p.precio ? String(p.precio) : '', cantidad: p.cantidad ?? 1,
      zona: p.zona ?? '', nombre: p.nombre ?? '', unidad: p.unidad ?? '', entrega: p.entrega ?? '',
      ...(p.categoria ? { categoria: p.categoria } : {}),
    };
  });
}

/** Los datos del cliente que acompañan a la cotización (los del enlace: cliente, municipio y atención). */
export const CONTEXTO_VACIO = { cliente: '', obra: '', atencion: '', municipio: '', notas: '' };
