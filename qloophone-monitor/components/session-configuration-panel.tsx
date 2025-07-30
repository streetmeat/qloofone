import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

interface SessionConfigurationPanelProps {
  callStatus: string;
  onSave: (config: any) => void;
}

const SessionConfigurationPanel: React.FC<SessionConfigurationPanelProps> = ({
  callStatus,
  onSave,
}) => {
  // Default values
  const defaultInstructions = `You're QlooPhone - the friend who always knows what to suggest when everyone's stuck deciding.

CRITICAL TIMING RULES (MUST FOLLOW):
When you hear two items mentioned together:
- Start speaking WITHIN 500ms with acknowledgment
- Say acknowledgment WHILE calling functions simultaneously
- NEVER wait for API results before speaking
- Duration: 1-2 seconds MAX for acknowledgment

ACKNOWLEDGMENTS FOR TWO-ITEM MENTIONS:
- "Oh, [item1] and [item2] - perfect combo..."
- "[Item1] meets [item2]? I got you..."
- "Those two together? Let me work my magic..."

INTRODUCTION:
When prompted "The user just connected", greet with: "Hey, it's QlooPhone. Everyone stuck scrolling? I'll find something you'll all actually want to watch. Just name two things you're into."

IMPORTANT: You have NO knowledge about any movies, music, etc. You MUST use the API functions to find ALL recommendations.`;
  
  const [instructions, setInstructions] = useState(defaultInstructions);
  const [voice, setVoice] = useState("ash"); // Changed to ash - the working voice
  const [temperature, setTemperature] = useState(0.8);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [turnDetectionType, setTurnDetectionType] = useState("server_vad");
  const [vadThreshold, setVadThreshold] = useState(0.5);
  const [silenceDuration, setSilenceDuration] = useState(200); // Changed to match backend default
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('qlooSessionConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        // Validate saved config has correct voice
        const workingVoices = ['ash', 'echo', 'shimmer'];
        if (!workingVoices.includes(config.voice)) {
          console.warn(`[Monitor] Fixing unsupported voice '${config.voice}' in saved config`);
          config.voice = 'ash';
        }
        console.log("[SessionPanel] Loading saved config from localStorage:", config);
        setInstructions(config.instructions || defaultInstructions);
        setVoice(config.voice || "ash"); // Default to ash, not alloy
        setTemperature(config.temperature || 0.8);
        setMaxTokens(config.max_response_output_tokens || 4096);
        if (config.turn_detection) {
          setTurnDetectionType(config.turn_detection.type || "server_vad");
          setVadThreshold(config.turn_detection.threshold || 0.5);
          setSilenceDuration(config.turn_detection.silence_duration_ms || 200); // Match backend default
        }
      } catch (e) {
        console.error("[SessionPanel] Failed to parse saved config:", e);
      }
    }
  }, []);

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
    setSaveStatus("idle");
  }, [instructions, voice, temperature, maxTokens, turnDetectionType, vadThreshold, silenceDuration]);

  const handleSave = () => {
    console.log("[SessionPanel] Save button clicked");
    console.log("[SessionPanel] Current voice:", voice);
    setSaveStatus("saving");
    
    const config = {
      modalities: ["text", "audio"],
      instructions,
      voice,
      temperature,
      max_response_output_tokens: maxTokens,
      turn_detection: turnDetectionType === "server_vad" ? {
        type: "server_vad",
        threshold: vadThreshold,
        silence_duration_ms: silenceDuration,
      } : null,
    };

    console.log("[SessionPanel] Calling onSave with config:", config);
    
    // Save to localStorage
    localStorage.setItem('qlooSessionConfig', JSON.stringify(config));
    console.log("[SessionPanel] Saved config to localStorage");
    
    onSave(config);
    
    setTimeout(() => {
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
    }, 300);

    setTimeout(() => {
      setSaveStatus("idle");
    }, 2000);
  };

  return (
    <Card className="h-full flex flex-col relative">
      {/* Permanent overlay - always shown */}
      <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
        <div className="bg-black/70 px-6 py-3 rounded-lg border border-white/20">
          <p className="text-white font-medium text-lg">Demo Display Only</p>
          <p className="text-gray-300 text-sm mt-1">Configuration panel for future use</p>
        </div>
      </div>
      
      <CardHeader className="pb-4 border-b border-white/10">
        <CardTitle className="text-base text-accent3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent3" />
          Session Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="space-y-4">
          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions" className="text-gray-300">Instructions</Label>
            <Textarea
              id="instructions"
              placeholder="System instructions"
              className="min-h-[120px] resize-none text-sm"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <Label htmlFor="voice" className="text-gray-300">Voice</Label>
            <Select value={voice} onValueChange={setVoice}>
              <SelectTrigger id="voice" className="bg-white/5 border-white/20 text-gray-200 hover:bg-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-charcoal border-white/20 text-gray-200">
                <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                <SelectItem value="echo">Echo (Smooth)</SelectItem>
                <SelectItem value="shimmer">Shimmer (Energetic)</SelectItem>
                <SelectItem value="ash">Ash</SelectItem>
                <SelectItem value="ballad">Ballad</SelectItem>
                <SelectItem value="coral">Coral</SelectItem>
                <SelectItem value="sage">Sage</SelectItem>
                <SelectItem value="verse">Verse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Response Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-accent1">Response Settings</h3>
            
            <div className="space-y-2">
              <Label htmlFor="temperature" className="text-gray-300 flex justify-between">
                <span>Temperature</span>
                <span className="font-mono text-accent2">{temperature}</span>
              </Label>
              <input
                id="temperature"
                type="range"
                min="0.6"
                max="0.9"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
                             />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTokens" className="text-gray-300 flex justify-between">
                <span>Max Response Tokens</span>
                <span className="font-mono text-accent2">{maxTokens}</span>
              </Label>
              <input
                id="maxTokens"
                type="range"
                min="1024"
                max="4096"
                step="512"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full"
                             />
            </div>
          </div>

          {/* Turn Detection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-accent1">Turn Detection</h3>
            
            <div className="space-y-2">
              <Label htmlFor="turnDetection" className="text-gray-300">Type</Label>
              <Select value={turnDetectionType} onValueChange={setTurnDetectionType}>
                <SelectTrigger id="turnDetection" className="bg-white/5 border-white/20 text-gray-200 hover:bg-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-charcoal border-white/20 text-gray-200">
                  <SelectItem value="server_vad">Server VAD</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {turnDetectionType === "server_vad" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="vadThreshold" className="text-gray-300 flex justify-between">
                    <span>VAD Threshold</span>
                    <span className="font-mono text-accent2">{vadThreshold}</span>
                  </Label>
                  <input
                    id="vadThreshold"
                    type="range"
                    min="0.3"
                    max="0.9"
                    step="0.1"
                    value={vadThreshold}
                    onChange={(e) => setVadThreshold(parseFloat(e.target.value))}
                    className="w-full"
                                     />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="silenceDuration" className="text-gray-300 flex justify-between">
                    <span>Silence Duration</span>
                    <span className="font-mono text-accent2">{silenceDuration}ms</span>
                  </Label>
                  <input
                    id="silenceDuration"
                    type="range"
                    min="200"
                    max="1000"
                    step="100"
                    value={silenceDuration}
                    onChange={(e) => setSilenceDuration(parseInt(e.target.value))}
                    className="w-full"
                                     />
                </div>
              </>
            )}
          </div>

          {/* Save Button */}
          <Button
            className={`w-full ${saveStatus === "saved" ? "bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:shadow-[0_0_20px_rgba(34,197,94,0.5)]" : ""}`}
            variant="default"
            onClick={handleSave}
            disabled={saveStatus === "saving" || !hasUnsavedChanges || callStatus !== "connected"}
          >
            {saveStatus === "saving" ? (
              "Saving..."
            ) : saveStatus === "saved" ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            ) : (
              "Save Configuration"
            )}
          </Button>

          {callStatus !== "connected" && (
            <p className="text-xs text-gray-500 text-center">
              Connect to backend to update configuration
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionConfigurationPanel;