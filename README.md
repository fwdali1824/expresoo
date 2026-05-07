# Expresso CLI Pro 🚀☕

Expresso CLI Pro is a premium, smart full-stack framework for scaffolding professional Node.js projects with a clean MVC architecture, integrated React (Vite) frontend, auto-generated documentation, and Laravel-style API monitoring.

## 🌟 Key Features
- **Smart Routing**: Automatically switches between React Frontend and JSON API.
- **Expresso Telescope 🔭**: A beautiful, built-in Laravel Telescope clone to monitor API requests, payloads, headers, and performance in real-time.
- **Auto-Generated Swagger Docs**: Generates complete API documentation (Swagger UI) automatically—no manual JSDoc required!
- **Database Auto-Creation**: Instantly connects and auto-creates your MySQL/MongoDB databases and tables on first run.
- **Full-Stack Orchestrator**: Run both Backend and Frontend with a single command.
- **Interactive Master Menu**: No commands to remember, just run and select.

---

## 🚀 Quick Start (Backend Only)

1. **Initialize Project:**
   ```bash
   npx expresso-cli-pro init
   ```
   *(Select your DB. If using MySQL, the database and tables are created automatically!)*

2. **Start Server:**
   ```bash
   cd your-app-name
   npm run dev
   ```

---

## 🔭 Expresso Telescope (API Monitoring)

Get a stunning, real-time dashboard to monitor all incoming API traffic, exactly like Laravel Telescope.

1. Run the generator in your project:
   ```bash
   npx expresso-cli-pro generate:telescope
   ```
2. Visit **`http://localhost:3000/telescope`**
3. Features include: Dark/Light Mode toggle, Live Polling pause/play, Request Filtering, and full Request/Response/Headers payload viewing.

---

## 📚 Auto-Generated API Docs

Tired of writing JSDoc comments? Expresso handles it automatically.

1. Generate documentation boilerplate:
   ```bash
   npx expresso-cli-pro generate:docs
   ```
2. Simply run your server using `npm run dev`. Your `swagger_output.json` will auto-generate based on your actual routes!
3. Visit **`http://localhost:3000/api-docs`** to test your APIs.

---

## 💻 Full-Stack Setup (Add React)

1. **Add Frontend:**
   Inside your project root, run:
   ```bash
   npx expresso-cli-pro g
   ```
   *(Select "Frontend (React Integration)")*

2. **Run Both (Dev Mode):**
   This starts Node.js and React (Vite) simultaneously:
   ```bash
   npm run dev
   ```

---

## 🛠 Production Build & Deploy

When you are ready to go live, use the Smart Build command:
```bash
npx expresso-cli-pro build:stack
```
**What this does:**
- Builds the React production bundle.
- Syncs it to `src/public`.
- Configures the server to serve it dynamically.

---

## 📂 Master Menu
If you don't want to type commands, just run:
```bash
npx expresso-cli-pro
```
And select your action from the menu! 🛠📦🚀