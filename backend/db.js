const { Pool, Client, types } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Ensure BIGINT (OID 20) and COUNT() are returned as integers in JavaScript
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

const getSslConfig = () => {
    if (process.env.DB_SSL === "false" || process.env.DB_SSL === "0") {
        return false;
    }
    if (process.env.DB_CA_CERT) {
        return { ca: process.env.DB_CA_CERT, rejectUnauthorized: false };
    }
    const caPath = path.join(__dirname, "ca.pem");
    if (fs.existsSync(caPath)) {
        return { ca: fs.readFileSync(caPath).toString(), rejectUnauthorized: false };
    }
    if (process.env.DB_SSL === "true") {
        return { rejectUnauthorized: false };
    }
    // Remote connection default to SSL if not localhost
    const host = (process.env.DB_HOST || "").toLowerCase();
    if (host && host !== "localhost" && host !== "127.0.0.1") {
        return { rejectUnauthorized: false };
    }
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("sslmode=require")) {
        return { rejectUnauthorized: false };
    }
    return false;
};

const sslConfig = getSslConfig();

const poolConfig = process.env.DATABASE_URL
    ? {
          connectionString: process.env.DATABASE_URL,
          ssl: sslConfig || undefined
      }
    : {
          host: process.env.DB_HOST || "localhost",
          port: parseInt(process.env.DB_PORT, 10) || 5432,
          user: process.env.DB_USER || "postgres",
          password: process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : "",
          database: process.env.DB_NAME || "online_exam_portal",
          ssl: sslConfig || undefined,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
      };

const pgPool = new Pool(poolConfig);

function convertPlaceholders(sql) {
    let index = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let result = "";

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if (char === "'" && (i === 0 || sql[i - 1] !== "\\")) {
            inSingleQuote = !inSingleQuote;
            result += char;
        } else if (char === '"' && (i === 0 || sql[i - 1] !== "\\")) {
            inDoubleQuote = !inDoubleQuote;
            result += char;
        } else if (char === "?" && !inSingleQuote && !inDoubleQuote) {
            result += `$${index++}`;
        } else {
            result += char;
        }
    }
    return result;
}

function normalizeQuery(sql) {
    let convertedSql = convertPlaceholders(sql);
    const trimmed = convertedSql.trim();

    // Auto-append RETURNING id for INSERT statements if RETURNING is not already specified
    if (/^\s*INSERT\s+INTO/i.test(trimmed) && !/\bRETURNING\b/i.test(trimmed)) {
        convertedSql = trimmed.replace(/;+$/, "") + " RETURNING id";
    }

    return convertedSql;
}

async function executeQuery(executor, sqlOrConfig, params) {
    let sql;
    let values;

    if (typeof sqlOrConfig === "object" && sqlOrConfig !== null && sqlOrConfig.text) {
        sql = sqlOrConfig.text;
        values = sqlOrConfig.values || params || [];
    } else {
        sql = sqlOrConfig;
        values = params || [];
    }

    const convertedSql = normalizeQuery(sql);
    const rawResult = await executor.query(convertedSql, values);

    const rows = rawResult.rows || [];
    const insertId = rows[0]?.id !== undefined ? rows[0].id : null;

    rows.insertId = insertId;
    rows.affectedRows = rawResult.rowCount;
    rows.rowCount = rawResult.rowCount;

    const meta = {
        insertId,
        affectedRows: rawResult.rowCount,
        rowCount: rawResult.rowCount,
        command: rawResult.command,
        fields: rawResult.fields
    };

    const tuple = [rows, meta];
    tuple.rows = rows;
    tuple.rowCount = rawResult.rowCount;
    tuple.command = rawResult.command;
    tuple.fields = rawResult.fields;
    tuple.insertId = insertId;

    return tuple;
}

const pool = {
    query: (sql, params) => executeQuery(pgPool, sql, params),
    connect: async () => {
        const client = await pgPool.connect();
        return {
            query: (sql, params) => executeQuery(client, sql, params),
            release: () => client.release()
        };
    },
    end: () => pgPool.end(),
    on: (...args) => pgPool.on(...args)
};

const initDB = async () => {
    const dbName = process.env.DB_NAME || "online_exam_portal";

    // 1. Check and create database if missing (when connected with administrative credentials)
    if (!process.env.DATABASE_URL) {
        let adminClient;
        try {
            const adminConfig = {
                host: process.env.DB_HOST || "localhost",
                port: parseInt(process.env.DB_PORT, 10) || 5432,
                user: process.env.DB_USER || "postgres",
                password: process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : "",
                database: "postgres",
                ssl: sslConfig || undefined
            };

            adminClient = new Client(adminConfig);
            await adminClient.connect();

            const checkRes = await adminClient.query(
                "SELECT 1 FROM pg_database WHERE datname = $1",
                [dbName]
            );

            if (checkRes.rowCount === 0) {
                const safeDbName = dbName.replace(/"/g, '""');
                await adminClient.query(`CREATE DATABASE "${safeDbName}"`);
                console.log(`Database '${dbName}' created successfully.`);
            }
        } catch (adminErr) {
            // Non-fatal: user might not have admin rights or DB is managed/already created
            if (adminErr.code !== "42P04") { // 42P04 = duplicate_database
                console.warn(`Database check notice: ${adminErr.message}`);
            }
        } finally {
            if (adminClient) {
                try {
                    await adminClient.end();
                } catch (_) {}
            }
        }
    }

    // 2. Initialize schema tables
    let client;
    try {
        client = await pgPool.connect();
        console.log(`Connected to PostgreSQL. Database '${dbName}' ready.`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'admin')),
                profile_picture TEXT,
                mobile_number VARCHAR(20),
                dob DATE,
                gender VARCHAR(20),
                register_number VARCHAR(50),
                department VARCHAR(100),
                year_of_study VARCHAR(20),
                section VARCHAR(20),
                college_name VARCHAR(200),
                last_login_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS exams (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                duration_minutes INT NOT NULL,
                created_by INT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
                question_text TEXT NOT NULL,
                option_a VARCHAR(255) NOT NULL,
                option_b VARCHAR(255) NOT NULL,
                option_c VARCHAR(255) NOT NULL,
                option_d VARCHAR(255) NOT NULL,
                correct_option CHAR(1) NOT NULL
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS results (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
                score INT NOT NULL,
                total_questions INT NOT NULL,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS answers (
                id SERIAL PRIMARY KEY,
                result_id INT NOT NULL REFERENCES results(id) ON DELETE CASCADE,
                question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                selected_option CHAR(1),
                is_correct BOOLEAN DEFAULT FALSE
            )
        `);

        console.log("Database tables initialized successfully.");
    } catch (err) {
        console.error("Database initialization failed:");
        console.error(err);
    } finally {
        if (client) {
            client.release();
        }
    }
};

module.exports = {
    pool,
    initDB
};