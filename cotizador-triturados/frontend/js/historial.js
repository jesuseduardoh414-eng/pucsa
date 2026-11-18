import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { api } from './api.js';
import { Aviso } from './piezas.js';
import { Compartir } from './compartir.js';
import { DOCUMENTO_CSS, documentoCuerpo } from './documento.js';
import { fechaCorta, money } from './formato.js';
import { Ui } from './iconos.js';

/** Las cotizaciones guardadas, de la más nueva a la más vieja. */
export function Historial({ ir }) {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(() => {
      api(`cotizaciones?q=${encodeURIComponent(q.trim())}`)
        .then((l) => { if (vigente) { setLista(l); setError(null); } })
        .catch((e) => { if (vigente) setError(e.message); });
    }, q ? 250 : 0);
    return () => { vigente = false; clearTimeout(t); };
  }, [q]);

  return html`<div class="cz">
    <div class="cz-card">
      <h2 class="cz-card-h">Cotizaciones guardadas</h2>
      <p class="cz-card-s">Cada una se guardó con su documento tal como se vio: ábrela para mandarla otra vez o cotiza sobre ella.</p>
      <input class="cz-input" type="search" placeholder="Busca por folio, cliente o municipio…" value=${q}
        onInput=${(e) => setQ(e.currentTarget.value)} aria-label="Buscar cotizaciones" />
      ${error ? html`<div style="margin-top:14px"><${Aviso} tono="bad">${error}<//></div>` : null}
      <div class="hist">
        ${lista === null && !error ? html`<p class="hist-vacio">Cargando…</p>` : null}
        ${lista && !lista.length ? html`<p class="hist-vacio">${q ? 'Nada coincide con la búsqueda.' : 'Aún no hay cotizaciones guardadas.'}</p>` : null}
        ${(lista ?? []).map((c) => html`<button type="button" key=${c.id} class="hist-fila" onClick=${() => ir(`#/historial/${c.id}`)}>
          <span class="hist-info"><b>${c.folio}</b><span>${[c.cliente || c.obra || '—', c.municipio, fechaCorta(c.fecha)].filter(Boolean).join(' · ')}</span>
            ${c.titulo ? html`<small>${c.titulo}</small>` : null}</span>
          <span class="hist-tot">${money(c.total)}</span>
          <${Ui} n="flecha" />
        </button>`)}
      </div>
    </div>
  </div>`;
}

/** Una cotización guardada: su documento congelado, para mandarlo otra vez. */
export function VistaGuardada({ id, ir, usarComoBase }) {
  const [cot, setCot] = useState(null);
  const [error, setError] = useState(null);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    api(`cotizaciones/${id}`).then(setCot).catch((e) => setError(e.message));
  }, [id]);

  async function borrar() {
    if (!confirm(`¿Borrar la cotización ${cot.folio}? No se puede deshacer.`)) return;
    setBorrando(true);
    try {
      await api(`cotizaciones/${id}`, { method: 'DELETE' });
      ir('#/historial');
    } catch (e) {
      setError(e.message);
      setBorrando(false);
    }
  }

  if (error) return html`<div class="cz"><${Aviso} tono="bad">${error}<//>
    <p><button type="button" class="cz-btn ghost" onClick=${() => ir('#/historial')}><${Ui} n="atras" /> Volver al historial</button></p></div>`;
  if (!cot) return html`<div class="cz"><p class="hist-vacio">Cargando…</p></div>`;

  const datos = { ...cot.documento, folio: cot.folio, fecha: cot.fecha };
  return html`<div class="cz">
    <div class="cz-card">
      <h2 class="cz-card-h">Cotización ${cot.folio}</h2>
      <p class="cz-card-s">${cot.documento?.legado
        ? 'Del sistema anterior. Se ve tal como se cotizó.'
        : 'Guardada el ' + fechaCorta(cot.fecha) + '. Se ve tal como se guardó, aunque las tarifas hayan cambiado.'}</p>
      <${Compartir} datos=${datos} huella=${`guardada-${cot.id}`} />
      <div class="cz-preview" style="margin-top:16px" dangerouslySetInnerHTML=${{ __html: `<style>${DOCUMENTO_CSS}</style>${documentoCuerpo(datos)}` }}></div>
    </div>
    <div class="cz-barra">
      <div class="cz-barra-fila" data-final="1">
        <button type="button" class="cz-btn ghost" onClick=${() => ir('#/historial')}><${Ui} n="atras" /> Historial</button>
        <button type="button" class="cz-btn ghost peligro" onClick=${borrar} disabled=${borrando}><${Ui} n="basura" /> Borrar</button>
        <button type="button" class="cz-btn primary" onClick=${() => usarComoBase(cot)}><${Ui} n="copiar" /> Cotizar sobre esta</button>
      </div>
    </div>
  </div>`;
}
