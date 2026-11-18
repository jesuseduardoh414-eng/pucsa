import { html, useRef, useState, useMemo } from '../vendor/preact-htm.js';
import { Icono, Ui } from './iconos.js';

let contadorIds = 0;
/** Un id estable por componente (para enlazar etiqueta y control). */
export function useId() {
  const ref = useRef(null);
  if (ref.current === null) ref.current = `cz${++contadorIds}`;
  return ref.current;
}

/** Etiqueta + control. `children` puede ser una función que recibe el id del control. */
export function Campo({ label, req, help, error, ancho, children }) {
  const id = useId();
  const enlazada = typeof children === 'function';
  return html`<div class=${`cz-field${ancho === 'full' ? ' full' : ''}`} data-req=${req ? '1' : undefined}>
    <label class="cz-lbl" for=${enlazada ? id : undefined}>${label}${req ? html`<span class="req"> *</span>` : null}</label>
    ${enlazada ? children(id) : children}
    ${error ? html`<span class="cz-err">${error}</span>` : help ? html`<span class="cz-help">${help}</span>` : null}
  </div>`;
}

/**
 * Cantidad entera que se escribe (viajes, días, horas, equipos, piezas…).
 * Sin − ni + (como MAQSER24 desde 2026-11-12: «solo anotar el total, en todos
 * los campos; mejor que el usuario lo escriba»). Mientras se escribe guarda el
 * texto tal cual (puede quedar vacío); al salir muestra la cantidad real. Al
 * tocarlo se selecciona todo, para escribir encima.
 */
export function Contador({ valor, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, ariaLabel, id }) {
  const acotar = (v) => Math.min(max, Math.max(min, v));
  const [texto, setTexto] = useState(null);
  return html`<input id=${id} class="cz-input cz-cant" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label=${ariaLabel}
    value=${texto ?? String(valor)}
    onFocus=${(e) => e.currentTarget.select()}
    onInput=${(e) => {
      const t = e.currentTarget.value.replace(/\D/g, '').slice(0, 9);
      setTexto(t);
      const v = parseInt(t, 10);
      if (!Number.isNaN(v)) onChange(acotar(v));
    }}
    onBlur=${() => setTexto(null)} />`;
}

/**
 * Número de texto libre (toneladas, precios). Guarda una CADENA: validar en
 * cada tecla no deja escribir "0.5" (al teclear el punto se borraba).
 */
export function NumeroTexto({ valor, onChange, placeholder, ariaLabel, decimal, id, invalido }) {
  return html`<input id=${id} class="cz-input" type="text" inputmode=${decimal ? 'decimal' : 'numeric'} autocomplete="off"
    aria-label=${ariaLabel} aria-invalid=${invalido ? 'true' : undefined} placeholder=${placeholder} value=${valor}
    onInput=${(e) => {
      let t = e.currentTarget.value.replace(',', '.').replace(decimal ? /[^0-9.]/g : /\D/g, '');
      const i = t.indexOf('.');
      if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
      if (t !== e.currentTarget.value) e.currentTarget.value = t;
      onChange(t);
    }} />`;
}

export function Texto({ valor, onChange, placeholder, id, max = 190, autoFocus, invalido }) {
  return html`<input id=${id} class="cz-input" type="text" maxlength=${max} placeholder=${placeholder} value=${valor}
    autofocus=${autoFocus} aria-invalid=${invalido ? 'true' : undefined} onInput=${(e) => onChange(e.currentTarget.value)} />`;
}

/** Selector nativo con el estilo del cotizador. */
export function Selector({ valor, onChange, opciones, placeholder, id, ariaLabel, invalido }) {
  return html`<select id=${id} class="cz-select" aria-label=${ariaLabel} aria-invalid=${invalido ? 'true' : undefined} value=${valor}
    onChange=${(e) => onChange(e.currentTarget.value)}>
    ${placeholder ? html`<option value="" disabled selected=${!valor}>${placeholder}</option>` : null}
    ${opciones.map((o) => html`<option value=${o.valor} selected=${o.valor === valor}>${o.texto}</option>`)}
  </select>`;
}

/**
 * Buscador con lista (cliente, municipio). Admite texto libre: la cobertura
 * cambia y la lista va detrás. Sin <datalist>, que en Windows abría una lista
 * blanca del sistema sobre el tema oscuro.
 */
export function Combobox({ valor, onChange, opciones, placeholder, id, invalido }) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const filtradas = useMemo(() => {
    const q = String(valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lista = opciones.filter((o) => !q || o.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
    return lista.slice(0, 60);
  }, [valor, opciones]);
  const elegir = (o) => { onChange(o); setAbierto(false); setActivo(-1); };
  return html`<div class="cz-combo">
    <input id=${id} class="cz-input" type="text" role="combobox" aria-expanded=${abierto ? 'true' : 'false'} autocomplete="off"
      aria-invalid=${invalido ? 'true' : undefined} placeholder=${placeholder} value=${valor} maxlength="190"
      onFocus=${() => setAbierto(true)} onClick=${() => setAbierto(true)}
      onBlur=${() => setTimeout(() => setAbierto(false), 120)}
      onInput=${(e) => { onChange(e.currentTarget.value); setAbierto(true); setActivo(-1); }}
      onKeyDown=${(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(filtradas.length - 1, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(0, a - 1)); }
        else if (e.key === 'Enter' && abierto && activo >= 0 && filtradas[activo]) { e.preventDefault(); elegir(filtradas[activo]); }
        else if (e.key === 'Escape') setAbierto(false);
      }} />
    ${abierto && filtradas.length && !(filtradas.length === 1 && filtradas[0] === valor) ? html`<ul class="cz-combo-lista" role="listbox">
      ${filtradas.map((o, i) => html`<li role="option" aria-selected=${i === activo} data-on=${i === activo ? '1' : undefined}
        onMouseDown=${(e) => { e.preventDefault(); elegir(o); }}>${o}</li>`)}
    </ul>` : null}
  </div>`;
}

export function Chip({ on, onClick, children }) {
  return html`<button type="button" class="cz-chip" data-on=${on ? '1' : '0'} aria-pressed=${on ? 'true' : 'false'} onClick=${onClick}>${children}</button>`;
}

/**
 * Tarjeta del catálogo. `alternar`: el clic elige y vuelve a quitar.
 * `agregar`: siempre añade. `opcion`: una entre varias, con palomita.
 * El "+" de la esquina agrega OTRA partida igual (otra duración).
 */
export function Tarjeta({ icono, titulo, nota, n = 0, modo = 'alternar', deshabilitada = false, onClick, onAgregarOtra }) {
  const activa = n > 0;
  return html`<div class="cz-pick-wrap">
    <button type="button" class="cz-pick" data-on=${activa ? '1' : '0'} aria-pressed=${modo !== 'agregar' ? (activa ? 'true' : 'false') : undefined}
      disabled=${deshabilitada} onClick=${onClick}>
      <span class="ico"><${Icono} nombre=${icono} size=${30} /></span>
      <b>${titulo}</b>
      ${nota ? html`<span class="pu">${nota}</span>` : null}
      ${activa && modo === 'alternar' ? html`<span class="cz-pick-quitar"><${Ui} n="x" size=${12} /> Toca para quitar</span>` : null}
    </button>
    ${activa ? html`<span class="cz-pick-badges">
      ${onAgregarOtra ? html`<button type="button" class="cz-pick-mas" title="Agregar otra partida igual (para cotizarla con otra duración)"
        aria-label=${`Agregar otra partida de ${titulo}`} onClick=${onAgregarOtra}><${Ui} n="mas" size=${13} /></button>` : null}
      ${modo === 'opcion'
        ? html`<span class="cz-pick-n" aria-label=${`${titulo}: elegida`}><${Ui} n="check" size=${12} /></span>`
        : html`<span class="cz-pick-n" aria-label=${`${n} partidas de ${titulo}`}>${n}</span>`}
    </span>` : null}
  </div>`;
}

/** Una partida, con su desglose de dinero abajo. */
export function Linea({ icono, titulo, nota, insignia, onQuitar, children, dinero }) {
  return html`<div class="cz-line">
    <div class="cz-line-h">
      <span class="ico"><${Icono} nombre=${icono} size=${26} /></span>
      <span class="nm"><b>${titulo}</b>${nota ? html`<span>${nota}</span>` : null}</span>
      ${insignia ? html`<span class="cz-tier">${insignia}</span>` : null}
      <button type="button" class="cz-rm" aria-label="Quitar partida" onClick=${onQuitar}><${Ui} n="x" /></button>
    </div>
    <div class="cz-ctrl">${children}</div>
    ${dinero ? html`<div class="cz-money">${dinero}</div>` : null}
  </div>`;
}

export function Renglon({ texto, valor, fuerte }) {
  return html`<div class=${`mr${fuerte ? ' sub' : ''}`}><span>${texto}</span><span>${valor}</span></div>`;
}

export function Aviso({ tono, children }) {
  return html`<div class=${`cz-note${tono === 'bad' ? ' bad' : ''}`}>${children}</div>`;
}

/** Botón con el estilo del cotizador. */
export function Boton({ variante = 'primary', chico, children, ...props }) {
  return html`<button type="button" class=${`cz-btn ${variante}${chico ? ' sm' : ''}`} ...${props}>${children}</button>`;
}
