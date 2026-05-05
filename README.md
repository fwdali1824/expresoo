# Expresso CLI Pro 🚀☕

Expresso CLI Pro is a premium, smart full-stack framework for scaffolding professional Node.js projects with a clean MVC architecture and integrated React (Vite) frontend.

## 🌟 Key Features
- **Smart Routing**: Automatically switches between React Frontend and JSON API.
- **Full-Stack Orchestrator**: Run both Backend and Frontend with a single command.
- **Dynamic Config**: Auto-generates `.env` and DB connections (MongoDB, MySQL, etc.).
- **Interactive Master Menu**: No commands to remember, just run and select.

---

## 🚀 Quick Start (Backend Only)

1. **Initialize Project:**
   ```bash
   npx expresso-cli-pro init
   ```
2. **Start Server:**
   ```bash
   cd your-app-name
   npm start
   ```

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
- Configures the server to serve it from `http://localhost:3000/`.

---

## 📂 Master Menu
If you don't want to type commands, just run:
```bash
npx expresso-cli-pro
```
And select your action from the menu! 🛠📦🚀