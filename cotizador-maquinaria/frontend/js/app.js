// =============================================================================
// PUCSA MAQUINARIA · COTIZADOR (la app del enlace).
//
// Como el acceso directo de MAQSER24: un menú con los cotizadores (renta de
// maquinaria, agua, acarreos, carpeta asfáltica, materiales y venta) y las
// calculadoras; elegir uno abre una cotización nueva con esa categoría, y
// «¿Necesitas otro servicio?» suma otras a la MISMA cotización. Se instala en
// el celular como app y el ícono abre directo aquí, con la llave.
// =============================================================================
import { html, render, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { COTIZADORES, cotizadorDe } from './motor.js';
import { Cotizador } from './cotizador.js';
import { Historial, VistaGuardada } from './historial.js';
import { CalculadoraPavimento, ConversorM3Ton } from './calculadoras.js';
import { Icono, Ui } from './iconos.js';
import { Aviso } from './piezas.js';
import { api } from './api.js';

const CALCULADORAS = [
  { clave: 'calculadora-pavimento', titulo: 'Calculadora de pavimento', resumen: 'Material para una calle: subrasante, subbase, base y carpeta', icono: 'calculadora' },
  { clave: 'm3-a-toneladas', titulo: 'Conversor de m³ a toneladas', resumen: 'Triturados y carpeta asfáltica, de m³ a toneladas y al revés', icono: 'conversion' },
];
const NOTA_TRITURADOS = 'Los triturados (subbase y base) se cotizan en el cotizador de PUCSA Triturados.';

function leerRuta() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (partes[0] === 'historial') return partes[1] ? { vista: 'guardada', id: Number(partes[1]) } : { vista: 'historial' };
  if (CALCULADORAS.some((c) => c.clave === partes[0])) return { vista: 'calculadora', clave: partes[0] };
  if (partes[0] === 'cotizar' && cotizadorDe(partes[1])) return { vista: 'cotizar', clave: partes[1] };
  return { vista: 'cotizar', clave: 'maquinaria' };
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

  /** Ir a otra pantalla; con una cotización sin guardar, primero se pregunta. */
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
    // Del sistema anterior los servicios traían su precio de entonces: se cotizan al de hoy.
    const partidas = cot.documento?.legado
      ? cot.partidas.map((p) => (p.tipo === 'servicio' ? { ...p, precio: 0 } : p))
      : cot.partidas;
    const categorias = (cot.categorias ?? []).filter((k) => cotizadorDe(k));
    ir(`#/cotizar/${categorias[0] ?? 'maquinaria'}`, { conBase: { ...cot, partidas, categorias } });
  };

  const actual = ruta.vista === 'cotizar' ? cotizadorDe(ruta.clave) : null;
  const calc = ruta.vista === 'calculadora' ? CALCULADORAS.find((c) => c.clave === ruta.clave) : null;

  let cuerpo;
  if (error) cuerpo = html`<${Aviso} tono="bad">No se pudo cargar el tabulador: ${error}<//>`;
  else if (calc) {
    const cotizar = (m) => (m === 'carpeta' ? { href: '#/cotizar/carpeta-asfaltica', texto: 'Cotizar carpeta asfáltica' } : null);
    cuerpo = calc.clave === 'calculadora-pavimento'
      ? html`<${CalculadoraPavimento} key=${vuelta} cotizar=${cotizar} marca="PUCSA Maquinaria" nota=${NOTA_TRITURADOS} />`
      : html`<${ConversorM3Ton} key=${vuelta} cotizar=${cotizar} marca="PUCSA Maquinaria" nota=${NOTA_TRITURADOS} />`;
  } else if (ruta.vista === 'historial') cuerpo = html`<${Historial} ir=${ir} />`;
  else if (ruta.vista === 'guardada') cuerpo = html`<${VistaGuardada} key=${ruta.id} id=${ruta.id} ir=${ir} usarComoBase=${usarComoBase} />`;
  else if (!cat) cuerpo = html`<p class="hist-vacio">Cargando…</p>`;
  else {
    cuerpo = html`<${Cotizador} key=${`${ruta.clave}-${vuelta}`} cat=${cat} clientes=${clientes} entrada=${ruta.clave} base=${base}
      onSucio=${(s) => { sucio.current = s; }}
      onGuardada=${(fila) => setClientes((l) => [fila.cliente, ...l.filter((c) => c !== fila.cliente)])}
      onNueva=${() => ir(`#/cotizar/${ruta.clave}`)} />`;
  }

  return html`<div class="cza">
    <${Encabezado} actual=${actual} calc=${calc} historial=${ruta.vista === 'historial' || ruta.vista === 'guardada'} ir=${ir} />
    <${Instalable} />
    <main class="cza-main">${cuerpo}</main>
  </div>`;
}

function Encabezado({ actual, calc, historial, ir }) {
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useState(leerTema);
  const menu = useRef(null);

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
    : { icono: actual?.icono ?? 'excavadora', grupo: 'Cotizador', titulo: actual?.titulo ?? 'Renta de maquinaria' };

  const opcion = (c, destino, on) => html`<a key=${c.clave} href=${destino} data-on=${on ? '1' : undefined} aria-current=${on ? 'page' : undefined}
    onClick=${(e) => { e.preventDefault(); setAbierto(false); ir(destino); }}>
    <span class="cza-ico"><${Icono} nombre=${c.icono} size=${26} /></span>
    <span class="cza-item"><b>${c.titulo}</b><small>${c.resumen}</small></span>
    ${on ? html`<span class="cza-check"><${Ui} n="check" /></span>` : null}
  </a>`;

  return html`<header class="cza-h">
    <div class="cza-marca">
      <img class="logo-oscuro" src="assets/logo-blanco.webp" alt="PUCSA Maquinaria" />
      <img class="logo-claro" src="assets/logo-negro.png" alt="PUCSA Maquinaria" />
    </div>
    <div class="cza-menu" ref=${menu}>
      <button type="button" class="cza-menu-btn" aria-haspopup="true" aria-expanded=${abierto ? 'true' : 'false'} onClick=${() => setAbierto((a) => !a)}>
        <${Icono} nombre=${boton.icono} size=${22} />
        <span class="cza-menu-txt"><small>${boton.grupo}</small><b>${boton.titulo}</b></span>
        <span class="cza-flecha"><${Ui} n="abajo" size=${14} /></span>
      </button>
      ${abierto ? html`<nav class="cza-lista" aria-label="Cotizadores y calculadoras">
        <p class="cza-lista-t">Cotizadores</p>
        ${COTIZADORES.map((c) => opcion(c, `#/cotizar/${c.clave}`, !calc && !historial && actual?.clave === c.clave))}
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
