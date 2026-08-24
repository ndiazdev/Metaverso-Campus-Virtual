import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const app = express();
app.use(cors());
app.use(express.json());

// Configura las credenciales de tu MySQL según tu Workbench
const db = mysql.createPool({
  host: '127.0.0.1', // Cambia 'localhost' por IP directa para evitar desvíos de sockets
  port: 3306,
  user: 'root',
  password: '12345', 
  database: 'usta_metaverso',
});
// --- LOGIN ---
app.post('/api/login', async (req, res) => {
  const { correo, contrasena } = req.body;
  try {
    const [rows]: any = await db.query(
      'SELECT id, correo, nombre_completo AS nombreCompleto, rol, carrera, materia, contrasena_hash FROM cuentas WHERE correo = ?',
      [correo]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const cuenta = rows[0];
    const coincide = await bcrypt.compare(contrasena, cuenta.contrasena_hash);
    if (!coincide) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    delete cuenta.contrasena_hash; // nunca mandes el hash de vuelta al navegador
    return res.json({ cuenta }); // <-- envuelto en "cuenta", como espera el frontend
  } catch (error) {
    console.error('--- ERROR DE BASE DE DATOS (login) ---', error);
    return res.status(500).json({ error: 'Error en la base de datos' });
  }
});


// --- CLASES: Obtener clases del Docente ---
app.get('/api/clases/docente/:correo', async (req, res) => {
  try {
    const [rows]: any = await db.query(
      'SELECT id, codigo, materia FROM clases WHERE correo_docente = ?',
      [req.params.correo]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener clases del docente:', error);
    res.status(500).json({ error: 'Error al consultar clases' });
  }
});

// --- CLASES: Crear clase (Docente) ---
app.post('/api/clases', async (req, res) => {
  const { codigo, materia, correoDocente, nombreDocente } = req.body;

  if (!correoDocente || !nombreDocente) {
    return res.status(400).json({ error: 'Faltan datos del docente' });
  }

  try {
    await db.query(
      'INSERT INTO clases (codigo, materia, correo_docente, nombre_docente) VALUES (?, ?, ?, ?)',
      [codigo, materia, correoDocente, nombreDocente]
    );
    res.status(201).json({ codigo, materia, correoDocente, nombreDocente });
  } catch (error) {
    console.error('Error al crear clase en MySQL:', error);
    res.status(500).json({ error: 'Error al guardar la clase' });
  }
});

// --- CLASES: Obtener clases del Estudiante ---
app.get('/api/clases/estudiante/:correo', async (req, res) => {
  try {
    const query = `
      SELECT c.id, c.codigo, c.materia, c.nombre_docente AS nombreDocente
      FROM inscripciones i
      JOIN clases c ON i.codigo_clase = c.codigo
      WHERE i.correo_estudiante = ?
    `;
    const [rows]: any = await db.query(query, [req.params.correo]);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener clases del estudiante:', error);
    res.status(500).json({ error: 'Error al consultar inscripciones' });
  }
});

// --- INSCRIPCIONES: Inscribir estudiante por código ---
app.post('/api/inscripciones', async (req, res) => {
  const { correoEstudiante, codigoClase } = req.body;
  try {
    const [clases]: any = await db.query('SELECT codigo FROM clases WHERE codigo = ?', [codigoClase]);
    if (clases.length === 0) {
      return res.status(404).json({ error: 'No existe ninguna clase con ese código.' });
    }

    const [previo]: any = await db.query(
      'SELECT id FROM inscripciones WHERE correo_estudiante = ? AND codigo_clase = ?',
      [correoEstudiante, codigoClase]
    );
    if (previo.length > 0) {
      return res.status(400).json({ error: 'Ya estás inscrito en esta clase.' });
    }

    await db.query('INSERT INTO inscripciones (codigo_clase, correo_estudiante) VALUES (?, ?)', [
      codigoClase,
      correoEstudiante,
    ]);

    res.status(201).json({ mensaje: 'Inscripción exitosa' });
  } catch (error) {
    console.error('Error en inscripción:', error);
    res.status(500).json({ error: 'Error al inscribirse a la clase' });
  }
});

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});