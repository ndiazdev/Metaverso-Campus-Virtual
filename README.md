# Campus Metaverso

Aula 3D (metaverso) con dashboard de usuarios: login/registro, dashboards por rol
(admin, docente, estudiante, invitado) y una sala 3D con pizarra proyectada.

El proyecto está **separado en dos carpetas** para que sea más fácil de trabajar y
de subir:

```
campus-metaverso/
├── frontend/                  ← lo VISUAL (Vite + TypeScript + Babylon.js)
│   ├── index.html
│   ├── public/                imágenes, modelos .glb
│   └── src/
│       ├── api/               capa de API (cliente.ts con la URL del backend)
│       ├── page/login/        login y registro
│       ├── page/dashboard/    dashboards por rol
│       ├── 3d/                sala 3D, personaje, pizarra
│       │   ├── funcionalidades.ts    caminar, sentarse, presentar en el atril,
│       │   │                         cámara y mano → LO REUTILIZA CUALQUIER
│       │   │                         MAPA (se importa, no se reescribe)
│       │   ├── tableroFuncionalidad.ts  pizarra: PDF, vídeo, páginas, dibujo
│       │   ├── personaje.ts          modelo 3D del avatar
│       │   └── metaverso.ts          el mapa del salón (cablea lo anterior)
│       ├── ui/                barra de usuario, menú de ajustes, webcam, micrófono
│       └── state/             sesión y tipos compartidos
│
├── backend/                   ← las FUNCIONALIDADES (Express + MySQL)
│   ├── .env.example           plantilla de configuración
│   ├── .env                   tus datos reales (NO se sube a git)
│   └── src/
│       ├── index.ts           arranca el servidor
│       ├── app.ts             monta rutas + sirve el frontend compilado
│       ├── entorno.ts         lee las variables del .env
│       ├── db.ts              pool de MySQL
│       ├── roles.ts           regla de detección de rol por correo
│       └── rutas/             una funcionalidad por archivo
│           ├── auth.ts            POST /api/login, /api/registro
│           ├── usuarios.ts        GET /api/usuarios, PATCH /api/usuarios/:correo/rol
│           ├── clases.ts          GET/POST /api/clases, /api/clases/docente|estudiante/:correo
│           └── inscripciones.ts   GET/POST /api/inscripciones
│
├── scripts/dev.cjs            arranca las dos partes con `npm run dev`
└── package.json               scripts de la raíz (no tiene dependencias)
```

## Requisitos

- Node.js 20 o superior
- MySQL con la base `usta_metaverso` (tablas `cuentas`, `clases`, `inscripciones`)

## 1. Instalar

Desde la raíz del proyecto:

```bash
npm --prefix frontend install
npm --prefix backend install
```

## 2. Configurar el backend

Copia la plantilla y pon tus datos:

```bash
# Windows (PowerShell)
Copy-Item backend\.env.example backend\.env

# macOS / Linux
cp backend/.env.example backend/.env
```

> **`.env` nunca se sube a git.** Está en `.gitignore`; lo único que se versiona es
> `.env.example` (sin credenciales), para que cualquiera sepa qué variables necesita.

## 3. Levantar en desarrollo

```bash
npm run dev
```

Arranca las dos partes a la vez, con su color en la consola:

- **front** → http://localhost:5173
- **back** → http://localhost:3000

También se pueden levantar por separado: `npm run dev:front` y `npm run dev:back`.
`Ctrl+C` detiene las dos.

## 4. Compilar y subir (un solo servidor)

```bash
npm run build     # compila frontend/ → frontend/dist
npm start         # Express sirve la API y el frontend en el mismo puerto
```

Abriendo **http://localhost:3000** queda lista la aplicación completa.

Para subirlo, en la plataforma (Render, Railway, etc.) se ponen:

| opción | valor |
|---|---|
| carpeta | la raíz del proyecto |
| *build command* | `npm install --prefix frontend && npm install --prefix backend && npm run build` |
| *start command* | `npm start` |
| variables de entorno | `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `CORS_ORIGENES` |

Como el frontend y la API viven en el **mismo origen**, en producción las peticiones
son relativas (`/api/...`) y **no hay que configurar ninguna URL**: eso es lo que hace
`frontend/src/api/cliente.ts`.

## Scripts disponibles

| comando | qué hace |
|---|---|
| `npm run dev` | frontend + backend a la vez |
| `npm run dev:front` | solo el frontend (Vite) |
| `npm run dev:back` | solo el backend (Express) |
| `npm run build` | compila el frontend a `frontend/dist` |
| `npm start` | arranca el backend (sirve API + frontend compilado) |
| `npm run verificar` | compila el front y revisa los tipos del back |

## Notas

- **Los mapas no reescriben la lógica**: caminar (WASD), sentarse (E), presentar en
  el atril (R), cámara 1ª/3ª persona (B) y mano alzada (H) viven en
  `frontend/src/3d/funcionalidades.ts`. Un mapa nuevo importa `crearFuncionalidades(...)`,
  le entrega su escena, sus sillas, su atril y sus colisiones, y ya funciona.
- El rol de cada cuenta se deduce del correo en `backend/src/roles.ts`
  (invitado / docente / admin / estudiante); el frontend no decide roles.
- Si la API se muda a otro sitio, se fuerza con `VITE_API_URL` en el `.env` del
  frontend; sin eso, en desarrollo usa `http://localhost:3000/api` y en producción `/api`.
