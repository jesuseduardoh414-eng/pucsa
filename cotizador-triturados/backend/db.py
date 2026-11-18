"""Persistencia en SQLite (un archivo, `data/triturados.db`).

Cada cotización se guarda CONGELADA: lo que se eligió (partidas, para volver a
cotizar sobre ella) y el documento tal como se vio, con sus importes. Ver,
descargar o mandar una cotización guardada usa ese documento, nunca el
tabulador de hoy.

El folio sale del id del renglón (AUTOINCREMENT no reutiliza ids), así que no
se repite aunque se borren cotizaciones ni aunque dos personas guarden a la vez.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path
from typing import Any

from backend import legado

RAIZ = Path(__file__).resolve().parent.parent
RUTA_DB = RAIZ / "data" / "triturados.db"


def _conn() -> sqlite3.Connection:
    con = sqlite3.connect(RUTA_DB, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    with closing(_conn()) as con, con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS cotizaciones (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                folio     TEXT NOT NULL,
                cliente   TEXT NOT NULL DEFAULT '',
                obra      TEXT NOT NULL DEFAULT '',
                atencion  TEXT NOT NULL DEFAULT '',
                sucursal  TEXT NOT NULL DEFAULT '',
                fecha     TEXT NOT NULL,
                partidas  TEXT NOT NULL,
                con_iva   INTEGER NOT NULL DEFAULT 1,
                subtotal  REAL NOT NULL,
                iva       REAL NOT NULL,
                total     REAL NOT NULL,
                notas     TEXT NOT NULL DEFAULT ''
            )
        """)
        cols = {r[1] for r in con.execute("PRAGMA table_info(cotizaciones)").fetchall()}
        for col, ddl in (
            ("sucursal", "TEXT NOT NULL DEFAULT ''"),
            ("titulo", "TEXT NOT NULL DEFAULT ''"),
            ("documento", "TEXT"),
        ):
            if col not in cols:
                con.execute(f"ALTER TABLE cotizaciones ADD COLUMN {col} {ddl}")
        _migrar_anteriores(con)


def _migrar_anteriores(con: sqlite3.Connection) -> None:
    """Congela una vez el documento de las cotizaciones del sistema anterior."""
    for fila in con.execute("SELECT * FROM cotizaciones WHERE documento IS NULL").fetchall():
        try:
            doc = legado.documento_de(dict(fila))
        except Exception:  # noqa: BLE001 — una fila rara no debe tumbar la app
            continue
        con.execute("UPDATE cotizaciones SET documento = ?, titulo = ? WHERE id = ?",
                    (json.dumps(doc, ensure_ascii=False), doc["titulo"], fila["id"]))


def guardar(datos: dict[str, Any]) -> dict[str, Any]:
    doc = datos["documento"]
    calc = doc["calc"]
    ahora = datetime.now()
    with closing(_conn()) as con, con:
        cur = con.execute("""
            INSERT INTO cotizaciones
              (folio, cliente, obra, atencion, sucursal, fecha, partidas, con_iva, subtotal, iva, total,
               notas, titulo, documento)
            VALUES ('', ?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            datos["cliente"], datos["obra"], datos["atencion"], datos["municipio"],
            ahora.isoformat(timespec="seconds"),
            json.dumps(datos["partidas"], ensure_ascii=False),
            1 if calc.get("con_iva", True) else 0,
            float(calc["subtotal"]), float(calc["iva"]), float(calc["total"]),
            datos["notas"], doc["titulo"], json.dumps(doc, ensure_ascii=False),
        ))
        cid = cur.lastrowid
        con.execute("UPDATE cotizaciones SET folio = ? WHERE id = ?", (f"COT-{cid:03d}/{ahora:%Y}", cid))
    return obtener(cid)


def obtener(cid: int) -> dict[str, Any] | None:
    with closing(_conn()) as con:
        fila = con.execute("SELECT * FROM cotizaciones WHERE id = ?", (cid,)).fetchone()
    if not fila:
        return None
    d = dict(fila)
    d["municipio"] = d.pop("sucursal")
    d["partidas"] = json.loads(d["partidas"])
    d["con_iva"] = bool(d["con_iva"])
    d["documento"] = json.loads(d["documento"]) if d.get("documento") else None
    return d


def listar(q: str = "", limite: int = 300) -> list[dict[str, Any]]:
    sql = "SELECT id, folio, cliente, obra, sucursal AS municipio, fecha, total, titulo FROM cotizaciones"
    args: list[Any] = []
    q = q.strip()
    if q:
        sql += " WHERE folio LIKE ? OR cliente LIKE ? OR obra LIKE ? OR sucursal LIKE ?"
        args += [f"%{q}%"] * 4
    sql += " ORDER BY id DESC LIMIT ?"
    args.append(limite)
    with closing(_conn()) as con:
        return [dict(r) for r in con.execute(sql, args).fetchall()]


def eliminar(cid: int) -> bool:
    with closing(_conn()) as con, con:
        return con.execute("DELETE FROM cotizaciones WHERE id = ?", (cid,)).rowcount > 0


def clientes() -> list[str]:
    with closing(_conn()) as con:
        filas = con.execute("""
            SELECT cliente FROM cotizaciones WHERE cliente <> ''
            GROUP BY cliente ORDER BY MAX(id) DESC LIMIT 300
        """).fetchall()
    return [r["cliente"] for r in filas]
