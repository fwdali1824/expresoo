#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');

const program = new Command();

program
  .name('expresso-cli-pro')
  .description('Expresso CLI Pro - The ultimate full-stack tool')
  .version('1.5.0');

const showBanner = () => {
    console.log(chalk.magenta(`
    ☕ Expresso CLI Pro v1.5.0
    --------------------------
    The Professional Full-Stack Studio
    --------------------------
    `));
};

const findProjectRoot = (startDir) => {
    let currentDir = startDir;
    while (currentDir !== path.parse(currentDir).root) {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) return currentDir;
        currentDir = path.dirname(currentDir);
    }
    return startDir;
};

// --- LOGIC: GENERATORS ---
const makeFile = async (type, name, fieldsString = '') => {
    const rootDir = findProjectRoot(process.cwd());
    const resourceName = name.charAt(0).toUpperCase() + name.slice(1);
    const lowerName = name.toLowerCase();
    
    let dbType = 'MongoDB';
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = require(pkgPath);
            if (pkg.dependencies && (pkg.dependencies['mysql2'] || pkg.dependencies['sqlite3'])) {
                dbType = 'SQL';
            }
        } catch(err) {}
    }

    let modelContent = '';
    
    if (dbType === 'MongoDB') {
        let schemaFields = '{ name: String }';
        if (type === 'model' && fieldsString) {
            const fieldsArr = fieldsString.split(' ').filter(f => f);
            if (fieldsArr.length > 0) {
                const parsedFields = fieldsArr.map(f => {
                    const [fName, fType, fRef] = f.split(':');
                    let typeStr = 'String';
                    const refModel = fRef ? `'${fRef}'` : "'OtherModel'";
                    switch(fType?.toLowerCase()) {
                        case 'number': case 'int': case 'integer': case 'float': case 'double': typeStr = 'Number'; break;
                        case 'boolean': case 'bool': case 'tinyint': typeStr = 'Boolean'; break;
                        case 'date': case 'datetime': case 'timestamp': typeStr = 'Date'; break;
                        case 'time': typeStr = 'String'; break;
                        case 'object': case 'json': case 'mixed': typeStr = 'mongoose.Schema.Types.Mixed'; break;
                        case 'array': typeStr = '[]'; break;
                        case 'buffer': case 'binary': case 'blob': case 'image': typeStr = 'Buffer'; break;
                        case 'decimal': typeStr = 'mongoose.Schema.Types.Decimal128'; break;
                        case 'map': typeStr = 'Map'; break;
                        case 'uuid': typeStr = 'mongoose.Schema.Types.UUID'; break;
                        case 'objectid': case 'id': case 'ref': case 'belongsto': case 'onetoone': 
                            typeStr = `{ type: mongoose.Schema.Types.ObjectId, ref: ${refModel} }`; 
                            break;
                        case 'hasmany': case 'manytomany':
                            typeStr = `[{ type: mongoose.Schema.Types.ObjectId, ref: ${refModel} }]`;
                            break;
                        case 'enum': typeStr = '{ type: String, enum: ["value1", "value2"] }'; break;
                        case 'string': case 'text': case 'varchar': case 'char': typeStr = 'String'; break;
                        default: typeStr = 'String';
                    }
                    return `    ${fName}: ${typeStr}`;
                });
                schemaFields = `{\n${parsedFields.join(',\n')}\n}`;
            }
        }
        modelContent = `const mongoose = require('mongoose');\nconst schema = new mongoose.Schema(${schemaFields}, { timestamps: true });\nmodule.exports = mongoose.model('${resourceName}', schema);`;
    } else {
        // SQL (Sequelize)
        let schemaFields = "{\n    name: {\n        type: DataTypes.STRING,\n        allowNull: false\n    }\n}";
        if (type === 'model' && fieldsString) {
            const fieldsArr = fieldsString.split(' ').filter(f => f);
            if (fieldsArr.length > 0) {
                const parsedFields = fieldsArr.map(f => {
                    const [fName, fType, fRef] = f.split(':');
                    let typeStr = 'DataTypes.STRING';
                    const refModel = fRef ? `'${fRef}'` : "'OtherModel'";
                    let isAssoc = false;
                    switch(fType?.toLowerCase()) {
                        case 'number': case 'int': case 'integer': typeStr = 'DataTypes.INTEGER'; break;
                        case 'float': case 'double': case 'decimal': typeStr = 'DataTypes.FLOAT'; break;
                        case 'boolean': case 'bool': case 'tinyint': typeStr = 'DataTypes.BOOLEAN'; break;
                        case 'date': case 'datetime': case 'timestamp': typeStr = 'DataTypes.DATE'; break;
                        case 'time': typeStr = 'DataTypes.TIME'; break;
                        case 'object': case 'json': case 'mixed': typeStr = 'DataTypes.JSON'; break;
                        case 'buffer': case 'binary': case 'blob': case 'image': typeStr = 'DataTypes.BLOB'; break;
                        case 'uuid': typeStr = 'DataTypes.UUID'; break;
                        case 'objectid': case 'id': case 'ref': case 'belongsto': case 'onetoone': 
                            typeStr = `DataTypes.INTEGER,\n        references: { model: ${refModel}, key: 'id' }`; 
                            break;
                        case 'hasmany': case 'manytomany':
                            isAssoc = true;
                            typeStr = `// Association: ${fName} -> ${refModel}. Define this in separate setup logic.`;
                            break;
                        case 'enum': typeStr = 'DataTypes.ENUM("value1", "value2")'; break;
                        case 'string': case 'text': case 'varchar': case 'char': typeStr = 'DataTypes.STRING'; break;
                        default: typeStr = 'DataTypes.STRING';
                    }
                    if (isAssoc) return `    ${typeStr}`;
                    return `    ${fName}: {\n        type: ${typeStr}\n    }`;
                });
                schemaFields = `{\n${parsedFields.join(',\n')}\n}`;
            }
        }
        modelContent = `const { DataTypes } = require('sequelize');\nconst { sequelize } = require('../config/database'); // Ensure you have sequelize configured here\n\nconst ${resourceName} = sequelize.define('${resourceName}', ${schemaFields}, { timestamps: true });\n\nmodule.exports = ${resourceName};`;
    }

    const templates = {
        controller: { path: `src/controllers/${lowerName}.controller.js`, content: `class ${resourceName}Controller {\n    async index(req, res) { res.json({ msg: '${resourceName} Controller' }); }\n}\nmodule.exports = new ${resourceName}Controller();` },
        model: { path: `src/models/${lowerName}.model.js`, content: modelContent },
        route: { path: `src/routes/${lowerName}.route.js`, content: `const express = require('express');\nconst router = express.Router();\nconst ctrl = require('../controllers/${lowerName}.controller');\n\n/**\n * @swagger\n * /api/${lowerName}s:\n *   get:\n *     summary: Retrieve a list of ${lowerName}s\n *     tags: [${resourceName}]\n *     responses:\n *       200:\n *         description: A list of ${lowerName}s.\n */\nrouter.get('/', ctrl.index);\n\nmodule.exports = router;` },
        service: { path: `src/services/${lowerName}.service.js`, content: `class ${resourceName}Service {\n    async getAll() { return { data: '${resourceName} Data' }; }\n}\nmodule.exports = new ${resourceName}Service();` },
        repository: { path: `src/repositories/${lowerName}.repository.js`, content: `const Model = require('../models/${lowerName}.model');\nclass ${resourceName}Repository {\n    async findAll() { return await Model.find(); }\n}\nmodule.exports = new ${resourceName}Repository();` },
        middleware: { path: `src/middleware/${lowerName}.middleware.js`, content: `module.exports = (req, res, next) => { next(); };` }
    };
    const file = templates[type];
    const fullPath = path.join(rootDir, file.path);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, file.content);
    console.log(chalk.green(`  ✔ Created ${type}: ${file.path}`));
};

const handleInit = async () => {
    showBanner();
    const answers = await inquirer.prompt([
        { type: 'input', name: 'projectName', message: 'Project Name:', default: 'expresso-app' },
        { type: 'confirm', name: 'auth', message: 'Include Auth?', default: true },
        { type: 'list', name: 'dbType', message: 'DB:', choices: ['MongoDB', 'MySQL', 'SQLite'] },
        { type: 'confirm', name: 'install', message: 'Install dependencies?', default: true }
    ]);
    const targetDir = path.join(process.cwd(), answers.projectName);
    try {
        await fs.ensureDir(targetDir);
        await fs.copy(path.join(__dirname, '../templates'), targetDir);
        const pkgPath = path.join(targetDir, 'package.json');
        const pkg = await fs.readJson(pkgPath);
        if (!pkg.dependencies) pkg.dependencies = {};
        
        // Database ORMs & Drivers
        if (answers.dbType === 'MongoDB') {
            pkg.dependencies['mongoose'] = '^8.0.0';
        } else if (answers.dbType === 'MySQL' || answers.dbType === 'SQLite') {
            if (answers.dbType === 'MySQL') pkg.dependencies['mysql2'] = '^3.6.0';
            else pkg.dependencies['sqlite3'] = '^5.1.0';
            pkg.dependencies['sequelize'] = '^6.35.0';

            // Overwrite config to use Sequelize
            const dbConfigPath = path.join(targetDir, 'src/config/database.js');
            const dialect = answers.dbType === 'MySQL' ? 'mysql' : 'sqlite';
            const storageLine = answers.dbType === 'SQLite' ? "\n    storage: './database.sqlite'," : "";
            const sqlDbContent = `const { Sequelize } = require('sequelize');\nconst chalk = require('chalk');\nrequire('dotenv').config();\n\nconst dbName = process.env.DB_NAME || 'expresso_db';\nconst dbUser = process.env.DB_USER || 'root';\nconst dbPass = process.env.DB_PASS || '';\nconst dbHost = process.env.DB_HOST || 'localhost';\n\nconst sequelize = new Sequelize(dbName, dbUser, dbPass, {\n    host: dbHost,\n    dialect: '${dialect}',${storageLine}\n    logging: false\n});\n\nconst connectDB = async () => {\n    try {\n        if ('${dialect}' === 'mysql') {\n            const mysql = require('mysql2/promise');\n            const connection = await mysql.createConnection({ host: dbHost, user: dbUser, password: dbPass });\n            await connection.query(\`CREATE DATABASE IF NOT EXISTS \\\`\${dbName}\\\`;\`);\n            await connection.end();\n        }\n\n        await sequelize.authenticate();\n        console.log(chalk.green.bold('✅ SQL Database Connected'));\n        await sequelize.sync({ alter: true }); // Auto-create tables for development\n    } catch (error) {\n        console.log(chalk.red.bold('❌ Database Connection Error!'), error.message);\n        process.exit(1);\n    }\n};\n\nmodule.exports = connectDB;\nmodule.exports.sequelize = sequelize;`;
            await fs.writeFile(dbConfigPath, sqlDbContent);

            // Overwrite boilerplate user.model.js to Sequelize
            const userModelPath = path.join(targetDir, 'src/models/user.model.js');
            const sqlUserModelContent = `const { DataTypes } = require('sequelize');\nconst { sequelize } = require('../config/database');\n\nconst User = sequelize.define('User', {\n    username: { type: DataTypes.STRING, allowNull: false, unique: true },\n    email: { type: DataTypes.STRING, allowNull: false, unique: true },\n    password: { type: DataTypes.STRING, allowNull: false }\n}, { timestamps: true });\n\nmodule.exports = User;`;
            await fs.writeFile(userModelPath, sqlUserModelContent);
        }

        // Authentication 
        if (answers.auth) {
            pkg.dependencies['jsonwebtoken'] = '^9.0.2';
            pkg.dependencies['bcryptjs'] = '^2.4.3';
        }
        await fs.writeJson(pkgPath, pkg, { spaces: 2 });
        if (answers.install) { console.log(chalk.yellow('📦 Installing...')); execSync('npm install', { stdio: 'inherit', cwd: targetDir }); }
        console.log(chalk.cyan(`\n✨ Project ready!`));
    } catch (e) { console.error(e); }
};

const handleGenerate = async () => {
    const { action } = await inquirer.prompt([{ type: 'list', name: 'action', message: 'What to generate?', choices: ['Backend (MVC)', 'Frontend (React Integration)'] }]);
    if (action === 'Frontend (React Integration)') {
        const rootDir = findProjectRoot(process.cwd());
        console.log(chalk.blue('\n🚀 Adding React Frontend...'));
        execSync('npm create vite@latest frontend -- --template react', { stdio: 'inherit', cwd: rootDir });
        execSync('npm install concurrently --save-dev', { stdio: 'inherit', cwd: rootDir });
        const pkgPath = path.join(rootDir, 'package.json');
        const pkg = await fs.readJson(pkgPath);
        pkg.scripts = { ...pkg.scripts, "server": "node src/index.js", "client": "npm run dev --prefix frontend", "dev": "concurrently \"npm run server\" \"npm run client\"" };
        await fs.writeJson(pkgPath, pkg, { spaces: 2 });
        console.log(chalk.green('\n✅ Frontend added!'));
    } else {
        const { type, name } = await inquirer.prompt([
            { type: 'list', name: 'type', message: 'Type:', choices: ['All (CRUD Stack)', 'Controller', 'Model', 'Route', 'Service', 'Repository', 'Middleware'] },
            { type: 'input', name: 'name', message: 'Name:', validate: i => i ? true : 'Required!' }
        ]);
        
        let fieldsString = '';
        if (type === 'All (CRUD Stack)' || type === 'Model') {
            const { fields } = await inquirer.prompt([
                { type: 'input', name: 'fields', message: 'Fields (e.g. name:string doc_id:belongsto:Doctor tags:hasmany:Tag) [Leave empty]:' }
            ]);
            fieldsString = fields;
        }

        if (type === 'All (CRUD Stack)') {
            for (const t of ['model', 'repository', 'service', 'controller', 'route']) await makeFile(t, name, fieldsString);
        } else await makeFile(type.toLowerCase(), name, fieldsString);
    }
};

const handleBuildStack = async () => {
    const rootDir = findProjectRoot(process.cwd());
    console.log(chalk.blue('\n🚀 Building...'));
    try {
        execSync('npm run build --prefix frontend', { stdio: 'inherit', cwd: rootDir });
        const distDir = path.join(rootDir, 'frontend/dist');
        const publicDir = path.join(rootDir, 'src/public');
        await fs.ensureDir(publicDir); await fs.emptyDir(publicDir); await fs.copy(distDir, publicDir);

        const indexPath = path.join(rootDir, 'src/index.js');
        if (await fs.pathExists(indexPath)) {
            let content = await fs.readFile(indexPath, 'utf8');
            let imports = "";
            if (!content.includes("require('path')")) imports += "const path = require('path');\n";
            if (!content.includes("require('fs')")) imports += "const fs = require('fs');\n";
            if (imports) content = imports + content;
            const smartRouteLogic = `\n// --- Smart Routing (React vs API) ---\nconst publicPath = path.join(__dirname, 'public');\nif (fs.existsSync(publicPath)) {\n    app.use(express.static(publicPath));\n    app.get('*', (req, res) => {\n        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });\n        res.sendFile(path.join(publicPath, 'index.html'));\n    });\n} else {\n    app.get('/', (req, res) => res.json({ message: 'Welcome to Expresso Framework API' }));\n}\n`;
            const oldRouteRegex = /app\.get\('\/',[\s\S]*?\}\);\s*\}\);/m;
            if (content.match(oldRouteRegex)) content = content.replace(oldRouteRegex, smartRouteLogic);
            else if (!content.includes('Smart Routing')) content += smartRouteLogic;
            await fs.writeFile(indexPath, content);
        }
        console.log(chalk.green('\n✅ Done!'));
    } catch (e) { console.error(e); }
};

const handleAddAuth = async () => {
    const rootDir = findProjectRoot(process.cwd());
    console.log(chalk.blue('\n🔐 Adding Auth Boilerplate...'));
    try {
        const templates = {
            middleware: { path: 'src/middleware/auth.middleware.js', content: `const jwt = require('jsonwebtoken');\n\nmodule.exports = (req, res, next) => {\n    const token = req.header('Authorization');\n    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });\n\n    try {\n        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');\n        req.user = decoded.user;\n        next();\n    } catch (err) {\n        res.status(401).json({ msg: 'Token is not valid' });\n    }\n};` },
            controller: { path: 'src/controllers/auth.controller.js', content: `const jwt = require('jsonwebtoken');\n\nclass AuthController {\n    async login(req, res) {\n        // Dummy login - implement your logic\n        const payload = { user: { id: 1 } };\n        jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 3600 }, (err, token) => {\n            if (err) throw err;\n            res.json({ token });\n        });\n    }\n}\nmodule.exports = new AuthController();` },
            route: { path: 'src/routes/auth.route.js', content: `const express = require('express');\nconst router = express.Router();\nconst authCtrl = require('../controllers/auth.controller');\n\n/**\n * @swagger\n * /api/auth/login:\n *   post:\n *     summary: Login user\n *     tags: [Auth]\n *     requestBody:\n *       required: true\n *       content:\n *         application/json:\n *           schema:\n *             type: object\n *             properties:\n *               email:\n *                 type: string\n *               password:\n *                 type: string\n *     responses:\n *       200:\n *         description: Login successful\n */\nrouter.post('/login', authCtrl.login);\n\nmodule.exports = router;` },
            model: { path: 'src/models/user.model.js', content: `const mongoose = require('mongoose');\nconst schema = new mongoose.Schema({ \n    email: { type: String, required: true, unique: true },\n    password: { type: String, required: true }\n});\nmodule.exports = mongoose.model('User', schema);` }
        };

        for (const [key, file] of Object.entries(templates)) {
            const fullPath = path.join(rootDir, file.path);
            await fs.ensureDir(path.dirname(fullPath));
            await fs.writeFile(fullPath, file.content);
            console.log(chalk.green(`  ✔ Created ${key}: ${file.path}`));
        }

        const pkgPath = path.join(rootDir, 'package.json');
        if (await fs.pathExists(pkgPath)) {
            const pkg = await fs.readJson(pkgPath);
            if (!pkg.dependencies) pkg.dependencies = {};
            pkg.dependencies['jsonwebtoken'] = '^9.0.2';
            pkg.dependencies['bcryptjs'] = '^2.4.3';
            await fs.writeJson(pkgPath, pkg, { spaces: 2 });
            console.log(chalk.yellow('📦 Installing auth dependencies...'));
            execSync('npm install', { stdio: 'inherit', cwd: rootDir });
        }

        console.log(chalk.cyan('\n✨ Auth Boilerplate ready!'));
    } catch (e) { console.error(e); }
};

const handleAddDocs = async () => {
    const rootDir = findProjectRoot(process.cwd());
    console.log(chalk.blue('\n📚 Generating Swagger Auto-Gen Setup...'));
    try {
        const swaggerScriptPath = path.join(rootDir, 'swagger.js');
        const swaggerContent = `const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });\n\nconst doc = {\n    info: {\n        title: 'Expresso API',\n        description: 'Auto generated Swagger API documentation'\n    },\n    servers: [\n        {\n            url: 'http://localhost:' + (process.env.PORT || 3000),\n        }\n    ],\n    components: {\n        securitySchemes: {\n            bearerAuth: {\n                type: 'http',\n                scheme: 'bearer',\n                bearerFormat: 'JWT',\n            }\n        }\n    },\n    security: [{ bearerAuth: [] }]\n};\n\nconst outputFile = './src/config/swagger_output.json';\nconst routes = ['./src/index.js'];\n\nswaggerAutogen(outputFile, routes, doc).then(() => {\n    console.log('✅ Swagger JSON generated successfully!');\n});`;

        await fs.writeFile(swaggerScriptPath, swaggerContent);
        console.log(chalk.green(`  ✔ Created auto-generator script: swagger.js`));

        // Inject into index.js
        const indexPath = path.join(rootDir, 'src/index.js');
        if (await fs.pathExists(indexPath)) {
            let content = await fs.readFile(indexPath, 'utf8');
            
            // Clean up old swagger-jsdoc logic if exists
            if (content.includes('swaggerSpec')) {
                content = content.replace(/const swaggerSpec = require\('\.\/config\/swagger'\);\n?/g, '');
                content = content.replace(/app\.use\('\/api-docs', swaggerUi\.serve, swaggerUi\.setup\(swaggerSpec\)\);\n?/g, '');
            }

            if (!content.includes('swagger_output.json')) {
                if (!content.includes('swagger-ui-express')) {
                    const imports = `const swaggerUi = require('swagger-ui-express');\nconst fs = require('fs');\nconst path = require('path');\n`;
                    content = content.replace("const express = require('express');", "const express = require('express');\n" + imports);
                } else if (!content.includes("require('fs')")) {
                    content = content.replace("const express = require('express');", "const express = require('express');\nconst fs = require('fs');\nconst path = require('path');\n");
                }

                const routeInject = `\n// API Documentation\nconst swaggerFile = path.join(__dirname, 'config/swagger_output.json');\nif (fs.existsSync(swaggerFile)) {\n    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(require(swaggerFile)));\n}\n`;
                
                if (content.includes('// Routes')) {
                    content = content.replace('// Routes', routeInject + '\n// Routes');
                } else if (content.includes('app.listen(')) {
                    content = content.replace('app.listen(', routeInject + '\napp.listen(');
                } else {
                    content += routeInject;
                }
                
                await fs.writeFile(indexPath, content);
                console.log(chalk.green(`  ✔ Updated src/index.js with dynamic /api-docs route`));
            }
        }

        // Add dependencies and scripts
        const pkgPath = path.join(rootDir, 'package.json');
        if (await fs.pathExists(pkgPath)) {
            const pkg = await fs.readJson(pkgPath);
            if (!pkg.dependencies) pkg.dependencies = {};
            pkg.dependencies['swagger-ui-express'] = '^5.0.0';
            pkg.dependencies['swagger-autogen'] = '^2.23.7';
            if(pkg.dependencies['swagger-jsdoc']) delete pkg.dependencies['swagger-jsdoc'];

            if (!pkg.scripts) pkg.scripts = {};
            pkg.scripts['docs'] = 'node swagger.js';
            
            // Auto run swagger-autogen on dev
            if (pkg.scripts['dev'] && !pkg.scripts['dev'].includes('node swagger.js')) {
                pkg.scripts['dev'] = 'node swagger.js && ' + pkg.scripts['dev'];
            }

            await fs.writeJson(pkgPath, pkg, { spaces: 2 });
            console.log(chalk.yellow('📦 Installing swagger-autogen dependencies...'));
            execSync('npm install', { stdio: 'inherit', cwd: rootDir });
            
            // Initial generation
            await fs.ensureDir(path.join(rootDir, 'src/config'));
            console.log(chalk.yellow('⚙️ Generating initial swagger.json...'));
            execSync('npm run docs', { stdio: 'inherit', cwd: rootDir });
        }

        console.log(chalk.cyan('\n✨ Magic Swagger documentation ready at /api-docs!'));
    } catch (e) { console.error(e); }
};

const handleAddTelescope = async () => {
    const rootDir = findProjectRoot(process.cwd());
    console.log(chalk.blue('\n🔭 Generating Telescope Dashboard & Middleware...'));

    try {
        let dbType = 'MongoDB';
        const pkgPath = path.join(rootDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = require(pkgPath);
                if (pkg.dependencies && (pkg.dependencies['mysql2'] || pkg.dependencies['sqlite3'])) {
                    dbType = 'SQL';
                }
            } catch(err) {}
        }

        // 1. Model
        const modelPath = path.join(rootDir, 'src/models/telescope.model.js');
        let modelContent = '';
        if (dbType === 'MongoDB') {
            modelContent = `const mongoose = require('mongoose');\nconst schema = new mongoose.Schema({\n    method: String,\n    url: String,\n    status: Number,\n    duration: Number,\n    ip: String,\n    payload: mongoose.Schema.Types.Mixed,\n    headers: mongoose.Schema.Types.Mixed,\n    response: mongoose.Schema.Types.Mixed,\n    createdAt: { type: Date, default: Date.now }\n});\nmodule.exports = mongoose.model('TelescopeLog', schema);`;
        } else {
            modelContent = `const { DataTypes } = require('sequelize');\nconst { sequelize } = require('../config/database');\n\nconst TelescopeLog = sequelize.define('TelescopeLog', {\n    method: DataTypes.STRING,\n    url: DataTypes.STRING,\n    status: DataTypes.INTEGER,\n    duration: DataTypes.INTEGER,\n    ip: DataTypes.STRING,\n    payload: DataTypes.JSON,\n    headers: DataTypes.JSON,\n    response: DataTypes.JSON\n}, { timestamps: true });\n\nmodule.exports = TelescopeLog;`;
        }

        // 2. Middleware
        const middlewarePath = path.join(rootDir, 'src/middleware/telescope.middleware.js');
        const middlewareContent = `const Log = require('../models/telescope.model');\n\nmodule.exports = async (req, res, next) => {\n    // Skip telescope routes to avoid infinite loop\n    if (req.originalUrl.startsWith('/telescope')) return next();\n\n    const start = Date.now();\n    const oldJson = res.json;\n    const oldSend = res.send;\n    let responseBody;\n\n    res.json = function(data) {\n        responseBody = data;\n        return oldJson.apply(res, arguments);\n    };\n    res.send = function(data) {\n        if (!responseBody) responseBody = data;\n        return oldSend.apply(res, arguments);\n    };\n\n    res.on('finish', () => {\n        const duration = Date.now() - start;\n        Log.create({\n            method: req.method,\n            url: req.originalUrl,\n            status: res.statusCode,\n            duration,\n            ip: req.ip,\n            payload: req.body,\n            headers: req.headers,\n            response: responseBody\n        }).catch(err => console.error('Telescope Log Error:', err));\n    });\n\n    next();\n};`;

        // 3. Controller & View
        const controllerPath = path.join(rootDir, 'src/controllers/telescope.controller.js');
        const viewPath = path.join(rootDir, 'src/views/telescope.html');
        
        const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Expresso Telescope</title>
    <style>
        :root { --bg: #f8f9fa; --card: #ffffff; --text: #374151; --text-light: #6b7280; --border: #e5e7eb; --primary: #4f46e5; --sidebar-bg: #ffffff; --sidebar-hover: #f3f4f6; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); margin: 0; display: flex; height: 100vh; overflow: hidden; transition: background 0.3s; }
        
        /* Top Navigation (Fixed) */
        .top-nav { position: fixed; top: 0; left: 0; right: 0; height: 60px; background: var(--card); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; padding: 0 24px; z-index: 50; transition: background 0.3s; }
        .logo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 18px; color: var(--text); }
        .logo svg { width: 24px; height: 24px; fill: var(--primary); }
        
        .action-bar { display: flex; gap: 8px; align-items: center; }
        .action-btn { background: var(--bg); border: 1px solid var(--border); color: var(--text-light); width: 34px; height: 34px; border-radius: 6px; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: 0.2s; }
        .action-btn:hover { background: var(--border); color: var(--text); }
        .action-btn svg { width: 16px; height: 16px; fill: currentColor; }
        
        /* Layout */
        .wrapper { display: flex; width: 100%; margin-top: 60px; height: calc(100vh - 60px); }
        
        /* Sidebar */
        .sidebar { width: 240px; background: var(--sidebar-bg); border-right: 1px solid var(--border); overflow-y: auto; padding: 20px 0; transition: background 0.3s; }
        .nav-item { padding: 10px 24px; display: flex; align-items: center; gap: 12px; color: var(--text-light); text-decoration: none; font-size: 14px; font-weight: 500; transition: 0.2s; cursor: pointer; }
        .nav-item:hover { background: var(--sidebar-hover); color: var(--text); }
        .nav-item.active { border-left: 3px solid var(--primary); color: var(--primary); background: rgba(79, 70, 229, 0.05); }
        .nav-item svg { width: 18px; height: 18px; fill: currentColor; }
        
        /* Main Content */
        .main-content { flex: 1; overflow-y: auto; padding: 30px; background: var(--bg); transition: background 0.3s; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 20px; transition: background 0.3s; }
        
        /* List Header */
        .card-header { padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.01); }
        .card-title { font-weight: 600; font-size: 15px; color: var(--text); margin: 0; }
        .search-box { position: relative; }
        .search-box input { padding: 6px 12px 6px 30px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; width: 200px; outline: none; background: var(--card); color: var(--text); }
        .search-box svg { position: absolute; left: 10px; top: 8px; width: 14px; height: 14px; fill: var(--text-light); }

        /* Table */
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 12px 24px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text); }
        th { color: var(--text-light); font-weight: 500; font-size: 12px; }
        tr:hover { background: rgba(0,0,0,0.02); cursor: pointer; }
        .method { font-weight: 600; font-size: 11px; padding: 3px 8px; border-radius: 4px; display: inline-block; letter-spacing: 0.5px; }
        .method-GET { background: #f0f9ff; color: #0284c7; }
        .method-POST { background: #eff6ff; color: #3b82f6; }
        .method-PUT { background: #fefce8; color: #ca8a04; }
        .method-DELETE { background: #fef2f2; color: #ef4444; }
        .status { font-weight: 600; }
        .status-2xx { color: #10b981; }
        .status-4xx { color: #f59e0b; }
        .status-5xx { color: #ef4444; }
        .eye-btn { background: none; border: none; color: var(--text-light); cursor: pointer; padding: 0; }
        .eye-btn:hover { color: var(--primary); }

        /* Details View */
        #details-view { display: none; }
        .back-link { color: var(--text-light); font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; margin-bottom: 20px; cursor: pointer; }
        .back-link:hover { color: var(--primary); }
        
        .detail-row { display: flex; border-bottom: 1px solid var(--border); padding: 14px 24px; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { width: 200px; color: var(--text-light); font-weight: 500; }
        .detail-value { font-weight: 400; color: var(--text); }
        
        .tabs { display: flex; border-bottom: 1px solid var(--border); padding: 0 10px; background: rgba(0,0,0,0.01); }
        .tab { padding: 14px 20px; cursor: pointer; font-size: 13px; color: var(--text-light); font-weight: 500; margin-bottom: -1px; }
        .tab.active { color: var(--primary); border-bottom: 2px solid var(--primary); }
        .tab-content { display: none; padding: 0; background: #1e293b; }
        .tab-content.active { display: block; }
        pre { color: #e2e8f0; padding: 20px; margin: 0; overflow-x: auto; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; line-height: 1.5; }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    </style>
</head>
<body>
    <!-- Top Nav -->
    <div class="top-nav">
        <div class="logo">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
            Expresso Telescope
        </div>
        <div class="action-bar">
            <div id="live-indicator" style="display: flex; align-items: center; gap: 6px; margin-right: 15px; font-size: 12px; font-weight: 600; color: #065f46; background: #d1fae5; padding: 4px 10px; border-radius: 999px;">
                <span style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; display: inline-block;"></span> Live
            </div>
            <button class="action-btn" id="btn-pause" onclick="togglePause()" title="Pause/Play">
                <svg id="icon-pause" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button class="action-btn" onclick="clearLogs()" title="Clear Logs">
                <svg viewBox="0 0 24 24"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
            </button>
            <button class="action-btn" onclick="fetchLogs(true)" title="Refresh">
                <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button class="action-btn" onclick="toggleTheme()" title="Toggle Theme">
                <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
            </button>
        </div>
    </div>

    <div class="wrapper">
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="nav-item active"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 7.5l-6-3v7l6 3v-7zm2-3v7l6-3v-7l-6 3z"/></svg> Requests</div>
            <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5.5 15l-1.5-1.5L8.5 9 4 4.5 5.5 3 11.5 9 5.5 15zm14 0H12v-2h7.5v2z"/></svg> Commands</div>
            <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> Schedule</div>
            <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg> Jobs</div>
            <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> Logs</div>
            <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/></svg> Models</div>
            <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg> Mail</div>
            <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg> Notifications</div>
            <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> Exceptions</div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <!-- List View -->
            <div id="list-view" class="card">
                <div class="card-header">
                    <h2 class="card-title">Requests</h2>
                    <div class="search-box">
                        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                        <input type="text" id="search-input" placeholder="Search Tag" onkeyup="searchLogs(this.value)">
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Verb</th>
                            <th>Path</th>
                            <th>Status</th>
                            <th>Duration</th>
                            <th>Happened</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="logs-body">
                        <tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 40px;">Loading API requests...</td></tr>
                    </tbody>
                </table>
                <div style="text-align: center; padding: 15px; border-top: 1px solid var(--border); background: rgba(0,0,0,0.01); font-size: 13px;">
                    <a href="#" style="color: var(--primary); text-decoration: none;" onclick="fetchLogs(true)">Load Older Entries</a>
                </div>
            </div>

            <!-- Details View -->
            <div id="details-view">
                <a class="back-link" onclick="showList()"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg> Back to Requests</a>
                
                <div class="card">
                    <div class="card-header"><h2 class="card-title" style="font-size: 16px;">Request Details</h2></div>
                    <div class="detail-row"><div class="detail-label">Time</div><div class="detail-value" id="d-time"></div></div>
                    <div class="detail-row"><div class="detail-label">Hostname</div><div class="detail-value" id="d-host"></div></div>
                    <div class="detail-row"><div class="detail-label">Method</div><div class="detail-value"><span id="d-method" class="method"></span></div></div>
                    <div class="detail-row"><div class="detail-label">Path</div><div class="detail-value" id="d-path" style="font-family: monospace;"></div></div>
                    <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value" id="d-status"></div></div>
                    <div class="detail-row"><div class="detail-label">Duration</div><div class="detail-value" id="d-duration"></div></div>
                    <div class="detail-row"><div class="detail-label">IP Address</div><div class="detail-value" id="d-ip"></div></div>
                </div>

                <div class="card" style="margin-top: 20px;">
                    <div class="tabs">
                        <div class="tab active" onclick="switchTab('payload', this)">Payload</div>
                        <div class="tab" onclick="switchTab('headers', this)">Headers</div>
                        <div class="tab" onclick="switchTab('response', this)">Response</div>
                    </div>
                    <div id="tab-payload" class="tab-content active"><pre id="d-payload"></pre></div>
                    <div id="tab-headers" class="tab-content"><pre id="d-headers"></pre></div>
                    <div id="tab-response" class="tab-content"><pre id="d-response"></pre></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let logsData = [];
        let polling = true;
        
        async function fetchLogs(force = false) {
            if (!polling && !force) return;
            try {
                const res = await fetch('/telescope/api/logs');
                const data = await res.json();
                if (JSON.stringify(data) !== JSON.stringify(logsData)) {
                    logsData = data;
                    searchLogs(document.getElementById('search-input').value);
                }
            } catch (err) { console.error('Polling failed', err); }
        }

        function renderLogs(dataToRender) {
            const tbody = document.getElementById('logs-body');
            tbody.innerHTML = '';
            if (!dataToRender || dataToRender.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light); padding: 40px;">No requests found.</td></tr>';
                return;
            }
            dataToRender.forEach((log) => {
                const originalIndex = logsData.findIndex(l => l._id === log._id || l.id === log.id);
                const statusClass = log.status >= 500 ? 'status-5xx' : (log.status >= 400 ? 'status-4xx' : 'status-2xx');
                const tr = document.createElement('tr');
                tr.onclick = () => showDetails(originalIndex);
                tr.innerHTML = \`
                    <td><span class="method method-\${log.method}">\${log.method}</span></td>
                    <td style="font-family: monospace;">\${log.url}</td>
                    <td><span class="status \${statusClass}">\${log.status}</span></td>
                    <td style="color: var(--text-light);">\${log.duration} ms</td>
                    <td style="color: var(--text-light); font-size: 13px;">\${timeAgo(new Date(log.createdAt || log.updatedAt))}</td>
                    <td style="text-align: right;"><button class="eye-btn"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button></td>
                \`;
                tbody.appendChild(tr);
            });
        }

        function timeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + "y ago";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + "mo ago";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + "d ago";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + "h ago";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + "m ago";
            if (seconds < 10) return "Just now";
            return Math.floor(seconds) + "s ago";
        }

        function searchLogs(query) {
            if (!query) return renderLogs(logsData);
            const lowerQ = query.toLowerCase();
            const filtered = logsData.filter(log => log.url.toLowerCase().includes(lowerQ) || log.method.toLowerCase().includes(lowerQ) || log.status.toString().includes(lowerQ));
            renderLogs(filtered);
        }

        function showDetails(index) {
            polling = false;
            document.getElementById('live-indicator').style.display = 'none';
            const log = logsData[index];
            document.getElementById('list-view').style.display = 'none';
            document.getElementById('details-view').style.display = 'block';
            
            document.getElementById('d-time').innerText = new Date(log.createdAt || log.updatedAt).toLocaleString();
            document.getElementById('d-host').innerText = window.location.hostname;
            const methodEl = document.getElementById('d-method');
            methodEl.innerText = log.method;
            methodEl.className = \`method method-\${log.method}\`;
            document.getElementById('d-path').innerText = log.url;
            
            const statusClass = log.status >= 500 ? 'status-5xx' : (log.status >= 400 ? 'status-4xx' : 'status-2xx');
            document.getElementById('d-status').innerHTML = \`<span class="\${statusClass}">\${log.status}</span>\`;
            document.getElementById('d-duration').innerText = \`\${log.duration} ms\`;
            document.getElementById('d-ip').innerText = log.ip || '127.0.0.1';

            document.getElementById('d-payload').innerText = Object.keys(log.payload || {}).length ? JSON.stringify(log.payload, null, 2) : '[]';
            document.getElementById('d-headers').innerText = JSON.stringify(log.headers, null, 2);
            document.getElementById('d-response').innerText = JSON.stringify(log.response, null, 2);
            switchTab('payload', document.querySelector('.tab'));
        }

        function showList() {
            polling = true;
            document.getElementById('live-indicator').style.display = 'flex';
            document.getElementById('details-view').style.display = 'none';
            document.getElementById('list-view').style.display = 'block';
            fetchLogs(true);
        }

        function switchTab(tabId, el) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            document.getElementById('tab-' + tabId).classList.add('active');
        }

        function togglePause() {
            polling = !polling;
            const btn = document.getElementById('btn-pause');
            const icon = document.getElementById('icon-pause');
            if (!polling) {
                btn.style.color = '#f59e0b';
                icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                document.getElementById('live-indicator').style.display = 'none';
            } else {
                btn.style.color = '';
                icon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
                document.getElementById('live-indicator').style.display = 'flex';
                fetchLogs(true);
            }
        }

        async function clearLogs() {
            if (!confirm('Are you sure you want to clear all logs?')) return;
            try {
                await fetch('/telescope/api/logs', { method: 'DELETE' });
                logsData = [];
                renderLogs(logsData);
            } catch(e) { alert('Failed to clear logs'); }
        }

        function toggleTheme() {
            const root = document.documentElement;
            if (root.style.getPropertyValue('--bg') === '#111827') {
                root.style.setProperty('--bg', '#f8f9fa');
                root.style.setProperty('--card', '#ffffff');
                root.style.setProperty('--text', '#374151');
                root.style.setProperty('--border', '#e5e7eb');
                root.style.setProperty('--text-light', '#6b7280');
                root.style.setProperty('--sidebar-bg', '#ffffff');
                root.style.setProperty('--sidebar-hover', '#f3f4f6');
            } else {
                root.style.setProperty('--bg', '#111827');
                root.style.setProperty('--card', '#1f2937');
                root.style.setProperty('--text', '#f9fafb');
                root.style.setProperty('--border', '#374151');
                root.style.setProperty('--text-light', '#9ca3af');
                root.style.setProperty('--sidebar-bg', '#111827');
                root.style.setProperty('--sidebar-hover', '#1f2937');
            }
        }

        setInterval(fetchLogs, 2000);
        fetchLogs();
    </script>
</body>
</html>`;

        const controllerContent = `const Log = require('../models/telescope.model');\nconst path = require('path');\n\nclass TelescopeController {\n    async view(req, res) {\n        res.sendFile(path.join(__dirname, '../views/telescope.html'));\n    }\n    \n    async getLogs(req, res) {\n        try {\n            let logs = [];\n            if (Log.find) logs = await Log.find().sort({ _id: -1 }).limit(50);\n            else if (Log.findAll) logs = await Log.findAll({ order: [['id', 'DESC']], limit: 50 });\n            res.json(logs);\n        } catch (e) { res.status(500).json({ error: e.message }); }\n    }\n\n    async clearLogs(req, res) {\n        try {\n            if (Log.deleteMany) await Log.deleteMany({});\n            else if (Log.destroy) await Log.destroy({ where: {}, truncate: true });\n            res.json({ success: true });\n        } catch (e) { res.status(500).json({ error: e.message }); }\n    }\n}\n\nmodule.exports = new TelescopeController();`;

        // 4. Route
        const routePath = path.join(rootDir, 'src/routes/telescope.route.js');
        const routeContent = `const express = require('express');\nconst router = express.Router();\nconst ctrl = require('../controllers/telescope.controller');\n\nrouter.get('/', ctrl.view);\nrouter.get('/api/logs', ctrl.getLogs);\nrouter.delete('/api/logs', ctrl.clearLogs);\n\nmodule.exports = router;`;

        await fs.ensureDir(path.dirname(modelPath));
        await fs.writeFile(modelPath, modelContent);
        await fs.ensureDir(path.dirname(middlewarePath));
        await fs.writeFile(middlewarePath, middlewareContent);
        await fs.ensureDir(path.dirname(viewPath));
        await fs.writeFile(viewPath, htmlTemplate);
        await fs.ensureDir(path.dirname(controllerPath));
        await fs.writeFile(controllerPath, controllerContent);
        await fs.ensureDir(path.dirname(routePath));
        await fs.writeFile(routePath, routeContent);

        console.log(chalk.green(`  ✔ Generated Telescope MVC and Middleware`));

        // 5. Inject into index.js
        const indexPath = path.join(rootDir, 'src/index.js');
        if (await fs.pathExists(indexPath)) {
            let content = await fs.readFile(indexPath, 'utf8');
            
            // Inject middleware
            if (!content.includes('telescope.middleware')) {
                const middlewareInject = `\n// Telescope Middleware\napp.use(require('./middleware/telescope.middleware'));\n`;
                content = content.replace("app.use(express.json());", "app.use(express.json());" + middlewareInject);
            }
            
            // Inject route
            if (!content.includes("use('/telescope'")) {
                const routeInject = `\n// Telescope Dashboard\napp.use('/telescope', require('./routes/telescope.route'));\n`;
                if (content.includes('// Routes')) {
                    content = content.replace('// Routes', routeInject + '\n// Routes');
                } else if (content.includes('app.listen(')) {
                    content = content.replace('app.listen(', routeInject + '\napp.listen(');
                } else {
                    content += routeInject;
                }
            }
            
            await fs.writeFile(indexPath, content);
            console.log(chalk.green(`  ✔ Attached Telescope to src/index.js`));
        }

        console.log(chalk.cyan('\n✨ Telescope is active! Visit /telescope to view live API logs.'));
    } catch (e) { console.error(e); }
};

const mainHandler = async () => {
    showBanner();
    const { action } = await inquirer.prompt([{ type: 'list', name: 'action', message: 'Action:', choices: ['init', 'generate', 'add:auth', 'add:docs', 'add:telescope', 'build:stack'] }]);
    if (action === 'init') await handleInit();
    else if (action === 'generate') await handleGenerate();
    else if (action === 'add:auth') await handleAddAuth();
    else if (action === 'add:docs') await handleAddDocs();
    else if (action === 'add:telescope') await handleAddTelescope();
    else await handleBuildStack();
};

program.command('init').action(handleInit);
program.command('generate').alias('g').action(handleGenerate);
program.command('add:auth').action(handleAddAuth);
program.command('add:docs').action(handleAddDocs);
program.command('add:telescope').alias('generate:telescope').action(handleAddTelescope);
program.command('build:stack').action(handleBuildStack);

if (process.argv.length > 2) program.parse(process.argv);
else mainHandler();
