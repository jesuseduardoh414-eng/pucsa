// El documento como archivo PDF, hecho en el navegador (como en MAQSER24).
//
// Es el MISMO documento de la pantalla, a lo ancho de una hoja carta: se
// fotografía y se reparte en hojas, cortando solo entre renglones, viñetas o
// bloques (nunca a media línea ni con el total separado de su subtotal).
// Las librerías se cargan solo la primera vez que se pide un PDF.
import { DOCUMENTO_CSS, MARCA, documentoCuerpo } from './documento.js';

const ANCHO_HOJA = 816; // carta a 96 ppp: con este ancho sale la tabla completa
const MARGEN = 28;      // puntos arriba y abajo de cada hoja

const cargadas = {};
function cargarScript(src) {
  cargadas[src] ??= new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => { delete cargadas[src]; mal(new Error(`No se pudo cargar ${src}`)); };
    document.head.appendChild(s);
  });
  return cargadas[src];
}

/** Una imagen como `data:` URL, con tope de tiempo; null si no llegó o no es imagen. */
async function comoDataUrl(src, ms) {
  const ctrl = new AbortController();
  const tope = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(src, { signal: ctrl.signal, credentials: 'same-origin' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const blob = await r.blob();
    return await new Promise((listo) => {
      const lector = new FileReader();
      lector.onload = () => listo(typeof lector.result === 'string' ? lector.result : null);
      lector.onerror = () => listo(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(tope);
  }
}

/**
 * EL LOGO DEL PDF, SIEMPRE (como MAQSER24, 2026-11-12): se trae antes de armar
 * la hoja y va dentro del documento; con dos intentos. Si de plano no llega,
 * el documento lleva el nombre de la empresa en su lugar, no un hueco.
 */
async function logoParaPdf() {
  const src = new URL(MARCA.logo, document.baseURI).href;
  for (const ms of [8000, 15000]) {
    const dato = await comoDataUrl(src, ms);
    if (dato) return dato;
  }
  return null;
}

export async function documentoPdf(d) {
  const [, , logo] = await Promise.all([cargarScript('vendor/html2canvas.min.js'), cargarScript('vendor/jspdf.umd.min.js'), logoParaPdf()]);
  d = { ...d, logo };
  const html2canvas = window.html2canvas;
  const { jsPDF } = window.jspdf;

  const caja = document.createElement('div');
  caja.className = 'czdoc-hoja';
  caja.setAttribute('aria-hidden', 'true');
  caja.style.cssText = `position:fixed;left:-${ANCHO_HOJA + 200}px;top:0;width:${ANCHO_HOJA}px;background:#fff;pointer-events:none;`;
  // Viñetas propias: las del navegador salían pegadas al texto en la foto.
  caja.innerHTML = `<style>${DOCUMENTO_CSS}.czdoc-hoja .czdoc{padding:34px 38px}.czdoc-hoja .czdoc-cond ul{list-style:none;padding-left:16px}.czdoc-hoja .czdoc-cond li{position:relative}.czdoc-hoja .czdoc-cond li::before{content:"•";position:absolute;left:-12px;color:#8a7d5a}</style>${documentoCuerpo(d)}`;
  document.body.appendChild(caja);

  try {
    await document.fonts?.ready;
    await Promise.all([...caja.querySelectorAll('img')].map((img) =>
      img.complete ? null : new Promise((listo) => { img.onload = listo; img.onerror = listo; })));
    const doc = caja.querySelector('.czdoc');
    const escala = 2;
    const lienzo = await html2canvas(doc, { scale: escala, backgroundColor: '#ffffff', logging: false, windowWidth: ANCHO_HOJA, useCORS: true });

    // Dónde se puede cortar la hoja.
    const arriba = doc.getBoundingClientRect().top;
    const cortes = [...doc.querySelectorAll('tr, li, p, .czdoc-hd, .czdoc-meta, .czdoc-tot, .czdoc-note, .czdoc-sign, .czdoc-pago, .czdoc-cond')]
      .map((e) => (e.getBoundingClientRect().bottom - arriba) * escala)
      .sort((a, b) => a - b);

    const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
    const anchoPt = pdf.internal.pageSize.getWidth();
    const altoPt = pdf.internal.pageSize.getHeight();
    const pxPorPt = lienzo.width / anchoPt;

    // Si sobra poco de una hoja, se encoge un poco y va en una sola.
    const altoTodo = lienzo.height / pxPorPt;
    const cabeEnUna = altoPt - MARGEN;
    if (altoTodo > cabeEnUna && altoTodo * 0.86 <= cabeEnUna) {
      const f = cabeEnUna / altoTodo;
      pdf.addImage(lienzo.toDataURL('image/jpeg', 0.9), 'JPEG', (anchoPt - anchoPt * f) / 2, 0, anchoPt * f, altoTodo * f);
      return pdf.output('blob');
    }

    let inicio = 0;
    let hoja = 0;
    while (inicio < lienzo.height - 2) {
      const arribaPt = hoja === 0 ? 0 : MARGEN;
      const cabe = Math.floor((altoPt - arribaPt - MARGEN) * pxPorPt);
      let fin = Math.min(inicio + cabe, lienzo.height);
      if (fin < lienzo.height) {
        const corte = cortes.filter((c) => c > inicio + cabe * 0.5 && c <= fin).pop();
        if (corte) fin = Math.ceil(corte);
      }
      const trozo = document.createElement('canvas');
      trozo.width = lienzo.width;
      trozo.height = fin - inicio;
      const ctx = trozo.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, trozo.width, trozo.height);
      ctx.drawImage(lienzo, 0, inicio, lienzo.width, trozo.height, 0, 0, lienzo.width, trozo.height);
      if (hoja > 0) pdf.addPage();
      pdf.addImage(trozo.toDataURL('image/jpeg', 0.9), 'JPEG', 0, arribaPt, anchoPt, trozo.height / pxPorPt);
      inicio = fin;
      hoja += 1;
    }
    return pdf.output('blob');
  } finally {
    caja.remove();
  }
}

/** El nombre del archivo: empresa, cliente, folio o fecha. Así se distingue en el chat y en Descargas. */
export function nombreArchivo(d) {
  const limpio = (s, max) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return ['Cotizacion-PUCSA-Maquinaria', limpio(d.cliente, 40), d.folio ? limpio(d.folio, 30) : fecha].filter(Boolean).join('-') + '.pdf';
}

export function descargarArchivo(archivo) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Abre el menú de compartir del teléfono con el PDF (de ahí, WhatsApp). Solo el archivo, sin texto. */
export async function compartirArchivo(archivo) {
  if (!navigator.canShare?.({ files: [archivo] })) return 'sin-soporte';
  try {
    await navigator.share({ files: [archivo], title: archivo.name });
    return 'compartido';
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelado';
    throw e;
  }
}
