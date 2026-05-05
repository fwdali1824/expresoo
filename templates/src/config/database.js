const mongoose = require('mongoose');
const chalk = require('chalk');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/expresso_db');
        console.log(chalk.green.bold(`✅ Database Connected: ${conn.connection.host}`));
    } catch (error) {
        console.log(chalk.red.bold('❌ Database Connection Error!'));
        console.log(chalk.yellow(`
👉 Troubleshooting:
1. Check if your MongoDB is running.
2. Ensure MONGODB_URI is set correctly in your .env file.
3. If using Atlas, check your IP Whitelist.
        `));
        process.exit(1);
    }
};

module.exports = connectDB;
