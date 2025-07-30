import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import dotenv from "dotenv";
import http from "http";
import { readFileSync } from "fs";
import { join } from "path";
import cors from "cors";
import {
  handleCallConnection,
  handleFrontendConnection,
} from "./sessionManager";
import functions from "./functionHandlers";
import { entityCache } from "./entityCache";

dotenv.config();

const PORT = parseInt(process.env.PORT || "8081", 10);
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.urlencoded({ extended: false }));

const twimlPath = join(__dirname, "twiml.xml");
const twimlTemplate = readFileSync(twimlPath, "utf-8");

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Cache stats endpoint
app.get("/cache-stats", (_req, res) => {
  const stats = entityCache.getStats();
  res.json({
    ...stats,
    timestamp: new Date().toISOString()
  });
});

app.get("/public-url", (_req, res) => {
  res.json({ publicUrl: PUBLIC_URL });
});

// Test endpoint to monitor active sessions (for debugging)
app.get("/test/sessions", (_req, res) => {
  // Import the session count function
  const { getActiveSessionCount } = require('./sessionManager');
  
  res.json({
    activeSessions: getActiveSessionCount(),
    timestamp: new Date().toISOString()
  });
});

app.all("/twiml", (_req, res) => {
  const wsUrl = new URL(PUBLIC_URL);
  wsUrl.protocol = "wss:";
  wsUrl.pathname = `/call`;

  const twimlContent = twimlTemplate.replace("{{WS_URL}}", wsUrl.toString());
  res.type("text/xml").send(twimlContent);
});

// New endpoint to list available tools (schemas)
app.get("/tools", (_req, res) => {
  res.json(functions.map((f) => f.schema));
});

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 1) {
    ws.close();
    return;
  }

  const type = parts[0];

  if (type === "call") {
    // Each call gets its own isolated session
    handleCallConnection(ws, OPENAI_API_KEY);
  } else if (type === "logs") {
    // Frontend monitoring connections
    handleFrontendConnection(ws);
  } else {
    ws.close();
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Cache stats available at GET /cache-stats endpoint if needed
  console.log(`Cache stats endpoint: http://localhost:${PORT}/cache-stats`);
});

// Export server for testing
export { server };
