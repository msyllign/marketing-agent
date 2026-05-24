FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package.json .npmrc ./
RUN npm install --legacy-peer-deps

# Build TypeScript
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# Create required runtime directories
RUN mkdir -p uploads approved_messages

EXPOSE 5000
ENV PORT=5000
CMD ["node", "dist/index.js"]
