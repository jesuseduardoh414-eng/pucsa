"""El tabulador (`data/catalogo.json`): tarifas, servicios, zonas y condiciones.

El cálculo lo hace la pantalla con este catálogo (un solo motor, como en
MAQSER24) y al guardar la cotización se congela con sus importes: si mañana
cambia una tarifa, lo ya guardado sigue diciendo lo mismo.

Se vuelve a leer solo cuando el archivo cambia (por su fecha de modificación):
editar una tarifa no requiere reiniciar la app.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parent.parent
RUTA_CATALOGO = RAIZ / "data" / "catalogo.json"

_cache: dict[str, Any] = {"mtime": None, "datos": None}

CLAVES = ("tipo", "iva", "jornada_horas", "empresa", "firma", "saludo", "municipios",
          "fletes", "equipos", "servicios", "condiciones")


def _validar(cat: dict) -> None:
    for clave in CLAVES:
        if clave not in cat:
            raise ValueError(f"catalogo.json: falta la clave '{clave}'")
    for eq in cat["equipos"]:
        if "precio_hora" not in eq and "tarifas" not in eq:
            raise ValueError(f"equipo {eq.get('id')}: falta 'precio_hora'")
        if eq["flete_tipo"] not in cat["fletes"]:
            raise ValueError(f"equipo {eq['id']}: flete_tipo desconocido '{eq['flete_tipo']}'")


def cargar() -> dict[str, Any]:
    mtime = RUTA_CATALOGO.stat().st_mtime
    if _cache["datos"] is None or _cache["mtime"] != mtime:
        with open(RUTA_CATALOGO, encoding="utf-8") as f:
            datos = json.load(f)
        _validar(datos)
        _cache.update(mtime=mtime, datos=datos)
    return _cache["datos"]
