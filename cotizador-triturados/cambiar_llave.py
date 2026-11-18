"""Crea (o cambia) la llave del enlace del cotizador de PUCSA Triturados.

Uso, desde la carpeta del proyecto:

    python cambiar_llave.py

Muestra el enlace nuevo. Los enlaces anteriores dejan de funcionar en ese
momento (también lo instalado en los celulares): hay que mandar el nuevo.
Guárdalo en un lugar seguro y no lo compartas en grupos: quien lo tenga entra
al cotizador y a su historial.
"""
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.acceso import RUTA_HUELLA, huella  # noqa: E402


def main() -> None:
    llave = secrets.token_urlsafe(24)
    RUTA_HUELLA.parent.mkdir(parents=True, exist_ok=True)
    RUTA_HUELLA.write_text(huella(llave) + "\n", encoding="utf-8")
    print("Llave nueva creada. Los enlaces anteriores ya no sirven.\n")
    print("Enlace (agrega tu dominio al inicio):")
    print(f"    /e/{llave}/\n")
    print("En tu computadora (pruebas):")
    print(f"    http://127.0.0.1:8000/e/{llave}/")


if __name__ == "__main__":
    main()
