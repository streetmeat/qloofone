"use client";

import React, { useState, useEffect, useRef } from "react";
import TopBar from "@/components/top-bar";
import Transcript from "@/components/transcript";
import FunctionCallsPanel from "@/components/function-calls-panel";
import SessionConfigurationPanel from "@/components/session-configuration-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Item } from "@/components/types";
import handleRealtimeEvent from "@/lib/handle-realtime-event";

// Backend URL from environment variable (replaced at build time)
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'localhost:8081';

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [callStatus, setCallStatus] = useState("disconnected");
  const wsRef = useRef<WebSocket | null>(null);

  // Debug items changes
  useEffect(() => {
    console.log("[Monitor] Items updated, count:", items.length);
    if (items.length > 0) {
      console.log("[Monitor] Latest item:", items[items.length - 1]);
    }
  }, [items]);

  useEffect(() => {
    // Use the build-time constant for backend URL
    console.log("[Monitor] Using backend URL:", BACKEND_URL);
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = BACKEND_URL.replace(/^https?:\/\//, ''); // Remove protocol if present
    console.log("[Monitor] Connecting to WebSocket:", `${wsProtocol}//${wsHost}/logs`);
    const newWs = new WebSocket(`${wsProtocol}//${wsHost}/logs`);

    newWs.onopen = () => {
      console.log("Connected to logs websocket");
      setCallStatus("connected");
      wsRef.current = newWs;
      
      // DO NOT automatically send saved config - let user manually save
      // This prevents overwriting the backend's working configuration
      console.log("[Monitor] Connected - config will only be sent when user clicks Save");
    };

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("[Monitor] Received WebSocket message:", data);
      console.log("[Monitor] Event type:", data.type);
      if (data.type === "connection.established") {
        console.log("[Monitor] Connection confirmed by backend");
      }
      handleRealtimeEvent(data, setItems);
    };

    newWs.onclose = () => {
      console.log("Logs websocket disconnected");
      wsRef.current = null;
      setCallStatus("disconnected");
    };

    return () => {
      newWs.close();
    };
  }, []);

  return (
    <div className="h-screen bg-charcoal flex flex-col">
      <TopBar />
      <div className="flex-grow p-4 h-full overflow-hidden">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column: Session Configuration */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <SessionConfigurationPanel
              callStatus={callStatus}
              onSave={(config) => {
                console.log("[Monitor] onSave called with config:", config);
                console.log("[Monitor] WebSocket ref:", wsRef.current);
                console.log("[Monitor] WebSocket state:", wsRef.current?.readyState, "OPEN=", WebSocket.OPEN);
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  const updateEvent = {
                    type: "session.update",
                    session: config,
                  };
                  console.log("[Monitor] Sending session update:", updateEvent);
                  wsRef.current.send(JSON.stringify(updateEvent));
                } else {
                  console.error("[Monitor] WebSocket not connected!");
                }
              }}
            />
          </div>

          {/* Middle Column: Transcript */}
          <div className="col-span-6 flex flex-col h-full overflow-hidden">
            <Transcript items={items} />
          </div>

          {/* Right Column: Function Calls */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <FunctionCallsPanel items={items} ws={wsRef.current} />
          </div>
        </div>
      </div>
    </div>
  );
}