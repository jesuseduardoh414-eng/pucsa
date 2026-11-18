"""El tabulador (`data/catalogo.json`): materiales, zonas, camiones y condiciones.

El cálculo lo hace la pantalla con este catálogo (un solo motor, como en
MAQSER24) y al guardar la cotización se congela con sus importes: si mañana
cambia un precio, lo ya guardado sigue diciendo lo mismo.

Se vuelve a leer solo cuando el archivo cambia: editar un precio no requiere
reiniciar la app. Lo único que la app escribe aquí son los municipios que se
agregan a una zona de flete desde el cotizador.
"""
from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parent.parent
RUTA_CATALOGO = RAIZ / "data" / "catalogo.json"

_cache: dict[str, Any] = {"mtime": None, "datos": None}
_candado = threading.Lock()

CLAVES = ("tipo", "iva", "empresa", "firma", "saludo", "municipios", "productos",
          "ton_por_viaje", "zonas", "condiciones")


def _validar(cat: dict) -> None:
    for clave in CLAVES:
        if clave not in cat:
            raise ValueError(f"catalogo.json: falta la clave '{clave}'")
    for p in cat["productos"]:
        if "precio_ton" not in p:
            raise ValueError(f"producto {p.get('id')}: falta 'precio_ton'")


def cargar() -> dict[str, Any]:
    mtime = RUTA_CATALOGO.stat().st_mtime
    if _cache["datos"] is None or _cache["mtime"] != mtime:
        with open(RUTA_CATALOGO, encoding="utf-8") as f:
            datos = json.load(f)
        _validar(datos)
        _cache.update(mtime=mtime, datos=datos)
    return _cache["datos"]


def agregar_municipio(municipio: str, zona_id: str) -> list[dict]:
    """Guarda en qué zona de flete queda un municipio; desde ahí su zona sale sola."""
    municipio = municipio.strip()
    with _candado:
        with open(RUTA_CATALOGO, encoding="utf-8") as f:
            datos = json.load(f)
        zona = next((z for z in datos["zonas"] if z["id"] == zona_id), None)
        if zona is None:
            raise KeyError(zona_id)
        clave = municipio.casefold()
        # Un municipio va en UNA zona: si estaba en otra, se mueve.
        for z in datos["zonas"]:
            z["municipios"] = [m for m in z.get("municipios", []) if m.casefold() != clave]
        zona.setdefault("municipios", []).append(municipio)
        # Escritura atómica: un corte a medias no deja el tabulador roto.
        fd, tmp = tempfile.mkstemp(dir=RUTA_CATALOGO.parent, suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=2)
        os.replace(tmp, RUTA_CATALOGO)
    return cargar()["zonas"]
