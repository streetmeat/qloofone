import * as dotenv from 'dotenv';
dotenv.config();

// Simulate the exact way sessionManager calls functions
import functionHandlers from '../../functionHandlers';

async function simulateOpenAICall() {
  console.log('Simulating exact OpenAI function call...\n');

  // This simulates what handleFunctionCall does
  const item = {
    name: "get_recommendation",
    arguments: JSON.stringify({
      "location_signal": "NYC",
      "output_type": "urn:entity:movie"
    })
  };

  const fnDef = functionHandlers.find((f) => f.schema.name === item.name);
  if (!fnDef) {
    throw new Error(`No handler found for function: ${item.name}`);
  }

  let args: unknown;
  try {
    args = JSON.parse(item.arguments);
    console.log("Parsed arguments:", args);
  } catch {
    console.error("Invalid JSON arguments");
    return;
  }

  try {
    console.log("Calling function:", fnDef.schema.name, args);
    const result = await fnDef.handler(args as any);
    console.log("Raw result type:", typeof result);
    console.log("Raw result:", result.substring(0, 200) + "...");
    
    // Check if result is valid JSON
    try {
      const parsed = JSON.parse(result);
      console.log("Result parses as valid JSON");
      console.log("Number of recommendations:", parsed.recommendations?.length);
    } catch (e) {
      console.error("Result is not valid JSON:", e);
    }
    
  } catch (err: any) {
    console.error(`Error running function ${item.name}:`, err);
    console.error("Stack:", err.stack);
  }
}

simulateOpenAICall().catch(console.error);