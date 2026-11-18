import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { compartirArchivo, descargarArchivo, documentoPdf, nombreArchivo } from './pdf.js';
import { Ui } from './iconos.js';

/**
 * Mandar por WhatsApp y descargar el PDF.
 *
 * El PDF se prepara solo, medio segundo después del último cambio: el menú de
 * compartir del teléfono tiene que abrirse en el mismo toque del botón, y armar
 * el PDF en ese momento tarda demasiado (el navegador ya no lo deja abrir).
 */
export function Compartir({ datos, huella }) {
  const [archivo, setArchivo] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    setArchivo(null);
    setAviso(null);
    let vigente = true;
    const t = setTimeout(() => {
      documentoPdf(datos)
        .then((blob) => { if (vigente) setArchivo(new File([blob], nombreArchivo(datos), { type: 'application/pdf' })); })
        .catch(() => { if (vigente) setAviso('No se pudo preparar el PDF. Regresa a editar y vuelve a entrar para intentarlo otra vez.'); });
    }, 500);
    return () => { vigente = false; clearTimeout(t); };
    // `datos` se rehace en cada pintada; lo que cambia el documento está en la huella.
  }, [huella]);

  async function whatsapp() {
    if (!archivo) return;
    setAviso(null);
    try {
      const r = await compartirArchivo(archivo);
      if (r === 'sin-soporte') {
        descargarArchivo(archivo);
        setAviso('Este navegador no deja mandar archivos directo: se descargó el PDF, adjúntalo en WhatsApp.');
      }
    } catch {
      setAviso('No se pudo abrir el menú para compartir. Descarga el PDF y mándalo desde WhatsApp.');
    }
  }

  return html`<div class="cz-compartir">
    <button type="button" class="cz-btn primary" disabled=${!archivo} onClick=${whatsapp}>
      <${Ui} n="whatsapp" /> ${archivo ? 'Mandar por WhatsApp' : 'Preparando PDF…'}
    </button>
    <button type="button" class="cz-btn ghost" disabled=${!archivo} onClick=${() => archivo && descargarArchivo(archivo)}>
      <${Ui} n="descargar" /> Descargar PDF
    </button>
    ${aviso ? html`<p class="cz-help cz-compartir-aviso">${aviso}</p>` : null}
  </div>`;
}
