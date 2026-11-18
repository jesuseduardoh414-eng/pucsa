// =============================================================================
// CALCULADORAS DE MATERIAL: pavimento (material para una calle) y m³ ↔ toneladas.
//
// Son las de PUCSA Triturados (las mismas que llevó MAQSER24). Estimaciones por
// volumen, sin precio:
//  - Abundamiento: 1.30 (lo que crece el material suelto).
//  - Triturados: cada m³ × 1.65 = toneladas.
//  - Carpeta asfáltica: cada m³ × 1.30 × 1.80 = toneladas.
// =============================================================================
import { html, useState } from '../vendor/preact-htm.js';

export const ABUNDAMIENTO = 1.3;
export const FACTOR_TRITURADO = 1.65;
export const FACTOR_CARPETA = 1.8;

/** Lo que se escribe; vacío, negativo o texto cuenta como 0. Acepta coma decimal. */
export function numeroDe(valor) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export const cifra = (n) => (Number.isFinite(n) ? n : 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dato = (n) => (Number.isFinite(n) ? n : 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });

/** El espesor llega en cm y se pasa a metros (÷ 100) antes de los factores. */
export function materialesCalle(d) {
  const volumen = (cm) => d.area * (cm / 100);
  const subbase = volumen(d.subbase);
  const base = volumen(d.base);
  const carpeta = volumen(d.carpeta);
  const r = {
    subrasante: { compacto: volumen(d.subrasante), m3: volumen(d.subrasante) * ABUNDAMIENTO },
    subbase: { m3: subbase, t: subbase * FACTOR_TRITURADO * ABUNDAMIENTO },
    base: { m3: base, t: base * FACTOR_TRITURADO * ABUNDAMIENTO },
    carpeta: { m3: carpeta, t: carpeta * ABUNDAMIENTO * FACTOR_CARPETA },
  };
  return { ...r, totalT: r.subbase.t + r.base.t + r.carpeta.t };
}

export const MATERIALES_CONVERSION = {
  triturados: { nombre: 'Triturados', factor: FACTOR_TRITURADO, formula: '1.65', explicacion: 'Triturados: cada m³ se multiplica por 1.65.' },
  carpeta: { nombre: 'Carpeta asfáltica', factor: ABUNDAMIENTO * FACTOR_CARPETA, formula: '(1.30 × 1.80)', explicacion: 'Carpeta asfáltica: cada m³ se multiplica por 1.30 y después por 1.80.' },
};

export function convertir(material, aToneladas, valor) {
  const f = MATERIALES_CONVERSION[material].factor;
  return aToneladas ? valor * f : valor / f;
}

const whatsappLibre = (resumen) => `https://wa.me/?text=${encodeURIComponent(resumen)}`;

function Marco({ titulo, sub, children }) {
  return html`<div class="cz">
    <div class="cz-head"><div><h1 class="cz-title">${titulo}</h1><p class="cz-sub">${sub}</p></div></div>
    ${children}
  </div>`;
}

/** Cotizar, mandar por WhatsApp y copiar el resumen. */
function Acciones({ resumen, cotizar, vacio, nota }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumen);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt('Copia el resumen:', resumen);
    }
  }
  return html`<div class="cm-acciones">
    ${cotizar.map((c, i) => html`<a key=${c.href} href=${c.href} class=${`cz-btn ${i === 0 ? 'primary' : 'ghost'}`}>${c.texto}${i === 0 ? ' →' : ''}</a>`)}
    ${vacio ? null : html`<a href=${whatsappLibre(resumen)} target="_blank" rel="noopener noreferrer" class="cz-btn ghost">Mandar por WhatsApp</a>`}
    <button type="button" class="cz-btn ghost" onClick=${copiar} disabled=${vacio}><span aria-live="polite">${copiado ? '✓ Resumen copiado' : 'Copiar resumen'}</span></button>
  </div>
  ${nota ? html`<p class="cz-help" style="margin:10px 0 0">${nota}</p>` : null}`;
}

function CampoNumero({ id, etiqueta, unidad, ayuda, valor, alCambiar, placeholder }) {
  return html`<div class="cz-field">
    <label class="cz-lbl" for=${id}>${etiqueta}</label>
    <div class="cm-unidad">
      <input id=${id} class="cz-input" type="text" inputmode="decimal" autocomplete="off" value=${valor}
        placeholder=${placeholder ?? '0'} onInput=${(e) => alCambiar(e.currentTarget.value.replace(/[^0-9.,]/g, ''))} />
      <span aria-hidden="true">${unidad}</span>
    </div>
    ${ayuda ? html`<span class="cz-help">${ayuda}</span>` : null}
  </div>`;
}

const CAMPOS = [
  { clave: 'area', etiqueta: 'Superficie de la calle', unidad: 'm²', ayuda: 'Área total a pavimentar' },
  { clave: 'subrasante', etiqueta: 'Espesor de subrasante', unidad: 'cm', ayuda: 'Tierra de banco' },
  { clave: 'subbase', etiqueta: 'Espesor de subbase', unidad: 'cm', ayuda: 'Subbase hidráulica' },
  { clave: 'base', etiqueta: 'Espesor de base', unidad: 'cm', ayuda: 'Base hidráulica' },
  { clave: 'carpeta', etiqueta: 'Espesor de carpeta', unidad: 'cm', ayuda: 'Carpeta asfáltica' },
];
const EJEMPLO = { area: '1000', subrasante: '20', subbase: '20', base: '20', carpeta: '5' };
const VACIO = { area: '', subrasante: '', subbase: '', base: '', carpeta: '' };

/**
 * @param cotizar  (material) => { href, texto } | null — a qué cotizador de ESTE proyecto lleva cada material
 * @param nota     qué decir de lo que se cotiza en el otro proyecto
 */
export function CalculadoraPavimento({ cotizar, marca, nota }) {
  const [v, setV] = useState(EJEMPLO);
  const d = { area: numeroDe(v.area), subrasante: numeroDe(v.subrasante), subbase: numeroDe(v.subbase), base: numeroDe(v.base), carpeta: numeroDe(v.carpeta) };
  const m = materialesCalle(d);
  const materiales = [
    { nombre: 'Subrasante', tipo: 'Tierra de banco', cant: m.subrasante.m3, unidad: 'm³', sec: `Volumen compacto: ${cifra(m.subrasante.compacto)} m³`, formula: 'Área × (espesor ÷ 100) × 1.30 de abundamiento' },
    { nombre: 'Subbase hidráulica', tipo: 'Triturado', cant: m.subbase.t, unidad: 't', sec: `Volumen: ${cifra(m.subbase.m3)} m³`, formula: 'Área × (espesor ÷ 100) × 1.65 × 1.30' },
    { nombre: 'Base hidráulica', tipo: 'Triturado', cant: m.base.t, unidad: 't', sec: `Volumen: ${cifra(m.base.m3)} m³`, formula: 'Área × (espesor ÷ 100) × 1.65 × 1.30' },
    { nombre: 'Carpeta asfáltica', tipo: 'Mezcla asfáltica', cant: m.carpeta.t, unidad: 't', sec: `Volumen: ${cifra(m.carpeta.m3)} m³`, formula: 'Área × (espesor ÷ 100) × 1.30 × 1.80' },
  ];
  const resumen = [
    `${marca} · Material para una calle`,
    `Superficie: ${dato(d.area)} m²`,
    `Subrasante (tierra de banco, ${dato(d.subrasante)} cm): ${cifra(m.subrasante.m3)} m³`,
    `Subbase hidráulica (${dato(d.subbase)} cm): ${cifra(m.subbase.t)} t`,
    `Base hidráulica (${dato(d.base)} cm): ${cifra(m.base.t)} t`,
    `Carpeta asfáltica (${dato(d.carpeta)} cm): ${cifra(m.carpeta.t)} t`,
    `Total en toneladas: ${cifra(m.totalT)} t`,
  ].join('\n');

  return html`<${Marco} titulo="Calculadora de pavimento" sub="Escribe la superficie y el espesor de cada capa: el material sale al momento. Es una estimación por volumen, sin precio.">
    <section class="cz-card">
      <div class="cm-cabeza">
        <div><h2 class="cz-card-h">Datos de la calle</h2><p class="cz-card-s">Superficie en m² y espesores en centímetros.</p></div>
        <button type="button" class="cm-borrar" onClick=${() => setV(VACIO)}>Borrar todo</button>
      </div>
      <div class="cm-campos">
        ${CAMPOS.map((c) => html`<${CampoNumero} key=${c.clave} id=${`cm-${c.clave}`} etiqueta=${c.etiqueta} unidad=${c.unidad} ayuda=${c.ayuda}
          valor=${v[c.clave]} alCambiar=${(x) => setV((prev) => ({ ...prev, [c.clave]: x }))} />`)}
      </div>
    </section>
    <section class="cz-card">
      <h2 class="cz-card-h">Material que necesitas</h2>
      <p class="cz-card-s">Cambia mientras escribes.</p>
      <div class="cm-res" aria-live="polite">
        ${materiales.map((x) => html`<article key=${x.nombre} class="cm-mat">
          <div class="cm-mat-h"><b>${x.nombre}</b><span class="cm-tag">${x.tipo}</span></div>
          <p class="cm-cant">${cifra(x.cant)}<small>${x.unidad}</small></p>
          <p class="cm-sec">${x.sec}</p>
          <p class="cm-formula">${x.formula}</p>
        </article>`)}
      </div>
      <div class="cz-total cm-total">
        <div class="n"><span>Total en toneladas</span><b>${cifra(m.totalT)}<small>t</small></b></div>
        <p class="d">Subbase + base + carpeta asfáltica<br />(la subrasante va en m³)</p>
      </div>
      <${Acciones} resumen=${resumen} cotizar=${[cotizar('triturados'), cotizar('carpeta')].filter(Boolean)} vacio=${d.area === 0} nota=${nota} />
      <ul class="cm-como">
        <li>El espesor en centímetros se pasa a metros (÷ 100) antes de aplicar los factores.</li>
        <li><b>Subrasante:</b> × 1.30 de abundamiento, en m³ (la tierra de banco se pide por volumen).</li>
        <li><b>Subbase y base:</b> × 1.65 × 1.30, en toneladas. <b>Carpeta:</b> × 1.30 × 1.80, en toneladas.</li>
      </ul>
    </section>
  <//>`;
}

export function ConversorM3Ton({ cotizar, marca, nota }) {
  const [material, setMaterial] = useState('triturados');
  const [aToneladas, setAToneladas] = useState(true);
  const [valor, setValor] = useState('');
  const mat = MATERIALES_CONVERSION[material];
  const n = numeroDe(valor);
  const resultado = convertir(material, aToneladas, n);
  const de = aToneladas ? 'm³' : 't';
  const a = aToneladas ? 't' : 'm³';
  const resumen = `${marca} · ${mat.nombre}\n${dato(n)} ${de} = ${cifra(resultado)} ${a}`;
  const destino = cotizar(material);

  return html`<${Marco} titulo="Conversor de m³ a toneladas" sub="Triturados o carpeta asfáltica: escribe el volumen y salen las toneladas al momento. También al revés.">
    <section class="cz-card cm-angosto">
      <h2 class="cz-card-h">${aToneladas ? 'De metros cúbicos a toneladas' : 'De toneladas a metros cúbicos'}</h2>
      <p class="cz-card-s">Elige el material y escribe la cantidad.</p>
      <div class="cm-conv-top">
        <span class="cz-lbl">Material</span>
        <div class="cz-chips" role="radiogroup">
          ${Object.keys(MATERIALES_CONVERSION).map((k) => html`<button key=${k} type="button" role="radio" aria-checked=${material === k ? 'true' : 'false'}
            class="cz-chip" data-on=${material === k ? '1' : undefined} onClick=${() => setMaterial(k)}>${MATERIALES_CONVERSION[k].nombre}</button>`)}
        </div>
      </div>
      <div class="cm-conv-top">
        <span class="cz-lbl">Convertir</span>
        <div class="cm-sentido" role="radiogroup">
          ${[true, false].map((haciaT) => html`<button key=${String(haciaT)} type="button" role="radio" aria-checked=${aToneladas === haciaT ? 'true' : 'false'}
            data-on=${aToneladas === haciaT ? '1' : undefined} onClick=${() => setAToneladas(haciaT)}>${haciaT ? 'De m³ a toneladas' : 'De toneladas a m³'}</button>`)}
        </div>
      </div>
      <${CampoNumero} id="cm-valor" etiqueta=${aToneladas ? '¿Cuántos m³?' : '¿Cuántas toneladas?'} unidad=${de}
        ayuda=${`Escribe ${aToneladas ? 'el volumen' : 'las toneladas'} de ${material === 'triturados' ? 'triturado' : 'carpeta asfáltica'}.`}
        valor=${valor} alCambiar=${setValor} placeholder=${aToneladas ? 'Ej. 25' : 'Ej. 41.25'} />
      <div class="cz-total cm-total" aria-live="polite">
        <div class="n"><span>Resultado estimado</span><b>${cifra(resultado)}<small>${a}</small></b></div>
        <p class="d">${dato(n)} ${de} ${aToneladas ? '×' : '÷'} ${mat.formula} = ${cifra(resultado)} ${a}</p>
      </div>
      <p class="cz-note" style="margin-top:12px">${aToneladas ? mat.explicacion : `${mat.nombre}: las toneladas se dividen entre ${mat.formula}.`}</p>
      <${Acciones} resumen=${resumen} cotizar=${destino ? [destino] : []} vacio=${n === 0} nota=${destino ? null : nota} />
    </section>
  <//>`;
}
