// =============================================================================
// PUCSA TRITURADOS · COTIZADOR (la app del enlace).
//
// Como el acceso directo de MAQSER24: el cotizador de triturados y, en el
// mismo menú, las calculadoras de material. Se instala en el celular como app
// y el ícono abre directo aquí, con la llave.
// =============================================================================
import { html, render, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { Cotizador } from './cotizador.js';
import { Historial, VistaGuardada } from './historial.js';
import { CalculadoraPavimento, ConversorM3Ton } from './calculadoras.js';
import { productoDe, RECOGE_EN_PLANTA } from './motor.js';
import { Icono, Ui } from './iconos.js';
import { Aviso } from './piezas.js';
import { api } from './api.js';

const COTIZADORES = [
  { clave: 'triturados', titulo: 'Triturados', resumen: 'Grava, arena y base: en planta, por viaje o pedido grande', icono: 'material' },
];
const CALCULADORAS = [
  { clave: 'calculadora-pavimento', titulo: 'Calculadora de pavimento', resumen: 'Material para una calle: subrasante, subbase, base y carpeta', icono: 'calculadora' },
  { clave: 'm3-a-toneladas', titulo: 'Conversor de m³ a toneladas', resumen: 'Triturados y carpeta asfáltica, de m³ a toneladas y al revés', icono: 'conversion' },
];
const NOTA_CARPETA = 'La carpeta asfáltica se cotiza en el cotizador de PUCSA Maquinaria.';

function leerRuta() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (partes[0] === 'historial') return partes[1] ? { vista: 'guardada', id: Number(partes[1]) } : { vista: 'historial' };
  if (CALCULADORAS.some((c) => c.clave === partes[0])) return { vista: 'calculadora', clave: partes[0] };
  return { vista: 'cotizar' };
}

function leerTema() {
  try { return localStorage.getItem('pucsa-tema'); } catch { return null; }
}

function App() {
  const [cat, setCat] = useState(null);
  const [error, setError] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [ruta, setRuta] = useState(leerRuta);
  const [vuelta, setVuelta] = useState(0);
  const [base, setBase] = useState(null);
  const sucio = useRef(false);

  useEffect(() => {
    api('catalogo').then(setCat).catch((e) => setError(e.message));
    api('clientes').then(setClientes).catch(() => {});
    const cambio = () => setRuta(leerRuta());
    window.addEventListener('hashchange', cambio);
    const salir = (e) => { if (sucio.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', salir);
    return () => { window.removeEventListener('hashchange', cambio); window.removeEventListener('beforeunload', salir); };
  }, []);

  const ir = (destino, { conBase = null } = {}) => {
    if (sucio.current && !confirm('Tienes una cotización sin guardar. ¿Dejarla e ir a otra pantalla?')) return;
    sucio.current = false;
    setBase(conBase);
    setVuelta((v) => v + 1);
    if (location.hash !== destino) location.hash = destino;
    else setRuta(leerRuta());
    window.scrollTo({ top: 0 });
  };

  const usarComoBase = (cot) => {
    let partidas = cot.partidas;
    // Del sistema anterior: los precios se toman de hoy, lo que ya no existe va escrito a mano
    // y las zonas cambiaron (se eligen otra vez).
    if (cot.documento?.legado && cat) {
      partidas = partidas.map((p) => {
        if (p.tipo === 'material') {
          const existe = !!productoDe(cat, p.id);
          return { ...p, id: existe ? p.id : 'custom', precio: existe ? 0 : p.precio, flete_ton: 0, flete_zona: RECOGE_EN_PLANTA, camion: undefined };
        }
        if (p.tipo === 'zona') return { ...p, zona_id: '' };
        return p;
      });
    }
    ir('#/cotizar', { conBase: { ...cot, partidas } });
  };

  const guardarZona = async (municipio, zonaId) => {
    const r = await api('zona-municipio', { method: 'POST', body: { municipio, zona_id: zonaId } });
    setCat((c) => ({ ...c, zonas: r.zonas }));
  };

  const calc = ruta.vista === 'calculadora' ? CALCULADORAS.find((c) => c.clave === ruta.clave) : null;
  let cuerpo;
  if (error) cuerpo = html`<${Aviso} tono="bad">No se pudo cargar el tabulador: ${error}<//>`;
  else if (calc) {
    const cotizar = (m) => (m === 'triturados' ? { href: '#/cotizar', texto: 'Cotizar triturados' } : null);
    cuerpo = calc.clave === 'calculadora-pavimento'
      ? html`<${CalculadoraPavimento} key=${vuelta} cotizar=${cotizar} marca="PUCSA Triturados" nota=${NOTA_CARPETA} />`
      : html`<${ConversorM3Ton} key=${vuelta} cotizar=${cotizar} marca="PUCSA Triturados" nota=${NOTA_CARPETA} />`;
  } else if (ruta.vista === 'historial') cuerpo = html`<${Historial} ir=${ir} />`;
  else if (ruta.vista === 'guardada') cuerpo = html`<${VistaGuardada} key=${ruta.id} id=${ruta.id} ir=${ir} usarComoBase=${usarComoBase} />`;
  else if (!cat) cuerpo = html`<p class="hist-vacio">Cargando…</p>`;
  else {
    cuerpo = html`<${Cotizador} key=${`t-${vuelta}`} cat=${cat} clientes=${clientes} base=${base} guardarZona=${guardarZona}
      onSucio=${(s) => { sucio.current = s; }}
      onGuardada=${(fila) => setClientes((l) => [fila.cliente, ...l.filter((c) => c !== fila.cliente)])}
      onNueva=${() => ir('#/cotizar')} />`;
  }

  return html`<div class="cza">
    <${Encabezado} ruta=${ruta} calc=${calc} ir=${ir} />
    <${Instalable} />
    <main class="cza-main">${cuerpo}</main>
  </div>`;
}

function Encabezado({ ruta, calc, ir }) {
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useState(leerTema);
  const menu = useRef(null);
  const historial = ruta.vista === 'historial' || ruta.vista === 'guardada';

  useEffect(() => {
    if (tema) document.documentElement.setAttribute('data-theme', tema);
    else document.documentElement.removeAttribute('data-theme');
  }, [tema]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => { if (!menu.current?.contains(e.target)) setAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  const cambiarTema = () => {
    const oscuro = (document.documentElement.getAttribute('data-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    const nuevo = oscuro ? 'light' : 'dark';
    try { localStorage.setItem('pucsa-tema', nuevo); } catch { /* sin almacenamiento */ }
    setTema(nuevo);
  };

  const boton = calc ? { icono: calc.icono, grupo: 'Calculadora', titulo: calc.titulo }
    : historial ? { icono: 'historial', grupo: 'Cotizador', titulo: 'Historial' }
    : { icono: 'material', grupo: 'Cotizador', titulo: 'Triturados' };

  const opcion = (c, destino, on) => html`<a key=${c.clave} href=${destino} data-on=${on ? '1' : undefined} aria-current=${on ? 'page' : undefined}
    onClick=${(e) => { e.preventDefault(); setAbierto(false); ir(destino); }}>
    <span class="cza-ico"><${Icono} nombre=${c.icono} size=${26} /></span>
    <span class="cza-item"><b>${c.titulo}</b><small>${c.resumen}</small></span>
    ${on ? html`<span class="cza-check"><${Ui} n="check" /></span>` : null}
  </a>`;

  return html`<header class="cza-h">
    <div class="cza-marca"><img src="assets/logo-triturados-banda.png" alt="PUCSA Triturados" /></div>
    <div class="cza-menu" ref=${menu}>
      <button type="button" class="cza-menu-btn" aria-haspopup="true" aria-expanded=${abierto ? 'true' : 'false'} onClick=${() => setAbierto((a) => !a)}>
        <${Icono} nombre=${boton.icono} size=${22} />
        <span class="cza-menu-txt"><small>${boton.grupo}</small><b>${boton.titulo}</b></span>
        <span class="cza-flecha"><${Ui} n="abajo" size=${14} /></span>
      </button>
      ${abierto ? html`<nav class="cza-lista" aria-label="Cotizador y calculadoras">
        <p class="cza-lista-t">Cotizador</p>
        ${COTIZADORES.map((c) => opcion(c, '#/cotizar', ruta.vista === 'cotizar'))}
        <p class="cza-lista-t cza-lista-sep">Calculadoras</p>
        ${CALCULADORAS.map((c) => opcion(c, `#/${c.clave}`, calc?.clave === c.clave))}
      </nav>` : null}
    </div>
    <div class="cza-acc">
      <button type="button" class="cza-link" data-on=${historial ? '1' : undefined} onClick=${() => ir('#/historial')}><${Ui} n="historial" /> <span>Historial</span></button>
      <button type="button" class="cza-tema" aria-label="Cambiar tema claro u oscuro" title="Tema" onClick=${cambiarTema}><${Ui} n="tema" /></button>
    </div>
  </header>`;
}

/**
 * Sin aviso de «agregar al inicio» (como MAQSER24, 2026-11-12: «quitar el
 * mensaje de agregar al inicio»). Se sigue pudiendo instalar desde el menú del
 * navegador (Chrome: ⋮ → Agregar a la pantalla principal; Safari: Compartir →
 * Agregar a inicio): el manifiesto y el service worker se quedan. Tampoco sale
 * la barrita propia de Chrome.
 */
function Instalable() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => undefined);
    const sinAviso = (e) => e.preventDefault();
    window.addEventListener('beforeinstallprompt', sinAviso);
    return () => window.removeEventListener('beforeinstallprompt', sinAviso);
  }, []);
  return null;
}

render(html`<${App} />`, document.getElementById('app'));
