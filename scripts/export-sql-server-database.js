require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const databaseName = process.env.DB_NAME || 'yahweh_rohi_inventory';
const outputArg = process.argv.find((arg) => arg.startsWith('--out='));
const defaultFileName = `${databaseName}_full_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
const outputPath = path.resolve(process.cwd(), outputArg ? outputArg.slice('--out='.length) : path.join('database', defaultFileName));

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: databaseName,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: String(process.env.DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
  },
  requestTimeout: 120000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

function q(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

function fullName(row) {
  return `${q(row.schema_name)}.${q(row.name)}`;
}

function literal(value, column) {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;

  const type = String(column.type_name || '').toLowerCase();

  if (type === 'bit') return value ? '1' : '0';
  if (
    [
      'bigint',
      'int',
      'smallint',
      'tinyint',
      'decimal',
      'numeric',
      'money',
      'smallmoney',
      'float',
      'real',
    ].includes(type)
  ) {
    return String(value);
  }

  if (value instanceof Date) {
    return `CONVERT(datetime2, N'${value.toISOString().replace('T', ' ').replace('Z', '')}', 121)`;
  }

  return `N'${String(value).replace(/'/g, "''")}'`;
}

function dataType(column) {
  const type = String(column.type_name).toLowerCase();

  if (['varchar', 'char', 'varbinary', 'binary'].includes(type)) {
    return `${type}(${column.max_length === -1 ? 'max' : column.max_length})`;
  }

  if (['nvarchar', 'nchar'].includes(type)) {
    return `${type}(${column.max_length === -1 ? 'max' : column.max_length / 2})`;
  }

  if (['decimal', 'numeric'].includes(type)) {
    return `${type}(${column.precision}, ${column.scale})`;
  }

  if (['datetime2', 'datetimeoffset', 'time'].includes(type)) {
    return `${type}(${column.scale})`;
  }

  return type;
}

async function query(pool, text) {
  const result = await pool.request().query(text);
  return result.recordset;
}

async function getSchemas(pool) {
  return query(
    pool,
    `
    SELECT name
    FROM sys.schemas
    WHERE schema_id < 16384
      AND name NOT IN ('dbo', 'guest', 'INFORMATION_SCHEMA', 'sys')
    ORDER BY name
  `,
  );
}

async function getTables(pool) {
  return query(
    pool,
    `
    SELECT s.name AS schema_name, t.name, t.object_id
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name
  `,
  );
}

async function getColumns(pool) {
  return query(
    pool,
    `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      c.object_id,
      c.column_id,
      c.name,
      ty.name AS type_name,
      c.max_length,
      c.precision,
      c.scale,
      c.is_nullable,
      c.is_identity,
      c.is_computed,
      cc.definition AS computed_definition,
      dc.name AS default_name,
      dc.definition AS default_definition
    FROM sys.columns c
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
    LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name, c.column_id
  `,
  );
}

async function getChecks(pool) {
  return query(
    pool,
    `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      cc.name,
      cc.definition,
      cc.is_disabled,
      cc.is_not_trusted
    FROM sys.check_constraints cc
    INNER JOIN sys.tables t ON t.object_id = cc.parent_object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name, cc.name
  `,
  );
}

async function getIndexes(pool) {
  return query(
    pool,
    `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      i.name,
      i.type_desc,
      i.is_unique,
      i.is_primary_key,
      i.is_unique_constraint,
      i.has_filter,
      i.filter_definition,
      keys.key_columns,
      included.included_columns
    FROM sys.indexes i
    INNER JOIN sys.tables t ON t.object_id = i.object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    CROSS APPLY (
      SELECT STRING_AGG(
        QUOTENAME(c.name) + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END,
        ', '
      ) WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_columns
      FROM sys.index_columns ic
      INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE ic.object_id = i.object_id
        AND ic.index_id = i.index_id
        AND ic.is_included_column = 0
    ) keys
    OUTER APPLY (
      SELECT STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY ic.index_column_id) AS included_columns
      FROM sys.index_columns ic
      INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE ic.object_id = i.object_id
        AND ic.index_id = i.index_id
        AND ic.is_included_column = 1
    ) included
    WHERE t.is_ms_shipped = 0
      AND i.type > 0
      AND i.is_hypothetical = 0
      AND keys.key_columns IS NOT NULL
    ORDER BY s.name, t.name, i.is_primary_key DESC, i.is_unique_constraint DESC, i.name
  `,
  );
}

async function getForeignKeys(pool) {
  return query(
    pool,
    `
    SELECT
      sch.name AS schema_name,
      tab.name AS table_name,
      fk.name,
      ref_sch.name AS ref_schema_name,
      ref_tab.name AS ref_table_name,
      fk.delete_referential_action_desc,
      fk.update_referential_action_desc,
      fk.is_disabled,
      fk.is_not_trusted,
      STRING_AGG(QUOTENAME(col.name), ', ') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS columns,
      STRING_AGG(QUOTENAME(ref_col.name), ', ') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS ref_columns
    FROM sys.foreign_keys fk
    INNER JOIN sys.tables tab ON tab.object_id = fk.parent_object_id
    INNER JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
    INNER JOIN sys.tables ref_tab ON ref_tab.object_id = fk.referenced_object_id
    INNER JOIN sys.schemas ref_sch ON ref_sch.schema_id = ref_tab.schema_id
    INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.columns col ON col.object_id = fkc.parent_object_id AND col.column_id = fkc.parent_column_id
    INNER JOIN sys.columns ref_col ON ref_col.object_id = fkc.referenced_object_id AND ref_col.column_id = fkc.referenced_column_id
    WHERE tab.is_ms_shipped = 0
    GROUP BY sch.name, tab.name, fk.name, ref_sch.name, ref_tab.name, fk.delete_referential_action_desc,
      fk.update_referential_action_desc, fk.is_disabled, fk.is_not_trusted
    ORDER BY sch.name, tab.name, fk.name
  `,
  );
}

async function getProgrammableObjects(pool) {
  return query(
    pool,
    `
    SELECT
      s.name AS schema_name,
      o.name,
      o.type,
      o.type_desc,
      m.definition
    FROM sys.objects o
    INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
    INNER JOIN sys.sql_modules m ON m.object_id = o.object_id
    WHERE o.is_ms_shipped = 0
      AND o.type IN ('V', 'P', 'FN', 'IF', 'TF', 'TR')
    ORDER BY CASE o.type WHEN 'FN' THEN 1 WHEN 'IF' THEN 1 WHEN 'TF' THEN 1 WHEN 'V' THEN 2 WHEN 'P' THEN 3 WHEN 'TR' THEN 4 ELSE 5 END,
      s.name, o.name
  `,
  );
}

function groupByObject(rows, key = 'object_id') {
  return rows.reduce((map, row) => {
    const current = map.get(row[key]) || [];
    current.push(row);
    map.set(row[key], current);
    return map;
  }, new Map());
}

function buildCreateTable(table, columnsByTable) {
  const lines = columnsByTable.get(table.object_id).map((column) => {
    if (column.is_computed) {
      return `  ${q(column.name)} AS ${column.computed_definition}`;
    }

    const identity = column.is_identity ? ' IDENTITY(1,1)' : '';
    const nullable = column.is_nullable ? ' NULL' : ' NOT NULL';
    const defaultSql = column.default_definition ? ` CONSTRAINT ${q(column.default_name)} DEFAULT ${column.default_definition}` : '';
    return `  ${q(column.name)} ${dataType(column)}${identity}${nullable}${defaultSql}`;
  });

  return `CREATE TABLE ${fullName(table)} (\n${lines.join(',\n')}\n);\nGO`;
}

function buildIndex(index) {
  const table = `${q(index.schema_name)}.${q(index.table_name)}`;
  const constraintType = index.is_primary_key ? 'PRIMARY KEY' : 'UNIQUE';
  const clustered = index.type_desc.includes('CLUSTERED') ? 'CLUSTERED' : 'NONCLUSTERED';

  if (index.is_primary_key || index.is_unique_constraint) {
    return `ALTER TABLE ${table} ADD CONSTRAINT ${q(index.name)} ${constraintType} ${clustered} (${index.key_columns});\nGO`;
  }

  const unique = index.is_unique ? 'UNIQUE ' : '';
  const include = index.included_columns ? ` INCLUDE (${index.included_columns})` : '';
  const filter = index.has_filter ? ` WHERE ${index.filter_definition}` : '';
  return `CREATE ${unique}${clustered} INDEX ${q(index.name)} ON ${table} (${index.key_columns})${include}${filter};\nGO`;
}

function buildForeignKey(fk) {
  const table = `${q(fk.schema_name)}.${q(fk.table_name)}`;
  const ref = `${q(fk.ref_schema_name)}.${q(fk.ref_table_name)}`;
  const deleteAction = fk.delete_referential_action_desc !== 'NO_ACTION' ? ` ON DELETE ${fk.delete_referential_action_desc.replace('_', ' ')}` : '';
  const updateAction = fk.update_referential_action_desc !== 'NO_ACTION' ? ` ON UPDATE ${fk.update_referential_action_desc.replace('_', ' ')}` : '';
  const trusted = fk.is_not_trusted ? 'WITH NOCHECK' : 'WITH CHECK';
  return `ALTER TABLE ${table} ${trusted} ADD CONSTRAINT ${q(fk.name)} FOREIGN KEY (${fk.columns}) REFERENCES ${ref} (${fk.ref_columns})${deleteAction}${updateAction};\nGO`;
}

function buildCheck(check) {
  const table = `${q(check.schema_name)}.${q(check.table_name)}`;
  const trusted = check.is_not_trusted ? 'WITH NOCHECK' : 'WITH CHECK';
  return `ALTER TABLE ${table} ${trusted} ADD CONSTRAINT ${q(check.name)} CHECK ${check.definition};\nGO`;
}

async function scriptData(pool, table, columns) {
  const insertColumns = columns.filter((column) => !column.is_computed && !['timestamp', 'rowversion'].includes(String(column.type_name).toLowerCase()));
  if (insertColumns.length === 0) return '';

  const tableName = fullName(table);
  const columnList = insertColumns.map((column) => q(column.name)).join(', ');
  const rows = await query(pool, `SELECT ${columnList} FROM ${tableName}`);

  if (rows.length === 0) return `-- Sin datos para ${tableName}\n`;

  const hasIdentity = insertColumns.some((column) => column.is_identity);
  const chunks = [`-- Datos para ${tableName} (${rows.length} filas)`];

  if (hasIdentity) chunks.push(`SET IDENTITY_INSERT ${tableName} ON;`);

  for (const row of rows) {
    const values = insertColumns.map((column) => literal(row[column.name], column)).join(', ');
    chunks.push(`INSERT INTO ${tableName} (${columnList}) VALUES (${values});`);
  }

  if (hasIdentity) chunks.push(`SET IDENTITY_INSERT ${tableName} OFF;`);
  chunks.push('GO');

  return `${chunks.join('\n')}\n`;
}

function header() {
  return `/*
  Respaldo completo generado para migracion.
  Base de datos: ${databaseName}
  Generado: ${new Date().toISOString()}

  Incluye:
  - esquemas
  - tablas
  - constraints, indices y llaves foraneas
  - datos de todas las tablas de usuario, incluyendo tablas de auditoria/logs si existen
  - vistas, funciones, procedimientos almacenados y triggers

  Nota: el log transaccional fisico de SQL Server no se representa como script SQL.
  Para incluir archivos MDF/LDF use un backup .bak desde SQL Server Management Studio o BACKUP DATABASE.
*/

SET NOCOUNT ON;
GO

IF DB_ID(N'${databaseName.replace(/'/g, "''")}') IS NULL
BEGIN
  CREATE DATABASE ${q(databaseName)};
END;
GO

USE ${q(databaseName)};
GO
`;
}

async function main() {
  const pool = await sql.connect(config);

  try {
    const [schemas, tables, columns, indexes, checks, foreignKeys, objects] = await Promise.all([
      getSchemas(pool),
      getTables(pool),
      getColumns(pool),
      getIndexes(pool),
      getChecks(pool),
      getForeignKeys(pool),
      getProgrammableObjects(pool),
    ]);

    const columnsByTable = groupByObject(columns);
    const sections = [header()];

    sections.push('\n-- Esquemas\n');
    for (const schema of schemas) {
      sections.push(`IF SCHEMA_ID(N'${schema.name.replace(/'/g, "''")}') IS NULL EXEC(N'CREATE SCHEMA ${q(schema.name)}');\nGO\n`);
    }

    sections.push('\n-- Tablas\n');
    for (const table of tables) {
      sections.push(`${buildCreateTable(table, columnsByTable)}\n`);
    }

    sections.push('\n-- Llaves primarias, constraints unicas e indices\n');
    for (const index of indexes) {
      sections.push(`${buildIndex(index)}\n`);
    }

    sections.push('\n-- Check constraints\n');
    for (const check of checks) {
      sections.push(`${buildCheck(check)}\n`);
    }

    sections.push('\n-- Datos\n');
    sections.push('EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL";\nGO\n');
    sections.push('EXEC sp_MSforeachtable "DISABLE TRIGGER ALL ON ?";\nGO\n');

    for (const table of tables) {
      const tableColumns = columnsByTable.get(table.object_id) || [];
      sections.push(await scriptData(pool, table, tableColumns));
    }

    sections.push('EXEC sp_MSforeachtable "ENABLE TRIGGER ALL ON ?";\nGO\n');
    sections.push('EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL";\nGO\n');

    sections.push('\n-- Llaves foraneas\n');
    for (const fk of foreignKeys) {
      sections.push(`${buildForeignKey(fk)}\n`);
    }

    sections.push('\n-- Vistas, funciones, procedimientos almacenados y triggers\n');
    for (const object of objects) {
      sections.push(`-- ${object.type_desc}: ${q(object.schema_name)}.${q(object.name)}\n`);
      sections.push(`${object.definition}\nGO\n`);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, sections.join('\n'), 'utf8');

    console.log(`Respaldo generado: ${outputPath}`);
    console.log(`Tablas exportadas: ${tables.length}`);
    console.log(`Objetos programables exportados: ${objects.length}`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error('No se pudo generar el respaldo de SQL Server.');
  console.error(error.message || error);
  process.exitCode = 1;
});
