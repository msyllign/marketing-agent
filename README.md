# Marketing Agent

Generate and refine personalised Viber/SMS campaign messages using Claude AI.

## Quick start (local)

**Requirements:** Node.js 18+, an [Anthropic API key](https://console.anthropic.com/settings/keys)

```bash
# 1. Clone
git clone https://github.com/msyllign/marketing-agent.git
cd marketing-agent

# 2. Start (builds frontend on first run, ~30 s)
./start.sh --api-key sk-ant-YOUR_KEY_HERE

# 3. Open  http://localhost:5000
```

Everything — the React UI and the Express API — is served from a **single port (5000)**.  
No separate frontend dev server needed.

---

## Manual setup

```bash
# Install & build
cd backend
npm install
npm run build:full        # builds React → backend/public

# Configure
echo 'PORT=5000'                           >  .env
echo 'ANTHROPIC_API_KEY=sk-ant-...'        >> .env
echo 'UPLOAD_DIR=./uploads'                >> .env

# Run
npm start
# → http://localhost:5000
```

---

## How it works

| Step | What happens |
|------|-------------|
| **Upload** | Upload an SMS template (`.txt`) and a personas file (`.csv` / `.xlsx`) |
| **Generate** | Claude reads each persona and personalises the template into a message |
| **Refine** | Chat with Claude to tweak individual messages |
| **Approve** | Mark messages as approved |
| **Export** | Download approved messages as CSV |

---

## Project structure

```
marketing-agent/
├── backend/               Express API (port 5000, also serves built UI)
│   ├── src/
│   │   ├── index.ts       Entry point
│   │   ├── routes/        upload · generate · chat · approval
│   │   └── services/      claude.ts · fileParser.ts
│   └── .env               API key (gitignored — never committed)
├── frontend/              React + TypeScript + Tailwind source
└── start.sh               One-command launcher
```

---

## Sample files

**sms_template.txt**
```
Hey {name}! Our summer sale is on — up to 50% off. Shop at example.com/sale. Ends Sunday!
```

**personas.csv**
```csv
name,age,profession,interests
Alice,32,Graphic Designer,art travel photography
Bob,45,Software Engineer,gadgets gaming coffee
```
