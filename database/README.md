# Base de datos - Campus Metaverso

La aplicación usa **MySQL/MariaDB**. El archivo `usta_metaverso.sql` contiene la estructura y los datos iniciales del proyecto.

> Importante: el dump incluye correos y hashes de contraseñas reales. No lo subas a un repositorio público ni lo compartas fuera del equipo.

## 1. Crear e importar la base

### Opción A: phpMyAdmin o panel del hosting

1. Crea una base de datos llamada `usta_metaverso` con cotejamiento `utf8mb4_unicode_ci`.
2. Crea un usuario de MySQL y dale permisos sobre esa base.
3. Entra a phpMyAdmin, selecciona la base `usta_metaverso` y usa **Importar**.
4. Selecciona `database/usta_metaverso.sql` y ejecuta la importación.

Si el panel ya creó la base y el usuario no tiene permiso para crear bases, puedes comentar o borrar las líneas `CREATE DATABASE` del archivo; el `USE` seguirá seleccionando la base existente.

### Opción B: consola del servidor

```bash
mysql -u usuario -p < database/usta_metaverso.sql
```

El archivo ya incluye `CREATE DATABASE IF NOT EXISTS` y `USE usta_metaverso`, así que no necesitas seleccionar la base antes.

Si quieres importar a una base con otro nombre, cambia el nombre en:

- `CREATE DATABASE` y `USE` dentro de `usta_metaverso.sql`.
- `DB_NAME` en `backend/.env`.

## 2. Configurar el backend

Copia la plantilla y ajusta los valores del servidor:

```bash
cp backend/.env.example backend/.env
```

Variables mínimas:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=usuario_mysql
DB_PASSWORD=clave_mysql
DB_NAME=usta_metaverso

JWT_SECRET=una_cadena_larga_y_aleatoria
```

El registro crea la cuenta directamente, sin código de verificación por correo. La página pública registra estudiantes; los docentes se crean desde el panel de administración.

## 3. Instalar y ejecutar

```bash
npm --prefix backend install
npm --prefix frontend install

npm --prefix frontend run build
npm --prefix backend run start
```

Para producción se recomienda usar un gestor de procesos como PM2:

```bash
npm install -g pm2
cd backend
pm2 start npm --name campus-metaverso -- run start
pm2 save
```

## 4. Comprobar la importación

Entra a MySQL y ejecuta:

```sql
USE usta_metaverso;
SHOW TABLES;
SELECT COUNT(*) FROM cuentas;
```

Deben aparecer las tablas `cuentas`, `clases` e `inscripciones`.

## 5. Errores comunes

| Error | Causa probable | Solución |
|---|---|---|
| `ERROR 1046 (3D000): No database selected` | El dump se importó sin seleccionar una base | Usa el archivo actualizado o selecciona la base antes de importar |
| `ERROR 1044/1045: Access denied` | Usuario o contraseña incorrectos, o faltan permisos | Revisa `DB_USER`, `DB_PASSWORD` y los permisos del usuario |
| `ERROR 1215: Cannot add foreign key constraint` | Orden de tablas o FK activas durante la importación | El archivo incluye `SET FOREIGN_KEY_CHECKS=0`; verifica que se ejecute completo |
| `ERROR 1142: LOCK TABLES command denied` | El hosting no permite `LOCK TABLES` | Ya se quitaron los `LOCK TABLES` del dump |
| `ECONNREFUSED` al iniciar el backend | MySQL no está corriendo o el host/puerto es incorrecto | Revisa `DB_HOST`, `DB_PORT` y el servicio de MySQL |

## 6. Notas de seguridad

- Cambia las contraseñas de las cuentas de prueba antes de publicar.
- No uses el valor por defecto de `JWT_SECRET` en producción.
- Mantén `backend/.env` fuera de git.
- Haz copias de seguridad periódicas con `mysqldump`.

## 7. Migración de clases con tipo de salón

Si la base ya existe y fue creada antes de la función de tipos de salón, ejecuta una sola vez:

```bash
mysql -u usuario -p usta_metaverso < database/migracion_tipo_salon.sql
```

Esto agrega la columna `tipo_salon` (`normal`, `reunion` o `griego`, por defecto `normal`) a la tabla `clases`. Las clases existentes quedan automáticamente en `normal`. No ejecutes la migración dos veces: MySQL fallará porque la columna ya existe.

Si la base ya tenía la columna con el valor antiguo `arte`, ejecuta además una sola vez:

```bash
mysql -u usuario -p usta_metaverso < database/migracion_salon_reunion.sql
```

Esa migración renombra las clases de `arte` a `reunion` y deja el enum en `normal`, `reunion` y `griego`.

En instalaciones nuevas no hace falta: `usta_metaverso.sql` ya incluye la columna con los tipos actuales.
