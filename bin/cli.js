#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

const { execSync } = require('child_process');

const program = new Command();

program
  .name('expresso')
  .description('CLI to generate structure for Model, Controller, Routes, etc.')
  .version('1.0.0');

// --- INIT COMMAND ---
program
  .command('init')
  .description('Initialize the project structure and install dependencies')
  .option('--auth', 'Include authentication boilerplate (Login/Register)')
  .action(async (options) => {
    const targetDir = process.cwd();
    const templateDir = path.join(__dirname, '../templates');

    console.log(chalk.magenta(`
    ☕ Expresso CLI v1.0.0
    --------------------------
    Fast MVC backend generator
    --------------------------
    `));
    console.log(chalk.blue('🚀 Initializing Expresso project...'));

    try {
      await fs.copy(templateDir, targetDir);
      
      if (options.auth) {
        console.log(chalk.yellow('🔒 Adding Authentication boilerplate...'));
        // Update index.js to include auth routes
        const indexPath = path.join(targetDir, 'src', 'index.js');
        let indexContent = await fs.readFile(indexPath, 'utf8');
        
        indexContent = indexContent.replace(
            "// app.use('/api/users', require('./routes/user.route'));",
            "app.use('/api/auth', require('./routes/auth.route'));"
        );
        
        await fs.writeFile(indexPath, indexContent);
      } else {
        // If no auth, we can remove the auth files from target
        await fs.remove(path.join(targetDir, 'src', 'routes', 'auth.route.js'));
        await fs.remove(path.join(targetDir, 'src', 'controllers', 'auth.controller.js'));
        await fs.remove(path.join(targetDir, 'src', 'middleware', 'auth.middleware.js'));
      }

      console.log(chalk.green('✔ Files copied successfully.'));

      console.log(chalk.blue('📦 Installing dependencies (Express, Axios, Auth, etc.)...'));
      execSync('npm install', { stdio: 'inherit', cwd: targetDir });
      
      console.log(chalk.green('\n✨ Your Expresoo app is ready! ✨'));
      console.log(chalk.cyan('Run "npm start" to begin.'));
    } catch (err) {
      console.error(chalk.red('Error:'), err.message);
    }
  });

// --- GENERATE COMMANDS ---

// Helper to create files from templates
const generateFile = async (type, name) => {
    const dir = path.join(process.cwd(), 'src', `${type}s`);
    const fileName = `${name.toLowerCase()}.${type}.js`;
    const filePath = path.join(dir, fileName);

    if (!fs.existsSync(dir)) {
        await fs.ensureDir(dir);
    }

    if (fs.existsSync(filePath)) {
        console.log(chalk.yellow(`⚠ ${type} ${name} already exists.`));
        return;
    }

    let content = '';
    const className = name.charAt(0).toUpperCase() + name.slice(1);

    switch(type) {
        case 'model':
            content = `class ${className} {\n    constructor() {\n        // Model logic\n    }\n}\n\nmodule.exports = ${className};`;
            break;
        case 'controller':
            content = `const ${className}Service = require('../services/${name.toLowerCase()}.service');\n\nclass ${className}Controller {\n    async getAll(req, res) {\n        // Controller logic\n    }\n}\n\nmodule.exports = new ${className}Controller();`;
            break;
        case 'service':
            content = `const ${className}Repository = require('../repositories/${name.toLowerCase()}.repository');\n\nclass ${className}Service {\n    async findAll() {\n        // Service logic\n    }\n}\n\nmodule.exports = new ${className}Service();`;
            break;
        case 'repository':
            content = `class ${className}Repository {\n    async find() {\n        // Repository logic\n    }\n}\n\nmodule.exports = new ${className}Repository();`;
            break;
        case 'route':
            content = `const express = require('express');\nconst router = express.Router();\nconst ${className}Controller = require('../controllers/${name.toLowerCase()}.controller');\n\nrouter.get('/', ${className}Controller.getAll);\n\nmodule.exports = router;`;
            break;
    }

    await fs.writeFile(filePath, content);
    console.log(chalk.green(`✔ Created ${type}: ${fileName}`));
};

program
  .command('make:model <name>')
  .description('Create a new model')
  .action((name) => generateFile('model', name));

program
  .command('make:controller <name>')
  .description('Create a new controller')
  .action((name) => generateFile('controller', name));

program
  .command('make:service <name>')
  .description('Create a new service')
  .action((name) => generateFile('service', name));

program
  .command('make:repository <name>')
  .description('Create a new repository')
  .action((name) => generateFile('repository', name));

program
  .command('make:route <name>')
  .description('Create a new route')
  .action((name) => generateFile('route', name));

program
  .command('make:all <name>')
  .description('Create model, controller, route, service, and repository')
  .action(async (name) => {
    await generateFile('model', name);
    await generateFile('controller', name);
    await generateFile('service', name);
    await generateFile('repository', name);
    await generateFile('route', name);
    console.log(chalk.magenta(`\n🚀 Full stack for ${name} is ready!`));
  });

program.parse(process.argv);
