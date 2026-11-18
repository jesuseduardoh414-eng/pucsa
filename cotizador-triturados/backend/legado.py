"""Cotizaciones del sistema anterior (antes de 2026-11).

Las cotizaciones nuevas se guardan con su documento congelado. Las que ya
estaban guardadas no lo traen: aquí se arma su documento UNA vez, con el
cálculo y el tabulador de entonces (`data/catalogo-anterior-2026-07.json`),
para que el historial las siga mostrando y descargando como eran.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parent.parent
RUTA_ANTERIOR = RAIZ / "data" / "catalogo-anterior-2026-07.json"

SALUDO = ("Por medio de la presente, ponemos a su consideración la cotización correspondiente a los "
          "materiales solicitados. Agradecemos la oportunidad de participar en su requerimiento y quedamos "
          "a su disposición para cualquier aclaración. Un cordial saludo.")


def _catalogo() -> dict[str, Any]:
    with open(RUTA_ANTERIOR, encoding="utf-8") as f:
        return json.load(f)


def _precio_zona(cat: dict, z: dict, pid: str) -> float | None:
    override = z.get("precios", {}).get(pid)
    if override is not None:
        return float(override)
    prod = next((p for p in cat["productos"] if p["id"] == pid), None)
    if not prod:
        return None
    return round(float(z.get("flete", 0)) + float(prod["precio_ton"]) * cat.get("ton_por_viaje", 20), 2)


def _calcular(cat: dict, partidas: list[dict], con_iva: bool) -> dict:
    productos = {p["id"]: p for p in cat["productos"]}
    zonas = {z["id"]: z for z in cat["zonas"]}
    renglones: list[dict] = []
    materiales = fletes = 0.0
    for p in partidas:
        tipo = p.get("tipo")
        if tipo == "material":
            prod = productos.get(p.get("id") or "")
            nombre = (p.get("nombre") or (prod["nombre"] if prod else "")).strip()
            precio = float(p.get("precio") if p.get("precio") not in (None, "", 0) else (prod["precio_ton"] if prod else 0))
            ton = float(p.get("toneladas") or 0)
            if not nombre or ton <= 0 or precio <= 0:
                continue
            materiales += precio * ton
            renglones.append({"clase": "material", "concepto": nombre.upper(), "unidad": "TON", "cantidad": ton,
                              "pu": round(precio, 2), "importe": round(precio * ton, 2)})
            flete = float(p.get("flete_ton") or 0)
            if flete > 0:
                etiqueta = (p.get("flete_zona") or "").strip()
                fletes += flete * ton
                renglones.append({"clase": "flete", "concepto": f"FLETE {etiqueta.upper()}".strip() if etiqueta else "FLETE A OBRA",
                                  "unidad": "TON", "cantidad": ton, "pu": round(flete, 2), "importe": round(flete * ton, 2)})
        elif tipo == "banco":
            b = cat.get("material_banco", {})
            m3 = float(p.get("m3") or 0)
            precio = float(p.get("precio_m3") if p.get("precio_m3") not in (None, "", 0) else b.get("precio_m3_default", 0))
            if m3 <= 0 or precio <= 0:
                continue
            materiales += precio * m3
            renglones.append({"clase": "banco", "concepto": f"{b.get('nombre', 'Material de banco').upper()} (INCLUYE FLETE)",
                              "unidad": b.get("unidad", "M3"), "cantidad": m3, "pu": round(precio, 2), "importe": round(precio * m3, 2)})
        elif tipo == "zona":
            z = zonas.get(p.get("zona_id") or "")
            prod = productos.get(p.get("producto_id") or "")
            precio = _precio_zona(cat, z, prod["id"]) if z and prod else None
            if precio is None:
                continue
            viajes = max(1, int(p.get("viajes") or 1))
            materiales += precio * viajes
            renglones.append({"clase": "zona", "concepto": f"{prod['nombre'].upper()} · {z['nombre']}",
                              "unidad": cat.get("unidad_zona", "VIAJE"), "cantidad": viajes, "pu": round(precio, 2),
                              "importe": round(precio * viajes, 2)})
    subtotal = round(materiales + fletes, 2)
    iva = round(subtotal * cat["iva"], 2) if con_iva else 0.0
    conds = cat["condiciones"]
    general = {"titulo": conds["general"]["titulo"], "puntos": [
        "Costos más IVA (16%)." if con_iva else "Costos remisionados sin cargo de IVA; más IVA en caso de requerir factura.",
        *conds["general"]["puntos"]]}
    bloques = [general]
    for tipo, clave in (("material", "material"), ("banco", "banco"), ("zona", "zona")):
        if any(p.get("tipo") == tipo for p in partidas) and clave in conds:
            bloques.append(conds[clave])
    return {
        "renglones": renglones,
        "desglose": {"renta": 0, "servicios": 0, "fletes": round(fletes, 2), "materiales": round(materiales, 2)},
        "subtotal": subtotal, "iva": iva, "iva_tasa": cat["iva"], "con_iva": bool(con_iva),
        "total": round(subtotal + iva, 2), "condiciones": bloques,
    }


def documento_de(fila: dict[str, Any]) -> dict[str, Any]:
    """El documento congelado de una cotización del sistema anterior."""
    cat = _catalogo()
    partidas = json.loads(fila["partidas"]) if isinstance(fila["partidas"], str) else fila["partidas"]
    calc = _calcular(cat, partidas, bool(fila.get("con_iva", 1)))
    emp = dict(cat["empresa"])
    emp.setdefault("correo", "")
    cliente = (fila.get("cliente") or fila.get("obra") or "").strip()
    obra = (fila.get("obra") or "").strip()
    return {
        "legado": True,
        "titulo": "Cotización de triturados",
        "cliente": cliente,
        "obra": "" if obra == cliente else obra,
        "atencion": fila.get("atencion") or "",
        "municipio": fila.get("sucursal") or "",
        "notas": fila.get("notas") or "",
        "empresa": emp,
        "firma": cat["firma"],
        "saludo": SALUDO,
        "pago": None,
        "calc": calc,
    }
