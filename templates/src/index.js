const express = require('express');
const { connectSQLite } = require('./config/database');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize DB (Example: SQLite)
connectSQLite();

// Routes
// app.use('/api/users', require('./routes/user.route'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
