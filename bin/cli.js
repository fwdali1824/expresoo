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
            
            // Cleanup existing Smart Routing or Default Route to avoid duplicates/conflicts
            content = content.replace(/\/\/ --- Smart Routing[\s\S]*?\}\n/g, '');
            content = content.replace(/app\.get\('\/',[\s\S]*?\}\);\s*\}\);/g, '');

            let imports = "";
            if (!content.includes("require('path')")) imports += "const path = require('path');\n";
            if (!content.includes("require('fs')")) imports += "const fs = require('fs');\n";
            if (imports) content = imports + content;

            const smartRouteLogic = `\n// --- Smart Routing (React vs API) ---\nconst publicPath = path.join(__dirname, 'public');\nif (fs.existsSync(publicPath)) {\n    app.use(express.static(publicPath));\n    app.get('*', (req, res) => {\n        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });\n        res.sendFile(path.join(publicPath, 'index.html'));\n    });\n}\n`;

            // Inject at the end, but before app.listen to ensure API routes hit first
            if (content.includes('app.listen')) {
                content = content.replace('app.listen', smartRouteLogic + '\napp.listen');
            } else {
                content += smartRouteLogic;
            }

            await fs.writeFile(indexPath, content);
        }
        console.log(chalk.green('\n✅ Done!'));
    } catch (e) { console.error(e); }
};

const handleAddAuth = async () => {
    const rootDir = findProjectRoot(process.cwd());
    console.log(chalk.blue('\n🔐 Generating Enterprise RBAC Auth Scaffold (Users, Roles, Permissions)...\n'));
    try {
        let dbType = 'MongoDB';
        const pkgPath = path.join(rootDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = require(pkgPath);
            if (pkg.dependencies && (pkg.dependencies['mysql2'] || pkg.dependencies['sqlite3'])) dbType = 'SQL';
        }

        // 1. Models
        const models = {
            role: dbType === 'MongoDB' ? 
                `const mongoose = require('mongoose');\nconst schema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, permissions: [String] });\nmodule.exports = mongoose.model('Role', schema);` : 
                `const { DataTypes } = require('sequelize');\nconst { sequelize } = require('../config/database');\nconst Role = sequelize.define('Role', {\n    name: { type: DataTypes.STRING, allowNull: false, unique: true },\n    permissions: {\n        type: DataTypes.TEXT,\n        get() {\n            const val = this.getDataValue('permissions');\n            return val ? JSON.parse(val) : [];\n        },\n        set(val) {\n            this.setDataValue('permissions', JSON.stringify(val));\n        }\n    }\n});\nmodule.exports = Role;`,
            permission: dbType === 'MongoDB' ?
                `const mongoose = require('mongoose');\nconst schema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, slug: { type: String, required: true, unique: true } });\nmodule.exports = mongoose.model('Permission', schema);` :
                `const { DataTypes } = require('sequelize');\nconst { sequelize } = require('../config/database');\nconst Permission = sequelize.define('Permission', { name: { type: DataTypes.STRING, allowNull: false }, slug: { type: DataTypes.STRING, allowNull: false, unique: true } });\nmodule.exports = Permission;`
        };

        for (const [name, content] of Object.entries(models)) {
            const p = path.join(rootDir, `src/models/${name}.model.js`);
            await fs.ensureDir(path.dirname(p));
            await fs.writeFile(p, content);
        }

        // Inject Associations for SQL
        if (dbType === 'SQL') {
            const userModelPath = path.join(rootDir, 'src/models/user.model.js');
            if (await fs.pathExists(userModelPath)) {
                let userModelContent = await fs.readFile(userModelPath, 'utf8');
                if (!userModelContent.includes('RoleId') && !userModelContent.includes('belongsTo')) {
                    const roleImport = `const Role = require('./role.model');\n`;
                    const association = `\nUser.belongsTo(Role);\nRole.hasMany(User);\n`;
                    userModelContent = userModelContent.replace('password: { type: DataTypes.STRING, allowNull: false }', 
                        'password: { type: DataTypes.STRING, allowNull: false },\n    RoleId: { type: DataTypes.INTEGER, references: { model: Role, key: "id" } }');
                    userModelContent = roleImport + userModelContent.replace('module.exports = User;', association + 'module.exports = User;');
                    await fs.writeFile(userModelPath, userModelContent);
                }
            }
        }

        // 2. Auth Middleware
        const authMidContent = `const jwt = require('jsonwebtoken');\nconst User = require('../models/user.model');\nconst Role = require('../models/role.model');\n\nexports.protect = async (req, res, next) => {\n    let token = req.headers.authorization?.split(' ')[1];\n    if (!token) return res.status(401).json({ msg: 'Unauthorized' });\n    try {\n        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');\n        req.user = await ${dbType === 'MongoDB' ? 'User.findById(decoded.user.id).populate("role")' : 'User.findByPk(decoded.user.id, { include: ["Role"] })'};\n        next();\n    } catch (err) { res.status(401).json({ msg: 'Token invalid' }); }\n};\n\nexports.authorize = (...permissions) => {\n    return (req, res, next) => {\n        const role = req.user?.Role || req.user?.role;\n        if (!req.user || !role) return res.status(403).json({ msg: 'Forbidden' });\n        const userPermissions = role.permissions || [];\n        if (userPermissions.includes('*')) return next();\n        const hasPermission = permissions.every(p => userPermissions.includes(p));\n        if (!hasPermission) return res.status(403).json({ msg: 'Missing permissions' });\n        next();\n    };\n};`;
        await fs.writeFile(path.join(rootDir, 'src/middleware/auth.middleware.js'), authMidContent);

        // 3. Auth Controller
        const authCtrlContent = `const jwt = require('jsonwebtoken');\nconst bcrypt = require('bcryptjs');\nconst User = require('../models/user.model');\nconst Role = require('../models/role.model');\nconst Permission = require('../models/permission.model');\n\nclass AuthController {\n    async register(req, res) {\n        try {\n            const { email, password } = req.body;\n            let user = await ${dbType === 'MongoDB' ? 'User.findOne({ email })' : 'User.findOne({ where: { email } })'};\n            if (user) return res.status(400).json({ msg: 'User already exists' });\n            const count = await ${dbType === 'MongoDB' ? 'User.countDocuments()' : 'User.count()'};\n            const roleName = count === 0 ? 'admin' : 'user';\n            let role = await Role.findOne(${dbType === 'MongoDB' ? '{ name: roleName }' : '{ where: { name: roleName } }'});\n            if(!role) role = await Role.create({ name: roleName, permissions: roleName === 'admin' ? ['manage_users', 'manage_roles', 'view_dashboard'] : ['view_dashboard'] });\n            const salt = await bcrypt.genSalt(10);\n            const hashedPassword = await bcrypt.hash(password, salt);\n            const userData = { email, password: hashedPassword, username: email.split('@')[0] + Math.floor(Math.random() * 1000) };\n            if ('${dbType}' === 'MongoDB') userData.role = role._id; else userData.RoleId = role.id;\n            user = await User.create(userData);\n            const payload = { user: { id: user.id || user._id } };\n            const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });\n            res.status(201).json({ token, user: { email: user.email, role: role.name, permissions: role.permissions } });\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n\n    async login(req, res) {\n        try {\n            const { email, password } = req.body;\n            const user = await ${dbType === 'MongoDB' ? 'User.findOne({ email }).populate("role")' : 'User.findOne({ where: { email }, include: ["Role"] })'};\n            if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ msg: 'Invalid credentials' });\n            const payload = { user: { id: user.id || user._id } };\n            const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });\n            res.json({ token, user: { email: user.email, role: user.Role?.name || user.role?.name, permissions: user.Role?.permissions || user.role?.permissions } });\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n\n    async updatePassword(req, res) {\n        try {\n            const { password } = req.body;\n            const salt = await bcrypt.genSalt(10);\n            const hashedPassword = await bcrypt.hash(password, salt);\n            await User.update({ password: hashedPassword }, { where: { id: req.user.id } });\n            res.json({ msg: 'Password updated' });\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n\n    // --- RBAC MANAGEMENT ---\n    // Users\n    async getUsers(req, res) { try { const users = await ${dbType === 'MongoDB' ? 'User.find().populate("role")' : 'User.findAll({ include: ["Role"] })'}; res.json(users); } catch(err) { res.status(500).json({ error: err.message }); } }\n    async updateUser(req, res) {\n        try {\n            const { roleId } = req.body;\n            if ('${dbType}' === 'MongoDB') await User.findByIdAndUpdate(req.params.id, { role: roleId });\n            else await User.update({ RoleId: roleId }, { where: { id: req.params.id } });\n            res.json({ msg: 'User role updated' });\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n    async deleteUser(req, res) { try { await ${dbType === 'MongoDB' ? 'User.findByIdAndDelete(req.params.id)' : 'User.destroy({ where: { id: req.params.id } })'}; res.json({ msg: 'User deleted' }); } catch(err) { res.status(500).json({ error: err.message }); } }\n\n    // Roles\n    async getRoles(req, res) { try { const roles = await Role.${dbType === 'MongoDB' ? 'find()' : 'findAll()'}; res.json(roles); } catch(err) { res.status(500).json({ error: err.message }); } }\n    async createRole(req, res) { try { const role = await Role.create(req.body); res.status(201).json(role); } catch(err) { res.status(500).json({ error: err.message }); } }\n    async updateRole(req, res) { try { if('${dbType}'==='MongoDB') await Role.findByIdAndUpdate(req.params.id, req.body); else await Role.update(req.body, { where: { id: req.params.id } }); res.json({ msg: 'Role updated' }); } catch(err) { res.status(500).json({ error: err.message }); } }\n    async deleteRole(req, res) { try { await ${dbType === 'MongoDB' ? 'Role.findByIdAndDelete(req.params.id)' : 'Role.destroy({ where: { id: req.params.id } })'}; res.json({ msg: 'Role deleted' }); } catch(err) { res.status(500).json({ error: err.message }); } }\n\n    // Permissions\n    async getPermissions(req, res) { try { const perms = await Permission.${dbType === 'MongoDB' ? 'find()' : 'findAll()'}; res.json(perms); } catch(err) { res.status(500).json({ error: err.message }); } }\n    async createPermission(req, res) { try { const perm = await Permission.create(req.body); res.status(201).json(perm); } catch(err) { res.status(500).json({ error: err.message }); } }\n    async deletePermission(req, res) { try { await ${dbType === 'MongoDB' ? 'Permission.findByIdAndDelete(req.params.id)' : 'Permission.destroy({ where: { id: req.params.id } })'}; res.json({ msg: 'Permission deleted' }); } catch(err) { res.status(500).json({ error: err.message }); } }\n\n    async getMe(req, res) { res.json(req.user); }\n}\nmodule.exports = new AuthController();`;
        await fs.writeFile(path.join(rootDir, 'src/controllers/auth.controller.js'), authCtrlContent);

        // 4. Routes
        const authRouteContent = `const express = require('express');\nconst router = express.Router();\nconst ctrl = require('../controllers/auth.controller');\nconst { protect, authorize } = require('../middleware/auth.middleware');\n\nrouter.post('/register', ctrl.register);\nrouter.post('/login', ctrl.login);\nrouter.get('/me', protect, ctrl.getMe);\nrouter.put('/update-password', protect, ctrl.updatePassword);\n\n// Admin Only\nrouter.get('/users', protect, authorize('manage_users'), ctrl.getUsers);\nrouter.put('/users/:id', protect, authorize('manage_users'), ctrl.updateUser);\nrouter.delete('/users/:id', protect, authorize('manage_users'), ctrl.deleteUser);\n\nrouter.get('/roles', protect, authorize('manage_roles'), ctrl.getRoles);\nrouter.post('/roles', protect, authorize('manage_roles'), ctrl.createRole);\nrouter.put('/roles/:id', protect, authorize('manage_roles'), ctrl.updateRole);\nrouter.delete('/roles/:id', protect, authorize('manage_roles'), ctrl.deleteRole);\n\nrouter.get('/permissions', protect, authorize('manage_roles'), ctrl.getPermissions);\nrouter.post('/permissions', protect, authorize('manage_roles'), ctrl.createPermission);\nrouter.delete('/permissions/:id', protect, authorize('manage_roles'), ctrl.deletePermission);\n\nmodule.exports = router;`;
        await fs.writeFile(path.join(rootDir, 'src/routes/auth.route.js'), authRouteContent);

        // 5. Frontend UI
        const frontendDir = path.join(rootDir, 'frontend');
        if (await fs.pathExists(frontendDir)) {
            console.log(chalk.blue('\n🎨 Generating Enterprise RBAC UI...\n'));
            await fs.ensureDir(path.join(frontendDir, 'src/pages'));
            await fs.ensureDir(path.join(frontendDir, 'src/store'));

            // Store
            const authSliceContent = `import { createSlice } from '@reduxjs/toolkit';\nconst authSlice = createSlice({\n  name: 'auth',\n  initialState: { token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user')), isAuthenticated: !!localStorage.getItem('token') },\n  reducers: {\n    setCredentials: (state, action) => {\n      state.token = action.payload.token; state.user = action.payload.user; state.isAuthenticated = true;\n      localStorage.setItem('token', action.payload.token); localStorage.setItem('user', JSON.stringify(action.payload.user));\n    },\n    logout: (state) => {\n      state.token = null; state.user = null; state.isAuthenticated = false;\n      localStorage.removeItem('token'); localStorage.removeItem('user');\n    }\n  }\n});\nexport const { setCredentials, logout } = authSlice.actions;\nexport default authSlice.reducer;`;
            await fs.writeFile(path.join(frontendDir, 'src/store/authSlice.js'), authSliceContent);

            // Auth.jsx
            const authPageContent = `import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/authSlice';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(\`/api/auth/\${isLogin ? 'login' : 'register'}\`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if(data.token) { dispatch(setCredentials(data)); navigate('/dashboard'); } else alert(data.msg || 'Error');
    } catch(err) { alert('Network Error'); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#0d47a1] relative overflow-hidden font-sans items-center justify-center p-4" style={{ fontFamily: '"Outfit", "Inter", sans-serif' }}>
      {/* Abstract Background Shapes simulating the image */}
      <div className="absolute -top-[15%] -left-[10%] w-[600px] h-[600px] bg-blue-500 rounded-full mix-blend-screen filter blur-xl opacity-80 animate-pulse"></div>
      <div className="absolute top-[30%] -right-[15%] w-[800px] h-[800px] bg-blue-400 rounded-full mix-blend-screen filter blur-xl opacity-60"></div>
      <div className="absolute -bottom-[20%] left-[20%] w-[500px] h-[500px] bg-blue-600 rounded-full mix-blend-screen filter blur-2xl opacity-90"></div>
      
      <div className="flex w-full max-w-[1100px] bg-transparent relative z-10 flex-col lg:flex-row items-center gap-12 lg:gap-24">
        {/* Left Side text */}
        <div className="flex-1 text-white pr-8 hidden lg:block">
          <h1 className="text-[54px] font-extrabold mb-4 uppercase tracking-[0.2em] drop-shadow-2xl">WELCOME</h1>
          <h2 className="text-2xl font-bold mb-6 tracking-wide opacity-90 uppercase">YOUR HEADLINE NAME</h2>
          <p className="text-[15px] leading-relaxed opacity-80 max-w-lg font-light">
            Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat.
          </p>
        </div>
        
        {/* Right Side - Form Card */}
        <div className="w-full max-w-[440px] bg-white rounded-[32px] p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle decoration inside card */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16"></div>

          <h2 className="text-[32px] font-extrabold mb-2 text-gray-800 tracking-tight">{isLogin ? 'Sign in' : 'Sign up'}</h2>
          <p className="text-xs text-gray-400 mb-8 font-medium">Lorem ipsum dolor sit amet, consectetuer adipiscing elit</p>
          
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <input type="email" placeholder="User Name" required 
                className="w-full px-5 py-4 rounded-xl border-2 border-gray-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-gray-800 placeholder-gray-400 text-sm font-medium transition-all" 
                value={form.email} onChange={e=>setForm({...form, email: e.target.value})} />
            </div>
            <div className="relative">
              <input type="password" placeholder="Password" required 
                className="w-full px-5 py-4 rounded-xl border-2 border-gray-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-gray-800 placeholder-gray-400 text-sm font-medium transition-all" 
                value={form.password} onChange={e=>setForm({...form, password: e.target.value})} />
              <button type="button" className="absolute right-5 top-4 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors tracking-widest">SHOW</button>
            </div>
            
            <div className="flex justify-between items-center text-xs text-gray-500 font-medium pt-2 pb-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all" />
                <span className="group-hover:text-gray-700 transition-colors">Remember me</span>
              </label>
              <a href="#" className="hover:text-blue-600 transition-colors">Forgot Password?</a>
            </div>
            
            <button type="submit" 
              className="w-full py-4 bg-[#f8fafc] text-blue-600 border border-gray-100 hover:bg-blue-600 hover:text-white transition-all duration-300 rounded-xl font-bold text-[15px] shadow-sm hover:shadow-xl mt-4 tracking-wide">
              {loading ? '...' : (isLogin ? 'Sign in' : 'Sign up')}
            </button>
          </form>
          
          <p className="mt-8 text-center text-xs text-gray-500 font-medium relative z-10">
            {isLogin ? "Don't have an account?" : "Already have an account?"} 
            <button onClick={()=>setIsLogin(!isLogin)} className="ml-1 text-gray-800 font-bold hover:text-blue-600 transition-colors">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
`;
            await fs.writeFile(path.join(frontendDir, 'src/pages/Auth.jsx'), authPageContent);

            // Dashboard.jsx (Expanded)
            const dashboardContent = `import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import { useNavigate, Link, Routes, Route, useLocation } from 'react-router-dom';

// Sub Components
const UserManagement = ({ token }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => {
    fetch('/api/auth/users', { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json()).then(setUsers);
    fetch('/api/auth/roles', { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json()).then(setRoles);
  };
  useEffect(load, []);

  const handleUpdateRole = async (userId, roleId) => {
    await fetch('/api/auth/users/' + userId, { 
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ roleId })
    });
    setEditing(null); load();
  };

  return (
    <div className="bg-[#171b30] p-8 rounded-[24px] shadow-2xl border border-[#2d3748]/30">
      <h2 className="text-2xl font-bold text-white mb-8 tracking-wide">User Management</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-widest border-b border-[#2d3748]/50">
              <th className="pb-4 px-6 font-semibold">Email</th>
              <th className="pb-4 px-6 font-semibold">Role</th>
              <th className="pb-4 px-6 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3748]/30">
            {users.map(u => (
              <tr key={u.id || u._id} className="hover:bg-[#1a2035] transition-all duration-300">
                <td className="py-5 px-6 text-gray-200 font-medium">{u.email}</td>
                <td className="py-5 px-6">
                  {editing === (u.id || u._id) ? (
                    <select className="bg-[#0b1021] border border-[#2d3748] text-white rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-inner"
                      onChange={(e)=>handleUpdateRole(u.id || u._id, e.target.value)} defaultValue={u.RoleId || u.role?._id}>
                      <option value="">Select Role</option>
                      {roles.map(r => <option key={r.id || r._id} value={r.id || r._id}>{r.name}</option>)}
                    </select>
                  ) : (
                    <span className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 text-blue-300 py-1.5 px-4 rounded-full text-xs border border-blue-800/50 uppercase tracking-widest font-semibold shadow-sm">
                      {u.Role?.name || u.role?.name || 'User'}
                    </span>
                  )}
                </td>
                <td className="py-5 px-6 text-right">
                  <button onClick={()=>setEditing(u.id || u._id)} className="text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-blue-500/20">Edit Role</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RoleManagement = ({ token }) => {
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [name, setName] = useState('');
  
  const load = () => {
    fetch('/api/auth/roles', { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json()).then(setRoles);
    fetch('/api/auth/permissions', { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json()).then(setPerms);
  };
  useEffect(load, []);

  const handleAddRole = async () => {
    if(!name) return;
    await fetch('/api/auth/roles', { 
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ name, permissions: [] })
    });
    setName(''); load();
  };

  const togglePerm = async (role, slug) => {
    const newPerms = role.permissions.includes(slug) ? role.permissions.filter(p => p !== slug) : [...role.permissions, slug];
    await fetch('/api/auth/roles/' + (role.id || role._id), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ permissions: newPerms })
    });
    load();
  };

  return (
    <div className="bg-[#171b30] p-8 rounded-[24px] shadow-2xl border border-[#2d3748]/30">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold text-white tracking-wide">Role Management</h2>
        <div className="flex w-full sm:w-auto gap-3">
          <input placeholder="New Role Name" value={name} onChange={e=>setName(e.target.value)} className="bg-[#0b1021] text-white border border-[#2d3748] rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-auto shadow-inner" />
          <button onClick={handleAddRole} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all shadow-lg shadow-blue-500/20">Add Role</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead><tr className="text-gray-400 text-xs uppercase tracking-widest border-b border-[#2d3748]/50"><th className="pb-4 px-6 font-semibold">Role Name</th><th className="pb-4 px-6 font-semibold">Assigned Permissions</th></tr></thead>
          <tbody className="divide-y divide-[#2d3748]/30">
            {roles.map(r => (
              <tr key={r.id || r._id} className="hover:bg-[#1a2035] transition-all duration-300">
                <td className="py-6 px-6 text-white font-bold capitalize text-lg tracking-wide">{r.name}</td>
                <td className="py-6 px-6 flex flex-wrap gap-3">
                  {perms.map(p => (
                    <label key={p.slug} className={\`text-xs px-4 py-2 rounded-full cursor-pointer transition-all border shadow-sm font-semibold tracking-wide \${r.permissions.includes(p.slug) ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-300 border-blue-500/50 hover:bg-blue-600/30' : 'bg-[#0b1021] text-gray-400 border-[#2d3748] hover:border-gray-500 hover:text-gray-300'}\`}>
                      <input type="checkbox" checked={r.permissions.includes(p.slug)} onChange={()=>togglePerm(r, p.slug)} className="hidden" />
                      {p.name}
                    </label>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PermissionManagement = ({ token }) => {
  const [perms, setPerms] = useState([]);
  const [form, setForm] = useState({ name: '', slug: '' });
  const load = () => fetch('/api/auth/permissions', { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json()).then(setPerms);
  useEffect(load, []);

  const handleAdd = async () => {
    if(!form.name || !form.slug) return;
    await fetch('/api/auth/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(form) });
    setForm({ name: '', slug: '' }); load();
  };

  const handleDelete = async (id) => { await fetch('/api/auth/permissions/'+id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); load(); };

  return (
    <div className="bg-[#171b30] p-8 rounded-[24px] shadow-2xl border border-[#2d3748]/30">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold text-white tracking-wide">System Permissions</h2>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
          <input placeholder="Name (e.g. Edit Post)" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="bg-[#0b1021] text-white border border-[#2d3748] rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-blue-500 shadow-inner" />
          <input placeholder="Slug (e.g. edit_post)" value={form.slug} onChange={e=>setForm({...form, slug: e.target.value})} className="bg-[#0b1021] text-white border border-[#2d3748] rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-blue-500 shadow-inner" />
          <button onClick={handleAdd} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 whitespace-nowrap">Create</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead><tr className="text-gray-400 text-xs uppercase tracking-widest border-b border-[#2d3748]/50"><th className="pb-4 px-6 font-semibold">Name</th><th className="pb-4 px-6 font-semibold">Slug (System ID)</th><th className="pb-4 px-6 font-semibold text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-[#2d3748]/30">
            {perms.map(p => (
              <tr key={p.id || p._id} className="hover:bg-[#1a2035] transition-all duration-300">
                <td className="py-5 px-6 text-gray-200 font-medium">{p.name}</td>
                <td className="py-5 px-6 text-gray-500 font-mono text-xs">{p.slug}</td>
                <td className="py-5 px-6 text-right"><button onClick={()=>handleDelete(p.id || p._id)} className="text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-red-500/20">Revoke</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Profile = ({ user, token }) => {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const handleUpdate = async () => {
    if(!password) return;
    const res = await fetch('/api/auth/update-password', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ password }) });
    if (res.ok) { setMsg('Password updated securely.'); setPassword(''); } else setMsg('Error updating password.');
  };
  return (
    <div className="bg-[#171b30] p-8 rounded-[24px] shadow-2xl border border-[#2d3748]/30 max-w-xl mx-auto mt-10">
      <div className="flex items-center gap-6 mb-10">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-blue-500/30 border-4 border-[#0b1021]">
          {user?.email?.[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Account Profile</h2>
          <p className="text-gray-400 text-sm">Manage your personal settings</p>
        </div>
      </div>
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
          <input disabled value={user?.email} className="w-full bg-[#0b1021]/50 text-gray-500 border border-[#2d3748]/50 rounded-xl px-5 py-4 text-sm cursor-not-allowed font-medium" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 ml-1">New Password</label>
          <input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-[#0b1021] text-white border border-[#2d3748] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-5 py-4 text-sm focus:outline-none transition-all shadow-inner placeholder-gray-600" />
        </div>
        <button onClick={handleUpdate} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold tracking-wide rounded-xl px-5 py-4 shadow-lg shadow-blue-500/20 transition-all mt-4">Save Changes</button>
        {msg && <div className={\`mt-4 p-4 rounded-xl text-sm font-medium text-center border \${msg.includes('securely') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}\`}>{msg}</div>}
      </div>
    </div>
  );
};

export default function DashboardLayout() {
  const { user, token } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const hasPerm = (p) => user?.permissions?.includes(p) || user?.permissions?.includes('*');

  const NavItem = ({ to, label, active, iconPath }) => (
    <Link to={to} className={\`flex items-center px-5 py-3.5 rounded-[14px] transition-all duration-300 font-medium \${active ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' : 'text-[#8c98a4] hover:text-white hover:bg-[#1f2540]'}\`}>
      <svg className={\`w-5 h-5 mr-4 \${active ? 'text-white' : 'text-gray-500'}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath}></path></svg>
      {label}
    </Link>
  );

  return (
    <div className="flex h-screen w-full bg-[#0b1021] font-sans text-gray-100 overflow-hidden" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Sidebar - Matching 'Maxton' style */}
      <aside className="w-[280px] bg-[#121629] border-r border-[#1e2540] flex flex-col hidden lg:flex transition-all z-20">
        <div className="h-24 flex items-center gap-4 px-8 border-b border-[#1e2540]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00c6ff] to-[#0072ff] flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="text-2xl font-extrabold tracking-wide text-white">Maxton</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-8 px-5 space-y-2">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4 px-5">Main Dashboard</div>
          <NavItem to="/dashboard" label="Overview" active={location.pathname === '/dashboard'} iconPath="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          
          {(hasPerm('manage_users') || hasPerm('manage_roles')) && <div className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4 px-5 mt-8">Administration</div>}
          {hasPerm('manage_users') && <NavItem to="/dashboard/users" label="User Directory" active={location.pathname === '/dashboard/users'} iconPath="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />}
          {hasPerm('manage_roles') && <NavItem to="/dashboard/roles" label="Role Hierarchy" active={location.pathname === '/dashboard/roles'} iconPath="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />}
          {hasPerm('manage_roles') && <NavItem to="/dashboard/permissions" label="Security Tokens" active={location.pathname === '/dashboard/permissions'} iconPath="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />}
          
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4 px-5 mt-8">Personal</div>
          <NavItem to="/dashboard/profile" label="Account Settings" active={location.pathname === '/dashboard/profile'} iconPath="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </div>
        
        <div className="p-6">
          <button onClick={() => { dispatch(logout()); navigate('/'); }} className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-[14px] bg-[#1a2035] text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 font-bold shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#070b19]">
        {/* Top Header */}
        <header className="h-24 px-10 flex items-center justify-between z-10 bg-[#070b19]/80 backdrop-blur-xl border-b border-[#1e2540]">
          <div className="flex items-center gap-4">
            <div className="lg:hidden text-gray-400 cursor-pointer">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </div>
            <div className="flex items-center bg-[#121629] rounded-2xl px-5 py-3 w-64 md:w-96 border border-[#1e2540] focus-within:border-blue-500 transition-colors shadow-inner">
              <svg className="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input type="text" placeholder="Search anything..." className="bg-transparent text-sm text-gray-200 focus:outline-none w-full font-medium placeholder-gray-600" />
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#121629] border border-[#1e2540] flex items-center justify-center cursor-pointer hover:bg-[#1a2035] transition-colors relative">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#121629]"></span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 cursor-pointer pl-8 border-l border-[#1e2540]">
              <div className="hidden md:block text-right">
                <div className="text-sm font-bold text-white">{user?.email?.split('@')[0]}</div>
                <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">{user?.role || 'User'}</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 border-2 border-[#1e2540]">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 relative">
          {/* Abstract Glow in background */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="max-w-[1400px] mx-auto relative z-10">
            <Routes>
              <Route path="/" element={
                <div className="space-y-8">
                  {/* Hero Card */}
                  <div className="bg-[#171b30] p-10 rounded-[32px] shadow-2xl relative overflow-hidden border border-[#2d3748]/50">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                      <div>
                        <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6 border border-blue-500/20">Welcome Back</div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2">{user?.email?.split('@')[0]}!</h1>
                        <p className="text-gray-400 text-lg">Here's what's happening with your projects today.</p>
                      </div>
                      
                      <div className="flex gap-6 bg-[#0b1021]/50 p-6 rounded-[24px] backdrop-blur-sm border border-[#2d3748]/30">
                        <div className="px-6 border-r border-[#2d3748]/50">
                          <div className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Today's Sales</div>
                          <div className="text-3xl font-extrabold text-white">\$65.4K</div>
                        </div>
                        <div className="px-2">
                          <div className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Growth Rate</div>
                          <div className="text-3xl font-extrabold text-green-400">78.4%</div>
                        </div>
                      </div>
                    </div>
                    {/* Decorative blobs */}
                    <div className="absolute -right-20 -bottom-20 w-[400px] h-[400px] bg-gradient-to-tl from-blue-600/20 to-transparent rounded-full blur-3xl"></div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[{title: 'Active Users', val: '42.5K', change: '+12%'}, {title: 'Total Views', val: '97.4K', change: '+24%'}, {title: 'Total Clicks', val: '82.7K', change: '-5%'}, {title: 'New Signups', val: '12.4K', change: '+8%'}].map((s,i) => (
                      <div key={i} className="bg-[#171b30] p-6 rounded-[24px] border border-[#2d3748]/30 shadow-xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">{s.title}</div>
                        <div className="text-3xl font-extrabold text-white mb-2">{s.val}</div>
                        <div className={\`text-sm font-semibold \${s.change.includes('+') ? 'text-green-400' : 'text-red-400'}\`}>{s.change} <span className="text-gray-600 ml-1">from last month</span></div>
                        <div className="absolute right-0 bottom-0 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-transparent rounded-tl-full group-hover:scale-150 transition-transform duration-500"></div>
                      </div>
                    ))}
                  </div>
                </div>
              } />
              <Route path="/users" element={<UserManagement token={token} />} />
              <Route path="/roles" element={<RoleManagement token={token} />} />
              <Route path="/permissions" element={<PermissionManagement token={token} />} />
              <Route path="/profile" element={<Profile user={user} token={token} />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
`;
            await fs.writeFile(path.join(frontendDir, 'src/pages/Dashboard.jsx'), dashboardContent);

            // App.jsx
            const appJsxContent = `import React from 'react';\nimport { Routes, Route, Navigate } from 'react-router-dom';\nimport { useSelector } from 'react-redux';\nimport AuthPage from './pages/Auth';\nimport DashboardLayout from './pages/Dashboard';\nexport default function App() {\n  const { isAuthenticated } = useSelector(state => state.auth);\n  return (\n    <Routes>\n      <Route path=\"/\" element={isAuthenticated ? <Navigate to=\"/dashboard\" /> : <AuthPage />} />\n      <Route path=\"/dashboard/*\" element={isAuthenticated ? <DashboardLayout /> : <Navigate to=\"/\" />} />\n    </Routes>\n  );\n}`;
            await fs.writeFile(path.join(frontendDir, 'src/App.jsx'), appJsxContent);
        }

        
        // Tailwind Setup
        console.log(chalk.yellow('\n🎨 Configuring Tailwind CSS...'));
        try {
            execSync('npm install -D tailwindcss@^3.4 postcss autoprefixer', { stdio: 'inherit', cwd: frontendDir });
            execSync('npx tailwindcss init -p', { stdio: 'inherit', cwd: frontendDir });
        } catch(e) {}
        await fs.writeFile(path.join(frontendDir, 'src/index.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { margin: 0; padding: 0; }\n');
        await fs.writeFile(path.join(frontendDir, 'tailwind.config.js'), '/** @type {import("tailwindcss").Config} */\nexport default { content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"], theme: { extend: {} }, plugins: [] };');
        // 6. Dependencies
        const pkg = await fs.readJson(path.join(rootDir, 'package.json'));
        pkg.dependencies = { ...pkg.dependencies, 'jsonwebtoken': '^9.0.2', 'bcryptjs': '^2.4.3' };
        await fs.writeJson(path.join(rootDir, 'package.json'), pkg, { spaces: 2 });
        
        const indexPath = path.join(rootDir, 'src/index.js');
        if (await fs.pathExists(indexPath)) {
            let content = await fs.readFile(indexPath, 'utf8');
            // Add Payload Limits
            content = content.replace('app.use(express.json());', 'app.use(express.json({ limit: "50mb" }));\napp.use(express.urlencoded({ limit: "50mb", extended: true }));');
            if (!content.includes('api/auth')) {
                content = content.replace('// Routes', "// Routes\napp.use('/api/auth', require('./routes/auth.route'));");
                await fs.writeFile(indexPath, content);
            }
        }

        console.log(chalk.yellow('\n📦 Installing dependencies...'));
        execSync('npm install', { stdio: 'inherit', cwd: rootDir });

        // 7. Seeding
        console.log(chalk.yellow('🌱 Seeding roles/users/permissions...'));
        const seedScript = `\nconst connectDB = require('./src/config/database');\nconst Role = require('./src/models/role.model');\nconst User = require('./src/models/user.model');\nconst Permission = require('./src/models/permission.model');\nconst bcrypt = require('bcryptjs');\nconst seed = async () => {\n  try {\n    await connectDB();\n    \n    // 1. Create Permissions\n    const perms = [\n      { name: 'Manage Users', slug: 'manage_users' },\n      { name: 'Manage Roles', slug: 'manage_roles' },\n      { name: 'View Dashboard', slug: 'view_dashboard' }\n    ];\n    for (const p of perms) { if (!await Permission.findOne(${dbType === 'MongoDB' ? "{ slug: p.slug }" : "{ where: { slug: p.slug } }"})) await Permission.create(p); }\n\n    // 2. Create Roles\n    const roles = [\n      { name: 'superadmin', permissions: ['*'] },\n      { name: 'admin', permissions: ['manage_users', 'manage_roles', 'view_dashboard'] },\n      { name: 'user', permissions: ['view_dashboard'] }\n    ];\n    for (const r of roles) { if (!await Role.findOne(${dbType === 'MongoDB' ? "{ name: r.name }" : "{ where: { name: r.name } }"})) await Role.create(r); }\n\n    // 3. Create Superadmin User\n    const salt = await bcrypt.genSalt(10);\n    const superRole = await Role.findOne(${dbType === 'MongoDB' ? "{ name: 'superadmin' }" : "{ where: { name: 'superadmin' } }"});\n    if (!await User.findOne(${dbType === 'MongoDB' ? "{ email: 'superadmin@test.com' }" : "{ where: { email: 'superadmin@test.com' } }"})) {\n      const pass = await bcrypt.hash('superadmin', salt);\n      const userData = { email: 'superadmin@test.com', password: pass, username: 'superadmin' };\n      if ('${dbType}' === 'MongoDB') userData.role = superRole._id; else userData.RoleId = superRole.id;\n      await User.create(userData);\n    }\n    process.exit(0);\n  } catch(e) { console.error(e); process.exit(1); }\n};\nseed();`;
        const seedPath = path.join(rootDir, 'expresso-seed.js');
        await fs.writeFile(seedPath, seedScript);
        try { execSync('node expresso-seed.js', { stdio: 'inherit', cwd: rootDir }); } catch(e) {} finally { await fs.remove(seedPath); }

        console.log(chalk.cyan('\n✨ Full-Stack RBAC Management Ready! Login with superadmin@test.com / superadmin\n'));
    } catch (e) { console.error(e); }
};

const handleMakeCrud = async (name) => {
    if (!name) { console.error(chalk.red('❌ Please provide a resource name. Usage: npx expresso-cli-pro make:crud <name>')); return; }
    const rootDir = findProjectRoot(process.cwd());
    const resourceName = name.charAt(0).toUpperCase() + name.slice(1);
    const lowerName = name.toLowerCase();
    
    console.log(chalk.blue(`\n⚡ Generating Auto CRUD for ${resourceName}...`));

    let dbType = 'MongoDB';
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = require(pkgPath);
            if (pkg.dependencies && (pkg.dependencies['mysql2'] || pkg.dependencies['sqlite3'])) dbType = 'SQL';
        } catch(err) {}
    }

    await makeFile('model', name);

    let controllerContent = '';
    if (dbType === 'MongoDB') {
        controllerContent = `const Model = require('../models/${lowerName}.model');\n\nclass ${resourceName}Controller {\n    async index(req, res) {\n        try {\n            const data = await Model.find();\n            res.json(data);\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n\n    async show(req, res) {\n        try {\n            const data = await Model.findById(req.params.id);\n            if (!data) return res.status(404).json({ message: 'Not found' });\n            res.json(data);\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n\n    async store(req, res) {\n        try {\n            const data = await Model.create(req.body);\n            res.status(201).json(data);\n        } catch(err) { res.status(400).json({ error: err.message }); }\n    }\n\n    async update(req, res) {\n        try {\n            const data = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });\n            if (!data) return res.status(404).json({ message: 'Not found' });\n            res.json(data);\n        } catch(err) { res.status(400).json({ error: err.message }); }\n    }\n\n    async destroy(req, res) {\n        try {\n            const data = await Model.findByIdAndDelete(req.params.id);\n            if (!data) return res.status(404).json({ message: 'Not found' });\n            res.json({ message: 'Deleted successfully' });\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n}\n\nmodule.exports = new ${resourceName}Controller();`;
    } else {
        controllerContent = `const Model = require('../models/${lowerName}.model');\n\nclass ${resourceName}Controller {\n    async index(req, res) {\n        try {\n            const data = await Model.findAll();\n            res.json(data);\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n\n    async show(req, res) {\n        try {\n            const data = await Model.findByPk(req.params.id);\n            if (!data) return res.status(404).json({ message: 'Not found' });\n            res.json(data);\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n\n    async store(req, res) {\n        try {\n            const data = await Model.create(req.body);\n            res.status(201).json(data);\n        } catch(err) { res.status(400).json({ error: err.message }); }\n    }\n\n    async update(req, res) {\n        try {\n            const data = await Model.findByPk(req.params.id);\n            if (!data) return res.status(404).json({ message: 'Not found' });\n            await data.update(req.body);\n            res.json(data);\n        } catch(err) { res.status(400).json({ error: err.message }); }\n    }\n\n    async destroy(req, res) {\n        try {\n            const data = await Model.findByPk(req.params.id);\n            if (!data) return res.status(404).json({ message: 'Not found' });\n            await data.destroy();\n            res.json({ message: 'Deleted successfully' });\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n}\n\nmodule.exports = new ${resourceName}Controller();`;
    }

    const controllerPath = path.join(rootDir, `src/controllers/${lowerName}.controller.js`);
    await fs.ensureDir(path.dirname(controllerPath));
    await fs.writeFile(controllerPath, controllerContent);
    console.log(chalk.green(`  ✔ Created CRUD Controller: src/controllers/${lowerName}.controller.js`));

    const routeContent = `const express = require('express');\nconst router = express.Router();\nconst ctrl = require('../controllers/${lowerName}.controller');\n\nrouter.get('/', ctrl.index);\nrouter.get('/:id', ctrl.show);\nrouter.post('/', ctrl.store);\nrouter.put('/:id', ctrl.update);\nrouter.delete('/:id', ctrl.destroy);\n\nmodule.exports = router;`;
    
    const routePath = path.join(rootDir, `src/routes/${lowerName}.route.js`);
    await fs.ensureDir(path.dirname(routePath));
    await fs.writeFile(routePath, routeContent);
    console.log(chalk.green(`  ✔ Created CRUD Routes: src/routes/${lowerName}.route.js`));

    const indexPath = path.join(rootDir, 'src/index.js');
    if (await fs.pathExists(indexPath)) {
        let content = await fs.readFile(indexPath, 'utf8');
        const routeInject = `app.use('/api/${lowerName}s', require('./routes/${lowerName}.route'));`;
        if (!content.includes(routeInject)) {
            if (content.includes('// Routes')) {
                content = content.replace('// Routes', '// Routes\n' + routeInject);
            } else if (content.includes('app.listen(')) {
                content = content.replace('app.listen(', routeInject + '\n\napp.listen(');
            }
            await fs.writeFile(indexPath, content);
            console.log(chalk.green(`  ✔ Injected route /api/${lowerName}s into src/index.js`));
        }
    }

    console.log(chalk.cyan(`\n✨ Auto CRUD generated for ${resourceName}! Test it out!`));
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
        await fs.ensureDir(path.dirname(modelPath));
        await fs.writeFile(modelPath, modelContent);

        // 2. Middleware
        const middlewarePath = path.join(rootDir, 'src/middleware/telescope.middleware.js');
        const middlewareContent = `const Log = require('../models/telescope.model');\n\nmodule.exports = async (req, res, next) => {\n    if (req.originalUrl.startsWith('/telescope')) return next();\n\n    const start = Date.now();\n    const oldJson = res.json;\n    const oldSend = res.send;\n    let responseBody;\n\n    res.json = function(data) {\n        responseBody = data;\n        return oldJson.apply(res, arguments);\n    };\n    res.send = function(data) {\n        if (!responseBody) responseBody = data;\n        return oldSend.apply(res, arguments);\n    };\n\n    res.on('finish', () => {\n        const duration = Date.now() - start;\n        Log.create({\n            method: req.method,\n            url: req.originalUrl,\n            status: res.statusCode,\n            duration,\n            ip: req.ip,\n            payload: req.body,\n            headers: req.headers,\n            response: responseBody\n        }).catch(err => console.error('Telescope Log Error:', err));\n    });\n\n    next();\n};`;
        await fs.ensureDir(path.dirname(middlewarePath));
        await fs.writeFile(middlewarePath, middlewareContent);

        // 3. Controller
        const controllerPath = path.join(rootDir, 'src/controllers/telescope.controller.js');
        const controllerContent = `const Log = require('../models/telescope.model');\nconst path = require('path');\n\nclass TelescopeController {\n    async index(req, res) {\n        res.sendFile(path.join(__dirname, '../views/telescope.html'));\n    }\n\n    async getLogs(req, res) {\n        try {\n            const logs = await Log.${dbType === 'MongoDB' ? 'find().sort({ createdAt: -1 }).limit(50)' : 'findAll({ order: [["createdAt", "DESC"]], limit: 50 })'};\n            res.json(logs);\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n\n    async clear(req, res) {\n        try {\n            await Log.${dbType === 'MongoDB' ? 'deleteMany({})' : 'destroy({ where: {}, truncate: true })'};\n            res.json({ message: 'Logs cleared' });\n        } catch(err) { res.status(500).json({ error: err.message }); }\n    }\n}\nmodule.exports = new TelescopeController();`;
        await fs.ensureDir(path.dirname(controllerPath));
        await fs.writeFile(controllerPath, controllerContent);

        // 5. Routes
        const routePath = path.join(rootDir, 'src/routes/telescope.route.js');
        const routeContent = `const express = require('express');\nconst router = express.Router();\nconst ctrl = require('../controllers/telescope.controller');\nrouter.get('/', ctrl.index);\nrouter.get('/api/logs', ctrl.getLogs);\nrouter.delete('/api/clear', ctrl.clear);\nmodule.exports = router;`;
        await fs.ensureDir(path.dirname(routePath));
        await fs.writeFile(routePath, routeContent);

        // 6. Injection
        const indexPath = path.join(rootDir, 'src/index.js');
        if (await fs.pathExists(indexPath)) {
            let content = await fs.readFile(indexPath, 'utf8');
            if (!content.includes('telescope.middleware')) {
                content = content.replace("app.use(express.json());", "app.use(express.json());\napp.use(require('./middleware/telescope.middleware'));");
                content = content.replace("// Routes", "// Routes\napp.use('/telescope', require('./routes/telescope.route'));");
                await fs.writeFile(indexPath, content);
            }
        }

        console.log(chalk.cyan('\n✨ Telescope is watching! Visit /telescope to see logs.'));
    } catch (e) { console.error(e); }
};

// --- COMMANDS ---
program
  .command('init')
  .description('Initialize a new Expresso project')
  .action(handleInit);

program
  .command('generate')
  .alias('g')
  .description('Generate components (Controller, Model, etc.)')
  .action(handleGenerate);

program
  .command('build:stack')
  .description('Build and bundle the full stack')
  .action(handleBuildStack);

program
  .command('make:auth')
  .description('Generate Enterprise RBAC Auth Scaffold')
  .action(handleAddAuth);

program
  .command('make:crud <name>')
  .description('Generate Auto CRUD for a resource')
  .action(handleMakeCrud);

program
  .command('make:docs')
  .description('Generate Swagger Documentation')
  .action(handleAddDocs);

program
  .command('make:telescope')
  .description('Add Telescope Debugging Dashboard')
  .action(handleAddTelescope);

program.parse(process.argv);
