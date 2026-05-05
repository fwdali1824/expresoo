const mysql = require('mysql2');
const mongoose = require('mongoose');
const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const connectMySQL = () => {
    const connection = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'test'
    });
    console.log('MySQL Connected...');
    return connection;
};

const connectMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test');
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
    }
};

const connectPostgreSQL = async () => {
    const client = new Client({
        user: process.env.PG_USER || 'postgres',
        host: process.env.PG_HOST || 'localhost',
        database: process.env.PG_NAME || 'test',
        password: process.env.PG_PASSWORD || 'password',
        port: process.env.PG_PORT || 5432,
    });
    await client.connect();
    console.log('PostgreSQL Connected...');
    return client;
};

const connectSQLite = () => {
    const db = new sqlite3.Database('./database.sqlite', (err) => {
        if (err) console.error(err.message);
        console.log('SQLite Connected...');
    });
    return db;
};

module.exports = {
    connectMySQL,
    connectMongoDB,
    connectPostgreSQL,
    connectSQLite
};
