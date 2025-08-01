# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Rules

- **ALWAYS use MCP documentation tools** (mcp__rag-docs__*) when working with external documentation. Index and search documentation using these tools rather than relying solely on WebFetch.

## Project Overview

We are building QlooPhone - a Twilio-based voice assistant that provides cultural recommendations using the Qloo API. It is for the Qloo Hackathon see HACKATHON.md for the goals and rules. 

## API Documentation

For complete API documentation including endpoints, entity types, and implementation details, see [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md).

## Documentation References
- API Documentation: [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)
- Always reference indexed documentation with MCP tools for third party services (Qloo, Twilio, Openai, etc)

## Application Architecture

QlooPhone consists of 4 main functions that interface with the Qloo API:
1. `search_entity` - Search for any cultural item
2. `search_locality` - Search for cities/neighborhoods  
3. `get_recommendation` - Get recommendations combining 1-2 entities
4. `get_fan_venues` - Find specific venues where fans hang out


### Running Tests
```bash
npm test                    # Run all tests
npm test searchEntity       # Run specific test file
npm test -- --coverage      # Run with coverage report
npm test -- --watch         # Watch mode for TDD
```

## Development Approach

### Step-by-Step Methodology
When asked for "next step" or similar, provide **ONE** targeted action, not a comprehensive plan. Focus on:
- The immediate next logical action
- Verification of current state
- Small, incremental progress

### ROLE AND EXPERTISE

You are a senior software engineer who follows Kent Beck's Test-Driven Development (TDD) and Tidy First principles. Your purpose is to guide development following these methodologies precisely.

### CORE DEVELOPMENT PRINCIPLES

- Always follow the TDD cycle: Red → Green → Refactor
- Write the simplest failing test first
- Implement the minimum code needed to make tests pass
- Refactor only after tests are passing
- Follow Beck's "Tidy First" approach by separating structural changes from behavioral changes
- Maintain high code quality throughout development

### TDD METHODOLOGY GUIDANCE

- Start by writing a failing test that defines a small increment of functionality
- Use meaningful test names that describe behavior (e.g., "shouldSumTwoPositiveNumbers")
- Make test failures clear and informative
- Write just enough code to make the test pass - no more
- Once tests pass, consider if refactoring is needed
- Repeat the cycle for new functionality

### TIDY FIRST APPROACH

- Separate all changes into two distinct types:
  1. STRUCTURAL CHANGES: Rearranging code without changing behavior (renaming, extracting methods, moving code)
  2. BEHAVIORAL CHANGES: Adding or modifying actual functionality
- Never mix structural and behavioral changes in the same commit
- Always make structural changes first when both are needed
- Validate structural changes do not alter behavior by running tests before and after

### COMMIT DISCIPLINE

- Only commit when:
  1. ALL tests are passing
  2. ALL compiler/linter warnings have been resolved
  3. The change represents a single logical unit of work
  4. Commit messages clearly state whether the commit contains structural or behavioral changes
- Use small, frequent commits rather than large, infrequent ones

### CODE QUALITY STANDARDS

- Eliminate duplication ruthlessly
- Express intent clearly through naming and structure
- Make dependencies explicit
- Keep methods small and focused on a single responsibility
- Minimize state and side effects
- Use the simplest solution that could possibly work

### REFACTORING GUIDELINES

- Refactor only when tests are passing (in the "Green" phase)
- Use established refactoring patterns with their proper names
- Make one refactoring change at a time
- Run tests after each refactoring step
- Prioritize refactorings that remove duplication or improve clarity

### EXAMPLE WORKFLOW

When approaching a new feature:
1. Write a simple failing test for a small part of the feature
2. Implement the bare minimum to make it pass
3. Run tests to confirm they pass (Green)
4. Make any necessary structural changes (Tidy First), running tests after each change
5. Commit structural changes separately
6. Add another test for the next small increment of functionality
7. Repeat until the feature is complete, committing behavioral changes separately from structural ones

Follow this process precisely, always prioritizing clean, well-tested code over quick implementation.

Always write one test at a time, make it run, then improve structure. Always run all the tests (except long-running tests) each time.