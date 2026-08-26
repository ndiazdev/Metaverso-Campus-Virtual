import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const app = express();

app.use(cors());
app.use(express.json());


// ======================================================
// CONFIGURACIÓN DE ROLES
// ======================================================

function detectarRolPorCorreo(correo: string): string {
  const DOMINIO_INSTITUCIONAL = '@usantoto.edu.co';

  const correoNormalizado = correo.trim().toLowerCase();

  if (!correoNormalizado.endsWith(DOMINIO_INSTITUCIONAL)) {
    return 'invitado';
  }

  const parteLocal = correoNormalizado.split('@')[0];

  const prefijosDocente = [
    'profe.',
    'profesor.',
    'docente.',
  ];

  if (
    prefijosDocente.some((prefijo) =>
      parteLocal.startsWith(prefijo)
    )
  ) {
    return 'docente';
  }

  if (parteLocal.startsWith('admin.')) {
    return 'admin';
  }

  return 'estudiante';
}


// ======================================================
// CONEXIÓN A MYSQL
// ======================================================

const db = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'usta_metaverso',
});


// ======================================================
// LOGIN
// ======================================================

app.post('/api/login', async (req, res) => {
  const { correo, contrasena } = req.body;

  try {
    const [rows]: any = await db.query(
      `
      SELECT
        id,
        correo,
        nombre_completo AS nombreCompleto,
        rol,
        carrera,
        materia,
        contrasena_hash
      FROM cuentas
      WHERE correo = ?
      `,
      [correo]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    const cuenta = rows[0];

    const coincide = await bcrypt.compare(
      contrasena,
      cuenta.contrasena_hash
    );

    if (!coincide) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    delete cuenta.contrasena_hash;

    return res.json({
      cuenta,
    });

  } catch (error) {
    console.error(
      '--- ERROR DE BASE DE DATOS (login) ---'
    );
    console.error(error);

    return res.status(500).json({
      error: 'Error en la base de datos',
    });
  }
});


// ======================================================
// REGISTRO
// ======================================================

app.post('/api/registro', async (req, res) => {
  const {
    nombreCompleto,
    correo,
    contrasena,
    carrera,
    materia,
  } = req.body;

  if (
    !nombreCompleto ||
    !correo ||
    !contrasena
  ) {
    return res.status(400).json({
      error: 'Faltan datos obligatorios.',
    });
  }

  const rolDetectado =
    detectarRolPorCorreo(correo);

  try {

    const [existentes]: any =
      await db.query(
        'SELECT id FROM cuentas WHERE correo = ?',
        [correo]
      );

    if (existentes.length > 0) {
      return res.status(400).json({
        error:
          'Ya existe una cuenta con ese correo.',
      });
    }

    const hash = await bcrypt.hash(
      contrasena,
      10
    );

    const [resultado]: any =
      await db.query(
        `
        INSERT INTO cuentas
        (
          nombre_completo,
          correo,
          contrasena_hash,
          rol,
          carrera,
          materia
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          nombreCompleto,
          correo,
          hash,
          rolDetectado,
          carrera || null,
          materia || null,
        ]
      );

    const cuenta = {
      id: resultado.insertId,
      nombreCompleto,
      correo,
      rol: rolDetectado,
      carrera: carrera || null,
      materia: materia || null,
    };

    return res.status(201).json({
      cuenta,
    });

  } catch (error) {

    console.error(
      '--- ERROR DE BASE DE DATOS (registro) ---'
    );
    console.error(error);

    return res.status(500).json({
      error:
        'Error al registrar la cuenta.',
    });
  }
});


// ======================================================
// ADMIN - TODOS LOS USUARIOS
// ======================================================

app.get('/api/usuarios', async (req, res) => {

  try {

    const [rows]: any =
      await db.query(
        `
        SELECT
          id,
          correo,
          nombre_completo AS nombreCompleto,
          rol,
          carrera,
          materia
        FROM cuentas
        ORDER BY nombre_completo
        `
      );

    console.log(
      '✅ /api/usuarios:',
      rows.length,
      'usuarios'
    );

    return res.json(rows);

  } catch (error) {

    console.error(
      '❌ ERROR /api/usuarios:'
    );

    console.error(error);

    return res.status(500).json({
      error:
        'Error al consultar usuarios',

      detalle:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
});


// ======================================================
// ADMIN - CAMBIAR ROL
// ======================================================

app.patch(
  '/api/usuarios/:correo/rol',
  async (req, res) => {

    const { nuevoRol } = req.body;

    if (
      nuevoRol !== 'docente' &&
      nuevoRol !== 'estudiante'
    ) {
      return res.status(400).json({
        error:
          'Solo se puede cambiar a docente o estudiante.',
      });
    }

    try {

      const [resultado]: any =
        await db.query(
          `
          UPDATE cuentas
          SET rol = ?
          WHERE correo = ?
          `,
          [
            nuevoRol,
            req.params.correo,
          ]
        );

      if (resultado.affectedRows === 0) {
        return res.status(404).json({
          error:
            'No se encontró el usuario.',
        });
      }

      console.log(
        '✅ Rol actualizado:',
        req.params.correo,
        '→',
        nuevoRol
      );

      return res.json({
        mensaje:
          'Rol actualizado correctamente',
      });

    } catch (error) {

      console.error(
        '❌ Error al actualizar rol:',
        error
      );

      return res.status(500).json({
        error:
          'Error al actualizar el rol',
      });
    }
  }
);


// ======================================================
// ADMIN - TODAS LAS CLASES
// ======================================================

app.get('/api/clases', async (req, res) => {

  try {

    const [rows]: any =
      await db.query(
        `
        SELECT
          c.codigo,
          c.materia,
          c.correo_docente AS correoDocente,
          c.nombre_docente AS nombreDocente,

          (
            SELECT COUNT(*)
            FROM inscripciones i
            WHERE i.codigo_clase = c.codigo
          ) AS totalInscritos

        FROM clases c

        ORDER BY c.fecha_creacion DESC
        `
      );

    console.log(
      '✅ /api/clases:',
      rows.length,
      'clases'
    );

    return res.json(rows);

  } catch (error) {

    console.error(
      '❌ ERROR /api/clases:'
    );

    console.error(error);

    return res.status(500).json({
      error:
        'Error al consultar clases',

      detalle:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
});


// ======================================================
// ADMIN - TODAS LAS INSCRIPCIONES
// ======================================================

app.get(
  '/api/inscripciones',
  async (req, res) => {

    try {

      const [rows]: any =
        await db.query(
          `
          SELECT
            u.nombre_completo AS nombreEstudiante,
            c.materia,
            c.codigo,

            DATE_FORMAT(
              i.fecha_inscripcion,
              '%Y-%m-%d'
            ) AS fecha

          FROM inscripciones i

          JOIN cuentas u
            ON i.correo_estudiante = u.correo

          JOIN clases c
            ON i.codigo_clase = c.codigo

          ORDER BY
            i.fecha_inscripcion DESC
          `
        );

      console.log(
        '✅ /api/inscripciones:',
        rows.length,
        'inscripciones'
      );

      return res.json(rows);

    } catch (error) {

      console.error(
        '❌ ERROR /api/inscripciones:'
      );

      console.error(error);

      return res.status(500).json({
        error:
          'Error al consultar inscripciones',

        detalle:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);


// ======================================================
// CLASES - OBTENER CLASES DEL DOCENTE
// ======================================================

app.get(
  '/api/clases/docente/:correo',
  async (req, res) => {

    try {

      const [rows]: any =
        await db.query(
          `
          SELECT
            id,
            codigo,
            materia
          FROM clases
          WHERE correo_docente = ?
          `,
          [req.params.correo]
        );

      return res.json(rows);

    } catch (error) {

      console.error(
        'Error al obtener clases del docente:',
        error
      );

      return res.status(500).json({
        error:
          'Error al consultar clases',
      });
    }
  }
);


// ======================================================
// CLASES - CREAR CLASE
// ======================================================

app.post(
  '/api/clases',
  async (req, res) => {

    const {
      codigo,
      materia,
      correoDocente,
      nombreDocente,
    } = req.body;

    if (
      !correoDocente ||
      !nombreDocente
    ) {
      return res.status(400).json({
        error:
          'Faltan datos del docente',
      });
    }

    try {

      await db.query(
        `
        INSERT INTO clases
        (
          codigo,
          materia,
          correo_docente,
          nombre_docente
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          codigo,
          materia,
          correoDocente,
          nombreDocente,
        ]
      );

      console.log(
        '✅ Clase creada:',
        codigo,
        materia
      );

      return res.status(201).json({
        codigo,
        materia,
        correoDocente,
        nombreDocente,
      });

    } catch (error) {

      console.error(
        '❌ Error al crear clase en MySQL:',
        error
      );

      return res.status(500).json({
        error:
          'Error al guardar la clase',
      });
    }
  }
);


// ======================================================
// CLASES - OBTENER CLASES DEL ESTUDIANTE
// ======================================================

app.get(
  '/api/clases/estudiante/:correo',
  async (req, res) => {

    try {

      const query = `
        SELECT
          c.id,
          c.codigo,
          c.materia,
          c.nombre_docente AS nombreDocente

        FROM inscripciones i

        JOIN clases c
          ON i.codigo_clase = c.codigo

        WHERE i.correo_estudiante = ?
      `;

      const [rows]: any =
        await db.query(
          query,
          [req.params.correo]
        );

      return res.json(rows);

    } catch (error) {

      console.error(
        'Error al obtener clases del estudiante:',
        error
      );

      return res.status(500).json({
        error:
          'Error al consultar inscripciones',
      });
    }
  }
);


// ======================================================
// INSCRIPCIONES - INSCRIBIR ESTUDIANTE
// ======================================================

app.post(
  '/api/inscripciones',
  async (req, res) => {

    const {
      correoEstudiante,
      codigoClase,
    } = req.body;

    try {

      // ----------------------------------------------
      // Comprobar que existe la clase
      // ----------------------------------------------

      const [clases]: any =
        await db.query(
          `
          SELECT codigo
          FROM clases
          WHERE codigo = ?
          `,
          [codigoClase]
        );

      if (clases.length === 0) {
        return res.status(404).json({
          error:
            'No existe ninguna clase con ese código.',
        });
      }


      // ----------------------------------------------
      // Comprobar inscripción previa
      // ----------------------------------------------

      const [previo]: any =
        await db.query(
          `
          SELECT id
          FROM inscripciones
          WHERE correo_estudiante = ?
            AND codigo_clase = ?
          `,
          [
            correoEstudiante,
            codigoClase,
          ]
        );

      if (previo.length > 0) {
        return res.status(400).json({
          error:
            'Ya estás inscrito en esta clase.',
        });
      }


      // ----------------------------------------------
      // Crear inscripción
      // ----------------------------------------------

      await db.query(
        `
        INSERT INTO inscripciones
        (
          codigo_clase,
          correo_estudiante
        )
        VALUES (?, ?)
        `,
        [
          codigoClase,
          correoEstudiante,
        ]
      );

      console.log(
        '✅ Inscripción creada:',
        correoEstudiante,
        '→',
        codigoClase
      );

      return res.status(201).json({
        mensaje:
          'Inscripción exitosa',
      });

    } catch (error) {

      console.error(
        '❌ Error en inscripción:',
        error
      );

      return res.status(500).json({
        error:
          'Error al inscribirse a la clase',
      });
    }
  }
);


// ======================================================
// INICIAR SERVIDOR
// ======================================================

app.listen(3000, () => {

  console.log(
    '========================================'
  );

  console.log(
    '🚀 Servidor corriendo en:'
  );

  console.log(
    'http://localhost:3000'
  );

  console.log(
    '========================================'
  );

});