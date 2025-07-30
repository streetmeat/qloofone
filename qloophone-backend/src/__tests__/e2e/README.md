# Real End-to-End Conversation Tests

This directory contains true end-to-end tests that simulate the exact user experience with real APIs.

## Overview

Unlike the mocked tests, these tests:
- Connect to the **real OpenAI Realtime API**
- Make **real Qloo API calls**
- Test **all 36 entity combinations**
- Simulate complete conversation flows
- Measure actual performance and latency

## Requirements

1. **Valid API Keys**
   - `OPENAI_API_KEY` - Must have Realtime API access
   - `QLOO_API_KEY` - Valid Qloo hackathon API key

2. **Environment Setup**
   ```bash
   # In .env file
   OPENAI_API_KEY=your-real-openai-key
   QLOO_API_KEY=your-real-qloo-key
   ```

3. **Cost Warning**
   - Each full test run costs approximately $0.06 in API fees
   - Individual tests cost ~$0.002 each

## Running the Tests

### Full Comprehensive Test (All 216 Combinations)
```bash
npm run test:real
```

This will test EVERY possible combination:
- 6 entity types × 6 entity types = 36 input pairs
- Each pair × 6 possible outputs = **216 total combinations**
- Estimated time: ~25 minutes
- Estimated cost: ~$0.43 in API fees

### Test Subsets (Faster & Cheaper)

```bash
# Test only unique input pairs (36 combinations)
TEST_SUBSET=unique-outputs npm run test:real

# Test specific input combination (6 outputs)
TEST_SUBSET=movie-music npm run test:real

# Test all combinations with specific output (36 combinations)
TEST_SUBSET=tv_show npm run test:real

# Test first N combinations
TEST_SUBSET=10 npm run test:real
```

### Individual Test Files
```bash
# Run specific test file
npx jest src/__tests__/e2e/realConversation.test.ts

# Run with verbose output
npx jest src/__tests__/e2e/realConversation.test.ts --verbose
```

## Test Output Example

```
🚀 Starting Comprehensive Real Conversation Tests
================================================

API Keys: ✅ OPENAI_API_KEY, ✅ QLOO_API_KEY
Generated 216 total combinations
Testing 216 entity combinations

[1/216] movie + movie → movie... ✅ (8.2s)
[2/216] movie + movie → music... ✅ (7.1s)
[3/216] movie + movie → tv_show... ✅ (6.5s)
[4/216] movie + movie → book... ✅ (7.8s)
[5/216] movie + movie → podcast... ✅ (6.9s)
[6/216] movie + movie → video_game... ✅ (8.1s)
[7/216] movie + music → movie... ✅ (7.3s)
...

================================================
TEST SUMMARY
================================================
Total Tests: 216
Passed: 210
Failed: 6
Success Rate: 97.2%
Total Duration: 1623.5s
Average per Test: 7.5s

⏱️  PERFORMANCE ANALYSIS:
Slowest combinations:
   - book + video_game → podcast: 11.2s
   - music + podcast → movie: 10.9s
   - tv_show + book → video_game: 10.4s
```

## What's Being Tested

### 1. Complete Conversation Flow
- Twilio WebSocket connection
- OpenAI session initialization
- Greeting reception
- User input processing
- Function calling (search_entity, get_recommendation)
- Response generation

### 2. All 216 Entity Combinations
Tests EVERY possible combination:
- **Input combinations**: movie+movie, movie+music, movie+tv_show, etc. (36 pairs)
- **Output types**: Each pair tested with ALL 6 output types
- **Examples**:
  - movie + music → movie
  - movie + music → music  
  - movie + music → tv_show
  - movie + music → book
  - movie + music → podcast
  - movie + music → video_game
- Validates correct function calling for each combination
- Ensures personalized recommendations work across all permutations

### 3. Performance Metrics
- Time to first response
- Total conversation duration
- Function call latency
- End-to-end response time (<6s target)

### 4. Error Scenarios
- Non-existent entities
- API failures
- Timeout handling
- Recovery mechanisms

## Test Data

Each entity type has 9 popular examples:
- **Movies**: The Matrix, Inception, Pulp Fiction, etc.
- **Music**: The Beatles, Radiohead, Pink Floyd, etc.
- **TV Shows**: Breaking Bad, The Wire, Game of Thrones, etc.
- **Books**: 1984, To Kill a Mockingbird, Dune, etc.
- **Podcasts**: This American Life, Serial, Radiolab, etc.
- **Video Games**: Zelda, Portal, The Witcher 3, etc.

## Understanding Results

### Success Criteria
- ✅ Correct output_type used
- ✅ Valid entity searches completed
- ✅ Recommendation received
- ✅ Response time under 10s

### Common Failures
- API rate limiting
- Entity not found in Qloo database
- OpenAI function calling timeout
- Network connectivity issues

## Debugging

### Enable Verbose Logging
```bash
DEBUG=* npm run test:real
```

### Check Specific Combination
Look in the generated `real-test-results-{timestamp}.json` for:
- Full transcripts
- Function call details
- Exact error messages
- Timing breakdowns

### Common Issues

1. **"No greeting received"**
   - OpenAI connection failed
   - Check API key has Realtime access

2. **"Wrong output type"**
   - Function calling logic issue
   - Check sessionManager.ts implementation

3. **"Timeout waiting for function call"**
   - Slow API response
   - Network latency
   - Increase timeout values

## Cost Optimization

To reduce API costs while testing:

1. **Test Subset**
   ```typescript
   // In comprehensiveRealTest.ts
   ENTITY_COMBINATIONS.slice(0, 5) // Test first 5 only
   ```

2. **Use Mock Tests First**
   ```bash
   npm test comprehensiveConversation.test.ts
   ```

3. **Test Specific Combinations**
   Modify the test to only run problematic combinations

## CI/CD Considerations

These tests should NOT run in CI/CD pipelines because:
- They require real API keys
- They incur real costs
- They depend on external services
- They take 4-5 minutes to complete

Instead, use the mocked `comprehensiveConversation.test.ts` for CI/CD.