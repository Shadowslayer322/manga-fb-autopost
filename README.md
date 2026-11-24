# SenshiManga — Autopost en Facebook (CapibaraTraductor API v1)

Publica automáticamente los nuevos capítulos de tu scan en **CapibaraTraductor** (`https://capibaratraductor.com/senshimanga`) hacia tu **Página de Facebook** usando la **Meta Graph API** y **GitHub Actions** (100% gratis).

## Cómo funciona
1. Consulta `GET /api/v1/works` con tu `CAPI_API_KEY` (solo ~3 peticiones para todas tus obras públicas).
2. Detecta qué obras tienen un `lastChapterAt` más reciente que el guardado en `state/published.json`.
3. Consulta `GET /api/v1/works/{workId}/chapters?order=desc` únicamente para esas obras y filtra `state === "published"`.
4. Publica cada capítulo nuevo en tu Página de Facebook usando la plantilla de `src/formatter.js` y guarda el estado en `state/published.json` para nunca repetir.

## 1. Obtener `FB_PAGE_ID` y `FB_PAGE_ACCESS_TOKEN` (que no expira)

1. Entra a [Meta for Developers](https://developers.facebook.com/) → **Mis apps** → **Crear app** (tipo *Otros* → *Negocios*).
2. Abre el **Explorador de la API Graph** (*Herramientas → Explorador de la API Graph*).
3. Selecciona tu app, elige **Token de acceso de usuario** y agrega estos permisos:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
4. Haz clic en **Generar token de acceso** y autoriza tu Página de Facebook.
5. Abre el [Depurador de tokens](https://developers.facebook.com/tools/debug/accesstoken/), pega ese token y pulsa **Extender token de acceso** (para obtener un token de usuario de 60 días).
6. Con ese token extendido, consulta en el Explorador de la API Graph:
   ```
   GET /me/accounts
   ```
   Copia de tu Página:
   - `id` → **`FB_PAGE_ID`**
   - `access_token` → **`FB_PAGE_ACCESS_TOKEN`** (no expira mientras no revoques permisos).

## 2. Probar en local

Copia `.env.example` a `.env`, coloca tu `CAPI_API_KEY` y ejecuta:

```bash
npm run dry-run
```

## 3. Subir a GitHub y activar el robot

1. Sube este proyecto a un repositorio **privado** en GitHub.
2. Ve a **Settings → Secrets and variables → Actions → New repository secret** y agrega:
   - `CAPI_API_KEY`
   - `FB_PAGE_ID`
   - `FB_PAGE_ACCESS_TOKEN`
3. **Primera vez (importante):** Ve a **Actions → Autopost Manga Chapters to Facebook → Run workflow**, marca **`seed_only = true`** y ejecútalo. Eso registra los capítulos existentes para no hacer spam la primera vez.
4. A partir de ese momento, se ejecutará cada **15 minutos** automáticamente.
