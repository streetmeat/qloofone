#!/usr/bin/env node
import * as dotenv from 'dotenv';
import WebSocket from 'ws';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

// Simple test focused on the core functionality
async function testRealConversation() {
  console.log('Starting Real API Test...\n');
  
  // Check API keys
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'test-key' ||
      !process.env.QLOO_API_KEY || process.env.QLOO_API_KEY === 'test-key') {
    console.error('❌ Real API keys required');
    process.exit(1);
  }
  
  // Start server
  process.env.PORT = '8083';
  const { server } = await import('../../server');
  await new Promise(resolve => server.once('listening', resolve));
  const port = (server.address() as any).port;
  
  console.log(`✅ Server running on port ${port}\n`);
  
  // Connect frontend monitor
  const frontendWs = new WebSocket(`ws://localhost:${port}/logs`);
  await new Promise(resolve => frontendWs.once('open', resolve));
  console.log('✅ Frontend monitor connected');
  
  // Track events
  const events: any[] = [];
  let greetingReceived = false;
  let functionCalls: any[] = [];
  let errors: any[] = [];
  
  frontendWs.on('message', (data) => {
    const event = JSON.parse(data.toString());
    events.push(event);
    
    // Log key events
    if (event.type === 'session.created') {
      console.log('📞 Session created');
    } else if (event.type === 'session.updated') {
      console.log('🔧 Session updated with', event.session?.tools?.length || 0, 'tools');
    } else if (event.type === 'response.done') {
      console.log('💬 Response completed');
      if (!greetingReceived) {
        greetingReceived = true;
        console.log('✅ Greeting sent (audio response)');
      }
    } else if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
      functionCalls.push(event.item);
      console.log(`🔍 Function called: ${event.item.name}`);
    } else if (event.type === 'error') {
      errors.push(event.error);
      console.error('❌ Error:', event.error?.message || 'Unknown error');
    }
  });
  
  // Connect Twilio call
  const twilioWs = new WebSocket(`ws://localhost:${port}/call`);
  await new Promise(resolve => twilioWs.once('open', resolve));
  console.log('✅ Twilio connection established\n');
  
  // Start call
  twilioWs.send(JSON.stringify({
    event: 'start',
    start: {
      streamSid: 'real-test-' + Date.now(),
      accountSid: 'ACtest',
      callSid: 'CAtest',
      tracks: ['inbound', 'outbound']
    }
  }));
  
  await new Promise(resolve => setTimeout(resolve, 100));
  twilioWs.send(JSON.stringify({ event: 'connected' }));
  
  // Wait for greeting
  console.log('⏳ Waiting for greeting...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  if (!greetingReceived) {
    console.log('⚠️  No greeting received, continuing anyway...\n');
  }
  
  // Send user input
  console.log('🎤 Sending user input...');
  twilioWs.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: 'I love The Matrix and Radiohead. What TV show should I watch?'
      }]
    }
  }));
  
  // Trigger response
  twilioWs.send(JSON.stringify({
    type: 'response.create'
  }));
  
  // Wait for function calls
  console.log('⏳ Waiting for function calls...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Results
  console.log('\n================================================');
  console.log('TEST RESULTS');
  console.log('================================================');
  console.log(`Total Events: ${events.length}`);
  console.log(`Greeting Received: ${greetingReceived ? '✅' : '❌'}`);
  console.log(`Function Calls: ${functionCalls.length}`);
  console.log(`Errors: ${errors.length}`);
  
  if (functionCalls.length > 0) {
    console.log('\nFunction Calls Made:');
    functionCalls.forEach(fc => {
      console.log(`  - ${fc.name}: ${fc.arguments}`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(err => {
      console.log(`  - ${err.message || err}`);
    });
  }
  
  // Save detailed results
  const resultsPath = path.join(__dirname, `simple-test-results-${Date.now()}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    greetingReceived,
    functionCallsCount: functionCalls.length,
    functionCalls,
    errorsCount: errors.length,
    errors,
    totalEvents: events.length,
    eventTypes: [...new Set(events.map(e => e.type))]
  }, null, 2));
  
  console.log(`\nDetailed results saved to: ${resultsPath}`);
  
  // Cleanup
  twilioWs.close();
  frontendWs.close();
  server.close();
  
  // Success criteria
  const success = greetingReceived && functionCalls.length >= 2 && errors.length === 0;
  console.log(`\nTest Result: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  
  process.exit(success ? 0 : 1);
}

testRealConversation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});