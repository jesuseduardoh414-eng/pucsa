"""La llave del enlace (como el acceso directo de los cotizadores de MAQSER24).

El cotizador no tiene usuario ni contraseña: se entra SOLO con el enlace
`/e/<llave>/`. Sin la llave, o con otra, la respuesta es un 404, igual que una
página que no existe.

En el servidor no se guarda la llave, solo su huella SHA-256 en
`data/llave.sha256`. Para crearla o cambiarla: `python cambiar_llave.py`.
Al cambiarla, los enlaces viejos (y lo ya instalado en los celulares) dejan de
servir en ese momento, sin reiniciar la app.
"""
from __future__ import annotations

import hashlib
import hmac
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RUTA_HUELLA = RAIZ / "data" / "llave.sha256"


def huella(llave: str) -> str:
    return hashlib.sha256(llave.encode("utf-8")).hexdigest()


def huella_guardada() -> str | None:
    """La huella vigente; se lee en cada petición para que un cambio aplique al momento."""
    try:
        h = RUTA_HUELLA.read_text(encoding="utf-8").strip().lower()
    except OSError:
        return None
    return h if len(h) == 64 else None


def hay_llave() -> bool:
    return huella_guardada() is not None


def llave_valida(llave: str | None) -> bool:
    if not llave or len(llave) < 20 or len(llave) > 200:
        return False
    guardada = huella_guardada()
    if not guardada:
        return False
    return hmac.compare_digest(huella(llave), guardada)
