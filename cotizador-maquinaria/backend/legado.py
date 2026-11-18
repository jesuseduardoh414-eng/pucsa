"""Cotizaciones del sistema anterior (tarifa día/semana/mes, antes de 2026-11).

Las cotizaciones nuevas se guardan con su documento congelado. Las que ya
estaban guardadas no lo traen: aquí se arma su documento UNA vez, con el
cálculo y el tabulador de entonces (`data/catalogo-anterior-2026-07.json`),
para que el historial las siga mostrando y descargando como eran.

Es el mismo cálculo que tenía la app anterior; no se usa para nada más.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parent.parent
RUTA_ANTERIOR = RAIZ / "data" / "catalogo-anterior-2026-07.json"

SALUDO = ("Por medio de la presente y aprovechando para enviarle un cordial y afectuoso saludo, "
          "se envía cotización de renta de maquinaria para su proyecto.")


def _catalogo() -> dict[str, Any]:
    with open(RUTA_ANTERIOR, encoding="utf-8") as f:
        return json.load(f)


def _tier(cat: dict, dias: int) -> str:
    for t in cat["tiers"]:
        hasta = t["hasta_dias"]
        if dias >= t["desde_dias"] and (hasta is None or dias <= hasta):
            return t["id"]
    return "mes"


def _calcular(cat: dict, partidas: list[dict], modo_unidad: str) -> dict:
    jornada = cat["jornada_horas"]
    fletes = cat["fletes"]
    equipos = {e["id"]: e for e in cat["equipos"]}
    servicios = {s["id"]: s for s in cat["servicios"]}
    renglones: list[dict] = []
    renta = serv = flete_tot = 0.0
    conds: set[str] = set()
    for p in partidas:
        if p.get("tipo") == "equipo":
            eq = equipos.get(p.get("id", ""))
            if not eq:
                continue
            conds.add("renta")
            dias = max(0, int(p.get("dias") or 0))
            horas = max(0, min(jornada - 1, int(p.get("horas") or 0)))
            cant = max(1, int(p.get("cantidad") or 1))
            if dias < 1 and horas < 1:
                continue
            tarifa_dia = float(eq["tarifas"][_tier(cat, max(1, dias))])
            tarifa_hora = tarifa_dia / jornada
            if p.get("precio_hora") not in (None, "", 0):
                tarifa_hora = float(p["precio_hora"])
                tarifa_dia = tarifa_hora * jornada
            importe = (dias * tarifa_dia + horas * tarifa_hora) * cant
            flete = float(fletes[eq["flete_tipo"]]) * cant
            renta += importe
            flete_tot += flete
            if modo_unidad == "dias":
                unidad, cantidad, pu = "JOR", round((dias + horas / jornada) * cant, 4), round(tarifa_dia, 2)
            else:
                unidad, cantidad, pu = "HRS", (dias * jornada + horas) * cant, round(tarifa_hora, 2)
            renglones.append({"clase": "equipo", "concepto": f"RENTA DE {eq['nombre'].upper()} ( CON OPERACIÓN, INCLUYE DIÉSEL )",
                              "unidad": unidad, "cantidad": cantidad, "pu": pu, "importe": round(importe, 2)})
            renglones.append({"clase": "flete", "concepto": f"FLETE {eq['flete_tipo'].upper()} A OBRA (IDA Y VUELTA)",
                              "unidad": "SERV", "cantidad": cant, "pu": float(fletes[eq["flete_tipo"]]), "importe": round(flete, 2)})
        elif p.get("tipo") == "servicio":
            sv = servicios.get(p.get("id", ""))
            if not sv:
                continue
            conds.add(sv.get("cond", "renta"))
            cant = max(1, int(p.get("cantidad") or 1))
            precio = float(p.get("precio") if p.get("precio") is not None else sv["precio"])
            serv += precio * cant
            concepto = f"{sv['nombre'].upper()} (TIRO LIBRE)" if sv["id"] == "retiro" else sv["nombre"].upper()
            renglones.append({"clase": "servicio", "concepto": concepto, "unidad": sv.get("unidad", "viaje").upper(),
                              "cantidad": cant, "pu": round(precio, 2), "importe": round(precio * cant, 2)})
    subtotal = round(renta + serv + flete_tot, 2)
    iva = round(subtotal * cat["iva"], 2)
    return {
        "renglones": renglones,
        "desglose": {"renta": round(renta, 2), "servicios": round(serv, 2), "fletes": round(flete_tot, 2), "materiales": 0},
        "subtotal": subtotal, "iva": iva, "iva_tasa": cat["iva"], "con_iva": True, "total": round(subtotal + iva, 2),
        "condiciones": [cat["condiciones"][k] for k in ("renta", "retiro", "pipa") if k in conds and k in cat["condiciones"]],
    }


def documento_de(fila: dict[str, Any]) -> dict[str, Any]:
    """El documento congelado de una cotización del sistema anterior."""
    cat = _catalogo()
    partidas = json.loads(fila["partidas"]) if isinstance(fila["partidas"], str) else fila["partidas"]
    calc = _calcular(cat, partidas, fila.get("modo_unidad") or "horas")
    emp = dict(cat["empresa"])
    emp.setdefault("correo", "")
    emp.setdefault("web", "")
    # La app anterior guardaba el mismo texto en cliente y obra («Obra / Cliente»).
    cliente = (fila.get("cliente") or fila.get("obra") or "").strip()
    obra = (fila.get("obra") or "").strip()
    return {
        "legado": True,
        "titulo": "Cotización de renta de maquinaria",
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
