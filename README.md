# Rutas Empordà

App web para el móvil con las 31 excursiones desde Pals (Alt y Baix Empordà), sacadas de la guía provisional del 2 de noviembre de 2026.

- Lista de rutas con filtros por comarca, buscador y orden por km o tiempo.
- Ficha de cada ruta con paradas, enlaces a Waze y Google Maps, castillos, calas, mercados y avisos.
- Menú para cambiar el punto de partida (GPS, un lugar escrito o Pals) y recalcular km y minutos con Google.
- Nota de hasta 1.000 caracteres y marca de "hecha" por ruta, guardadas solo en el móvil.
- Funciona sin conexión una vez abierta (el recálculo sí necesita internet).

## Clave de Google

La clave no está en el código: se pega en el menú de la app y se guarda solo en el móvil.

En Google Cloud, la clave necesita:
1. APIs activadas: **Maps JavaScript API** y **Routes API**.
2. Restricción de aplicación: sitios web, con `https://jordi0606.github.io/*`.
3. Restricción de API: solo esas dos.

Las rutas se piden sin tráfico en tiempo real.
