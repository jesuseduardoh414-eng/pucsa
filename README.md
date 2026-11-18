# Cotizadores PUCSA

Dos proyectos **independientes**, cada uno en su carpeta. No comparten código, base de datos ni despliegue: cada uno se instala y se actualiza por separado.

| Carpeta | Qué cotiza |
|---|---|
| [`cotizador-maquinaria/`](cotizador-maquinaria/) | PUCSA Maquinaria: renta de maquinaria por hora, agua y acarreos por zona, cal de patio, carpeta asfáltica, block y venta de maquinaria. |
| [`cotizador-triturados/`](cotizador-triturados/) | PUCSA Triturados: grava, arena y base en planta, por viaje a obra o pedido grande. |

Los dos incluyen historial, PDF, envío por WhatsApp y las calculadoras de pavimento y de m³ a toneladas. Se entra solo con un enlace con llave (`/e/<llave>/`).

Hechos con Python (FastAPI) y una pantalla en JavaScript sin compilar. El historial es un archivo SQLite que la app crea sola en `data/`.

Cómo correr, crear la llave y subir a cPanel: el `LEEME.md` de cada carpeta.

Las bases de datos (`*.db`) y la llave (`llave.sha256`) no van en el repositorio: se crean en cada instalación.
