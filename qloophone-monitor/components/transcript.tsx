import React, { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Phone, MessageSquare, Wrench } from "lucide-react";
import { Item } from "@/components/types";
import JsonFormatter from "@/components/json-formatter";

type TranscriptProps = {
  items: Item[];
};

const Transcript: React.FC<TranscriptProps> = ({ items }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  // Helper to format function calls
  const formatFunctionCall = (text: string) => {
    // Parse function calls like "search_entity({...})"
    const match = text.match(/^(\w+)\((.*)\)$/);
    if (match) {
      const [, funcName, args] = match;
      return { funcName, args };
    }
    return null;
  };

  // Show messages, function calls, and function call outputs in the transcript
  const transcriptItems = items.filter(
    (it) =>
      it.type === "message" ||
      it.type === "function_call" ||
      it.type === "function_call_output"
  );

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardContent className="flex-1 h-full min-h-0 overflow-hidden flex flex-col p-0">
        {transcriptItems.length === 0 && (
          <div className="flex flex-1 h-full items-center justify-center mt-36">
            <div className="flex flex-col items-center gap-3 justify-center h-full">
              <div className="h-[140px] w-[140px] rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:border-accent1/50 hover:shadow-[0_0_30px_var(--clr-accent1)]">
                <MessageSquare className="h-16 w-16 text-accent1/50 bg-transparent" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-gray-300">
                  No messages yet
                </p>
                <p className="text-sm text-gray-500">
                  Start a call to see the transcript
                </p>
              </div>
            </div>
          </div>
        )}
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-6 p-6">
            {transcriptItems.map((msg, i) => {
              const isUser = msg.role === "user";
              const isTool = msg.role === "tool";
              // Default to assistant if not user or tool
              const Icon = isUser ? Phone : isTool ? Wrench : Bot;

              // Combine all text parts into a single string for display
              const displayText = msg.content
                ? msg.content.map((c) => c.text).join("")
                : "";
              
              // Check if this is a function call display
              const isFunctionCall = msg.type === "function_call" && msg.role === "assistant";

              return (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 ${
                      isUser
                        ? "bg-accent2/20 border-accent2/30 text-accent2 shadow-[0_0_10px_var(--clr-accent2)]"
                        : isTool
                        ? "bg-accent1/20 border-accent1/30 text-accent1 shadow-[0_0_10px_var(--clr-accent1)]"
                        : "bg-accent3/20 border-accent3/30 text-accent3 shadow-[0_0_10px_var(--clr-accent3)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`text-sm font-medium ${
                          isUser ? "text-accent2" : isTool ? "text-accent1" : "text-accent3"
                        }`}
                      >
                        {isUser
                          ? "Caller"
                          : isTool
                          ? "Tool Response"
                          : "Assistant"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {msg.timestamp}
                      </span>
                    </div>
                    {isTool ? (
                      <div className="text-sm leading-relaxed">
                        <p className="text-gray-400 mb-2">API Response:</p>
                        <div className="bg-black/40 rounded-md p-3 font-mono text-xs overflow-x-auto border border-white/10">
                          <JsonFormatter json={displayText} />
                        </div>
                      </div>
                    ) : isFunctionCall && formatFunctionCall(displayText) ? (
                      <div className="text-sm leading-relaxed">
                        <p className="text-gray-300 mb-2">Calling function:</p>
                        <div className="bg-black/40 rounded-md p-3 font-mono text-xs border border-white/10">
                          <span className="text-accent2 font-semibold">{formatFunctionCall(displayText)?.funcName}</span>
                          <span className="text-gray-500">(</span>
                          <div className="ml-4 mt-1">
                            <JsonFormatter json={formatFunctionCall(displayText)?.args || "{}"} />
                          </div>
                          <span className="text-gray-500">)</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 leading-relaxed break-words">
                        {displayText}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Transcript;
