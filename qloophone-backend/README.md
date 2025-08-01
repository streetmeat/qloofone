# QlooPhone Backend

Core WebSocket server that orchestrates real-time communication between Twilio phone calls, OpenAI's Realtime API, and Qloo's recommendation engine.

## Overview

The backend serves as the central hub for:
- Managing concurrent phone call sessions
- Streaming audio between Twilio and OpenAI
- Executing Qloo API calls for recommendations
- Broadcasting events to the monitoring dashboard

## Architecture

### Core Components

1. **Server (`server.ts`)**
   - Express HTTP server with WebSocket upgrade
   - Health check and monitoring endpoints
   - TwiML response generation for Twilio

2. **Session Manager (`sessionManager.ts`)**
   - Isolated session handling per phone call
   - WebSocket connection orchestration
   - Real-time event broadcasting

3. **Function Handlers (`functionHandlers.ts`)**
   - Qloo API integration functions
   - Entity caching and sequel detection
   - Location-based recommendation logic

## Installation

```bash
cd qloophone-backend
npm install
```

## Configuration

Create a `.env` file:

```env
# Required
OPENAI_API_KEY=your-openai-api-key
QLOO_API_KEY=your-qloo-api-key
QLOO_API_URL=https://hackathon.api.qloo.com

# Optional (defaults shown)
PORT=8081
PUBLIC_URL=http://localhost:8081
```

## Running

### Development
```bash
npm run dev        # With hot-reload
npm run dev:logs   # With detailed logging
```

### Production
```bash
npm run build
npm start
```

### Testing
```bash
npm test                    # Run all tests
npm test:watch             # Watch mode
npm test:coverage          # Generate coverage report
npm test functionHandlers  # Test specific file
```

#### Test Structure
```
__tests__/
├── unit/                  # Isolated function tests
├── integration/           # Component interaction tests
├── e2e/                   # End-to-end conversation flows
├── fixtures/              # Test data and scenarios
└── mocks/                 # API mocks
```

Tests cover:
- All Qloo API functions with mocked responses
- Session management and concurrent calls
- Error handling and edge cases
- Complete conversation flows
- 70%+ code coverage enforced

## API Endpoints

### HTTP Endpoints

#### `GET /health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-30T10:00:00.000Z",
  "version": "1.0.0"
}
```

#### `GET /cache-stats`
Entity cache statistics.

**Response:**
```json
{
  "size": 42,
  "hits": 150,
  "misses": 30,
  "hitRate": 0.833
}
```

#### `ALL /twiml`
Twilio webhook endpoint that returns TwiML for WebSocket streaming.

### WebSocket Endpoints

#### `/call`
Phone call audio streaming endpoint. Handles:
- Twilio media stream events
- OpenAI Realtime API connection
- Function call execution

#### `/logs`
Monitor dashboard connection for real-time event streaming.

## Function Definitions

### `search_entity`
Search for any cultural item (movie, artist, book, etc.).

**Parameters:**
- `query` (string): Search term

**Returns:**
```json
{
  "entity_id": "urn:entity:movie:12345",
  "name": "The Matrix",
  "type": "urn:entity:movie"
}
```

### `get_recommendation`
Get recommendations that bridge cultural preferences.

**Parameters:**
- `entity_ids` (string): Comma-separated entity IDs
- `output_type` (string, optional): Desired recommendation type
- `location` (string, optional): Location for place recommendations
- `take` (number, optional): Number of results (default: 3)

**Returns:**
```json
{
  "recommendations": [
    {
      "entity_id": "urn:entity:movie:67890",
      "name": "Inception",
      "score": 0.95
    }
  ]
}
```

### `search_locality`
Search for cities or neighborhoods.

**Parameters:**
- `location` (string): City or neighborhood name

### `get_fan_venues`
Find venues where fans of specific entities hang out.

**Parameters:**
- `entity_ids` (string): Comma-separated entity IDs
- `location` (string): Location to search

## Session Management

Each phone call creates an isolated session containing:
- Twilio WebSocket connection
- OpenAI WebSocket connection
- Recent entity searches for context
- Audio timing information

Sessions are automatically cleaned up after disconnection.

## Caching Strategy

The backend implements a two-tier caching system:
1. **Entity Cache**: 7-day TTL for entity search results
2. **Memory Cache**: In-session entity tracking for sequel detection

Cache hit rates typically exceed 60% in production.

## Error Handling

- All external API calls have 3-second timeouts
- Graceful WebSocket disconnection handling
- Comprehensive error logging with context
- Fallback responses for failed API calls

## Performance Optimization

1. **Concurrent Processing**: Supports 10+ simultaneous calls
2. **Audio Streaming**: Direct μ-law passthrough (no transcoding)
3. **Smart Caching**: Reduces Qloo API calls by 60%+
4. **Connection Pooling**: Reuses HTTPS agents

## Logging

Logs are written to:
- Console output (with timestamps)
- `api_calls.log` for Qloo API tracking
- Structured JSON for production monitoring

## Development Guidelines

### Adding New Functions

1. Define the function schema in `functionHandlers.ts`
2. Implement the handler with proper error handling
3. Add corresponding tests in `__tests__/`
4. Update the OpenAI instructions in `sessionManager.ts`

### Testing Best Practices

- Mock all external API calls
- Test both success and error paths
- Verify caching behavior
- Check concurrent session handling

## Deployment

The backend is containerized and deploys automatically via Render.com:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## Monitoring

Production monitoring available at:
- Health: https://qloophone-backend.onrender.com/health
- Cache Stats: https://qloophone-backend.onrender.com/cache-stats

## Troubleshooting

### Common Issues

1. **"No session found for streamSid"**
   - Ensure Twilio webhook URL is correct
   - Check PUBLIC_URL environment variable

2. **OpenAI connection failures**
   - Verify API key is valid
   - Check for rate limiting

3. **Slow responses**
   - Monitor cache hit rates
   - Check Qloo API latency
   - Review concurrent session count

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* npm run dev
```

## Security Considerations

- API keys stored as environment variables
- No PII logging or storage
- Input validation on all functions
- WebSocket origin verification in production