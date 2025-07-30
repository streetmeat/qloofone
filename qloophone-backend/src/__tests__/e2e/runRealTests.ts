#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Check for required API keys
const requiredKeys = ['OPENAI_API_KEY', 'QLOO_API_KEY'];
const missingKeys = requiredKeys.filter(key => 
  !process.env[key] || process.env[key] === 'test-key'
);

if (missingKeys.length > 0) {
  console.error('❌ Missing required API keys for real tests:');
  missingKeys.forEach(key => console.error(`   - ${key}`));
  console.error('\nTo run real conversation tests, you need:');
  console.error('1. Valid OPENAI_API_KEY with Realtime API access');
  console.error('2. Valid QLOO_API_KEY');
  console.error('\nSet these in your .env file or environment variables.');
  process.exit(1);
}

console.log('✅ API keys found. Starting real conversation tests...\n');
console.log('⚠️  WARNING: This will make real API calls and incur costs!');
console.log('   Estimated cost: ~$0.06 per full test run\n');

// Allow user to cancel
console.log('Starting in 3 seconds... Press Ctrl+C to cancel');
setTimeout(() => {
  console.log('Running tests...\n');
  
  // Run the specific test file
  const testPath = path.join(__dirname, 'realConversation.test.ts');
  const jest = spawn('npx', ['jest', testPath, '--runInBand', '--verbose'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  jest.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Real conversation tests completed successfully!');
    } else {
      console.log('\n❌ Real conversation tests failed');
    }
    process.exit(code || 0);
  });
}, 3000);