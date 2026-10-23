# Paso a paso: subir el Campus Metaverso a un servidor Linux (Rocky Linux)

Este documento es un checklist práctico para desplegar este repositorio. Usa como referencia `DESPLIEGUE.md` para más detalles.

## 1) Pre-requisitos
- [ ] Servidor con Rocky Linux 9/10, 2GB RAM+ y acceso `sudo`/root
- [ ] Dominio apuntando al servidor (A/AAAA). Para HTTPS con certbot se necesita dominio
- [ ] Acceso SSH al servidor
- [ ] Exportación de la BD `usta_metaverso` desde desarrollo (el esquema NO está en el repo)
- [ ] URL del repositorio Git (ej. `https://github.com/ORG/REPO.git`)

## 2) Preparar servidor
Conéctate por SSH y ejecuta:

```bash
# Actualizar
sudo dnf update -y

# Usuario dedicado
sudo useradd -m campus
sudo usermod -aG wheel campus

# Firewall (solo 80/443)
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

## 3) Instalar dependencias
```bash
# Node.js 22 LTS
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
node -v  # v22.x

# Nginx, Git, rsync, MySQL client, Certbot
sudo dnf install -y nginx git rsync mysql certbot python3-certbot-nginx
```

**Base de datos (elegir UNA):**

- Opción A: MySQL 8 (recomendado)
```bash
sudo dnf install -y https://dev.mysql.com/get/mysql80-community-release-el9.noarch.rpm
sudo dnf install -y mysql-community-server
sudo systemctl enable --now mysqld
```
- Opción B: MariaDB
```bash
sudo dnf install -y mariadb-server
sudo systemctl enable --now mariadb
```

## 4) Clonar código y compilar frontend
```bash
sudo mkdir -p /opt/campus-metaverso
sudo chown campus:campus /opt/campus-metaverso
sudo -iu campus
cd /opt/campus-metaverso

# Clonar
git clone <URL_DEL_REPOSITORIO> .

# Instalar dependencias (frontend y backend). NO usar --omit=dev en backend (usa tsx)
npm ci --prefix frontend
npm ci --prefix backend

# Compilar frontend
npm run build  # genera frontend/dist
```

> Si hay archivos `.glb` muy grandes y falla el clone, usar Git LFS (`git lfs install` + `.gitattributes` con `*.glb filter=lfs...`).

## 5) Configurar Base de Datos
### Desde desarrollo (exportar)
```bash
# En máquina de desarrollo
mysqldump -u root -p --routines --triggers usta_metaverso > usta_metaverso.sql
scp usta_metaverso.sql campus@TU_SERVIDOR:/tmp/
```
*(En Windows usar ruta completa a `mysqldump.exe`)*

### En servidor (crear BD y usuario)
```bash
sudo mysql  # o mysql -u root -p
```
```sql
CREATE DATABASE usta_metaverso CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'campus'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE';
CREATE USER 'campus'@'127.0.0.1' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE'; -- por si hay conexión TCP
GRANT ALL PRIVILEGES ON usta_metaverso.* TO 'campus'@'localhost';
GRANT ALL PRIVILEGES ON usta_metaverso.* TO 'campus'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

### Importar volcado
```bash
mysql -u campus -p usta_metaverso < /tmp/usta_metaverso.sql
```

## 6) Variables de entorno del backend
```bash
sudo -iu campus
cd /opt/campus-metaverso
cp backend/.env.example backend/.env
nano backend/.env
```

Editar con valores reales:
```ini
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=campus
DB_PASSWORD=CLAVE_FUERTE_DEL_PASO_5
DB_NAME=usta_metaverso
CORS_ORIGENES=https://TU_DOMINIO.com
JWT_SECRET=<GENERAR_CON_openssl_rand_-hex_32>
```

Generar JWT_SECRET:
```bash
openssl rand -hex 32
```

## 7) Crear servicio systemd (backend)
Crear `/etc/systemd/system/campus-metaverso.service` (con `sudo nano`):
```ini
[Unit]
Description=Campus Metaverso - backend (Express + socket.io)
After=network.target mysqld.service
# Si usas MariaDB: cambiar a mariadb.service

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

Activar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now campus-metaverso
systemctl status campus-metaverso  # active (running)
journalctl -u campus-metaverso -f # logs
```

Comprobar backend:
```bash
curl -i http://127.0.0.1:3000/
```

## 8) Configurar nginx (estáticos + proxy)
Publicar estáticos:
```bash
sudo mkdir -p /var/www/campus
sudo rsync -a --delete /opt/campus-metaverso/frontend/dist/ /var/www/campus/
sudo chown -R root:root /var/www/campus
```

Crear `/etc/nginx/conf.d/campus.conf`:
```nginx
server {
    listen 80;
    server_name TU_DOMINIO.com;

    root /var/www/campus;
    index index.html;

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

Aplicar:
```bash
sudo setsebool -P httpd_can_network_connect 1
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

## 9) HTTPS con Certbot
```bash
sudo certbot --nginx -d TU_DOMINIO.com
sudo certbot renew --dry-run
```

## 10) Verificación final
```bash
systemctl status campus-metaverso --no-pager
systemctl status nginx --no-pager
sudo nginx -t
curl -I https://TU_DOMINIO.com
```

Pruebas funcionales:
- [ ] Entrar con `admin@usantoto.edu.co` / `Admin2026*` y cambiar la contraseña
- [ ] Abrir en dos navegadores/incógnito con dos usuarios en misma clase
- [ ] Avatares se ven correctamente
- [ ] Sincronización de diapositivas (PDF) entre usuarios
- [ ] Notas en pizarra + descarga `.txt`
- [ ] Vista "Tablero" al usar atril (R)
- [ ] Cámara/micrófono/pantalla compartida funcionan (WebRTC)
- [ ] Carga correcta sin errores en consola

Logs útiles:
```bash
journalctl -u campus-metaverso -n 100 --no-pager
sudo tail -n 100 /var/log/nginx/error.log
sudo ausearch -m avc -ts recent  # SELinux
```

## 11) Actualizar versión (futuras)
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

## 12) Copias de seguridad
```bash
sudo mkdir -p /respaldos && sudo chown campus /respaldos
# Programar con cron si se desea
mysqldump -u campus -p usta_metaverso | gzip > /respaldos/usta_metaverso-$(date +%F).sql.gz
```

## Notas importantes
- `.env` **nunca** va a git (solo `.env.example`)
- Al arrancar, el backend crea `admin@usantoto.edu.co` / `Admin2026*` (rol admin) si no existe; cámbiala al primer ingreso. A mano: `npm run seed:admin --prefix backend`
- Backend corre con `tsx` en producción (tal como está)
- WebRTC va peer-to-peer; señalización por Socket.IO a través de nginx
- Si hay problemas con permisos/SELinux, revisar etiquetas en `/var/www/campus`
- CORS debe apuntar al dominio HTTPS real