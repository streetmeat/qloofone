import { RawData, WebSocket } from "ws";
import functions from "./functionHandlers";

// Safe console.log wrapper to handle EPIPE errors during tests
const safeLog = (...args: any[]) => {
  try {
    console.log(...args);
  } catch (error: any) {
    // Silently ignore EPIPE errors during rapid test runs
    if (error.code !== 'EPIPE' && error.syscall !== 'write') {
      // Re-throw non-EPIPE/write errors
      throw error;
    }
  }
};

interface Session {
  twilioConn?: WebSocket;
  frontendConn?: WebSocket;
  modelConn?: WebSocket;
  streamSid?: string;
  lastAssistantItem?: string;
  responseStartTimestamp?: number;
  latestMediaTimestamp?: number;
  openAIApiKey?: string;
  greetingSent?: boolean;
  recentEntitySearches?: Map<string, {name: string, entity_id: string, type?: string}>;
}

// Map to store sessions by streamSid for concurrent call support
const sessions = new Map<string, Session>();

// Helper to get or create session
function getSession(streamSid: string): Session {
  if (!sessions.has(streamSid)) {
    sessions.set(streamSid, {});
  }
  return sessions.get(streamSid)!;
}

// Log active session count for monitoring
function logSessionCount() {
  safeLog(`[SessionManager] Active sessions: ${sessions.size}`);
}

// Export function to get active session count
export function getActiveSessionCount(): number {
  return sessions.size;
}

// Clean up orphaned sessions periodically
const cleanupInterval = setInterval(() => {
  let cleaned = 0;
  
  sessions.forEach((session, streamSid) => {
    // If session has no active connections, clean it up
    if (!isOpen(session.twilioConn) && !isOpen(session.modelConn)) {
      sessions.delete(streamSid);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    safeLog(`[SessionManager] Cleaned up ${cleaned} orphaned sessions`);
    logSessionCount();
  }
}, 60000); // Check every minute

// Allow process to exit even if this timer is active
cleanupInterval.unref();

export function handleCallConnection(ws: WebSocket, openAIApiKey: string) {
  // Wait for streamSid from Twilio before setting up session
  let streamSid: string | undefined;
  const queuedMessages: RawData[] = []; // Queue for messages that arrive early
  
  ws.on("message", (data: RawData) => {
    const msg = parseMessage(data);
    if (!msg) return;
    
    // Get streamSid from start event FIRST
    if (msg.event === "start" && msg.start?.streamSid) {
      streamSid = msg.start.streamSid;
      safeLog(`[SessionManager] New call connected: ${streamSid}`);
      
      // Create session for this call
      const session = getSession(streamSid!); // We know streamSid is defined here
      session.twilioConn = ws;
      session.openAIApiKey = openAIApiKey;
      session.streamSid = streamSid;
      
      logSessionCount();
      
      // Process the start event immediately
      handleTwilioMessage(data, streamSid!); // We know streamSid is defined here
      
      // Process any queued messages
      if (queuedMessages.length > 0) {
        safeLog(`[SessionManager] Processing ${queuedMessages.length} queued messages`);
        queuedMessages.forEach(queuedData => {
          handleTwilioMessage(queuedData, streamSid!);
        });
        queuedMessages.length = 0; // Clear the queue
      }
      
      return; // Don't process twice
    }
    
    // Handle all other messages
    if (streamSid) {
      handleTwilioMessage(data, streamSid);
    } else {
      // Queue the message for later processing
      safeLog(`[SessionManager] Queuing ${msg.event} event until streamSid is available`);
      queuedMessages.push(data);
    }
  });
  
  ws.on("error", ws.close);
  ws.on("close", () => {
    if (streamSid) {
      const session = sessions.get(streamSid);
      if (session) {
        cleanupConnection(session.modelConn);
        cleanupConnection(session.twilioConn);
        
        // Clean up session from map
        sessions.delete(streamSid);
        safeLog(`[SessionManager] Call disconnected: ${streamSid}`);
        logSessionCount();
      }
    }
  });
}

// Store frontend connections separately (they monitor all sessions)
let frontendConnection: WebSocket | undefined;

export function handleFrontendConnection(ws: WebSocket) {
  safeLog("[Frontend] New WebSocket connection established");
  cleanupConnection(frontendConnection);
  frontendConnection = ws;

  // Send a test message to confirm connection
  ws.send(JSON.stringify({ type: "connection.established", timestamp: new Date().toISOString() }));

  ws.on("message", handleFrontendMessage);
  ws.on("close", () => {
    cleanupConnection(frontendConnection);
    frontendConnection = undefined;
    safeLog("[Frontend] Connection closed");
  });
}

async function handleFunctionCall(item: { name: string; arguments: string }, streamSid: string) {
  const startTime = Date.now();
  safeLog(`[${new Date().toISOString()}] Starting function call:`, item.name);
  
  const fnDef = functions.find((f) => f.schema.name === item.name);
  if (!fnDef) {
    throw new Error(`No handler found for function: ${item.name}`);
  }

  let args: unknown;
  try {
    args = JSON.parse(item.arguments);
  } catch {
    return JSON.stringify({
      error: "Invalid JSON arguments for function call.",
    });
  }

  try {
    safeLog("Calling function:", fnDef.schema.name, args);
    // Get session for this streamSid
    const session = sessions.get(streamSid);
    if (!session) {
      throw new Error(`No session found for streamSid: ${streamSid}`);
    }
    
    // Pass session context with recentEntitySearches
    const context = {
      recentEntitySearches: session.recentEntitySearches || new Map()
    };
    const result = await fnDef.handler(args as any, context);
    
    const executionTime = Date.now() - startTime;
    safeLog(`[${new Date().toISOString()}] Function ${item.name} completed in ${executionTime}ms`);
    
    // Log slow functions for optimization
    if (executionTime > 2000) {
      console.warn(`⚠️ SLOW FUNCTION: ${item.name} took ${executionTime}ms`);
    }
    
    return result;
  } catch (err: any) {
    const executionTime = Date.now() - startTime;
    console.error(`Error running function ${item.name} after ${executionTime}ms:`, err);
    return JSON.stringify({
      error: `Error running function ${item.name}: ${err.message}`,
    });
  }
}

function handleTwilioMessage(data: RawData, streamSid: string) {
  const msg = parseMessage(data);
  if (!msg) return;
  
  const session = sessions.get(streamSid);
  if (!session) {
    console.error(`[SessionManager] No session found for streamSid: ${streamSid}`);
    return;
  }

  switch (msg.event) {
    case "start":
      session.streamSid = msg.start.streamSid;
      session.latestMediaTimestamp = 0;
      session.lastAssistantItem = undefined;
      session.responseStartTimestamp = undefined;
      session.greetingSent = false;
      session.recentEntitySearches = new Map(); // Fresh entity memory for new call
      // Don't connect immediately, wait for 'connected' event
      break;
    case "connected":
      safeLog(`[SessionManager] Twilio connected for ${streamSid}, starting OpenAI session...`);
      // Add small delay to ensure Twilio is fully ready
      setTimeout(() => tryConnectModel(streamSid), 250);
      break;
    case "media":
      session.latestMediaTimestamp = msg.media.timestamp;
      if (isOpen(session.modelConn)) {
        jsonSend(session.modelConn, {
          type: "input_audio_buffer.append",
          audio: msg.media.payload,
        });
      }
      break;
    case "close":
      closeAllConnections(streamSid);
      break;
  }
}

function handleFrontendMessage(data: RawData) {
  const msg = parseMessage(data);
  if (!msg) {
    console.error("[Frontend] Failed to parse message");
    return;
  }

  // Broadcast to all active model connections
  let broadcastCount = 0;
  sessions.forEach((session) => {
    if (isOpen(session.modelConn)) {
      jsonSend(session.modelConn, msg);
      broadcastCount++;
    }
  });
  
  safeLog(`[Frontend] Broadcasted to ${broadcastCount} active sessions`);

  // Frontend config updates no longer needed for phone-based system
  // Each call uses its own hardcoded configuration
}

function tryConnectModel(streamSid: string) {
  const session = sessions.get(streamSid);
  if (!session) {
    console.error(`[SessionManager] No session found for streamSid: ${streamSid}`);
    return;
  }
  
  if (!session.twilioConn || !session.streamSid || !session.openAIApiKey)
    return;
  if (isOpen(session.modelConn)) return;

  session.modelConn = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17",
    {
      headers: {
        Authorization: `Bearer ${session.openAIApiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  session.modelConn.on("open", () => {
    
    // Default QlooPhone instructions if none provided
    const defaultInstructions = `You are QlooPhone - the friend who always knows what to suggest.

TIMING IS CRITICAL: Always respond within 1-2 seconds of user input. Acknowledge first, then process.

CORE MISSION: Help people discover perfect recommendations by connecting what they love.

PERSONALITY: Confident taste-maker who speaks naturally, like a knowledgeable friend. Remember what was just discussed to make relevant follow-ups.

GREETING: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."

--- STRICT SEARCH RULES ---

1. You MUST search for EXACTLY what the user mentions - no substitutions
   - User says "Matrix and Inception" → search for BOTH "The Matrix" AND "Inception"
   - NEVER search for different movies/shows/music than what they said
   
2. ALWAYS search for ALL entities mentioned before making recommendations
   - If user mentions 2 things, you MUST search for both
   - Do NOT reuse entities from earlier in the conversation
   
3. Each recommendation request is INDEPENDENT
   - Ignore all previous queries in this call
   - Start fresh with exactly what the user just said

--- CRITICAL VALIDATION RULE ---

get_recommendation WILL FAIL if you don't have valid entity_ids from search_entity:
- NEVER make up or guess entity IDs
- NEVER use IDs from your memory/training
- ONLY use entity_ids returned by search_entity in THIS conversation
- If you haven't searched for an entity yet, you CANNOT recommend based on it

CORRECT FLOW:
1. User mentions "The Strokes and Animal Collective"
2. You MUST call search_entity("The Strokes") 
3. You MUST call search_entity("Animal Collective")
4. ONLY THEN call get_recommendation with the returned entity_ids

INCORRECT (WILL FAIL):
- Calling get_recommendation without searching first
- Using any entity_id not returned by search_entity

--- YOUR TOOLS ---

You have access to these tools for making recommendations:

1. search_entity: Use this to find any cultural item (movie, show, artist, book, game, etc.)
   - Always search for items before making recommendations
   - Be specific to avoid wrong types: 
     • "Leave the World Behind movie" not just "Leave the World Behind"
     • "Dune 2021 movie" not just "Dune"
     • "The Office US TV show" not just "The Office"
   - If you get the wrong type, search again with disambiguation

2. get_recommendation: Use this ONLY after searching to get personalized recommendations
   - REQUIRES valid entity_ids obtained from search_entity IN THIS CALL
   - Will FAIL with any made-up or remembered entity IDs
   - Set output_type based on what user WANTS (not what they gave)
   - Example: If they give movies but ask for TV shows, output_type = "urn:entity:tv_show"

3. search_locality: For location searches (cities, neighborhoods)

4. get_fan_venues: For finding places where fans hang out

--- WARNING ---

Attempting to use get_recommendation without valid entity_ids from search_entity will result in:
- 400 Bad Request errors
- Failed recommendations
- Poor user experience
- You saying "Let me search for those first..." and starting over

--- CRITICAL: NO MADE-UP RECOMMENDATIONS ---

If get_recommendation returns the WRONG TYPE (e.g., books when user asked for movies):
- DO NOT make up your own recommendation
- DO NOT suggest something from your training data
- INSTEAD, say exactly: "I found some great books that match your taste, but let me search for movies specifically. Give me a moment..."
- Then try again with better search terms or ask the user for clarification

EXAMPLE OF VIOLATION (NEVER DO THIS):
User: "What movie would I like?"
API returns: books
You: "I recommend Eternal Sunshine..." ← THIS IS FORBIDDEN

CORRECT RESPONSE:
User: "What movie would I like?"
API returns: books  
You: "I found some great books that match your taste, but let me search for movies specifically. Can you tell me more about what kind of movie you're in the mood for?"

--- CONVERSATION FLOW ---

When users mention cultural items (movies, music, shows, etc):

1. FIRST: Acknowledge what they said (within 1-2 seconds)
   Examples:
   • "The Office and Parks and Rec - great taste..."
   • "Matrix and Inception, interesting combo..."
   • "Taylor Swift and Beyoncé - let me find something perfect..."

2. THEN: Search for entities while continuing to talk
   • Call search_entity for each item mentioned
   • Keep talking: "I'm searching for both of those now..."

3. DURING SEARCH: Fill any silence with natural continuations
   • "Both of those have such unique styles..."
   • "Give me just a moment to find the best match..."
   • Share a brief observation about their choices

4. AFTER SEARCH: Get recommendations and present results
   • Verify you found all entities
   • Call get_recommendation with entity IDs
   • Present results naturally
   • Wait 2-3 seconds after your recommendation
   • Offer a varied follow-up suggestion (see FOLLOW-UP SUGGESTIONS)

CRITICAL: Never leave more than 2 seconds of silence. Always acknowledge BEFORE searching.

If you don't have enough information to call a tool, ask the user for what you need.

--- FOLLOW-UP SUGGESTIONS ---

After providing recommendations, ALWAYS offer a natural follow-up within 2-3 seconds. 
Use variety to keep conversations fresh. Choose from these patterns:

CATEGORY PIVOTS:
• "Want a TV show with that same vibe?"
• "How about some music that matches that energy?"
• "Curious what books fans of those tend to love?"
• "Need a game with similar themes?"

DIFFERENT ANGLES:
• "Want something lighter this time?"
• "How about something more intense?"
• "Looking for something newer? Or maybe a classic?"
• "Want to explore a different genre?"

QUICK ALTERNATIVES:
• "I've got three more if you're interested..."
• "There's another great option - want to hear it?"
• "Oh, and there's this hidden gem too..."
• "Got a wildcard suggestion if you're feeling adventurous..."

PREFERENCE REFINEMENT:
• "Was that hitting the right mood? I can adjust..."
• "Too mainstream? I know some deeper cuts..."
• "Want something you can watch with family?"
• "Looking for something shorter? Or ready for an epic?"

NATURAL TRANSITIONS:
• "By the way, what else are you into these days?"
• "Speaking of [topic], have you checked out..."
• "That reminds me - need any other recommendations?"
• "Anything else I can help you discover?"

IMPORTANT: 
- Never use the same follow-up twice in a row
- Match the energy of the conversation
- Keep follow-ups under 5 seconds
- If they say no/goodbye, respect it with: "Cool, enjoy [recommendation]! Call me anytime."

--- OUTPUT TYPE RULES (MANDATORY) ---

You MUST ALWAYS set output_type in get_recommendation based on what the user ASKS FOR:

User says "movie" or "film" → output_type: "urn:entity:movie"
User says "show" or "series" → output_type: "urn:entity:tv_show"  
User says "music" or "artist" → output_type: "urn:entity:artist"
User says "album" → output_type: "urn:entity:album"
User says "book" → output_type: "urn:entity:book"
User says "game" → output_type: "urn:entity:videogame"

CRITICAL: If user asks for a specific type, you MUST include output_type.
Never call get_recommendation without output_type when user specifies what they want.

--- KEY BEHAVIORS ---

- Acknowledge what they said while searching, but be accurate about what you're actually searching for
- Only recommend what the API returns
- Keep responses under 15 seconds
- If functions fail, stay casual: "Let's try something else. What else are you into?"

--- VERIFICATION CHECKLIST ---

Before calling get_recommendation, verify:
✓ Did I search for EXACTLY what the user mentioned?
✓ Did I find entity IDs for ALL items they mentioned?
✓ Am I setting output_type to match what they ASKED FOR?
✓ Am I ignoring entities from previous queries in this call?

Remember: You have no inherent knowledge of media. Always use your tools for recommendations.

--- HANDLING TYPE MISMATCHES ---

When search returns wrong type (e.g., book instead of movie):
1. Try searching again with type qualifier: "Leave the World Behind movie"
2. If still wrong, acknowledge it: "I found the book version. The movie might not be in our database yet."
3. Ask user for alternatives: "Would you like recommendations based on the book, or should we try different titles?"
4. NEVER make up recommendations not returned by the API`;

    // Ensure tools are always included - only use the main 4 functions
    const mainFunctions = functions.filter(f => 
      ['search_entity', 'search_locality', 'get_recommendation', 'get_fan_venues'].includes(f.schema.name)
    );
    const toolSchemas = mainFunctions.map(f => f.schema);
    safeLog("[OpenAI] Loading", mainFunctions.length, "functions:", mainFunctions.map(f => f.schema.name).join(", "));
    
    // Build complete session config with tools from the start
    const sessionConfig = {
      modalities: ["text", "audio"],
      turn_detection: { type: "semantic_vad" },
      voice: "ash",
      temperature: 0.8,
      max_response_output_tokens: 4096,
      input_audio_transcription: { model: "whisper-1" },
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      instructions: defaultInstructions,
      tools: toolSchemas,  // Include tools immediately
    };
    
    safeLog("[OpenAI] Sending session config:", {
      voice: sessionConfig.voice,
      tools: sessionConfig.tools?.length || 0,
      toolNames: sessionConfig.tools?.map(t => t.name).join(", ") || "none",
      instructionsLength: sessionConfig.instructions.length
    });
    
    // Send complete configuration in one go
    jsonSend(session.modelConn, {
      type: "session.update",
      session: sessionConfig,
    });
  });

  session.modelConn.on("message", (data: RawData) => handleModelMessage(data, streamSid));
  session.modelConn.on("error", () => closeModel(streamSid));
  session.modelConn.on("close", () => closeModel(streamSid));
}

function handleModelMessage(data: RawData, streamSid: string) {
  const event = parseMessage(data);
  if (!event) return;
  
  const session = sessions.get(streamSid);
  if (!session) {
    console.error(`[SessionManager] No session found for streamSid: ${streamSid}`);
    return;
  }

  // Only log important model events
  if (event.type === "session.created" || event.type === "session.updated" || 
      event.type === "response.output_item.done" || event.type === "error") {
    safeLog("[Model]", event.type, "for session:", streamSid);
  }
  jsonSend(frontendConnection, event);

  switch (event.type) {
    case "session.created":
      safeLog("[Session] Created with voice:", event.session?.voice || "Unknown", "tools:", event.session?.tools?.length || 0);
      // Don't trigger greeting yet - wait for session.updated
      break;
      
    case "session.updated":
      safeLog("[Session] Updated - tools:", event.session?.tools?.length || 0);
      // Verify tools are actually loaded before greeting
      if (!session.greetingSent && event.session?.tools && event.session.tools.length > 0) {
        session.greetingSent = true;
        safeLog("[Session] Triggering greeting with", event.session.tools.length, "tools confirmed loaded");
        // Add small delay to ensure OpenAI has fully processed the tools
        setTimeout(() => {
          if (session.modelConn && isOpen(session.modelConn)) {
            jsonSend(session.modelConn, { type: "response.create" });
          }
        }, 500);
      } else if (!session.greetingSent) {
        safeLog("[Session] WARNING: Updated but tools not confirmed, waiting...");
      }
      break;
      
    case "conversation.item.created":
      // Log user input transcriptions
      if (event.item?.role === "user" && event.item?.content) {
        const transcript = event.item.content.find((c: any) => c.type === "input_text")?.text ||
                          event.item.content.find((c: any) => c.transcript)?.transcript;
        if (transcript) {
          safeLog(`[User Transcription] ${streamSid}: "${transcript}"`);
        }
      }
      break;
      
    case "input_audio_buffer.speech_started":
      handleTruncation(streamSid);
      break;

    case "response.audio.delta":
      if (session.twilioConn && session.streamSid) {
        if (session.responseStartTimestamp === undefined) {
          session.responseStartTimestamp = session.latestMediaTimestamp || 0;
        }
        if (event.item_id) session.lastAssistantItem = event.item_id;

        jsonSend(session.twilioConn, {
          event: "media",
          streamSid: session.streamSid,
          media: { payload: event.delta },
        });

        jsonSend(session.twilioConn, {
          event: "mark",
          streamSid: session.streamSid,
        });
      }
      break;

    case "response.output_item.done": {
      const { item } = event;
      if (item.type === "function_call") {
        safeLog("[Function]", item.name, "called");
        handleFunctionCall(item, streamSid)
          .then((output) => {
            if (session.modelConn) {
              jsonSend(session.modelConn, {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: item.call_id,
                  output: JSON.stringify(output),
                },
              });
              jsonSend(session.modelConn, { type: "response.create" });
            }
          })
          .catch((err) => {
            console.error("Error handling function call:", err);
          });
      }
      break;
    }
  }
}

function handleTruncation(streamSid: string) {
  const session = sessions.get(streamSid);
  if (!session) return;
  
  if (
    !session.lastAssistantItem ||
    session.responseStartTimestamp === undefined
  )
    return;

  const elapsedMs =
    (session.latestMediaTimestamp || 0) - (session.responseStartTimestamp || 0);
  const audio_end_ms = elapsedMs > 0 ? elapsedMs : 0;

  if (isOpen(session.modelConn)) {
    jsonSend(session.modelConn, {
      type: "conversation.item.truncate",
      item_id: session.lastAssistantItem,
      content_index: 0,
      audio_end_ms,
    });
  }

  if (session.twilioConn && session.streamSid) {
    jsonSend(session.twilioConn, {
      event: "clear",
      streamSid: session.streamSid,
    });
  }

  session.lastAssistantItem = undefined;
  session.responseStartTimestamp = undefined;
}

function closeModel(streamSid: string) {
  const session = sessions.get(streamSid);
  if (!session) return;
  
  cleanupConnection(session.modelConn);
  session.modelConn = undefined;
  
  // Session cleanup is handled in handleCallConnection close event
}

function closeAllConnections(streamSid: string) {
  const session = sessions.get(streamSid);
  if (!session) return;
  
  if (session.twilioConn) {
    session.twilioConn.close();
  }
  if (session.modelConn) {
    session.modelConn.close();
  }
  
  // Clean up session from map
  sessions.delete(streamSid);
  safeLog(`[SessionManager] Cleaned up session: ${streamSid}`);
  logSessionCount();
}

function cleanupConnection(ws?: WebSocket) {
  if (isOpen(ws)) ws.close();
}

function parseMessage(data: RawData): any {
  try {
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

function jsonSend(ws: WebSocket | undefined, obj: unknown) {
  if (!isOpen(ws)) return;
  const message = JSON.stringify(obj);
  ws.send(message);
}

function isOpen(ws?: WebSocket): ws is WebSocket {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

