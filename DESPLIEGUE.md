# Despliegue del Campus Metaverso en Linux (Rocky Linux)

Guía de pasos para publicar el proyecto en un servidor con **Rocky Linux** (9 o 10),
que es la distribución que pidió el ingeniero. Solo documenta los pasos: nada de
este archivo toca el código.

## Qué se despliega

```
                    ┌──────────────────────────────────────────┐
 Navegador  ──HTTPS─►  nginx (80/443)                          │
                    │    · /            → frontend/dist (estáticos)  │
                    │    · /api/        → proxy a 127.0.0.1:3000     │
                    │    · /socket.io/  → proxy con WebSocket        │
                    │                                          │
                    │  backend (Node, systemd) ──► MySQL (3306)          │
                    └──────────────────────────────────────────┘
```

- **Frontend**: Vite genera archivos estáticos (`frontend/dist`); nginx los sirve.
- **Backend**: Express + socket.io corriendo con `tsx` en el puerto 3000. El
  firewall solo abre 80/443, así que desde fuera solo se llega a él a través
  de nginx (nunca directo).
- **Base de datos**: MySQL/MariaDB con el esquema `usta_metaverso`.

En producción **no** se usan `npm run dev` ni `vite preview`: solo `npm run build`
para el frontend y `npm start` para el backend.

## Requisitos

- Un servidor (físico, VM o instancia en la nube) con Rocky Linux 9/10, 2 GB de
  RAM o más y acceso `sudo` (o root).
- Un dominio apuntando al servidor (registros A/AAAA). Para pruebas internas se
  puede usar la IP, pero certbot solo emite certificados con dominio.
- El repositorio del proyecto (GitHub) y una copia de la base de datos de
  desarrollo, porque **el esquema no está en el repo**: hay que exportarlo.

---

## Paso 1 — Preparar el servidor

```bash
# Actualizar el sistema
sudo dnf update -y

# Usuario dedicado para la aplicación (evita correr como root)
sudo useradd -m campus
sudo usermod -aG wheel campus

# Cortafuegos: solo se abren la web (80) y la web segura (443).
# El puerto 3000 del backend NO se abre: nginx habla con él por localhost.
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

## Paso 2 — Instalar el software

```bash
# Node.js 22 LTS (el proyecto usa Vite 8 y TypeScript moderno: hace falta
# Node 20.19+ / 22.12+). El script oficial de NodeSource configura el
# repositorio y después instala el paquete:
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
node -v   # debe imprimir v22.x

# nginx, git, rsync (para publicar dist), cliente MySQL y certbot (HTTPS).
# OJO: el paquete "git-utils" NO existe en Rocky: no lo pongas en la lista.
sudo dnf install -y nginx git rsync mysql certbot python3-certbot-nginx
```

Base de datos (dos opciones; elige **una**):

- **Opción A — MySQL 8** (la misma que en desarrollo, recomendada):

  ```bash
  sudo dnf install -y https://dev.mysql.com/get/mysql80-community-release-el9.noarch.rpm
  sudo dnf install -y mysql-community-server
  sudo systemctl enable --now mysqld
  ```

  > Esta URL del repositorio es para EL9. Si el servidor es Rocky 10, mira
  > la URL vigente en <https://dev.mysql.com/downloads/repo/> o elige la
  > Opción B.

- **Opción B — MariaDB** (el que viene en los repositorios de Rocky; el
  `mysql2` del backend funciona con él):

  ```bash
  sudo dnf install -y mariadb-server
  sudo systemctl enable --now mariadb
  ```

## Paso 3 — Obtener el código y compilar

```bash
sudo mkdir -p /opt/campus-metaverso
sudo chown campus:campus /opt/campus-metaverso
sudo -iu campus
cd /opt/campus-metaverso

git clone <URL_DEL_REPOSITORIO> .

# Dependencias COMPLETAS en las dos carpetas:
# el backend arranca TypeScript con `tsx`, que vive en devDependencies:
# instalar con --omit=dev rompería el servidor.
npm ci --prefix frontend
npm ci --prefix backend

# Compilar el frontend (genera frontend/dist)
npm run build
```

> **Modelos .glb pesados** (~50–60 MB cada uno en `frontend/public/models/`):
> si `git clone` falla por tamaño o algún día superan los 100 MB, activa Git LFS
> antes del clone: `git lfs install` y añadir `*.glb filter=lfs diff=lfs merge=lfs -text`
> al `.gitattributes`. Con los tamaños actuales (máx. ~58 MB) el clone normal funciona.

## Paso 4 — Base de datos

1. **Exportar** el esquema con datos desde el equipo de desarrollo:

   ```bash
   mysqldump -u root -p --routines --triggers usta_metaverso > usta_metaverso.sql
   scp usta_metaverso.sql campus@TU_SERVIDOR:/tmp/
   ```

   > En Windows `mysqldump` normalmente **no está en el PATH**: usa la ruta
   > completa, p. ej.
   > `"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u root -p --routines --triggers usta_metaverso > usta_metaverso.sql`
   > (`scp` sí viene incluido en Windows 10/11).

2. **Crear** la base de datos y un usuario propio en el servidor:

   ```bash
   sudo mysql
   ```

   ```sql
   CREATE DATABASE usta_metaverso CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'campus'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE';
   GRANT ALL PRIVILEGES ON usta_metaverso.* TO 'campus'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

   > Si al arrancar el backend da «Access denied for user
   > 'campus'@'127.0.0.1'», repite `CREATE USER` y `GRANT` con
   > `'campus'@'127.0.0.1'` además (la conexión llega por TCP aunque el
   > host sea `localhost`).

3. **Importar** el volcado:

   ```bash
   mysql -u campus -p usta_metaverso < /tmp/usta_metaverso.sql
   ```

## Paso 5 — Variables de entorno del backend

```bash
sudo -iu campus
cd /opt/campus-metaverso
cp backend/.env.example backend/.env
nano backend/.env
```

`.env` real (nunca se sube a git):

```ini
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=campus
DB_PASSWORD=CLAVE_FUERTE_DEL_PASO_4
DB_NAME=usta_metaverso
CORS_ORIGENES=https://TU_DOMINIO.com
JWT_SECRET=GENERADO_ABAJO
```

> `CORS_ORIGENES` en producción debe ser la URL real (https), no `*`.
>
> **`JWT_SECRET` es obligatorio**: firma los tokens de sesión. Genera uno
> aleatorio largo (p. ej. `openssl rand -hex 32`) y no lo reutilices entre
> entornos. Sin él, el backend usa un valor por defecto conocido y
> cualquiera podría firmar tokens válidos.

## Paso 6 — Servicio del backend (systemd)

Crea `/etc/systemd/system/campus-metaverso.service`:

```ini
[Unit]
Description=Campus Metaverso - backend (Express + socket.io)
After=network.target mysqld.service

[Service]
Type=simple
User=campus
WorkingDirectory=/opt/campus-metaverso
ExecStart=/usr/bin/npm start
Environment=NODE_ENV=production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Con MariaDB cambia mysqld.service por mariadb.service en la línea After=
sudo systemctl daemon-reload
sudo systemctl enable --now campus-metaverso
systemctl status campus-metaverso    # debe decir "active (running)"
journalctl -u campus-metaverso -f    # log en vivo
```

Comprobación rápida del backend:

```bash
curl -i http://127.0.0.1:3000/
```

(Tiene que responder algo; un 404 de Express también es buena señal: significa
que el proceso está vivo y escuchando.)

## Paso 7 — nginx (estáticos + proxy)

Primero se publica la carpeta estática compilada (así SELinux la sirve sin
permisos especiales: todo lo que vive bajo `/var/www` es legible por nginx):

```bash
sudo mkdir -p /var/www/campus
sudo rsync -a --delete /opt/campus-metaverso/frontend/dist/ /var/www/campus/
sudo chown -R root:root /var/www/campus
```

Crea `/etc/nginx/conf.d/campus.conf`:

```nginx
server {
    listen 80;
    server_name TU_DOMINIO.com;

    root /var/www/campus;
    index index.html;

    # Los .glb pesados pesan ~50 MB: por si algún día hay que subir algo
    client_max_body_size 50m;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # socket.io: necesita la cabecera de "upgrade" para el WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

```bash
# SELinux: permitir que nginx haga proxy hacia el backend en localhost
sudo setsebool -P httpd_can_network_connect 1

# Probar la configuración y arrancar
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Si `nginx -t` da un error de `server_name` duplicado, revisa si hay otro
archivo en `/etc/nginx/conf.d/` o un `default_server` en `/etc/nginx/nginx.conf`.

## Paso 8 — HTTPS con certbot

```bash
sudo certbot --nginx -d TU_DOMINIO.com
```

Certbot reescribe el bloque de nginx añadiendo el 443 y la redirección a
https, y deja el renovador automático instalado. Comprueba la renovación con:

```bash
sudo certbot renew --dry-run
```

## Paso 9 — Verificación

Comandos:

```bash
systemctl status campus-metaverso --no-pager
systemctl status nginx --no-pager
sudo nginx -t
curl -I https://TU_DOMINIO.com
```

Prueba manual (la de verdad):

1. Abrir `https://TU_DOMINIO.com` en dos navegadores distintos (normal +
   incógnito) y entrar con **dos usuarios diferentes** en la **misma clase**.
2. Que los dos avatares se vean con su skin correcta.
3. Que quien publica unas diapositivas (PDF) las vea también el otro en menos
   de un segundo, y que las flechas ←/→ cambien la diapositiva para los dos.
4. Probar las notas del tablero (botón «Notas en el tablero» o haciendo
   clic sobre la pizarra) y la descarga `.txt`.
5. Que el que se pone en el atril (R) vea la pantallita «Vista del tablero».
6. Que los dos puedan encender **cámara y micrófono** y compartir
   **pantalla**, y que el otro los vea/escuche en directo (va por WebRTC,
   no pasa por el servidor).

Logs útiles si algo falla:

```bash
journalctl -u campus-metaverso -n 100 --no-pager   # backend
sudo tail -n 100 /var/log/nginx/error.log           # nginx
sudo ausearch -m avc -ts recent                     # denegaciones de SELinux
```

## Actualizar una versión

```bash
sudo -iu campus
cd /opt/campus-metaverso
git pull
npm ci --prefix frontend
npm ci --prefix backend
npm run build
sudo rsync -a --delete frontend/dist/ /var/www/campus/
sudo systemctl restart campus-metaverso
```

## Copias de seguridad

La base de datos no está en git, así que se respalda a mano (programa un cron):

```bash
sudo mkdir -p /respaldos && sudo chown campus /respaldos
mysqldump -u campus -p usta_metaverso | gzip > /respaldos/usta_metaverso-$(date +%F).sql.gz
```

## Notas y límites conocidos

- **`.env` jamás se sube a git** (está en `.gitignore`; solo se versiona
  `.env.example`).
- **Los sockets aún no autentican**: el backend confía en el `correo` que llega
  en el mensaje `sala:entrar` (no hay JWT). Mientras eso siga así, el servidor
  DEBE ir detrás de HTTPS y `CORS_ORIGENES` debe ser la URL real.
- **Límites del canal**: los mensajes de socket aceptan hasta 8 MB (las
  imágenes del tablero viajan como JPEG de ~200–500 KB, holgado) y hay límite
  de mensajes por segundo.
- **Vídeo y pantalla compartida SÍ se sincronizan entre usuarios**: van por
  **WebRTC** (par a par, sin pasar por el servidor); por nginx solo viaja la
  señalización (`/socket.io/`). El contenido de la pizarra (imagen/PDF
  renderizado, YouTube, notas y limpiar) viaja por socket hasta 8 MB.
- **`tsx` en producción**: el backend corre TypeScript en caliente; si en algún
  momento se optimiza el despliegue, habría que compilarlo con `tsc` a JS.
- Si nginx no sirve los estáticos y SELinux aparece en los logs, comprueba las
  etiquetas: `ls -Zd /var/www/campus` debe ser `httpd_sys_content_t`.
