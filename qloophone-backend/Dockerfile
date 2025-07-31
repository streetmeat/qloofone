FROM node:18-alpine

WORKDIR /app

# Copy package files from the backend directory
COPY qloophone-backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source files from the backend directory
COPY qloophone-backend/tsconfig.json ./
COPY qloophone-backend/src ./src

# Install TypeScript for build
RUN npm install -D typescript @types/node

# Build the application
RUN npm run build

# Expose port
EXPOSE 8081

# Start the server
CMD ["node", "dist/server.js"]