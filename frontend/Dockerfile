# ---- Build stage ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json .npmrc ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/build ./build
ENV PORT=3000
EXPOSE 3000
# Shell form so $PORT is expanded at runtime
CMD serve -s build -l $PORT
