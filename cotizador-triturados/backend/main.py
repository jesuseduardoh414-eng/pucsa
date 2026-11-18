"""Cotizador de PUCSA Triturados (FastAPI).

Todo vive detrás del enlace con llave `/e/<llave>/` (ver `acceso.py`): la
pantalla, sus archivos y la API. Sin la llave correcta, 404.

El cálculo y el documento los arma la pantalla (`frontend/js/motor.js` y
`documento.js`, un solo motor). Aquí se sirve el tabulador y se guardan las
cotizaciones con su documento congelado.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend import acceso, db
from backend import catalogo as cat

RAIZ = Path(__file__).resolve().parent.parent
FRONTEND = RAIZ / "frontend"
ASSETS = RAIZ / "assets"

app = FastAPI(title="PUCSA Triturados · Cotizador", docs_url=None, redoc_url=None, openapi_url=None)

# Passenger (WSGI) no dispara el arranque de FastAPI: la tabla se asegura al importar.
db.init_db()

TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}
SIN_CACHE = {"index.html", "sw.js", "manifest.webmanifest"}


@app.middleware("http")
async def cabeceras(request: Request, call_next):
    resp = await call_next(request)
    # La llave va en la dirección: que no salga en el Referer ni la guarde un buscador.
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["X-Robots-Tag"] = "noindex, nofollow"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


def _pagina(mensaje: str, status: int) -> HTMLResponse:
    from html import escape
    return HTMLResponse(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
        f"<title>{escape(mensaje)}</title><body style='font-family:system-ui;padding:40px;color:#444'>{escape(mensaje)}</body>",
        status_code=status)


def _no_encontrado() -> HTMLResponse:
    return _pagina("No encontrado.", 404)


@app.exception_handler(StarletteHTTPException)
async def _errores(request: Request, exc: StarletteHTTPException):
    # La API responde JSON (la pantalla lee `detail`); una página, HTML.
    if "/api/" in request.url.path:
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    return _pagina(str(exc.detail), exc.status_code)


@app.exception_handler(RequestValidationError)
async def _invalido(request: Request, exc: RequestValidationError):
    errores = exc.errors()
    msg = str(errores[0].get("msg", "")) if errores else ""
    msg = msg.removeprefix("Value error, ") or "Los datos de la cotización no son válidos."
    return JSONResponse({"detail": msg}, status_code=422)


def _revisar(llave: str) -> None:
    if not acceso.hay_llave():
        raise HTTPException(503, "Falta crear la llave del enlace: en la carpeta del proyecto corre «python cambiar_llave.py».")
    if not acceso.llave_valida(llave):
        raise HTTPException(404, "No encontrado.")


# ---------- modelos ----------
class CotizacionIn(BaseModel):
    tipo: Literal["triturados"] = "triturados"
    cliente: str = Field(max_length=190)
    obra: str = Field("", max_length=190)
    atencion: str = Field("", max_length=190)
    municipio: str = Field("", max_length=120)
    notas: str = Field("", max_length=2000)
    categorias: list[str] = Field(default_factory=list, max_length=20)
    partidas: list[dict[str, Any]] = Field(max_length=200)
    documento: dict[str, Any]

    @field_validator("cliente")
    @classmethod
    def _cliente(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Escribe a nombre de quién va la cotización.")
        return v

    @field_validator("documento")
    @classmethod
    def _documento(cls, d: dict[str, Any]) -> dict[str, Any]:
        calc = d.get("calc")
        if not isinstance(calc, dict) or not isinstance(calc.get("renglones"), list) or not calc["renglones"]:
            raise ValueError("La cotización no tiene partidas.")
        if len(calc["renglones"]) > 300:
            raise ValueError("Demasiados renglones.")
        for k in ("subtotal", "iva", "total"):
            if not isinstance(calc.get(k), (int, float)) or calc[k] < 0:
                raise ValueError("Totales inválidos.")
        if not isinstance(d.get("titulo"), str):
            raise ValueError("Falta el título del documento.")
        if len(json.dumps(d, ensure_ascii=False)) > 400_000:
            raise ValueError("El documento es demasiado grande.")
        return d


# ---------- rutas ----------
@app.get("/")
def raiz():
    return _no_encontrado()


@app.get("/e/{llave}")
def sin_diagonal(llave: str):
    _revisar(llave)
    return RedirectResponse(f"{llave}/", status_code=307)


@app.get("/e/{llave}/api/catalogo")
def get_catalogo(llave: str):
    _revisar(llave)
    return JSONResponse(cat.cargar(), headers={"Cache-Control": "no-store"})


class MunicipioZona(BaseModel):
    municipio: str = Field(min_length=2, max_length=80)
    zona_id: str = Field(min_length=1, max_length=40)


@app.post("/e/{llave}/api/zona-municipio")
def post_zona_municipio(llave: str, entrada: MunicipioZona):
    """Un municipio que no estaba en ninguna zona de flete: se guarda en la elegida."""
    _revisar(llave)
    try:
        zonas = cat.agregar_municipio(entrada.municipio, entrada.zona_id)
    except KeyError:
        raise HTTPException(404, "Esa zona no existe.")
    return {"zonas": zonas}


@app.get("/e/{llave}/api/clientes")
def get_clientes(llave: str):
    _revisar(llave)
    return db.clientes()


@app.get("/e/{llave}/api/cotizaciones")
def get_cotizaciones(llave: str, q: str = ""):
    _revisar(llave)
    return db.listar(q[:80])


@app.post("/e/{llave}/api/cotizaciones")
def post_cotizacion(llave: str, entrada: CotizacionIn):
    _revisar(llave)
    datos = entrada.model_dump()
    # El folio y la fecha los pone el servidor; el documento los recibe al mostrarse.
    datos["documento"].pop("folio", None)
    datos["documento"].pop("fecha", None)
    return db.guardar(datos)


@app.get("/e/{llave}/api/cotizaciones/{cid}")
def get_cotizacion(llave: str, cid: int):
    _revisar(llave)
    cot = db.obtener(cid)
    if not cot:
        raise HTTPException(404, "Cotización no encontrada.")
    return cot


@app.delete("/e/{llave}/api/cotizaciones/{cid}")
def delete_cotizacion(llave: str, cid: int):
    _revisar(llave)
    if not db.eliminar(cid):
        raise HTTPException(404, "Cotización no encontrada.")
    return {"ok": True}


@app.get("/e/{llave}/{ruta:path}")
def estatico(llave: str, ruta: str):
    """La pantalla y sus archivos, siempre detrás de la llave."""
    _revisar(llave)
    ruta = ruta or "index.html"
    if ruta.startswith("api/"):
        raise HTTPException(404, "No encontrado.")
    base = ASSETS if ruta.startswith("assets/") else FRONTEND
    rel = ruta[len("assets/"):] if base is ASSETS else ruta
    archivo = (base / rel).resolve()
    if not archivo.is_relative_to(base.resolve()) or not archivo.is_file():
        raise HTTPException(404, "No encontrado.")
    tipo = TIPOS.get(archivo.suffix.lower())
    if not tipo:
        raise HTTPException(404, "No encontrado.")
    cache = "no-store" if archivo.name in SIN_CACHE else "no-cache"
    return FileResponse(str(archivo), media_type=tipo, headers={"Cache-Control": cache})
