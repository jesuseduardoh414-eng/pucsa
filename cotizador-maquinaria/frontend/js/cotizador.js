// =============================================================================
// EL COTIZADOR (una sola pantalla para armar y otra con el documento).
//
// Arriba los datos del cliente; debajo, cada categoría en su sección, en el
// orden en que se agregó; al final «¿Necesitas otro servicio?» y una barra con
// el total siempre a la vista. «Cotización →» lleva al documento, donde se
// guarda (con folio, al historial) y se manda por WhatsApp o en PDF.
//
// Lo guardado se congela: aunque mañana suba una tarifa, esa cotización sigue
// diciendo lo mismo.
// =============================================================================
import { html, useEffect, useMemo, useRef, useState } from '../vendor/preact-htm.js';
import * as M from './motor.js';
import { aLineas, aPartidas, CONTEXTO_VACIO, lineaDeEquipo, lineaDeServicio, lineaDeServicioAMano, num } from './estado.js';
import { Aviso, Campo, Combobox, Selector, Tarjeta, Texto } from './piezas.js';
import { CategoriaAMano, PasoDuracion, PasoEquipos, PasoServicios, ServicioAMano } from './pasos.js';
import { DOCUMENTO_CSS, documentoCuerpo } from './documento.js';
import { Compartir } from './compartir.js';
import { money } from './formato.js';
import { Ui } from './iconos.js';
import { api } from './api.js';

const SUELTOS = '__a-mano';

/**
 * @param cat       el tabulador completo
 * @param entrada   la categoría con la que abre (la del menú)
 * @param base      una cotización guardada sobre la que se cotiza (opcional)
 */
export function Cotizador({ cat, clientes, entrada, base, onGuardada, onSucio, onNueva }) {
  const [activas, setActivas] = useState(() => {
    if (!base) return [entrada];
    const deBase = (base.categorias ?? []).filter((k) => M.cotizadorDe(k));
    return deBase.length ? deBase : [entrada];
  });
  const [lineas, setLineas] = useState(() => (base ? aLineas(base.partidas) : []));
  const [ctx, setCtx] = useState(() => (base
    ? { cliente: base.cliente ?? '', obra: base.obra ?? '', atencion: base.atencion ?? '', municipio: base.municipio ?? '', notas: base.notas ?? '' }
    : { ...CONTEXTO_VACIO }));
  const [modoUnidad, setModoUnidad] = useState(base?.modo_unidad === 'dias' ? 'dias' : 'horas');
  const [paso, setPaso] = useState('armar');
  const [tocado, setTocado] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  /** La última guardada en esta pantalla y la huella de lo que se guardó. */
  const [guardada, setGuardada] = useState(null);
  const raiz = useRef(null);

  const conPrecio = (clave) => M.categoriaConPrecio(cat, clave);
  const partidas = useMemo(() => M.conZonaDeLaObra(cat, aPartidas(lineas), ctx.municipio), [cat, lineas, ctx.municipio]);
  const calc = useMemo(() => M.calcular(cat, partidas, { modo_unidad: modoUnidad }), [cat, partidas, modoUnidad]);
  const enUso = lineas.map((l) => l.id);
  const paraElegir = useMemo(() => M.soloVisibles(cat, enUso), [cat, lineas]);

  // ---- edición ----
  const agregar = (l) => setLineas((prev) => [...prev, l]);
  const quitar = (uid) => setLineas((prev) => prev.filter((l) => l.uid !== uid));
  const actualizar = (uid, patch) => setLineas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  /** Tocar de nuevo lo elegido lo quita (todas sus partidas). */
  const alternar = (coincide, crear) => setLineas((prev) => (prev.some(coincide) ? prev.filter((l) => !coincide(l)) : [...prev, crear()]));
  const esEquipo = (id) => (l) => l.tipo === 'equipo' && l.id === id;
  const esServicio = (id) => (l) => l.tipo === 'servicio' && l.id === id;
  const activar = (clave) => setActivas((a) => (a.includes(clave) ? a : [...a, clave]));
  const quitarCategoria = (clave) => {
    setLineas((prev) => prev.filter((l) => !(l.tipo === 'servicio' && l.categoria === clave)));
    setActivas((a) => (a.length > 1 ? a.filter((k) => k !== clave) : a));
  };
  const deCategoria = (clave) => lineas.filter((l) => l.tipo === 'servicio' && l.categoria === clave);
  const alternarProducto = (clave, p) => setLineas((prev) => (
    prev.some((l) => l.tipo === 'servicio' && l.categoria === clave && l.nombre === p.nombre)
      ? prev.filter((l) => !(l.tipo === 'servicio' && l.categoria === clave && l.nombre === p.nombre))
      : [...prev, lineaDeServicioAMano({ nombre: p.nombre, unidad: p.unidad, categoria: clave })]));
  const sueltos = lineas.filter((l) => l.tipo === 'servicio' && l.id === M.SERVICIO_A_MANO && !l.categoria);

  // ---- documento ----
  const datosDoc = (folio = '', fecha = null) => ({
    titulo: M.tituloDe(cat, partidas),
    folio, fecha,
    cliente: ctx.cliente.trim(), obra: ctx.obra.trim(), atencion: ctx.atencion.trim(), municipio: ctx.municipio.trim(),
    notas: ctx.notas.trim(),
    empresa: cat.empresa, firma: cat.firma, pago: cat.pago ?? null,
    saludo: M.saludoDe(cat, partidas),
    calc,
  });
  const huella = JSON.stringify([datosDoc(), modoUnidad]);
  const yaGuardada = !!guardada && guardada.huella === huella;
  const sucio = lineas.length > 0 && !yaGuardada;
  useEffect(() => { onSucio?.(sucio); }, [sucio]);
  // Al salir de la pantalla (también con «atrás» del navegador) ya no hay nada pendiente aquí.
  useEffect(() => () => onSucio?.(false), []);

  // ---- qué falta ----
  const faltante = useMemo(() => validar({ ctx, lineas, calc, zona: M.faltaZona(cat, partidas, ctx.municipio) }), [ctx, lineas, calc, cat, partidas]);

  useEffect(() => {
    if (!intentos) return;
    const id = requestAnimationFrame(() => irALoQueFalta(raiz.current, faltante));
    return () => cancelAnimationFrame(id);
  }, [intentos]);

  const primero = useRef(true);
  useEffect(() => {
    if (primero.current) { primero.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [paso]);

  const avanzar = () => {
    setTocado(true);
    if (faltante) { setIntentos((n) => n + 1); return; }
    setTocado(false);
    setPaso('documento');
  };

  async function guardar() {
    if (faltante) { setPaso('armar'); setTocado(true); setIntentos((n) => n + 1); return; }
    setGuardando(true);
    setError(null);
    const h = huella;
    try {
      const fila = await api('cotizaciones', {
        method: 'POST',
        body: {
          tipo: 'maquinaria', cliente: ctx.cliente.trim(), obra: ctx.obra.trim(), atencion: ctx.atencion.trim(),
          municipio: ctx.municipio.trim(), notas: ctx.notas.trim(), modo_unidad: modoUnidad,
          categorias: activas, partidas, documento: datosDoc(),
        },
      });
      setGuardada({ ...fila, huella: h });
      onGuardada?.(fila);
    } catch (e) {
      setError(e.message || 'No se pudo guardar la cotización.');
    } finally {
      setGuardando(false);
    }
  }

  // ---- secciones, en el orden en que se agregaron ----
  const seccion = (k) => {
    if (k === 'maquinaria') {
      return html`<${PasoEquipos} cat=${paraElegir} lineas=${lineas}
          alternar=${(id) => alternar(esEquipo(id), () => lineaDeEquipo(id))} agregarOtra=${(id) => agregar(lineaDeEquipo(id))} />
        ${lineas.some((l) => l.tipo === 'equipo') ? html`<${PasoDuracion} cat=${cat} lineas=${lineas} actualizar=${actualizar} quitar=${quitar} />` : null}`;
    }
    const c = M.cotizadorDe(k);
    if (!c) return null;
    if (conPrecio(k)) {
      const sub = M.catalogoDeVarios(paraElegir, [k]);
      const ids = new Set(sub.servicios.map((s) => s.id));
      // Lo de la misma categoría que aún no tiene precio (el block junto a la cal) va en la misma tarjeta.
      const productos = cat.a_la_medida?.[k] ?? [];
      const aMano = productos.length || deCategoria(k).length
        ? { icono: c.icono, productos, lineas: deCategoria(k), alternar: (p) => alternarProducto(k, p),
            agregarOtro: () => agregar(lineaDeServicioAMano({ categoria: k })), actualizar, quitarLinea: quitar, tocado }
        : null;
      return html`<${PasoServicios} titulo=${c.titulo} cat=${{ ...cat, servicios: sub.servicios }}
        lineas=${lineas.filter((l) => l.tipo === 'servicio' && ids.has(l.id))} municipio=${ctx.municipio}
        alternar=${(id) => alternar(esServicio(id), () => lineaDeServicio(cat, id))} actualizar=${actualizar} quitar=${quitar}
        aMano=${aMano} />`;
    }
    return html`<${CategoriaAMano} titulo=${c.titulo} icono=${c.icono} productos=${cat.a_la_medida?.[k] ?? []}
      lineas=${deCategoria(k)} alternar=${(p) => alternarProducto(k, p)}
      agregarOtro=${() => agregar(lineaDeServicioAMano({ categoria: k }))}
      actualizar=${actualizar} quitarLinea=${quitar} quitar=${() => quitarCategoria(k)} tocado=${tocado} />`;
  };

  const orden = [...activas, ...(sueltos.length ? [SUELTOS] : [])];
  const otras = M.COTIZADORES.filter((c) => !activas.includes(c.clave));
  const hayEquipos = activas.includes('maquinaria') || lineas.some((l) => l.tipo === 'equipo');

  return html`<div class="cz" ref=${raiz}>
    ${paso === 'armar' ? html`
      <${DatosCliente} ctx=${ctx} setCtx=${setCtx} cat=${cat} clientes=${clientes} tocado=${tocado}
        modoUnidad=${hayEquipos ? { valor: modoUnidad, poner: setModoUnidad } : null} />
      ${orden.map((k) => (k === SUELTOS
        ? html`<div class="cz-card" key=${k}>
            <h2 class="cz-card-h">Otros servicios</h2>
            <p class="cz-card-s">Lo que no está en el tabulador: nombre, unidad y precio a mano.</p>
            <div style="margin-top:16px">${sueltos.map((l) => html`<${ServicioAMano} key=${l.uid} l=${l} actualizar=${actualizar} quitar=${quitar} tocado=${tocado} />`)}</div>
          </div>`
        : html`<div class="cz-seccion" key=${k}>${seccion(k)}</div>`))}
      <div class="cz-card" data-opcional="1">
        <h2 class="cz-card-h">¿Necesitas otro servicio?</h2>
        <p class="cz-card-s">Toca uno y se agrega a esta misma cotización con sus opciones. Lo que todavía no tiene precio de lista sale con sus productos y su precio se captura a mano.</p>
        ${otras.length ? html`<div class="cz-cards cz-opciones">
          ${otras.map((o) => html`<${Tarjeta} key=${o.clave} icono=${o.icono} titulo=${o.titulo}
            nota=${conPrecio(o.clave) ? o.resumen : 'Sin precio de lista · precio a mano'} modo="agregar" onClick=${() => activar(o.clave)} />`)}
        </div>` : null}
        <button type="button" class="cz-agregar" style="margin-top:14px" onClick=${() => agregar(lineaDeServicioAMano())}>
          <${Ui} n="mas" /> Otro servicio (nombre y precio a mano)
        </button>
      </div>
    ` : html`
      <div class="cz-card">
        <h2 class="cz-card-h">Así queda el documento</h2>
        <p class="cz-card-s">Revísalo. Guárdalo para que quede en el historial con su folio, o mándalo directo por WhatsApp o en PDF. Al guardarse se congela: aunque mañana suba una tarifa, esta cotización seguirá diciendo lo mismo.</p>
        <${Campo} label="Notas para el cliente (opcional)" ancho="full">
          ${(id) => html`<textarea id=${id} class="cz-textarea" maxlength="2000" value=${ctx.notas}
            placeholder="Vigencia, condiciones especiales, contacto en obra…" onInput=${(e) => setCtx({ ...ctx, notas: e.currentTarget.value })}></textarea>`}
        <//>
        ${yaGuardada ? html`<div style="margin-top:14px"><${Aviso}><b>Guardada con folio ${guardada.folio}.</b> Ya está en el historial.<//></div>` : null}
        <${Compartir} datos=${datosDoc(yaGuardada ? guardada.folio : '', yaGuardada ? guardada.fecha : null)}
          huella=${huella + (yaGuardada ? guardada.folio : '')} />
        ${error ? html`<div style="margin-top:14px"><${Aviso} tono="bad">${error}<//></div>` : null}
        <div class="cz-preview" style="margin-top:16px"
          dangerouslySetInnerHTML=${{ __html: `<style>${DOCUMENTO_CSS}</style>${documentoCuerpo(datosDoc(yaGuardada ? guardada.folio : '', yaGuardada ? guardada.fecha : null))}` }}></div>
      </div>
    `}

    <div class="cz-barra" role="region" aria-label="Total y siguiente paso">
      <div class="cz-barra-in">
        ${tocado && faltante ? html`<${Aviso} tono="bad">${faltante}<//>` : null}
        ${paso === 'armar' ? html`<div class="cz-barra-fila">
            <div class="cz-barra-total"><span>Total con IVA</span><b>${money(calc.total)}</b></div>
            <button type="button" class="cz-btn primary" onClick=${avanzar}>Cotización <${Ui} n="flecha" /></button>
          </div>`
        : html`<div class="cz-barra-fila" data-final="1">
            <button type="button" class="cz-btn ghost" onClick=${() => { setTocado(false); setPaso('armar'); }} disabled=${guardando}><${Ui} n="atras" /> Editar</button>
            ${yaGuardada
              ? html`<button type="button" class="cz-btn ghost" onClick=${onNueva}><${Ui} n="reiniciar" /> Nueva cotización</button>`
              : html`<button type="button" class="cz-btn primary" onClick=${guardar} disabled=${guardando}>
                  <${Ui} n="guardar" /> ${guardando ? 'Guardando…' : guardada ? 'Guardar cambios (folio nuevo)' : 'Guardar cotización'}</button>`}
          </div>`}
      </div>
    </div>
  </div>`;
}

/** El cliente, en una tarjeta compacta arriba de lo que se cotiza. */
function DatosCliente({ ctx, setCtx, cat, clientes, tocado, modoUnidad }) {
  const set = (patch) => setCtx({ ...ctx, ...patch });
  const malCliente = tocado && ctx.cliente.trim().length < 2;
  return html`<div class="cz-card cz-datos">
    <div class="cz-row">
      <${Campo} label="Cliente o empresa" req ancho="full" error=${malCliente ? 'Elige o escribe a nombre de quién va la cotización.' : null}>
        ${(id) => html`<${Combobox} id=${id} valor=${ctx.cliente} opciones=${clientes} placeholder="Busca o escribe el cliente…"
          invalido=${malCliente} onChange=${(v) => set({ cliente: v })} />`}
      <//>
    </div>
    <div class="cz-dos">
      <${Campo} label="Municipio" help="Define la zona del agua y los acarreos">
        ${(id) => html`<${Combobox} id=${id} valor=${ctx.municipio} opciones=${cat.municipios} placeholder="Ej. Apodaca"
          onChange=${(v) => set({ municipio: v })} />`}
      <//>
      <${Campo} label="Atención a">
        ${(id) => html`<${Texto} id=${id} valor=${ctx.atencion} placeholder="Ing. / Lic." onChange=${(v) => set({ atencion: v })} />`}
      <//>
    </div>
    ${modoUnidad ? html`<div class="cz-row">
      <${Campo} label="Presentar cantidades en" ancho="full" help="Cómo se ven las cantidades de la renta en el documento; el total no cambia.">
        ${(id) => html`<${Selector} id=${id} valor=${modoUnidad.valor} onChange=${modoUnidad.poner}
          opciones=${[{ valor: 'horas', texto: 'Horas (HRS)' }, { valor: 'dias', texto: 'Jornadas (JOR)' }]} />`}
      <//>
    </div>` : null}
  </div>`;
}

/** Qué falta para pasar al documento (o null). En el orden de la pantalla. */
function validar({ ctx, lineas, calc, zona }) {
  if (ctx.cliente.trim().length < 2) return 'Escribe a nombre de quién va la cotización.';
  if (lineas.some((l) => l.tipo === 'equipo' && l.dias < 1 && l.horas < 1)) return 'Hay equipos sin días ni horas: sin duración no se pueden cotizar.';
  if (!lineas.length) return 'Elige al menos una opción para continuar.';
  const aMano = lineas.filter((l) => l.tipo === 'servicio' && l.id === M.SERVICIO_A_MANO);
  if (aMano.some((l) => !l.nombre.trim())) return 'Ponle nombre a lo que escribiste a mano.';
  const sinPrecio = aMano.find((l) => num(l.precio) <= 0);
  if (sinPrecio) return `Captura el precio de ${sinPrecio.nombre.trim() || 'lo que escribiste a mano'}.`;
  if (zona) return `${zona} Si aun así se lleva, elige la zona a mano.`;
  if (!calc.renglones.length || calc.total <= 0) return 'La cotización está vacía: agrega partidas.';
  return null;
}

/**
 * Lleva la pantalla a lo primero que falta y deja el cursor ahí: un campo en
 * rojo, un obligatorio vacío o, si hay que elegir algo, la primera sección sin
 * nada elegido.
 */
function irALoQueFalta(raiz, aviso) {
  if (!raiz || !aviso) return;
  const visible = (el) => el.getClientRects().length > 0;
  const primero = (sel, cumple = () => true) => [...raiz.querySelectorAll(sel)].find((el) => visible(el) && cumple(el)) ?? null;
  const vacio = (el) => !(el.value ?? '').trim();
  const rojo = primero('.cz-err, [aria-invalid="true"]');
  let destino = rojo ? rojo.closest('.cz-field') ?? rojo : null;
  destino ??= primero('.cz-field[data-req] input, .cz-field[data-req] textarea', vacio)?.closest('.cz-field') ?? null;
  if (!destino && /^(elige|hay equipos)/i.test(aviso.trim())) {
    destino = /^hay equipos/i.test(aviso.trim())
      ? primero('.cz-line')
      : primero('.cz-card:not([data-opcional])', (c) => !!c.querySelector('.cz-pick') && !c.querySelector('.cz-pick[data-on="1"]'));
  }
  if (!destino) return;
  destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const control = destino.matches('input, textarea, button') ? destino : destino.querySelector('input:not([type=hidden]), textarea, select');
  control?.focus({ preventScroll: true });
}
