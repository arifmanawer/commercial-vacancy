FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port 5000
EXPOSE 5000

# Run dev server with hot reload (ts-node-dev has --respawn built-in)
CMD ["npm", "run", "dev"]
