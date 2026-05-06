require('dotenv').config();

const { getPool } = require('./db');

// PROCEDIMIENTO UBICADO EN server/test-db-connection.js
// ESTE SCRIPT EJECUTA UNA CONSULTA DE PRUEBA PARA VERIFICAR
// EL NOMBRE DE LA BASE DE DATOS, EL SERVIDOR Y LA FECHA DE RESPUESTA.

async function main() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        DB_NAME() AS database_name,
        @@SERVERNAME AS server_name,
        GETDATE() AS checked_at
    `);

    console.log('Conexion a SQL Server exitosa.');
    console.table(result.recordset);
    await pool.close();
  } catch (error) {
    console.error('No se pudo conectar a SQL Server.');
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
