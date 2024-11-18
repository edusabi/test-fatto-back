require('dotenv').config();
const { Pool } = require('pg');

// Corrigir o uso de process.env
const { DBUSER, DBHOST, DBDATABASE, DBPASSWORD } = process.env;

const pool = new Pool({
  user: DBUSER,            // Usuário do PostgreSQL
  host: DBHOST,            // Host do PostgreSQL
  database: DBDATABASE,    // Nome do banco de dados
  password: DBPASSWORD,    // Senha do usuário do banco
  port: 5432,              // Porta padrão do PostgreSQL
  ssl: {                   // Configuração de SSL
    rejectUnauthorized: false, // Aceitar certificados SSL não verificados
  },
});

module.exports = pool;
