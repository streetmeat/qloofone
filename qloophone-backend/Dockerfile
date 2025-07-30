FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source files
COPY tsconfig.json ./
COPY src ./src

# Install TypeScript for build
RUN npm install -D typescript @types/node

# Build the application
RUN npm run build

# Expose port
EXPOSE 8081

# Start the server
CMD ["node", "dist/server.js"]