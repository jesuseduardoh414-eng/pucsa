// =============================================================================
// EL COTIZADOR DE TRITURADOS (una sola pantalla para armar y otra con el documento).
//
// Arriba los datos del cliente; debajo «¿Cómo lo quieres?» (planta, por viaje
// o pedido grande) y su sección; una barra con el total siempre a la vista.
// «Cotización →» lleva al documento, donde se elige con o sin factura, se
// guarda (con folio, al historial) y se manda por WhatsApp o en PDF.
// =============================================================================
import { html, useEffect, useMemo, useRef, useState } from '../vendor/preact-htm.js';
import * as M from './motor.js';
import { aLineas, aPartidas, CONTEXTO_VACIO, formaDe, lineaDeMaterial, lineaDeZona, nuevoUid, num } from './estado.js';
import { Aviso, Campo, Combobox, Texto } from './piezas.js';
import { Facturacion, PasoPedido } from './pasos.js';
import { DOCUMENTO_CSS, documentoCuerpo } from './documento.js';
import { Compartir } from './compartir.js';
import { money } from './formato.js';
import { Ui } from './iconos.js';
import { api } from './api.js';

export function Cotizador({ cat, clientes, base, onGuardada, onSucio, onNueva, guardarZona }) {
  const esEnObra = (id) => M.esEnObra(cat, id);
  const [lineas, setLineas] = useState(() => (base ? aLineas(base.partidas) : []));
  const [forma, setForma] = useState(() => formaDe(base ? aLineas(base.partidas) : [], esEnObra));
  const [ctx, setCtx] = useState(() => (base
    ? { cliente: base.cliente ?? '', obra: base.obra ?? '', atencion: base.atencion ?? '', municipio: base.municipio ?? '', notas: base.notas ?? '' }
    : { ...CONTEXTO_VACIO }));
  const [conIva, setConIva] = useState(base ? base.con_iva !== false : cat.iva_por_defecto !== false);
  const [paso, setPaso] = useState('armar');
  const [tocado, setTocado] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [guardada, setGuardada] = useState(null);
  const [nuevo, setNuevo] = useState(null);
  const raiz = useRef(null);

  const partidas = useMemo(() => aPartidas(lineas), [lineas]);
  const calc = useMemo(() => M.calcular(cat, partidas, { con_iva: conIva }), [cat, partidas, conIva]);
  const paraElegir = useMemo(() => M.soloVisibles(cat, lineas.map((l) => l.id ?? l.productoId)), [cat, lineas]);

  // ---- edición ----
  const quitar = (uid) => setLineas((prev) => prev.filter((l) => l.uid !== uid));
  const actualizar = (uid, patch) => setLineas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const zonaObra = () => M.zonaDelMunicipio(cat, ctx.municipio);

  /** Con qué entrega nace un material en cada forma: en planta, sin flete; en el grande, tolva y el lugar en blanco. */
  const entregaDe = (f, otro) => (otro
    ? { fleteTon: otro.fleteTon, fleteZona: otro.fleteZona, camion: otro.camion }
    : f === 'grande' ? { fleteTon: 0, fleteZona: '', camion: 'tolva' } : { fleteTon: 0, fleteZona: M.RECOGE_EN_PLANTA, camion: '' });

  /** Cambiar de forma conserva el material elegido y cambia solo cómo se entrega. La cal se queda igual. */
  const cambiarForma = (f) => {
    if (f === forma) return;
    setForma(f);
    const zona = zonaObra();
    setLineas((prev) => {
      const todos = prev.filter((l) => l.tipo === 'material');
      const viajes = prev.filter((l) => l.tipo === 'zona');
      const resto = prev.filter((l) => l.tipo !== 'material' && l.tipo !== 'zona');
      // Lo puesto en obra va solo en el pedido grande: se queda ahí y se quita al pasar a planta o por viaje.
      const cal = f === 'grande' ? todos.filter((l) => esEnObra(l.id)) : [];
      const materiales = todos.filter((l) => !esEnObra(l.id));
      if (f === 'viaje') {
        const ids = [...new Set([...viajes.map((l) => l.productoId), ...materiales.filter((l) => l.id !== 'custom').map((l) => l.id)])];
        const zonaId = viajes[0]?.zonaId || zona?.id || '';
        return [...resto, ...cal, ...ids.map((id) => viajes.find((l) => l.productoId === id) ?? { ...lineaDeZona(cat), productoId: id, zonaId })];
      }
      const baseMat = materiales.length ? materiales : [...new Set(viajes.map((l) => l.productoId))].map((id) => lineaDeMaterial(cat, id));
      return [...resto, ...cal, ...baseMat.map((l) => ({ ...l, ...entregaDe(f) }))];
    });
  };

  /** De quién hereda un material nuevo el camión y el lugar: de otro material o, si solo hay lo puesto en obra, de ese. */
  const entregaPrevia = (prev) =>
    prev.find((l) => l.tipo === 'material' && !esEnObra(l.id))
    ?? prev.find((l) => l.tipo === 'material' && esEnObra(l.id) && !!l.camion);

  /** «Otro material (nombre y precio a mano)»: hereda la entrega de los demás. */
  const agregarMaterial = () => {
    const uid = nuevoUid();
    setLineas((prev) => {
      const otro = entregaPrevia(prev);
      return [...prev, { uid, tipo: 'material', id: 'custom', nombre: '', precio: '', toneladas: '', ...entregaDe(forma, otro) }];
    });
    setNuevo(uid);
  };

  /** Tocar un material lo agrega (con la entrega de la forma) y tocarlo otra vez lo quita. */
  const alternarMaterial = (id) => {
    const uid = nuevoUid();
    setLineas((prev) => {
      if (prev.some((l) => l.tipo === 'material' && l.id === id)) return prev.filter((l) => !(l.tipo === 'material' && l.id === id));
      // Lo puesto en obra (solo en el pedido grande) toma el camión y el lugar del pedido como los demás.
      return [...prev, { ...lineaDeMaterial(cat, id), uid, ...entregaDe(forma, entregaPrevia(prev)) }];
    });
    setNuevo(uid);
  };

  /** Por viaje: tocar un material agrega su viaje (a la zona de los demás o la de la obra); otra vez, lo quita. */
  const alternarViaje = (productoId) => setLineas((prev) => {
    if (prev.some((l) => l.tipo === 'zona' && l.productoId === productoId)) return prev.filter((l) => !(l.tipo === 'zona' && l.productoId === productoId));
    const otro = prev.find((l) => l.tipo === 'zona');
    return [...prev, { ...lineaDeZona(cat), productoId, zonaId: otro?.zonaId || zonaObra()?.id || '' }];
  });

  /** El municipio guardado en una zona: los viajes sin zona la toman. */
  const guardarZonaMunicipio = async (municipio, zonaId) => {
    await guardarZona(municipio, zonaId);
    setLineas((prev) => prev.map((l) => (l.tipo === 'zona' && !l.zonaId ? { ...l, zonaId } : l)));
  };

  // ---- documento ----
  const datosDoc = (folio = '', fecha = null) => ({
    titulo: 'Cotización de triturados',
    folio, fecha,
    cliente: ctx.cliente.trim(), obra: ctx.obra.trim(), atencion: ctx.atencion.trim(), municipio: ctx.municipio.trim(),
    notas: ctx.notas.trim(),
    empresa: cat.empresa, firma: cat.firma, pago: cat.pago ?? null, saludo: cat.saludo,
    calc,
  });
  const huella = JSON.stringify(datosDoc());
  const yaGuardada = !!guardada && guardada.huella === huella;
  const sucio = lineas.length > 0 && !yaGuardada;
  useEffect(() => { onSucio?.(sucio); }, [sucio]);
  useEffect(() => () => onSucio?.(false), []);

  const faltante = useMemo(() => validar({ ctx, lineas, forma, calc, minimoCamion: M.faltaMinimoCamion(cat, partidas), esEnObra }), [ctx, lineas, forma, calc, cat, partidas]);

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
          tipo: 'triturados', cliente: ctx.cliente.trim(), obra: ctx.obra.trim(), atencion: ctx.atencion.trim(),
          municipio: ctx.municipio.trim(), notas: ctx.notas.trim(), categorias: ['triturados'], partidas, documento: datosDoc(),
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

  const docGuardado = yaGuardada ? datosDoc(guardada.folio, guardada.fecha) : datosDoc();

  return html`<div class="cz" ref=${raiz}>
    ${paso === 'armar' ? html`
      <${DatosCliente} ctx=${ctx} setCtx=${setCtx} cat=${cat} clientes=${clientes} tocado=${tocado} />
      <${PasoPedido} cat=${paraElegir} lineas=${lineas} forma=${forma} cambiarForma=${cambiarForma}
        alternarMaterial=${alternarMaterial} alternarViaje=${alternarViaje} agregarMaterial=${agregarMaterial}
        actualizar=${actualizar} quitar=${quitar} nuevo=${nuevo} tocado=${tocado} municipio=${ctx.municipio}
        guardarZona=${guardarZonaMunicipio} />
    ` : html`
      <div class="cz-card">
        <h2 class="cz-card-h">Así queda el documento</h2>
        <p class="cz-card-s">Revísalo. Guárdalo para que quede en el historial con su folio, o mándalo directo por WhatsApp o en PDF. Al guardarse se congela: aunque mañana suba un precio, esta cotización seguirá diciendo lo mismo.</p>
        <div class="cz-qty wide" style="margin-bottom:14px">
          <span class="cz-lbl">Facturación · cambia el total y las condiciones del documento</span>
          <${Facturacion} cat=${cat} conIva=${conIva} setConIva=${setConIva} />
        </div>
        <${Campo} label="Notas para el cliente (opcional)" ancho="full">
          ${(id) => html`<textarea id=${id} class="cz-textarea" maxlength="2000" value=${ctx.notas}
            placeholder="Vigencia, condiciones especiales, contacto en obra…" onInput=${(e) => setCtx({ ...ctx, notas: e.currentTarget.value })}></textarea>`}
        <//>
        ${yaGuardada ? html`<div style="margin-top:14px"><${Aviso}><b>Guardada con folio ${guardada.folio}.</b> Ya está en el historial.<//></div>` : null}
        <${Compartir} datos=${docGuardado} huella=${huella + (yaGuardada ? guardada.folio : '')} />
        ${error ? html`<div style="margin-top:14px"><${Aviso} tono="bad">${error}<//></div>` : null}
        <div class="cz-preview" style="margin-top:16px" dangerouslySetInnerHTML=${{ __html: `<style>${DOCUMENTO_CSS}</style>${documentoCuerpo(docGuardado)}` }}></div>
      </div>
    `}

    <div class="cz-barra" role="region" aria-label="Total y siguiente paso">
      <div class="cz-barra-in">
        ${tocado && faltante ? html`<${Aviso} tono="bad">${faltante}<//>` : null}
        ${paso === 'armar' ? html`<div class="cz-barra-fila">
            <div class="cz-barra-total"><span>Total ${calc.con_iva ? 'con IVA' : 'sin IVA'}</span><b>${money(calc.total)}</b></div>
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

function DatosCliente({ ctx, setCtx, cat, clientes, tocado }) {
  const set = (patch) => setCtx({ ...ctx, ...patch });
  const malCliente = tocado && ctx.cliente.trim().length < 2;
  const zona = M.zonaDelMunicipio(cat, ctx.municipio);
  return html`<div class="cz-card cz-datos">
    <div class="cz-row">
      <${Campo} label="Cliente o empresa" req ancho="full" error=${malCliente ? 'Elige o escribe a nombre de quién va la cotización.' : null}>
        ${(id) => html`<${Combobox} id=${id} valor=${ctx.cliente} opciones=${clientes} placeholder="Busca o escribe el cliente…"
          invalido=${malCliente} onChange=${(v) => set({ cliente: v })} />`}
      <//>
    </div>
    <div class="cz-dos">
      <${Campo} label="Municipio" help=${zona ? `Zona de flete: ${zona.nombre}` : 'Define la zona del flete por viaje'}>
        ${(id) => html`<${Combobox} id=${id} valor=${ctx.municipio} opciones=${cat.municipios} placeholder="Ej. Apodaca"
          onChange=${(v) => set({ municipio: v })} />`}
      <//>
      <${Campo} label="Atención a">
        ${(id) => html`<${Texto} id=${id} valor=${ctx.atencion} placeholder="Ing. / Lic." onChange=${(v) => set({ atencion: v })} />`}
      <//>
    </div>
  </div>`;
}

/** Qué falta para pasar al documento (o null), en el orden de la pantalla. */
function validar({ ctx, lineas, forma, calc, minimoCamion, esEnObra }) {
  if (ctx.cliente.trim().length < 2) return 'Escribe a nombre de quién va la cotización.';
  if (!lineas.length) return forma ? 'Elige al menos un material.' : 'Elige cómo lo quieres: lo recogen en planta, por viaje a la obra o pedido grande.';
  if (lineas.some((l) => l.tipo === 'material' && l.id === 'custom' && !l.nombre.trim())) return 'Ponle nombre al material que escribiste a mano.';
  if (lineas.some((l) => l.tipo === 'material' && l.id === 'custom' && num(l.precio) <= 0)) return 'Captura el precio por tonelada del material que escribiste a mano.';
  if (lineas.some((l) => l.tipo === 'material' && num(l.toneladas) <= 0)) return 'Captura las toneladas de cada material.';
  const grande = lineas.filter((l) => l.tipo === 'material' && !!l.camion);
  if (grande.some((l) => !l.fleteZona.trim() || l.fleteZona.trim() === M.RECOGE_EN_PLANTA)) return 'Escribe a dónde va el pedido grande.';
  if (minimoCamion) return minimoCamion;
  if (lineas.some((l) => l.tipo === 'zona' && (!l.zonaId || !l.productoId))) return 'Elige la zona y el material de cada viaje.';
  if (lineas.some((l) => l.tipo === 'banco' && num(l.m3) <= 0)) return 'Captura los m³ del material de banco.';
  if (!calc.renglones.length || calc.total <= 0) return 'La cotización está vacía: agrega partidas.';
  return null;
}

function irALoQueFalta(raiz, aviso) {
  if (!raiz || !aviso) return;
  const visible = (el) => el.getClientRects().length > 0;
  const primero = (sel, cumple = () => true) => [...raiz.querySelectorAll(sel)].find((el) => visible(el) && cumple(el)) ?? null;
  const vacio = (el) => !(el.value ?? '').trim();
  const rojo = primero('.cz-err, [aria-invalid="true"]');
  let destino = rojo ? rojo.closest('.cz-field') ?? rojo : null;
  destino ??= primero('.cz-field[data-req] input, .cz-field[data-req] textarea', vacio)?.closest('.cz-field') ?? null;
  if (!destino && /^elige/i.test(aviso.trim())) {
    destino = primero('.cz-card:not([data-opcional])', (c) => !!c.querySelector('.cz-pick') && !c.querySelector('.cz-pick[data-on="1"]'));
  }
  if (!destino) return;
  destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const control = destino.matches('input, textarea, button') ? destino : destino.querySelector('input:not([type=hidden]), textarea, select');
  control?.focus({ preventScroll: true });
}
