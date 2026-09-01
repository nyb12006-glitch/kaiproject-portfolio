# Kevin Almeida — Portfolio V4

Cambios:
- Hero convertido en presentación sencilla, sin eslogan abstracto.
- Las webs ya no usan iframes: se muestran como capturas visuales y enlazan a la web real. Esto evita el rechazo de conexión por X-Frame-Options/CSP.
- YouTube usa miniaturas ligeras y enlace directo, evitando el error 153.
- Reels tienen tarjetas visuales y enlace directo a Instagram.
- Se eliminó la carga de iframes pesados y las fuentes externas para mejorar la velocidad.
- Imágenes con lazy loading y decoding async.
- Responsive.

### Nota sobre las capturas web
Las previsualizaciones usan `image.thum.io`. Si quieres que las imágenes sean 100% tuyas y no dependan de un servicio externo, puedes sustituirlas por capturas reales en `assets/images/`.


## V4 — Shopify
CultivaFungi está en Shopify y no se intenta incrustar ni capturar la tienda mediante iframe/screenshot proxy. La tarjeta utiliza directamente una imagen alojada en el CDN de Shopify. Sampayo utiliza directamente una imagen de su propia web. Esto evita los rechazos de conexión y elimina dos peticiones de captura externas.

## V4.1 — Optimización y despliegue
- Experience Barber Shop y DACAPO ya no dependen de `image.thum.io` en cada carga: las capturas se descargaron una vez, se comprimieron a WebP (de 636 KB/1,6 MB a ~19-21 KB) y se sirven localmente desde `assets/images/`.
- Favicon propio (`assets/icons/`, SVG + PNG + apple-touch-icon) — antes no existía y daba 404.
- Meta tags Open Graph / Twitter Card + imagen de preview (`assets/images/og-image.png`) para que el link se vea bien al compartirlo.
- Datos estructurados (schema.org Person) en el `<head>`.
- `width`/`height` en todas las imágenes para reducir CLS, y `preconnect` a los dominios externos restantes.
- Colores de texto secundario (`.eyebrow`, textos grises, footer) ajustados para cumplir el contraste mínimo WCAG AA (4.5:1) — antes fallaban en varios fondos.
- `robots.txt` añadido.
- Desplegado en GitHub + Vercel, con autodeploy en cada push a `main`.

## V4.2 — Interactividad
- Los reels de Instagram ahora muestran la miniatura real del vídeo (antes era un degradado de color sin contenido) y reproducen un preview de 6s sin audio al pasar el ratón por encima (`assets/videos/`), volviendo a la miniatura al salir.
- Scroll-reveal: las tarjetas de proyectos, vídeos y servicios entran con un fade suave al hacer scroll (`IntersectionObserver`), desactivado automáticamente si el sistema tiene `prefers-reduced-motion`.
- Cursor personalizado ("Ver ↗") que sigue al ratón sobre las tarjetas de proyectos web, solo en dispositivos con ratón (`hover: hover`).
