FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port 5001
EXPOSE 5001

# Run backend without file watchers (ts-node-dev watch can deadlock in containers)
CMD ["node", "-r", "ts-node/register/transpile-only", "src/index.ts"]
