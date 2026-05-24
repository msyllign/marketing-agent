FROM node:18-alpine
WORKDIR /app

# Install deps
COPY package.json .npmrc ./
RUN npm install --legacy-peer-deps

# Build React app — pass backend URL at build time so CRA bakes it in
COPY . .
ARG REACT_APP_API_URL=https://marketing-agent-production-3f2a.up.railway.app/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# Serve static build
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "serve", "-s", "build", "-l", "tcp://0.0.0.0:3000"]
