import { html } from '../vendor/preact-htm.js';

// Íconos de trazo que heredan el color del texto: el mismo sirve apagado en una
// tarjeta y encendido (amarillo PUCSA) cuando la tarjeta está elegida.
const TRAZOS = {
  calculadora: 'M12 5h16a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z M14 10h12v6H14z M15 22h0 M20 22h0 M25 22h0 M15 28h0 M20 28h0 M25 28h0',
  conversion: 'M7 14h24 M26 9l5 5-5 5 M33 26H9 M14 21l-5 5 5 5',
  excavadora: 'M4 27h19a3 3 0 0 1 0 6H4a3 3 0 0 1 0-6z M9 27v-6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6 M11 15h6 M18 20l8-4 6 4 M32 20l1.6 5-5 1.5-1.2-4',
  martillo_exc: 'M4 27h19a3 3 0 0 1 0 6H4a3 3 0 0 1 0-6z M9 27v-6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6 M18 20l9-3.5 M27 15.5l2.2 1v6.5l-2.2 1z M28.1 24v6',
  retro: 'M8 25l2-6h9l2 4 M4 21l4-1 1 3 M4 24V19l3-1 M21 20l7-3 4 3 M32 20l1 4-4 1',
  retro_mart: 'M8 25l2-6h9l2 4 M4 22l3.5-1.2 1 3 M21 20l7-2.5 M28 16.5l2 1v6l-2 1z M29 24.5v5',
  moto: 'M6 25l3-6h4l3 3 M13 22h14v-4l4 1v6 M12 27h13 M12 27l1-3',
  vibro: 'M19 22h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-6 M22 22v-4h5l1 4',
  minicargador: 'M7 26v-7a2 2 0 0 1 2-2h12v9z M10 17v-6h8l1 6 M17 12l10 8 M27 20v6h6l-1.5-7z',
  pipa: 'M14 16h13a4.5 4.5 0 0 1 0 9H14z M14 25H8a2 2 0 0 1-2-2v-4h6 M6 19l2-3h4v3 M14 30h12',
  agua: 'M20 6c6 8 9 12 9 17a9 9 0 0 1-18 0c0-5 3-9 9-17z M15 24a5 5 0 0 0 5 4',
  retiro: 'M6 26v-4h4l3-3 8 3v4 M6 22l2-3h3 M14 19l11-7 5 9-3 5H14 M17 15l2 3 M22 13l2 3',
  material: 'M3 31h34 M6 31l8-13 8 13 M20 31l6-9 6 9',
  zona: 'M6 26v-4h4l3-3 8 3v4 M6 22l2-3h3 M14 19l11-7 5 9-3 5H14',
  banco: 'M7 30h26 M10 30V20l10-6 10 6v10 M16 30v-6h8v6',
  asfalto: 'M14 6L6 34 M26 6l8 28 M20 8v4 M20 17v5 M20 27v6',
  block: 'M4 15h26v14H4z M4 15l6-6h26l-6 6 M30 29l6-6V9 M8 19h7v6H8z M19 19h7v6h-7z',
  venta: 'M21 6h12a1 1 0 0 1 1 1v12L19 34 6 21z',
  personalizado: 'M7 8h26a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z M20 14v12 M14 20h12',
  documento: 'M11 5h12l7 7v23a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M23 5v7h7 M14 21h12 M14 27h8',
  historial: 'M20 8a12 12 0 1 1-11.3 8 M8 8v8h8 M20 14v7l5 3',
};

const EXTRAS = {
  excavadora: [[8.5, 30, 1.1], [18.5, 30, 1.1]],
  martillo_exc: [[8.5, 30, 1.1], [18.5, 30, 1.1]],
  retro: [[12, 29, 4], [27, 29, 4]],
  retro_mart: [[12, 29, 4], [27, 29, 4]],
  moto: [[9, 29, 3.4], [20, 29, 3.4], [31, 29, 3.4]],
  vibro: [[12, 27, 7], [12, 27, 2.4], [30, 30, 2.2]],
  minicargador: [[11, 29, 3], [18, 29, 3]],
  pipa: [[11, 30, 3], [29, 30, 3]],
  retiro: [[12, 30, 3], [27, 30, 3]],
  zona: [[12, 30, 3], [27, 30, 3]],
  venta: [[28, 12, 2]],
};

export function Icono({ nombre, size = 30 }) {
  const d = TRAZOS[nombre] ?? TRAZOS.excavadora;
  const ruedas = EXTRAS[nombre] ?? [];
  return html`<svg viewBox="0 0 40 40" width=${size} height=${size} fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d=${d} />
    ${ruedas.map(([cx, cy, r]) => html`<circle cx=${cx} cy=${cy} r=${r} />`)}
  </svg>`;
}

/** Íconos de interfaz (lucide), en trazo. */
const UI = {
  mas: 'M12 5v14 M5 12h14',
  menos: 'M5 12h14',
  x: 'M18 6L6 18 M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  flecha: 'M5 12h14 M12 5l7 7-7 7',
  atras: 'M19 12H5 M12 19l-7-7 7-7',
  descargar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  whatsapp: 'M7.9 20A9 9 0 1 0 4 16.1L2 22z',
  reiniciar: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5',
  guardar: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  basura: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ver: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  copiar: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  abajo: 'M6 9l6 6 6-6',
  tema: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  historial: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M12 7v5l4 2',
};

export function Ui({ n, size = 16 }) {
  return html`<svg viewBox="0 0 24 24" width=${size} height=${size} fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${UI[n] ?? ''} /></svg>`;
}
