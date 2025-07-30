import { WebSocket } from "ws";

export interface Session {
  twilioConn?: WebSocket;
  frontendConn?: WebSocket;
  modelConn?: WebSocket;
  config?: any;
  streamSid?: string;
}

export interface FunctionCallItem {
  name: string;
  arguments: string;
  call_id?: string;
}

export interface FunctionSchema {
  name: string;
  type: "function";
  description?: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required: string[];
  };
}

export interface SessionContext {
  recentEntitySearches: Map<string, {name: string, entity_id: string, type?: string}>;
}

export interface FunctionHandler {
  schema: FunctionSchema;
  handler: (args: any, context?: SessionContext) => Promise<string>;
}
