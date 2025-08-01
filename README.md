# QlooPhone - Privacy-First Cultural Recommendations via Voice

> **Dial 1-877-361-7566** and discover perfect recommendations that bridge your tastes - no app, no account, no tracking.

[![Deployed on Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7?style=flat-square)](https://render.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-70%25-green?style=flat-square)](./qloophone-backend/jest.config.js)

## Overview

QlooPhone transforms any phone into a cultural recommendation engine. Simply call, mention two things you enjoy, and receive instant recommendations that bridge your tastes - all without downloading an app or sharing personal information.

### Key Features
- **Zero PII Required**: No names, emails, or personal data
- **Universal Access**: Works on any phone from rotary to smartphone
- **Cross-Domain Intelligence**: Connects movies to restaurants, music to travel
- **Sub-2 Second Response**: Natural conversation flow
- **Privacy by Design**: Stateless sessions, no data retention

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Twilio account (for local development)
- OpenAI API key
- Qloo API key ([Get one here](https://forms.gle/K1LVBUWReabqA3wQ8))

### Installation

```bash
# Clone the repository
git clone https://github.com/streetmeat/qloofone.git
cd qloo

# Install all dependencies
npm run install:all

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Running Locally

```bash
# Start all services (recommended)
npm run dev

# Or start services individually:
npm run dev:backend  # Backend on :8081
npm run dev:monitor  # Monitor on :3001
npm run dev:frontend # Frontend on :3000
```

## Project Structure

```
qloo/
├── qloophone-backend/    # Core WebSocket server & API integrations
├── qloophone-monitor/    # Real-time debugging dashboard
├── qloophone-frontend/   # Marketing landing page
├── docs/                 # API documentation & guides
├── .env.example          # Environment variable template
└── render.yaml          # Render.com deployment config
```

## Architecture

```
Phone Call → Twilio → Backend Server → OpenAI Realtime
                           ↓
                      Qloo API
                           ↓
                   Recommendation → Phone
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test searchEntity

# Watch mode for development
npm test -- --watch
```

The test suite includes:
- **Unit tests**: Core functions with mocked APIs
- **Integration tests**: WebSocket and server endpoints
- **E2E tests**: Complete conversation flows
- **70% coverage threshold** enforced
- Clean, focused test organization

## Deployment

The application auto-deploys to Render.com on push to main branch.

### Manual Deployment

```bash
# Deploy to Render
git push origin main

# Monitor deployment
# https://dashboard.render.com
```

### Environment Variables

Required for all environments:
- `OPENAI_API_KEY` - OpenAI API key
- `QLOO_API_KEY` - Qloo Hackathon API key
- `PUBLIC_URL` - Backend public URL (auto-set on Render)

## API Endpoints

### Backend Endpoints
- `GET /health` - Health check
- `GET /cache-stats` - Entity cache statistics
- `ALL /twiml` - Twilio webhook endpoint
- `WS /call` - Phone call WebSocket
- `WS /logs` - Monitor connection

### Qloo Functions
- `search_entity` - Find any cultural item
- `search_locality` - Find cities/neighborhoods
- `get_recommendation` - Get bridging recommendations
- `get_fan_venues` - Find where fans hang out

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project was created for the Qloo LLM Hackathon.

## Acknowledgments

- Built on the [OpenAI Realtime Twilio Demo](https://github.com/openai/openai-realtime-twilio-demo)
- Powered by [Qloo's Taste AI](https://qloo.com)
- Voice infrastructure by [Twilio](https://twilio.com)

---

**Try it now**: Call **1-877-361-7566** and say two things you love!