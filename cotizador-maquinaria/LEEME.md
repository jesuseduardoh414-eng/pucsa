# Cotizador · PUCSA Maquinaria

Renta de maquinaria (por hora, mínimo 8 h), servicios de agua y acarreos de material de 14 y 30 m³ (precio por zona), cal de patio (por tonelada, mínimo 28 t), carpeta asfáltica, block y venta de maquinaria (precio a mano), con historial, PDF y envío por WhatsApp. Incluye las calculadoras de pavimento y de m³ a toneladas.

Se instala en el celular desde el menú del navegador (Chrome: ⋮ → Agregar a la pantalla principal; Safari: Compartir → Agregar a inicio).

## Entrar

Se entra solo con el enlace que tiene la llave: `https://<dominio>/e/<llave>/`. Sin la llave, la página dice «No encontrado».

- **Crear o cambiar la llave:** desde la carpeta del proyecto corre `python cambiar_llave.py`. Muestra el enlace nuevo; los anteriores dejan de servir en ese momento, también lo instalado en los celulares.
- En el celular, abre el enlace e instálalo desde el menú del navegador (ver arriba).

## Correrlo en tu computadora

```
pip install -r requirements.txt
python cambiar_llave.py
python -m uvicorn backend.main:app --port 8000
```

Abre el enlace de pruebas que imprimió `cambiar_llave.py`.

## Subirlo a cPanel (Setup Python App)

Este proyecto es UNA app de Python: va en su propia carpeta, su propio subdominio y su propio entorno. No lo mezcles con el otro cotizador.

1. **Subdominio.** cPanel → *Domains* → *Create A Domain*: por ejemplo `cotizador.pucsa-maquinaria.com`. Si el dominio está en otro proveedor (GoDaddy, Namecheap…), agrega ahí un registro **A** del subdominio con la IP del servidor.
2. **Archivos.** Sube el zip a `/home/<usuario>/cotizador-maquinaria` (FUERA de `public_html`) con el *File Manager* y descomprímelo ahí. Debe quedar `passenger_wsgi.py` directamente dentro de esa carpeta.
3. **La app.** cPanel → *Setup Python App* → *Create Application*:
   - *Python version*: 3.11 o 3.12 (mínimo 3.10).
   - *Application root*: `cotizador-maquinaria`
   - *Application URL*: el subdominio del paso 1.
   - *Application startup file*: `passenger_wsgi.py`
   - *Application Entry point*: `application`
4. **Dependencias.** En la misma pantalla, en *Configuration files* agrega `requirements.txt` y toca *Run Pip Install*. (O en *Terminal*: copia el comando `source …/activate` que muestra la app arriba, y luego `cd ~/cotizador-maquinaria && pip install -r requirements.txt`.)
5. **La llave.** En *Terminal*, con el mismo `source …/activate`: `cd ~/cotizador-maquinaria && python cambiar_llave.py`. Copia el enlace y ponle el dominio adelante: `https://cotizador.pucsa-maquinaria.com/e/<llave>/`.
6. **Reinicia** la app (*Restart*) y abre el enlace.
7. **HTTPS.** cPanel → *SSL/TLS Status* → *Run AutoSSL* para el subdominio. Sin https no funcionan «Mandar por WhatsApp» ni instalarlo en el celular.

Para **actualizar** después: sube los archivos nuevos encima y toca *Restart*. **No borres ni reemplaces** `data/pucsa.db` (el historial).

Si ya tenían subida la versión anterior, súbela en la MISMA carpeta conservando `data/pucsa.db`: las cotizaciones de antes aparecen en el historial tal como eran.

Si algo falla, el error queda en `stderr.log` dentro de la carpeta de la app.

## Tarifas y textos

Todo está en `data/catalogo.json`: precio por hora de cada equipo, fletes, precios por zona del agua y los acarreos, municipios de cada zona, servicios con cantidad mínima (`minimo`, como la cal), productos sin precio de lista, condiciones, datos de la empresa, firma y datos para el pago. Al guardar el archivo, la app lo toma sin reiniciar.

Las cotizaciones guardadas no cambian si después cambias una tarifa: se guardan con su documento congelado.

`data/catalogo-anterior-2026-07.json` es el tabulador del sistema anterior; solo se usa para mostrar las cotizaciones que ya estaban guardadas. No lo borres.
