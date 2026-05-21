# Marketing Agent - Rich Viber Campaign Generator

An intelligent web application that generates personalized Rich Viber messages for marketing campaigns using Anthropic's Claude API.

## Features

- 📤 Upload SMS template and personas CSV/Excel files
- 🤖 AI-powered personalization using Claude 3.5 Sonnet
- 💬 Chat interface for message refinements
- ✅ Approval workflow for campaign messages
- 💾 Export approved messages for campaign usage

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **AI:** Anthropic Claude 3.5 Sonnet API
- **File Processing:** Multer for file uploads
- **Database:** Local JSON storage

## Prerequisites

- Node.js 18+
- npm or yarn
- Anthropic API key

## Installation

### Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
ANTHROPIC_API_KEY=your_api_key_here
PORT=5000
NODE_ENV=development
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
REACT_APP_API_URL=http://localhost:5000
```

## Running the Application

### Start Backend

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:5000`

### Start Frontend

```bash
cd frontend
npm start
```

Frontend runs on `http://localhost:3000`

## Project Structure

```
marketing-agent/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── upload.ts
│   │   │   ├── generate.ts
│   │   │   ├── chat.ts
│   │   │   └── approval.ts
│   │   ├── services/
│   │   │   ├── claudeService.ts
│   │   │   ├── fileService.ts
│   │   │   └── messageService.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── middleware/
│   │   │   └── errorHandler.ts
│   │   └── index.ts
│   ├── uploads/
│   ├── approved_messages/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.tsx
│   │   │   ├── MessagePreview.tsx
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageCard.tsx
│   │   │   └── ApprovalModal.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   └── Campaign.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── index.css
│   ├── public/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
└── .gitignore
```

## Usage

1. **Upload Files:** Upload your SMS template and personas CSV/Excel file
2. **Generate Messages:** The system generates personalized Rich Viber messages for each persona
3. **Refine:** Use the chat interface to request modifications to any message
4. **Approve:** Mark messages as approved when satisfied
5. **Export:** Download approved messages for your campaign

## API Endpoints

### Upload Files
- `POST /api/upload` - Upload SMS template and personas file

### Generate Messages
- `POST /api/generate` - Generate personalized messages

### Chat/Refinement
- `POST /api/chat/refine` - Request message modifications

### Approval
- `POST /api/approval/approve` - Mark message as approved
- `GET /api/approval/export` - Export approved messages

## License

MIT
