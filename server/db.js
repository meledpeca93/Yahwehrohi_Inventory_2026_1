const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || 'yahweh_rohi_inventory',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: String(process.env.DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
  },
  connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT || 30000),
  requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT || 120000),
  pool: {
    max: Number(process.env.DB_POOL_MAX || 1),
    min: 0,
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30000),
  },
};

let poolPromise;
let activePool;

function getPool() {
  if (poolPromise) {
    return poolPromise.then((pool) => {
      if (pool.connected) {
        return pool;
      }

      poolPromise = undefined;
      return getPool();
    });
  }

  const pool = new sql.ConnectionPool(config);
  pool.on('error', () => {
    activePool = undefined;
    poolPromise = undefined;
  });

  poolPromise = pool.connect().catch((error) => {
    activePool = undefined;
    poolPromise = undefined;
    throw error;
  }).then((connectedPool) => {
    activePool = connectedPool;
    return connectedPool;
  });

  return poolPromise;
}

function getDbConfig() {
  return {
    ...config,
    options: { ...config.options },
    pool: { ...config.pool },
  };
}

async function resetPool() {
  const pool = activePool;
  activePool = undefined;
  poolPromise = undefined;

  if (pool) {
    try {
      await pool.close();
    } catch {
      // The pool is already broken; discard it.
    }
  }
}

module.exports = {
  getDbConfig,
  getPool,
  resetPool,
  sql,
};
