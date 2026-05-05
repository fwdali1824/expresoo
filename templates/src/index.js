const express = require('express');
const connectDB = require('./config/database');
const chalk = require('chalk');
require('dotenv').config();

const app = express();
app.use(express.json());

// Professional Environment Check
const requiredEnvs = ['JWT_SECRET'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
    console.log(chalk.red.bold('\n⚠️  MISSING CONFIGURATION'));
    console.log(chalk.yellow(`The following environment variables are missing: ${missingEnvs.join(', ')}`));
    console.log(chalk.cyan('Please update your .env file before starting the server.\n'));
    process.exit(1);
}

// Initialize Database
connectDB();

// Root Route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Expresso Framework API' });
});

// Routes
app.use('/api/auth', require('./routes/auth.route'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(chalk.blue.bold(`
🚀 Server is flying on port ${PORT}
🔗 http://localhost:${PORT}
    `));
});
