# QlooPhone Monitor

Real-time debugging dashboard for monitoring QlooPhone calls, API interactions, and system performance.

## Overview

The monitor provides a live view of:
- Speech-to-text transcriptions
- OpenAI function calls and responses
- Qloo API requests and results
- Audio streaming events
- Session configuration

## Features

### Real-Time Monitoring
- Live WebSocket connection to backend
- Automatic reconnection on disconnect
- Event filtering and search
- JSON formatting for API responses

### Session Configuration Panel
- Modify OpenAI session parameters
- Test different voices and models
- Adjust temperature and response tokens
- Save configurations for reuse

### Transcript View
- Color-coded speaker identification
- Timestamp for each interaction
- Function call visualization
- Expandable JSON responses

### Function Calls Panel
- Detailed API request/response pairs
- Execution timing metrics
- Error highlighting
- Copy-to-clipboard functionality

## Installation

```bash
cd qloophone-monitor
npm install
```

## Configuration

The monitor automatically detects the backend URL:
- Local: `http://localhost:8081`
- Production: `https://qloophone-backend.onrender.com`

No additional configuration required.

## Running

### Development
```bash
npm run dev
# Opens at http://localhost:3001
```

### Production Build
```bash
npm run build
npm start
```

## Architecture

### Component Structure

```
app/
├── page.tsx              # Main dashboard page
├── layout.tsx            # Root layout with providers
└── globals.css          # Global styles

components/
├── top-bar.tsx          # Header with connection status
├── transcript.tsx       # Conversation transcript view
├── function-calls-panel.tsx    # API call details
├── session-configuration-panel.tsx  # OpenAI config
├── json-formatter.tsx   # JSON syntax highlighting
└── ui/                  # Reusable UI components

lib/
├── handle-realtime-event.ts  # Event processing logic
└── utils.ts            # Utility functions
```

### State Management

The monitor uses React hooks for state:
- `items`: Array of transcript items
- `callStatus`: WebSocket connection status
- `wsRef`: WebSocket reference for sending updates

### WebSocket Events

Incoming events are processed by `handleRealtimeEvent`:
- `session.created/updated`: Session configuration
- `conversation.item.created`: New transcript items
- `response.function_call_arguments.done`: Function completions
- `error`: Error notifications

## UI Components

### Top Bar
Displays:
- Application title and logo
- Connection status indicator
- Backend URL

### Session Configuration
Controls for:
- Voice selection (Ash, Ballad, Coral, Sage, Verse)
- Temperature (0.6 - 1.0)
- Max response tokens
- Instructions editing

### Transcript Panel
Shows:
- User speech (blue background)
- Assistant responses (gray background)
- Function calls (green indicators)
- Timestamps for each event

### Function Calls Panel
Displays:
- Function name and parameters
- API response data
- Execution time
- Error messages if any

## Styling

The monitor uses:
- Tailwind CSS for utility-first styling
- Custom color scheme matching QlooPhone branding
- Responsive grid layout
- Dark theme optimized for monitoring

## WebSocket Protocol

### Connection
```javascript
ws://localhost:8081/logs        // Development
wss://qloophone-backend.onrender.com/logs  // Production
```

### Message Format
```typescript
interface RealtimeEvent {
  type: string;
  event_id?: string;
  item?: ConversationItem;
  delta?: AudioDelta;
  error?: ErrorDetails;
}
```

## Debugging Tips

### Monitoring Active Calls

1. Open monitor before making call
2. Watch for "session.created" event
3. Verify function tools are loaded
4. Monitor transcript generation
5. Check function call execution

### Common Patterns

**Successful Call Flow:**
1. Session created
2. Session updated (tools loaded)
3. Greeting triggered
4. User speech detected
5. Function calls executed
6. Response generated

**Error Indicators:**
- Red badges for errors
- Missing transcriptions
- Stuck "in_progress" functions
- WebSocket disconnections

## Performance Considerations

- Limits stored items to prevent memory leaks
- Throttles UI updates for smooth rendering
- Lazy loads JSON formatting
- Efficient WebSocket message handling

## Development

### Adding New Features

1. Extend event handling in `handle-realtime-event.ts`
2. Add UI components in `components/`
3. Update types in `types.ts`
4. Style with Tailwind classes

### Testing

Currently manual testing via:
```bash
# Start backend
cd ../qloophone-backend && npm run dev

# Start monitor
cd ../qloophone-monitor && npm run dev

# Make test call to trigger events
```

## Deployment

Deployed automatically via Docker on Render:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Security

- Read-only monitoring (no call initiation)
- No sensitive data storage
- Automatic session cleanup
- Origin verification in production

## Troubleshooting

### No Events Showing

1. Verify backend is running
2. Check WebSocket connection in browser console
3. Ensure `/logs` endpoint is accessible
4. Look for CORS errors

### Missing Function Calls

1. Confirm OpenAI tools are loaded
2. Check for function handler errors
3. Verify API keys are set
4. Review backend logs

### Performance Issues

1. Clear browser cache
2. Limit concurrent monitors
3. Check for memory leaks
4. Reduce update frequency