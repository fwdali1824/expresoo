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
  .version('1.4.8');

const showBanner = () => {
    console.log(chalk.magenta(`
    ☕ Expresso CLI Pro v1.4.8
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
const makeFile = async (type, name) => {
    const rootDir = findProjectRoot(process.cwd());
    const resourceName = name.charAt(0).toUpperCase() + name.slice(1);
    const lowerName = name.toLowerCase();
    const templates = {
        controller: { path: `src/controllers/${lowerName}.controller.js`, content: `class ${resourceName}Controller {\n    async index(req, res) { res.json({ msg: '${resourceName} Controller' }); }\n}\nmodule.exports = new ${resourceName}Controller();` },
        model: { path: `src/models/${lowerName}.model.js`, content: `const mongoose = require('mongoose');\nconst schema = new mongoose.Schema({ name: String });\nmodule.exports = mongoose.model('${resourceName}', schema);` },
        route: { path: `src/routes/${lowerName}.route.js`, content: `const express = require('express');\nconst router = express.Router();\nconst ctrl = require('../controllers/${lowerName}.controller');\nrouter.get('/', ctrl.index);\nmodule.exports = router;` },
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
        if (answers.dbType === 'MySQL') pkg.dependencies['mysql2'] = '^3.6.0';
        else if (answers.dbType === 'SQLite') pkg.dependencies['sqlite3'] = '^5.1.0';
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
        if (type === 'All (CRUD Stack)') {
            for (const t of ['model', 'repository', 'service', 'controller', 'route']) await makeFile(t, name);
        } else await makeFile(type.toLowerCase(), name);
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

const mainHandler = async () => {
    showBanner();
    const { action } = await inquirer.prompt([{ type: 'list', name: 'action', message: 'Action:', choices: ['init', 'generate', 'build:stack'] }]);
    if (action === 'init') await handleInit();
    else if (action === 'generate') await handleGenerate();
    else await handleBuildStack();
};

program.command('init').action(handleInit);
program.command('generate').alias('g').action(handleGenerate);
program.command('build:stack').action(handleBuildStack);

if (process.argv.length > 2) program.parse(process.argv);
else mainHandler();
