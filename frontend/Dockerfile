# cya-frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ...serve stage as before
FROM caddy:2-alpine
COPY --from=build /app/dist /usr/share/caddy
RUN printf ":3001 {\n\troot * /usr/share/caddy\n\tfile_server\n\ttry_files {path} /index.html\n}\n" > /etc/caddy/Caddyfile
EXPOSE 3001