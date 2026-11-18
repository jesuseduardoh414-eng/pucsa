import { html, useEffect, useState } from '../vendor/preact-htm.js';
import {
  calcularEquipo, cobraFlete, conUnidad, ENTREGAS_A_MANO, minimoHorasDe, porZona, precioDeServicio,
  precioHoraDe, SERVICIO_A_MANO, zonaDeMunicipio, zonaPrecioDe, zonasDelServicio,
} from './motor.js';
import { money, money2, precioEnPantalla as dinero } from './formato.js';
import { Campo, Chip, Contador, Linea, NumeroTexto, Renglon, Tarjeta, Texto } from './piezas.js';
import { Ui } from './iconos.js';
import { num } from './estado.js';

/**
 * Las horas en total: se escribe cuántas y los días y horas extra se acomodan
 * solos (20 h con jornada de 8 = 2 días y 4 h). Mientras se escribe, el campo
 * guarda su propio texto: si mostrara el total calculado, borrar para teclear
 * otro número lo regresaría a "0" a media captura.
 */
function HorasEnTotal({ total, jornada, poner }) {
  const [texto, setTexto] = useState(String(total));
  const [escribiendo, setEscribiendo] = useState(false);
  useEffect(() => { if (!escribiendo) setTexto(String(total)); }, [total, escribiendo]);
  return html`<${Campo} label="Horas en total" help=${`Jornada de ${jornada} h: se reparte en días y horas extra`}>
    ${(id) => html`<input id=${id} class="cz-input" type="text" inputmode="numeric" value=${texto}
      onFocus=${(e) => { setEscribiendo(true); e.currentTarget.select(); }} onBlur=${() => setEscribiendo(false)}
      onInput=${(e) => {
        const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 5);
        setTexto(v);
        const h = Number(v) || 0;
        poner(Math.floor(h / jornada), h % jornada);
      }} />`}
  <//>`;
}

/** Qué equipo: solo elegir. Tocar otra vez lo quita; el "+" agrega otra partida del mismo. */
export function PasoEquipos({ cat, lineas, alternar, agregarOtra }) {
  const cuenta = (id) => lineas.filter((l) => l.tipo === 'equipo' && l.id === id).length;
  const conFlete = cobraFlete(cat);
  return html`<div class="cz-card">
    <h2 class="cz-card-h">Equipos disponibles</h2>
    <p class="cz-card-s">Toca un equipo para elegirlo y tócalo otra vez para quitarlo. Todos incluyen operador con DC3,
      diésel, IMSS y seguro${conFlete ? '; el flete a obra se suma solo' : ''}.</p>
    <div class="cz-cards">
      ${cat.equipos.map((e) => html`<${Tarjeta} key=${e.id} icono=${e.icono} titulo=${e.nombre}
        nota=${`${money(precioHoraDe(cat, e))} / hora`} n=${cuenta(e.id)}
        onClick=${() => alternar(e.id)} onAgregarOtra=${() => agregarOtra(e.id)} />`)}
    </div>
  </div>`;
}

const SUGERENCIAS = [1, 2, 3, 5, 15, 30];

/** Cuánto tiempo. Se cobra por hora: días × jornada + horas extra, con un mínimo por equipo. */
export function PasoDuracion({ cat, lineas, actualizar, quitar }) {
  const equipos = lineas.filter((l) => l.tipo === 'equipo');
  const minimo = minimoHorasDe(cat);
  const conFlete = cobraFlete(cat);
  return html`<div class="cz-card">
    <h2 class="cz-card-h">Tiempo de renta</h2>
    <p class="cz-card-s">Se cobra por hora de trabajo. Cada día es una jornada de ${cat.jornada_horas} horas${minimo > 0 ? ` y el mínimo es de ${minimo} horas por equipo` : ''}.</p>
    ${equipos.map((l) => {
      const c = calcularEquipo(cat, { tipo: 'equipo', id: l.id, dias: l.dias, horas: l.horas, cantidad: l.cantidad, precio_hora: num(l.precioHora) || null });
      if (!c.eq) return null;
      return html`<${Linea} key=${l.uid} icono=${c.eq.icono} titulo=${c.eq.nombre}
        nota=${conFlete ? `Flete ${c.eq.flete_tipo} · operador y diésel incluidos` : 'Operador y diésel incluidos'}
        insignia=${c.activo ? `${c.horasTotales} h` : null} onQuitar=${() => quitar(l.uid)}
        dinero=${html`
          <${Renglon} texto=${`Renta · ${c.horasTotales} h${l.cantidad > 1 ? ` (${l.cantidad} equipos)` : ''} a ${money2(c.tarifaHora)}/h`} valor=${money(c.tiempo)} />
          ${c.notaMinimo ? html`<${Renglon} texto=${c.notaMinimo} valor="" />` : null}
          ${conFlete ? html`<${Renglon} texto=${`Flete ida y vuelta${l.cantidad > 1 ? ` × ${l.cantidad}` : ''}`} valor=${money(c.flete)} />` : null}
          <${Renglon} texto="Subtotal" valor=${money(c.tiempo + c.flete)} fuerte />`}>
        <${HorasEnTotal} total=${l.dias * cat.jornada_horas + l.horas} jornada=${cat.jornada_horas}
          poner=${(dias, horas) => actualizar(l.uid, { dias, horas })} />
        <div class="cz-qty"><span class="cz-lbl">Días</span>
          <${Contador} valor=${l.dias} min=${0} ariaLabel="días" onChange=${(v) => actualizar(l.uid, { dias: v })} /></div>
        <div class="cz-qty"><span class="cz-lbl">Horas extra</span>
          <${Contador} valor=${l.horas} min=${0} max=${cat.jornada_horas - 1} ariaLabel="horas extra" onChange=${(v) => actualizar(l.uid, { horas: v })} /></div>
        <div class="cz-qty"><span class="cz-lbl">Equipos</span>
          <${Contador} valor=${l.cantidad} min=${1} max=${99} ariaLabel="equipos" onChange=${(v) => actualizar(l.uid, { cantidad: v })} /></div>
        <${Campo} label="Costo / hora" help=${c.negociado ? 'Precio negociado' : 'Del tabulador vigente'}>
          <${NumeroTexto} decimal ariaLabel="costo por hora" placeholder=${String(Math.round(precioHoraDe(cat, c.eq) * 100) / 100)}
            valor=${l.precioHora} onChange=${(v) => actualizar(l.uid, { precioHora: v })} />
        <//>
        <div class="cz-qty wide"><span class="cz-lbl">Duraciones frecuentes</span>
          <div class="cz-chips">${SUGERENCIAS.map((d) => html`<${Chip} key=${d} on=${l.dias === d && l.horas === 0}
            onClick=${() => actualizar(l.uid, { dias: d, horas: 0 })}>${d} ${d === 1 ? 'día' : 'días'}<//>`)}</div></div>
      <//>`;
    })}
  </div>`;
}

const CANTIDAD_EN = {
  viaje: 'Viajes', pieza: 'Piezas', millar: 'Millares', equipo: 'Equipos', tonelada: 'Toneladas', hora: 'Horas', día: 'Días',
  'm²': 'Metros cuadrados (m²)', 'm³': 'Metros cúbicos (m³)', litro: 'Litros', tarima: 'Tarimas',
  'viaje Torton': 'Viajes en Torton', 'viaje tráiler': 'Viajes en tráiler',
};
const cantidadEn = (unidad) => CANTIDAD_EN[unidad || 'viaje'] ?? 'Cantidad';

/**
 * Una categoría de servicios con precio (agua, acarreos, materiales): su propia
 * tarjeta. `aMano`: lo de la misma categoría que aún no tiene precio de lista
 * (el block, junto a la cal en Materiales): sus tarjetas y sus renglones van
 * aquí mismo, con el precio escrito a mano.
 */
export function PasoServicios({ titulo, cat, lineas, alternar, actualizar, quitar, municipio, aMano }) {
  const servicios = lineas.filter((l) => l.tipo === 'servicio');
  const cuentaAMano = (p) => (aMano?.lineas ?? []).filter((l) => l.nombre === p.nombre).length;
  const zonaObra = zonaDeMunicipio(cat, municipio);
  const conZona = cat.servicios.some(porZona);
  const cuenta = (id) => servicios.filter((l) => l.id === id).length;
  return html`<div class="cz-card">
    <h2 class="cz-card-h">${titulo}</h2>
    <p class="cz-card-s">Toca una opción para elegirla y pon la cantidad.${conZona ? ` Se cobra según la zona de la obra${zonaObra ? ` (${municipio}: ${zonaObra.nombre})` : ''}.` : ''}</p>
    <div class="cz-cards">
      ${cat.servicios.map((s) => {
        const fuera = porZona(s) && !!String(municipio).trim() && !zonasDelServicio(cat, s).some((z) => z.id === zonaObra?.id);
        const precio = porZona(s) ? precioDeServicio(cat, s, zonaObra?.id) : s.precio;
        const nota = fuera ? `No se ofrece en ${municipio} · elige la zona a mano`
          : precio ? `${dinero(precio)} / ${s.unidad}${porZona(s) && zonaObra ? ` · ${zonaObra.nombre}` : ''}`
          : `por ${s.unidad}${porZona(s) ? ' · según la zona' : s.minimo ? ` · mínimo ${s.minimo}` : ''}`;
        return html`<${Tarjeta} key=${s.id} icono=${s.icono} titulo=${s.nombre} nota=${nota} n=${cuenta(s.id)} onClick=${() => alternar(s.id)} />`;
      })}
      ${(aMano?.productos ?? []).map((p) => html`<${Tarjeta} key=${`am-${p.nombre}`} icono=${aMano.icono} titulo=${p.nombre}
        nota=${`por ${p.unidad} · precio a mano`} n=${cuentaAMano(p)} onClick=${() => aMano.alternar(p)} />`)}
    </div>
    ${servicios.length ? html`<div style="margin-top:16px">
      ${servicios.map((l) => {
        const sv = cat.servicios.find((s) => s.id === l.id);
        if (!sv) return null;
        const zonas = porZona(sv) ? zonasDelServicio(cat, sv) : [];
        const zona = porZona(sv) ? zonaPrecioDe(cat, l.zona) ?? zonaObra : null;
        const deZona = porZona(sv) ? precioDeServicio(cat, sv, zona?.id) : null;
        const unitario = num(l.precio) || deZona || sv.precio || 0;
        const nota = !porZona(sv) ? `Precio por ${sv.unidad}${sv.minimo ? ` · mínimo ${conUnidad(sv.minimo, sv.unidad)}` : ''}`
          : zona && deZona ? `${zona.nombre}${l.zona ? '' : ' · por el municipio de la obra'}`
          : String(municipio).trim() ? `No se ofrece en ${municipio}: elige la zona` : 'Elige el municipio de la obra para saber su zona';
        return html`<${Linea} key=${l.uid} icono=${sv.icono} titulo=${sv.nombre} nota=${nota} onQuitar=${() => quitar(l.uid)}
          dinero=${html`<${Renglon} texto=${`${conUnidad(l.cantidad, sv.unidad)} × ${dinero(unitario)}`} valor=${dinero(unitario * l.cantidad)} fuerte />`}>
          ${zonas.length ? html`<div class="cz-qty wide"><span class="cz-lbl">Zona de la obra</span>
            <div class="cz-chips">${zonas.map((z) => html`<${Chip} key=${z.id} on=${zona?.id === z.id}
              onClick=${() => actualizar(l.uid, { zona: z.id === zonaObra?.id ? '' : z.id })}>${z.nombre} · ${dinero(sv.precios_zona?.[z.id] ?? 0)}<//>`)}</div></div>` : null}
          <${Campo} label="Precio unitario" help=${porZona(sv) ? 'Vacío = el de la zona' : 'Vacío = el del tabulador'}>
            <${NumeroTexto} decimal ariaLabel="precio unitario" placeholder=${String(deZona ?? sv.precio ?? '')} valor=${l.precio}
              onChange=${(v) => actualizar(l.uid, { precio: v })} />
          <//>
          <div class="cz-qty"><span class="cz-lbl">${cantidadEn(sv.unidad)}</span>
            <${Contador} valor=${l.cantidad} min=${Math.max(1, sv.minimo ?? 1)} max=${100000} ariaLabel=${cantidadEn(sv.unidad).toLowerCase()} onChange=${(v) => actualizar(l.uid, { cantidad: v })} /></div>
          ${sv.presets?.length > 1 ? html`<div class="cz-qty wide"><span class="cz-lbl">Precios sugeridos</span>
            <div class="cz-chips">${sv.presets.map((p) => html`<${Chip} key=${p} on=${num(l.precio) === p} onClick=${() => actualizar(l.uid, { precio: String(p) })}>${dinero(p)}<//>`)}</div></div>` : null}
        <//>`;
      })}
    </div>` : null}
    ${aMano?.lineas.length ? html`<div style="margin-top:16px">
      ${aMano.lineas.map((l) => html`<${ServicioAMano} key=${l.uid} l=${l} actualizar=${aMano.actualizar} quitar=${aMano.quitarLinea} tocado=${aMano.tocado} />`)}
    </div>` : null}
    ${aMano?.productos.length ? html`<button type="button" class="cz-agregar" onClick=${aMano.agregarOtro} style="margin-top:14px">
      <${Ui} n="mas" /> Otro (nombre y precio a mano)
    </button>` : null}
  </div>`;
}

const UNIDADES_A_MANO = ['servicio', 'viaje', 'hora', 'día', 'pieza'];

/**
 * Lo escrito a mano: nombre, unidad (se puede escribir otra), cantidad, precio
 * y, opcional, cómo se entrega. También lo de una categoría sin precio de lista.
 */
export function ServicioAMano({ l, actualizar, quitar, tocado }) {
  const unitario = num(l.precio);
  const unidad = l.unidad || 'servicio';
  const [escribir, setEscribir] = useState(!UNIDADES_A_MANO.includes(unidad));
  const [propia, setPropia] = useState(UNIDADES_A_MANO.includes(unidad) ? '' : unidad);
  const entrega = l.entrega ?? '';
  const esDeLista = ENTREGAS_A_MANO.includes(entrega);
  const [entregaOtra, setEntregaOtra] = useState(!!entrega && !esDeLista);
  const [entregaTexto, setEntregaTexto] = useState(entrega && !esDeLista ? entrega : '');
  return html`<${Linea} icono="personalizado" titulo=${l.nombre.trim() || 'Servicio escrito a mano'}
    nota=${l.categoria ? 'Sin precio de lista: captura el precio' : 'No está en el tabulador: nombre y precio a mano'}
    onQuitar=${() => quitar(l.uid)}
    dinero=${html`<${Renglon} texto=${`${conUnidad(l.cantidad, unidad)} × ${dinero(unitario)}`} valor=${dinero(unitario * l.cantidad)} fuerte />`}>
    <${Campo} label="Nombre" req error=${tocado && !l.nombre.trim() ? 'Escribe qué es' : null}>
      ${(id) => html`<${Texto} id=${id} placeholder="Ej. Arena 8" max=${120} valor=${l.nombre} invalido=${tocado && !l.nombre.trim()}
        onChange=${(v) => actualizar(l.uid, { nombre: v })} />`}
    <//>
    <div class="cz-qty wide"><span class="cz-lbl">Se cobra por</span>
      <div class="cz-chips">
        ${UNIDADES_A_MANO.map((u) => html`<${Chip} key=${u} on=${!escribir && unidad === u} onClick=${() => { setEscribir(false); actualizar(l.uid, { unidad: u }); }}>${u}<//>`)}
        <${Chip} on=${escribir} onClick=${() => { setEscribir(true); if (propia.trim()) actualizar(l.uid, { unidad: propia.trim() }); }}>otra<//>
      </div></div>
    ${escribir ? html`<${Campo} label="¿Por qué se cobra?">
      ${(id) => html`<${Texto} id=${id} placeholder="Ej. tonelada, m², litro" max=${20} valor=${propia}
        onChange=${(v) => { setPropia(v); actualizar(l.uid, { unidad: v.trim() || 'servicio' }); }} />`}
    <//>` : null}
    <div class="cz-qty"><span class="cz-lbl">Cantidad</span>
      <${Contador} valor=${l.cantidad} min=${1} max=${100000} ariaLabel="cantidad" onChange=${(v) => actualizar(l.uid, { cantidad: v })} /></div>
    <${Campo} label=${`Precio por ${unidad}`} req error=${tocado && unitario <= 0 ? 'Captura el precio' : null}>
      <${NumeroTexto} decimal ariaLabel="precio unitario" placeholder="Ej. 3500" valor=${l.precio} invalido=${tocado && unitario <= 0}
        onChange=${(v) => actualizar(l.uid, { precio: v })} />
    <//>
    <div class="cz-qty wide"><span class="cz-lbl">¿Cómo se entrega? <span style="font-weight:400">(opcional)</span></span>
      <div class="cz-chips">
        ${ENTREGAS_A_MANO.map((e) => html`<${Chip} key=${e} on=${!entregaOtra && entrega === e}
          onClick=${() => { setEntregaOtra(false); actualizar(l.uid, { entrega: !entregaOtra && entrega === e ? '' : e }); }}>${e}<//>`)}
        <${Chip} on=${entregaOtra} onClick=${() => {
          if (entregaOtra) { setEntregaOtra(false); actualizar(l.uid, { entrega: '' }); return; }
          setEntregaOtra(true);
          actualizar(l.uid, { entrega: entregaTexto.trim() });
        }}>otra<//>
      </div></div>
    ${entregaOtra ? html`<${Campo} label="¿Cómo se entrega?" ancho="full">
      ${(id) => html`<${Texto} id=${id} placeholder="Ej. plataforma, camión con grúa" max=${60} valor=${entregaTexto}
        onChange=${(v) => { setEntregaTexto(v); actualizar(l.uid, { entrega: v }); }} />`}
    <//>` : null}
  <//>`;
}

/**
 * Una categoría SIN precio de lista (carpeta asfáltica, materiales, venta):
 * sus productos en tarjetas; tocar uno agrega su renglón con nombre y unidad,
 * y el precio se captura aquí.
 */
export function CategoriaAMano({ titulo, icono, productos, lineas, alternar, agregarOtro, actualizar, quitarLinea, quitar, tocado }) {
  const cuenta = (p) => lineas.filter((l) => l.nombre === p.nombre).length;
  return html`<div class="cz-card">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
      <h2 class="cz-card-h">${titulo}</h2>
      <button type="button" class="cz-rm" aria-label=${`Quitar ${titulo}`} title="Quitar" onClick=${quitar}><${Ui} n="x" /></button>
    </div>
    <p class="cz-card-s">${productos.length
      ? 'Todavía no tiene precio de lista: toca lo que se cotiza y captura su precio.'
      : 'Todavía no tiene precio de lista: escribe qué es y su precio.'}</p>
    ${productos.length ? html`<div class="cz-cards">
      ${productos.map((p) => html`<${Tarjeta} key=${p.nombre} icono=${icono} titulo=${p.nombre}
        nota=${`por ${p.unidad} · precio a mano`} n=${cuenta(p)} onClick=${() => alternar(p)} />`)}
    </div>` : null}
    ${lineas.length ? html`<div style="margin-top:16px">
      ${lineas.map((l) => html`<${ServicioAMano} key=${l.uid} l=${l} actualizar=${actualizar} quitar=${quitarLinea} tocado=${tocado} />`)}
    </div>` : null}
    <button type="button" class="cz-agregar" onClick=${agregarOtro} style="margin-top:14px">
      <${Ui} n="mas" /> ${productos.length ? 'Otro (nombre y precio a mano)' : 'Agregar (nombre y precio a mano)'}
    </button>
  </div>`;
}

export { SERVICIO_A_MANO };
