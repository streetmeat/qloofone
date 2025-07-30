import React, { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Item } from "@/components/types";
import JsonFormatter from "@/components/json-formatter";

type FunctionCallsPanelProps = {
  items: Item[];
  ws?: WebSocket | null;
};

const FunctionCallsPanel: React.FC<FunctionCallsPanelProps> = ({ items }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Filter function_call items
  const functionCalls = items.filter((it) => it.type === "function_call");
  
  // Auto-scroll when new function calls are added
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [functionCalls.length]);

  // For each function_call, check for a corresponding function_call_output
  const functionCallsWithStatus = functionCalls.map((call) => {
    const outputs = items.filter(
      (it) => it.type === "function_call_output" && it.call_id === call.call_id
    );
    const outputItem = outputs[0];
    const completed = call.status === "completed" || !!outputItem;
    const response = outputItem ? outputItem.output : undefined;
    
    // Response is already a string, no need to modify it
    let validResponse = response;
    
    return {
      ...call,
      completed,
      response: validResponse,
    };
  });

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="flex-shrink-0 space-y-1.5 pb-3 border-b border-white/10">
        <CardTitle className="text-base font-semibold text-accent1 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent1 animate-pulse" />
          Qloo API Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-4 overflow-hidden min-h-0">
        <ScrollArea className="h-full w-full">
          <div className="space-y-4 pr-3">
            {functionCallsWithStatus.map((call) => (
              <div
                key={call.id}
                className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3 transition-all duration-300 hover:bg-white/10 hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-sm text-accent2">{call.name}</h3>
                  <Badge 
                    variant={call.completed ? "success" : "accent3"}
                  >
                    {call.completed ? "Completed" : "Pending"}
                  </Badge>
                </div>

                {call.params && (
                  <div className="text-sm text-gray-400 font-mono">
                    <p className="text-xs text-gray-500 mb-1 font-sans">Parameters:</p>
                    <div className="bg-black/40 rounded p-2 border border-white/5">
                      <JsonFormatter json={JSON.stringify(call.params)} />
                    </div>
                  </div>
                )}

                {call.response && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1 font-sans">Response:</p>
                    <div className="bg-black/40 rounded p-2 overflow-x-auto border border-white/5">
                      <div className="text-xs font-mono">
                        <JsonFormatter json={call.response} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {functionCalls.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <div className="inline-flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-accent1/50" />
                  </div>
                  <span className="text-sm">No API calls yet</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FunctionCallsPanel;