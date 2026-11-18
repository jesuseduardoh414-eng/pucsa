// =============================================================================
// EL DOCUMENTO DE COTIZACIÓN (HTML).
//
// Es lo que se ve en pantalla, lo que se guarda congelado y lo que sale en el
// PDF: una sola implementación, así el PDF que recibe el cliente es
// exactamente el que revisó quien lo mandó.
//
// Va siempre sobre papel blanco: aquí los colores son literales (el tema
// oscuro de la app no se imprime).
// =============================================================================
import { cantidad, esc, fechaLarga, money2 } from './formato.js';

/** La identidad de PUCSA Triturados en el documento: banda negra con el logo y acento naranja. */
export const MARCA = {
  logo: 'assets/logo-triturados-banda.png',
  mascota: null,
  acento: '#E87616',       // naranja PUCSA Triturados: líneas y la etiqueta del título
  acentoTinta: '#1a0d02',  // texto sobre el naranja
  acentoTexto: '#9a4a0c',  // títulos en naranja oscuro (se lee sobre blanco)
};

export const DOCUMENTO_CSS = `
.czdoc{ background:#fff; color:#15181c; font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
  font-size:12px; line-height:1.55; padding:34px 38px; box-sizing:border-box; container:czdoc / inline-size; }
.czdoc *{ box-sizing:border-box; }
.czdoc h4{ margin:0 0 6px; font-size:12px; font-weight:700; }
/* Encabezado en banda negra (el logo de PUCSA Triturados va sobre fondo negro). */
.czdoc .czdoc-hd{ display:flex; align-items:center; justify-content:space-between; gap:24px;
  background:#010101; border-bottom:4px solid var(--czdoc-accent); margin:-34px -38px 18px; padding:16px 38px; }
.czdoc .czdoc-logo img{ height:72px; width:auto; max-width:230px; object-fit:contain; display:block; }
.czdoc .czdoc-logo b{ font-size:22px; letter-spacing:-0.02em; color:#fff; }
.czdoc .czdoc-co{ text-align:right; font-size:10.5px; color:#c7ccd2; line-height:1.5; }
.czdoc .czdoc-co b{ display:block; font-size:13px; color:#fff; margin-bottom:3px; }
.czdoc .czdoc-kind{ display:inline-block; margin-top:8px; padding:3px 9px; border-radius:4px;
  background:var(--czdoc-accent); color:var(--czdoc-ink); font-size:9.5px; font-weight:800;
  letter-spacing:.09em; text-transform:uppercase; }
.czdoc .czdoc-meta{ display:grid; grid-template-columns:repeat(auto-fit,minmax(118px,1fr)); gap:1px;
  background:#e3e7eb; border:1px solid #e3e7eb; border-radius:6px; overflow:hidden; margin-bottom:16px; }
.czdoc .czdoc-meta .b{ background:#f7f9fb; padding:8px 11px; font-size:11.5px; font-weight:600; overflow-wrap:anywhere; }
.czdoc .czdoc-meta .b span{ display:block; font-size:9px; letter-spacing:.08em; text-transform:uppercase;
  color:#78818b; font-weight:700; margin-bottom:2px; }
.czdoc .czdoc-greet{ margin:0 0 16px; font-size:11.5px; color:#3d444c; }
.czdoc table{ width:100%; border-collapse:collapse; margin-bottom:14px; }
.czdoc thead th{ background:#1a1d22; color:#fff; font-size:9.5px; letter-spacing:.07em;
  text-transform:uppercase; padding:7px 8px; text-align:left; font-weight:700; }
.czdoc tbody td{ padding:7px 8px; border-bottom:1px solid #e8ebef; font-size:11px; vertical-align:top; }
.czdoc tbody tr.flete td{ color:#5a626b; font-size:10.5px; }
.czdoc td.r, .czdoc th.r{ text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.czdoc td.concepto{ font-weight:600; }
.czdoc td.pc{ color:#5a626b; font-style:italic; }
.czdoc tr.flete td.concepto{ font-weight:500; }
.czdoc .czdoc-tot{ margin-left:auto; width:262px; }
.czdoc .czdoc-tot .tr{ display:flex; justify-content:space-between; padding:5px 0; font-size:11.5px; font-variant-numeric:tabular-nums; }
.czdoc .czdoc-tot .tr.g{ border-top:3px solid var(--czdoc-accent); margin-top:4px; padding-top:8px;
  font-size:15px; font-weight:800; }
.czdoc .czdoc-note{ margin:14px 0 0; padding:9px 12px; border-left:3px solid var(--czdoc-accent);
  background:#f7f8fa; font-size:11px; color:#3d444c; }
.czdoc .czdoc-notas{ white-space:pre-line; }
.czdoc .czdoc-cond{ margin-top:14px; padding:11px 14px; background:#faf6f0; border:1px solid #eee0cd; border-radius:8px; break-inside:avoid; }
.czdoc .czdoc-cond h4{ font-size:10.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--czdoc-text); }
.czdoc .czdoc-cond ul{ margin:0; padding-left:16px; list-style:disc; }
.czdoc .czdoc-cond li{ font-size:10.5px; color:#544a3c; margin-bottom:3px; }
.czdoc .czdoc-sign{ display:flex; align-items:flex-end; justify-content:center; gap:16px; margin-top:28px; break-inside:avoid; }
.czdoc .czdoc-sign img{ width:70px; height:auto; display:block; }
.czdoc .czdoc-sign .who{ min-width:230px; border-top:1px solid #cfd3da; padding-top:7px; text-align:center; }
.czdoc .czdoc-sign b{ display:block; font-size:12px; }
.czdoc .czdoc-sign span{ font-size:10.5px; color:#5a626b; }
.czdoc .czdoc-foot{ margin-top:16px; text-align:center; font-size:9.5px; color:#8b939c; }
.czdoc .czdoc-pago{ margin-top:16px; padding:12px 14px; border:1px solid #e3e7eb; border-left:3px solid var(--czdoc-accent);
  border-radius:6px; background:#f7f9fb; break-inside:avoid; }
.czdoc .czdoc-pago h4{ font-size:10.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--czdoc-text); }
.czdoc .czdoc-pago-tit{ margin:0 0 8px; font-size:11.5px; font-weight:600; }
.czdoc .czdoc-pago-tit span{ color:#5a626b; font-weight:500; }
.czdoc .czdoc-pago-cuentas{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px; }
.czdoc .czdoc-pago-c{ background:#fff; border:1px solid #e3e7eb; border-radius:6px; padding:8px 11px; display:grid; gap:2px; font-size:11px; color:#5a626b; }
.czdoc .czdoc-pago-c b{ font-size:12px; color:#15181c; margin-bottom:2px; }
.czdoc .czdoc-pago-c i{ font-style:normal; font-weight:700; color:#15181c; }
.czdoc .czdoc-pago-nota{ margin:9px 0 0; font-size:11px; color:#3d444c; }
.czdoc .czdoc-pago-cont{ margin:3px 0 0; font-size:10.5px; color:#5a626b; }
@media screen and (max-width: 560px){ .czdoc{ padding:20px 16px; } .czdoc .czdoc-hd{ margin:-20px -16px 14px; padding:14px 16px; } }
/* En el celular el documento se acomoda a lo angosto (lo decide su propio ancho). */
@container czdoc (max-width: 520px){
  .czdoc .czdoc-hd{ flex-direction:column; align-items:stretch; gap:12px; padding-bottom:14px; margin-bottom:14px; }
  .czdoc .czdoc-logo img{ height:60px; }
  .czdoc .czdoc-co{ text-align:left; font-size:11px; }
  .czdoc .czdoc-meta{ grid-template-columns:1fr 1fr; }
  .czdoc .czdoc-meta .b{ font-size:12.5px; }
  .czdoc .czdoc-greet{ font-size:12.5px; }
  .czdoc table, .czdoc tbody{ display:block; width:100%; }
  .czdoc thead{ display:none; }
  .czdoc tbody{ border-top:2px solid #1a1d22; }
  .czdoc tbody tr{ display:grid; grid-template-columns:auto auto 1fr auto; column-gap:6px; row-gap:4px;
    grid-template-areas:"con con con con" "cant u pu imp"; align-items:baseline; padding:11px 0; border-bottom:1px solid #e8ebef; }
  .czdoc tbody td{ display:block; padding:0; border:0; }
  .czdoc tbody td.c-n{ display:none; }
  .czdoc tbody td.concepto{ grid-area:con; font-size:13px; line-height:1.4; }
  .czdoc tbody td.c-cant{ grid-area:cant; text-align:left; color:#5a626b; font-size:12px; }
  .czdoc tbody td.c-u{ grid-area:u; color:#5a626b; font-size:12px; }
  .czdoc tbody td.c-pu{ grid-area:pu; text-align:left; color:#5a626b; font-size:12px; }
  .czdoc tbody td.c-pu::before{ content:'× '; }
  .czdoc tbody td.c-pu.pc::before{ content:''; }
  .czdoc tbody td.c-imp{ grid-area:imp; font-size:13px; font-weight:700; color:#15181c; }
  .czdoc tbody tr.flete td.concepto{ font-size:12px; color:#5a626b; }
  .czdoc .czdoc-tot{ width:100%; }
  .czdoc .czdoc-tot .tr{ font-size:12.5px; }
  .czdoc .czdoc-tot .tr.g{ font-size:17px; }
  .czdoc .czdoc-note, .czdoc .czdoc-pago-tit, .czdoc .czdoc-pago-nota, .czdoc .czdoc-pago-c{ font-size:12px; }
  .czdoc .czdoc-cond li{ font-size:12px; line-height:1.5; margin-bottom:5px; }
  .czdoc .czdoc-sign{ flex-direction:column; align-items:center; }
}
`;

/** URL absoluta (la ventana del PDF y la impresión no comparten la base de la página). */
const absoluta = (ruta) => {
  try { return new URL(ruta, document.baseURI).href; } catch { return ruta; }
};

/**
 * El cuerpo del documento, ya escapado. `d` es el documento congelado
 * (título, cliente, empresa, firma, saludo, cálculo, pago…) más folio y fecha.
 */
export function documentoCuerpo(d) {
  const { calc, empresa, firma } = d;
  const m = MARCA;
  const fecha = d.fecha ? new Date(d.fecha) : new Date();
  const logo = d.logo === undefined ? absoluta(m.logo) : d.logo;

  // El número salta los fletes: el flete no es algo que el cliente pidió, es llevárselo.
  let n = 0;
  const filas = calc.renglones.map((r) => {
    const num = r.clase === 'flete' ? '' : String(++n);
    return `<tr class="${esc(r.clase)}"><td class="c-n">${num}</td><td class="concepto">${esc(r.concepto)}</td>
      <td class="c-u">${esc(r.unidad)}</td><td class="r c-cant">${cantidad(r.cantidad, r.unidad)}</td>
      ${r.porCotizar
        ? '<td class="r c-pu pc">Por cotizar</td><td class="r c-imp pc">—</td>'
        : `<td class="r c-pu">${money2(r.pu)}</td><td class="r c-imp">${money2(r.importe)}</td>`}</tr>`;
  }).join('');

  const totales = `<div class="czdoc-tot">
      <div class="tr"><span>Subtotal</span><span>${money2(calc.subtotal)}</span></div>
      ${calc.con_iva ? `<div class="tr"><span>I.V.A. ${Math.round(calc.iva_tasa * 100)}%</span><span>${money2(calc.iva)}</span></div>` : ''}
      <div class="tr g"><span>Total</span><span>${money2(calc.total)}</span></div>
    </div>${calc.renglones.some((r) => r.porCotizar)
      ? `<div class="czdoc-note">Lo marcado «Por cotizar» todavía no tiene precio de lista: ${esc(empresa.nombre)} le confirma su precio.</div>` : ''}`;

  // Cada línea fiscal solo si existe: "RFC: —" es peor que no mencionarlo.
  const datosEmpresa = [
    empresa.rfc ? `RFC: ${esc(empresa.rfc)}` : '',
    empresa.direccion ? esc(empresa.direccion) : '',
    [empresa.telefono ? `Tel. ${esc(empresa.telefono)}` : '', esc(empresa.correo)].filter(Boolean).join(' · '),
    empresa.web ? esc(empresa.web) : '',
  ].filter(Boolean).join('<br>');

  const meta = [
    ['Cliente', d.cliente], ['Obra', d.obra], ['Atención', d.atencion], ['Municipio', d.municipio],
    ['Folio', d.folio], ['Fecha', fechaLarga(fecha)],
  ]
    .filter(([, v]) => String(v ?? '').trim().length > 0)
    .map(([k, v]) => `<div class="b"><span>${esc(k)}</span>${esc(v)}</div>`)
    .join('');

  const condiciones = (calc.condiciones ?? []).map((b) =>
    `<div class="czdoc-cond"><h4>${esc(b.titulo)}</h4><ul>${b.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('');

  const notas = d.notas?.trim() ? `<div class="czdoc-note czdoc-notas"><b>Notas:</b> ${esc(d.notas.trim())}</div>` : '';

  // A dónde se paga: solo con algo que pagar y cuentas con banco y algún número.
  const pago = d.pago;
  const cuentas = (pago?.cuentas ?? []).filter((c) => String(c.banco).trim() && (String(c.cuenta).trim() || String(c.clabe).trim()));
  const pagoHtml = calc.total > 0 && pago && cuentas.length
    ? `<div class="czdoc-pago"><h4>Datos para el pago</h4>
        ${String(pago.titular).trim() || String(pago.rfc).trim()
          ? `<p class="czdoc-pago-tit">${esc(pago.titular)}${String(pago.rfc).trim() ? ` <span>· RFC ${esc(pago.rfc)}</span>` : ''}</p>` : ''}
        <div class="czdoc-pago-cuentas">${cuentas.map((c) => `<div class="czdoc-pago-c"><b>${esc(c.banco)}</b>${String(c.cuenta).trim() ? `<span>Cuenta <i>${esc(c.cuenta)}</i></span>` : ''}${String(c.clabe).trim() ? `<span>CLABE <i>${esc(c.clabe)}</i></span>` : ''}</div>`).join('')}</div>
        ${String(pago.nota ?? '').trim() ? `<p class="czdoc-pago-nota">${esc(pago.nota)}</p>` : ''}
        ${String(pago.telefono ?? '').trim() || String(pago.correo ?? '').trim()
          ? `<p class="czdoc-pago-cont">Dudas sobre pagos: ${[esc(pago.telefono), esc(pago.correo)].filter(Boolean).join(' · ')}</p>` : ''}
      </div>`
    : '';

  const firmaHtml = String(firma?.nombre ?? '').trim()
    ? `<div class="czdoc-sign">${m.mascota ? `<img src="${esc(absoluta(m.mascota))}" alt="">` : ''}<div class="who"><b>${esc(firma.nombre)}</b>
        <span>${[esc(firma.puesto), esc(firma.telefono)].filter(Boolean).join(' · ')}</span></div></div>`
    : '';

  return `<div class="czdoc" style="--czdoc-accent:${m.acento};--czdoc-ink:${m.acentoTinta};--czdoc-text:${m.acentoTexto}">
    <div class="czdoc-hd">
      <div class="czdoc-logo">${logo ? `<img src="${esc(logo)}" alt="${esc(empresa.nombre)}">` : `<b>${esc(empresa.nombre)}</b>`}<div class="czdoc-kind">${esc(d.titulo)}</div></div>
      <div class="czdoc-co"><b>${esc(empresa.nombre)}</b>${datosEmpresa}</div>
    </div>
    <div class="czdoc-meta">${meta}</div>
    <p class="czdoc-greet">${esc(d.saludo)}</p>
    <table><thead><tr><th>No.</th><th>Concepto</th><th>U.</th><th class="r">Cant.</th><th class="r">P.U.</th><th class="r">Importe</th></tr></thead>
      <tbody>${filas}</tbody></table>
    ${totales}
    ${pagoHtml}
    ${notas}
    ${condiciones}
    ${firmaHtml}
    <div class="czdoc-foot">${esc(empresa.nombre)}${empresa.web ? ` · ${esc(empresa.web)}` : ''}${d.folio ? ` · ${esc(d.folio)}` : ''}</div>
  </div>`;
}
