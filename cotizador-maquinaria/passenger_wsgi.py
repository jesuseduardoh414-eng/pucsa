"""Arranque para cPanel / Passenger — puente ASGI->WSGI SIN hilos de fondo.

FastAPI es ASGI; Passenger corre WSGI. En vez de a2wsgi (que arranca un bucle de
asyncio en un hilo al importar y se cuelga bajo el modelo preload+fork de
Passenger), aquí se corre la app ASGI con un event loop NUEVO por cada petición,
en el mismo hilo del worker. Sin websockets/streaming/lifespan (esta app no los
usa) es correcto y estable. En local se usa uvicorn (ver LEEME.md), no este archivo.
"""
import asyncio
import os
import sys
import traceback
from http import HTTPStatus

sys.path.insert(0, os.path.dirname(__file__))

from backend.main import app as _asgi_app  # noqa: E402
from backend import db as _db              # noqa: E402

_db.init_db()  # WSGI no dispara lifespan: garantiza la tabla


def application(environ, start_response):
    # ---- WSGI environ -> ASGI scope ----
    headers = []
    for k, v in environ.items():
        if k.startswith("HTTP_"):
            headers.append((k[5:].replace("_", "-").lower().encode("latin-1"),
                            v.encode("latin-1")))
        elif k in ("CONTENT_TYPE", "CONTENT_LENGTH") and v:
            headers.append((k.replace("_", "-").lower().encode("latin-1"),
                            v.encode("latin-1")))
    path = environ.get("PATH_INFO", "/") or "/"
    try:
        port = int(environ.get("SERVER_PORT") or 0)
    except ValueError:
        port = 0
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.1"},
        "http_version": environ.get("SERVER_PROTOCOL", "HTTP/1.1").split("/")[-1],
        "method": environ.get("REQUEST_METHOD", "GET"),
        "scheme": environ.get("wsgi.url_scheme", "http"),
        "path": path,
        "raw_path": path.encode("latin-1"),
        "query_string": environ.get("QUERY_STRING", "").encode("latin-1"),
        "root_path": environ.get("SCRIPT_NAME", ""),
        "headers": headers,
        "server": (environ.get("SERVER_NAME", ""), port or None),
        "client": (environ.get("REMOTE_ADDR", ""), 0),
    }

    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
    except (ValueError, TypeError):
        length = 0
    body = environ["wsgi.input"].read(length) if length > 0 else b""

    state = {"status": 500, "headers": [], "body": bytearray(), "empezo": False}

    async def correr():
        # «El cliente se fue» solo cuando la respuesta ya salió completa. Antes se
        # avisaba en cuanto se leía la petición y la app cortaba los archivos a
        # media respuesta: la página y sus archivos llegaban con 0 bytes.
        listo = asyncio.Event()
        leido = {"ya": False}

        async def receive():
            if not leido["ya"]:
                leido["ya"] = True
                return {"type": "http.request", "body": body, "more_body": False}
            await listo.wait()
            return {"type": "http.disconnect"}

        async def send(message):
            t = message["type"]
            if t == "http.response.start":
                state["status"] = message["status"]
                state["headers"] = message.get("headers", [])
                state["empezo"] = True
            elif t == "http.response.body":
                state["body"].extend(message.get("body", b""))
                if not message.get("more_body", False):
                    listo.set()

        await _asgi_app(scope, receive, send)

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(correr())
    except Exception:  # noqa: BLE001 — se registra y se responde 500 en vez de tumbar el proceso
        traceback.print_exc(file=sys.stderr)
        if not state["empezo"]:
            state.update(status=500, headers=[(b"content-type", b"text/plain; charset=utf-8")],
                         body=bytearray("Error interno del cotizador.".encode("utf-8")))
    finally:
        loop.close()

    try:
        phrase = HTTPStatus(state["status"]).phrase
    except ValueError:
        phrase = ""
    start_response(f"{state['status']} {phrase}",
                   [(k.decode("latin-1"), v.decode("latin-1")) for k, v in state["headers"]])
    return [bytes(state["body"])]
