import { html, useState } from '../vendor/preact-htm.js';
import { camionDe, camionesDe, minimoCamionDe, precioZona, RECOGE_EN_PLANTA, zonaDe, zonaDelMunicipio } from './motor.js';
import { money, money2 } from './formato.js';
import { Campo, Chip, Contador, NumeroTexto, Selector, Tarjeta, Texto } from './piezas.js';
import { Icono, Ui } from './iconos.js';
import { num } from './estado.js';

/** Una sección: ícono, título, tarjetas para elegir, renglones y botón de agregar. */
function Bloque({ icono, titulo, desc, tarjetas, textoAgregar, onAgregar, vacio, pie, children }) {
  return html`<section class="cz-card cz-bloque" data-vacio=${vacio ? '1' : undefined}>
    <header class="cz-bloque-h">
      <span class="ico" aria-hidden="true"><${Icono} nombre=${icono} size=${26} /></span>
      <div><h2 class="cz-card-h">${titulo}</h2><p class="cz-card-s">${desc}</p></div>
    </header>
    ${tarjetas}
    ${vacio ? null : html`<div class="cz-filas">${children}</div>`}
    ${textoAgregar && onAgregar ? html`<button type="button" class="cz-agregar" onClick=${onAgregar}><${Ui} n="mas" /> ${textoAgregar}</button>` : null}
    ${pie}
  </section>`;
}

const Quitar = ({ onClick, que }) => html`<button type="button" class="cz-rm cz-fila-rm" aria-label=${`Quitar ${que}`} title="Quitar" onClick=${onClick}><${Ui} n="x" /></button>`;
const Importe = ({ texto, valor }) => html`<div class="cz-fila-imp"><span>${texto}</span><b>${valor}</b></div>`;

/** Todo lo de triturados: cómo lo quiere y, según eso, su sección. */
export function PasoPedido({ cat, lineas, forma, cambiarForma, alternarMaterial, alternarViaje, agregarMaterial, actualizar, quitar,
  nuevo, tocado, municipio, guardarZona }) {
  const materiales = lineas.filter((l) => l.tipo === 'material');
  const zonas = lineas.filter((l) => l.tipo === 'zona');
  const bancos = lineas.filter((l) => l.tipo === 'banco');
  const esEnObra = (id) => !!cat.productos.find((p) => p.id === id)?.en_obra;
  const enObra = cat.productos.filter((p) => p.en_obra && !p.oculto);
  const deTabulador = cat.productos.filter((p) => !p.en_obra && !p.oculto);
  const conEntrega = materiales.filter((l) => !esEnObra(l.id));
  const cuenta = (id) => materiales.filter((l) => l.id === id).length;

  const tarjetaEnObra = (p) => html`<${Tarjeta} key=${p.id} icono="material" titulo=${p.nombre}
    nota=${`${money(p.precio_ton)} / ton · puesta en obra`} n=${cuenta(p.id)} onClick=${() => alternarMaterial(p.id)} />`;
  // Lo puesto en obra solo sale en el pedido grande (`conEnObra`).
  const tarjetasPorTon = (conEnObra) => html`<div class="cz-cards" style=${`margin-bottom:${materiales.length ? 14 : 0}px`}>
    ${deTabulador.map((p) => html`<${Tarjeta} key=${p.id} icono="material" titulo=${p.nombre} nota=${`${money(p.precio_ton)} / ton`}
      n=${cuenta(p.id)} onClick=${() => alternarMaterial(p.id)} />`)}
    ${conEnObra ? enObra.map(tarjetaEnObra) : null}
  </div>`;
  const fila = (l) => html`<${FilaMaterial} key=${l.uid} cat=${cat} l=${l} actualizar=${actualizar} quitar=${quitar} abrir=${l.uid === nuevo} tocado=${tocado} />`;
  const filasEnObra = materiales.filter((l) => esEnObra(l.id)).map(fila);
  const zonaViaje = zonaDe(cat, zonas[0]?.zonaId ?? '') ?? zonaDelMunicipio(cat, municipio);
  const sinZona = guardarZona && forma === 'viaje' && String(municipio ?? '').trim() && !zonaDelMunicipio(cat, municipio)
    ? html`<${MunicipioSinZona} key=${municipio} cat=${cat} municipio=${municipio.trim()} guardar=${guardarZona} />` : null;

  return html`
    <${FormaEntrega} cat=${cat} forma=${forma} cambiar=${cambiarForma} />
    ${sinZona}
    ${forma === 'planta' ? html`<${Bloque} icono="banco" titulo="Lo recojo en planta"
        desc="Precio de lista por tonelada, cargado en planta (pedreras Escobedo), si mandas tu volteo, tolva o full. No incluye flete."
        textoAgregar="Otro material (nombre y precio a mano)" onAgregar=${agregarMaterial} vacio=${materiales.length === 0} tarjetas=${tarjetasPorTon(false)}>
        ${materiales.map(fila)}
      <//>` : null}
    ${forma === 'viaje' ? html`<${Bloque} icono="zona" titulo="Por viaje a mi obra"
        desc=${`${cat.nota_zona}. Elige el material y la zona de la obra; el precio del viaje ya incluye material y flete.`}
        vacio=${zonas.length === 0 && filasEnObra.length === 0}
        tarjetas=${html`<div class="cz-cards" style=${`margin-bottom:${zonas.length || filasEnObra.length ? 14 : 0}px`}>
          ${deTabulador.map((p) => {
            const pv = zonaViaje ? precioZona(cat, zonaViaje, p.id) : null;
            return html`<${Tarjeta} key=${p.id} icono="material" titulo=${p.nombre} nota=${pv ? `${money(pv)} / viaje` : 'por viaje · elige la zona'}
              n=${zonas.filter((l) => l.productoId === p.id).length} onClick=${() => alternarViaje(p.id)} />`;
          })}
        </div>`}>
        ${zonas.map((l) => html`<${FilaZona} key=${l.uid} cat=${cat} l=${l} actualizar=${actualizar} quitar=${quitar} tocado=${tocado} />`)}
        ${filasEnObra}
      <//>` : null}
    ${forma === 'grande' ? html`<${Bloque} icono="zona" titulo="Pedido grande: volteo, tolva o full"
        desc=${`Desde ${minimoCamionDe(cat)} toneladas. El material va a precio de lista por tonelada; el flete por tonelada se cotiza según el camión y el lugar de la obra.`}
        textoAgregar="Otro material (nombre y precio a mano)" onAgregar=${agregarMaterial} vacio=${materiales.length === 0} tarjetas=${tarjetasPorTon(true)}
        pie=${materiales.length ? html`<${EntregaCamion} cat=${cat} materiales=${materiales} porTon=${conEntrega} actualizar=${actualizar} tocado=${tocado} municipio=${municipio} />` : null}>
        ${materiales.map(fila)}
      <//>` : null}
    ${bancos.length ? html`<${Bloque} icono="banco" titulo="Material de banco, por m³"
        desc="El material de banco ya no se cotiza aquí. Este renglón viene de una cotización anterior." vacio=${false}>
        ${bancos.map((l) => html`<${FilaBanco} key=${l.uid} cat=${cat} l=${l} actualizar=${actualizar} quitar=${quitar} tocado=${tocado} />`)}
      <//>` : null}
  `;
}

/** Las tres formas, en tarjetas. Cambiar de forma conserva el material elegido. */
function FormaEntrega({ cat, forma, cambiar }) {
  return html`<section class="cz-card">
    <h2 class="cz-card-h">¿Cómo lo quieres?</h2>
    <p class="cz-card-s">Elige una forma; la cotización va de una sola.</p>
    <div class="cz-cards cz-opciones">
      <${Tarjeta} icono="banco" titulo="Lo recojo en planta" nota="Manda su camión · precio de lista" modo="opcion" n=${forma === 'planta' ? 1 : 0} onClick=${() => cambiar('planta')} />
      <${Tarjeta} icono="zona" titulo="Por viaje a mi obra" nota=${cat.nota_zona} modo="opcion" n=${forma === 'viaje' ? 1 : 0} onClick=${() => cambiar('viaje')} />
      <${Tarjeta} icono="material" titulo="Pedido grande" nota="Tolva 45-50 ton / full 90-100 ton" modo="opcion" n=${forma === 'grande' ? 1 : 0} onClick=${() => cambiar('grande')} />
    </div>
  </section>`;
}

/**
 * El pedido grande: camión y lugar, una sola vez para todo el material (va a
 * una obra). El lugar se escribe libre y el flete por tonelada también; sin
 * él, el documento dice que se confirma aparte. `materiales` son todos (el
 * camión y el lugar se ponen a todos); `porTon`, los que pagan flete y cuentan
 * para el mínimo (lo puesto en obra no: su flete va en su precio).
 */
function EntregaCamion({ cat, materiales, porTon, actualizar, tocado, municipio }) {
  const primero = porTon[0] ?? materiales[0];
  const aTodos = (patch) => materiales.forEach((l) => actualizar(l.uid, patch));
  const camion = camionDe(cat, primero.camion);
  const conFlete = porTon.length > 0;
  const ton = porTon.reduce((s, l) => s + num(l.toneladas), 0);
  const minimo = minimoCamionDe(cat);
  const fleteTon = primero.fleteTon;
  const lugar = primero.fleteZona.trim() === RECOGE_EN_PLANTA ? '' : primero.fleteZona;
  return html`<div class="cz-flete">
    <div class="cz-flete-h"><b>¿En qué camión y a dónde?</b><span>${conFlete ? 'El flete por tonelada depende del camión y del lugar de la obra.' : 'Llega puesto en tu obra: el flete ya va en su precio.'}</span></div>
    <div class="cz-cards cz-cards-2 cz-opciones">
      ${camionesDe(cat).map((c) => html`<${Tarjeta} key=${c.id} icono="zona" titulo=${c.nombre}
        nota=${c.detalle && !c.nombre.includes(c.detalle) ? c.detalle : undefined} modo="opcion" n=${primero.camion === c.id ? 1 : 0}
        onClick=${() => aTodos({ camion: c.id, fleteTon: 0 })} />`)}
    </div>
    <${Campo} label="¿A dónde va?" req error=${tocado && !lugar.trim() ? 'Escribe a dónde va: el lugar de la obra.' : null}>
      ${(id) => html`<${Texto} id=${id} max=${120} valor=${lugar} invalido=${tocado && !lugar.trim()}
        placeholder=${String(municipio ?? '').trim() ? `Ej. ${municipio.trim()}, parque industrial, colonia…` : 'Ej. parque industrial, colonia, municipio…'}
        onChange=${(v) => aTodos({ fleteZona: v })} />`}
    <//>
    ${conFlete ? html`<p class=${tocado && ton < minimo ? 'cz-err' : 'cz-help'} style="margin:0">
      ${ton < minimo ? `Llevas ${ton.toLocaleString('es-MX')} ton: el pedido grande es desde ${minimo}.` : `${ton.toLocaleString('es-MX')} ton en total.`}
    </p>
    <${Campo} label="Flete por tonelada" help="Escríbelo si ya lo sabes; si no, se confirma aparte.">
      <${NumeroTexto} decimal ariaLabel="flete por tonelada" placeholder="Ej. 150" valor=${fleteTon ? String(fleteTon) : ''}
        onChange=${(v) => aTodos({ fleteTon: num(v) })} />
    <//>` : null}
    ${conFlete && camion && lugar.trim()
      ? fleteTon > 0
        ? html`<${Importe} texto=${`Flete en ${camion.nombre.toLowerCase()} · ${ton.toLocaleString('es-MX')} ton × ${money(fleteTon)}`} valor=${money(fleteTon * ton)} />`
        : html`<p class="cz-help" style="margin:0">El flete en ${camion.nombre.toLowerCase()} se confirma aparte: todavía no está en este total.</p>`
      : null}
  </div>`;
}

const OTRO = 'custom';

function FilaMaterial({ cat, l, actualizar, quitar, abrir, tocado }) {
  const esOtro = l.id === OTRO;
  const prod = cat.productos.find((p) => p.id === l.id);
  const precio = num(l.precio) || prod?.precio_ton || 0;
  const ton = num(l.toneladas);
  const minimo = prod?.en_obra ? Number(prod.minimo_ton ?? 0) : 0;
  const cobradas = Math.max(ton, minimo);
  return html`<div class="cz-fila">
    ${prod
      ? html`<${Campo} label="Material">${(id) => html`<input id=${id} class="cz-input" value=${prod.nombre} readonly tabindex="-1" />`}<//>`
      : html`<${Campo} label="Nombre del material" req error=${tocado && !l.nombre.trim() ? 'Escribe el nombre' : null}>
          ${(id) => html`<${Texto} id=${id} placeholder="Ej. Grava 8" max=${120} autoFocus=${abrir} valor=${l.nombre}
            invalido=${tocado && !l.nombre.trim()} onChange=${(v) => actualizar(l.uid, { nombre: v })} />`}
        <//>`}
    <${Campo} label="Toneladas" req help=${minimo > 0 ? `Mínimo ${minimo.toLocaleString('es-MX')} ton · puesta en obra` : undefined}
      error=${tocado && ton <= 0 ? 'Captura las toneladas' : null}>
      <${NumeroTexto} decimal ariaLabel="toneladas" placeholder="Ej. 30" valor=${l.toneladas} invalido=${tocado && ton <= 0}
        onChange=${(v) => actualizar(l.uid, { toneladas: v })} />
    <//>
    <${Campo} label="Precio / ton" req=${esOtro} help=${prod ? `Tabulador: ${money(prod.precio_ton)}` : 'Precio acordado'}
      error=${tocado && esOtro && num(l.precio) <= 0 ? 'Captura el precio' : null}>
      <${NumeroTexto} decimal ariaLabel="precio por tonelada" valor=${l.precio} invalido=${tocado && esOtro && num(l.precio) <= 0}
        onChange=${(v) => actualizar(l.uid, { precio: v })} />
    <//>
    <${Importe} texto=${`${cobradas.toLocaleString('es-MX')} ton${ton > 0 && cobradas > ton ? ' (mínimo)' : ''} × ${money2(precio)}${prod?.en_obra ? ' · puesta en obra' : ''}`}
      valor=${money(precio * (ton > 0 ? cobradas : 0))} />
    <${Quitar} onClick=${() => quitar(l.uid)} que=${l.nombre || 'material'} />
  </div>`;
}

function FilaZona({ cat, l, actualizar, quitar, tocado }) {
  const z = zonaDe(cat, l.zonaId);
  const precio = precioZona(cat, z, l.productoId) ?? 0;
  return html`<div class="cz-fila">
    <${Campo} label="Zona de entrega" req error=${tocado && !l.zonaId ? 'Elige la zona' : null}>
      ${(id) => html`<${Selector} id=${id} ariaLabel="Zona de entrega" valor=${l.zonaId} placeholder="Elige la zona" invalido=${tocado && !l.zonaId}
        opciones=${cat.zonas.map((zz) => ({ valor: zz.id, texto: zz.nombre }))} onChange=${(v) => actualizar(l.uid, { zonaId: v })} />`}
    <//>
    <${Campo} label="Material" req>
      ${(id) => html`<${Selector} id=${id} ariaLabel="Material del viaje" valor=${l.productoId}
        opciones=${cat.productos.filter((p) => !p.en_obra).map((p) => {
          const pv = precioZona(cat, z, p.id);
          return { valor: p.id, texto: pv ? `${p.nombre} · ${money(pv)}/viaje` : p.nombre };
        })} onChange=${(v) => actualizar(l.uid, { productoId: v })} />`}
    <//>
    <div class="cz-qty"><span class="cz-lbl">Viajes</span>
      <${Contador} valor=${l.viajes} min=${1} max=${999} ariaLabel="viajes" onChange=${(v) => actualizar(l.uid, { viajes: v })} /></div>
    <${Importe} texto=${`${l.viajes} × ${money(precio)} por viaje`} valor=${money(precio * l.viajes)} />
    <${Quitar} onClick=${() => quitar(l.uid)} que="viaje" />
  </div>`;
}

function FilaBanco({ cat, l, actualizar, quitar, tocado }) {
  const b = cat.material_banco ?? { nombre: 'Material de banco', camion_m3: 14, precio_m3_default: 0 };
  const m3 = num(l.m3);
  const precio = num(l.precioM3) || b.precio_m3_default;
  return html`<div class="cz-fila">
    <${Campo} label="Metros cúbicos" req error=${tocado && m3 <= 0 ? 'Captura los m³' : null}>
      <${NumeroTexto} decimal ariaLabel="metros cúbicos" valor=${l.m3} onChange=${(v) => actualizar(l.uid, { m3: v })} />
    <//>
    <${Campo} label="Precio / m³" help="Material y flete">
      <${NumeroTexto} decimal ariaLabel="precio por metro cúbico" valor=${l.precioM3} onChange=${(v) => actualizar(l.uid, { precioM3: v })} />
    <//>
    <${Importe} texto=${`${m3.toLocaleString('es-MX')} m³ × ${money2(precio)}`} valor=${money(precio * m3)} />
    <${Quitar} onClick=${() => quitar(l.uid)} que=${b.nombre.toLowerCase()} />
  </div>`;
}

/** Un municipio que no está en ninguna zona de flete: se elige su zona una vez y se guarda. */
function MunicipioSinZona({ cat, municipio, guardar }) {
  const [zonaId, setZonaId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  return html`<section class="cz-card">
    <h2 class="cz-card-h">${municipio} no está en ninguna zona de flete</h2>
    <p class="cz-card-s">Elige en qué zona queda. Se guarda y la próxima vez su zona sale sola.</p>
    <div class="cz-sinzona">
      <${Selector} ariaLabel=${`Zona de ${municipio}`} valor=${zonaId} placeholder=${`¿En qué zona queda ${municipio}?`}
        opciones=${cat.zonas.map((z) => ({ valor: z.id, texto: z.nombre }))} onChange=${(v) => { setZonaId(v); setError(null); }} />
      <button type="button" class="cz-btn ghost" disabled=${!zonaId || guardando} onClick=${async () => {
        setGuardando(true);
        setError(null);
        try { await guardar(municipio, zonaId); } catch (e) { setError(e.message || 'No se pudo guardar. Inténtalo otra vez.'); } finally { setGuardando(false); }
      }}><${Ui} n="mas" /> ${guardando ? 'Guardando…' : `Guardar ${municipio} en esa zona`}</button>
    </div>
    ${error ? html`<p class="cz-err" style="margin:8px 0 0">${error}</p>` : null}
  </section>`;
}

/** Con o sin factura: cambia el total y las condiciones del documento. */
export function Facturacion({ cat, conIva, setConIva }) {
  return html`<div class="cz-chips" role="group" aria-label="Facturación">
    <${Chip} on=${conIva} onClick=${() => setConIva(true)}>Con factura · IVA ${Math.round(cat.iva * 100)}%<//>
    <${Chip} on=${!conIva} onClick=${() => setConIva(false)}>Remisionado · sin IVA<//>
  </div>`;
}
