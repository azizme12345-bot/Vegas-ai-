# Vegas AI

Vegas AI is a modern, fast, and feature-rich AI web application powered by Google Gemini models.

## Environment Variables Setup

The Gemini API key must stay strictly on the server side and should never be exposed in client code.

To configure the API key:
1. Create a `.env` or `.env.local` file in the root directory (or configure Environment Variables in your hosting provider, e.g., Vercel / Netlify).
2. Set the `GEMINI_API_KEY` variable:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Fallback environment variable names supported on the backend server:
- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `GEMINI_KEY`

## Features & Endpoints

- **Chat API**: `/api/chat` - Multi-turn conversational streaming with Google Gemini.
- **Transcribe API**: `/api/transcribe` - Server-side voice-to-text audio transcription using Gemini audio processing.
- **Image Generation & Photo Editor**: `/api/image` - AI image creation and local photo editing with face protection.
- **UI Design Studio**: `/api/ui-studio` - Multi-stage UI concept generation and HTML conversion.
- **Site & Code Analyzer**: `/api/analyze-url` and `/api/analyze-code` - Website structure and repository analysis.

## Development & Production Run

```bash
# Install dependencies
npm install

# Start local development server (Port 3000)
npm run dev

# Build for production
npm run build
```
