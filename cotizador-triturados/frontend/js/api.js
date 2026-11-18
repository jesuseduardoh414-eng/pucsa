// La API vive junto a la pantalla, detrás de la misma llave: rutas relativas (`api/...`).
export async function api(ruta, opciones = {}) {
  const init = { ...opciones, headers: { ...(opciones.body ? { 'Content-Type': 'application/json' } : {}), ...(opciones.headers ?? {}) } };
  if (init.body && typeof init.body !== 'string') init.body = JSON.stringify(init.body);
  let r;
  try {
    r = await fetch(`api/${ruta}`, init);
  } catch {
    throw new Error('Sin conexión con el servidor. Revisa tu señal e inténtalo otra vez.');
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(datos?.detail || `Error ${r.status}`);
  return datos;
}
