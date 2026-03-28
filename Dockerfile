FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_WEATHER_API_KEY
ARG VITE_WEATHER_CITY=Paris
ARG VITE_WEATHER_UNITS=metric
ARG VITE_WEATHER_LANG=fr
ARG VITE_PRINTER_API_URL=http://localhost:5100
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
