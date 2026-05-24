FROM node:18-alpine
WORKDIR /app

# Install deps
COPY package.json .npmrc ./
RUN npm install --legacy-peer-deps

# Build React app
COPY . .
RUN npm run build

# Serve static build
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "serve", "-s", "build", "-l", "tcp://0.0.0.0:3000"]
