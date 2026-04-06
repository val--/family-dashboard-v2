FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_WEATHER_API_KEY
ARG VITE_WEATHER_CITY=Paris
ARG VITE_WEATHER_UNITS=metric
ARG VITE_WEATHER_LANG=fr
ARG VITE_API_URL=http://localhost:5100
ENV VITE_WEATHER_API_KEY=$VITE_WEATHER_API_KEY \
    VITE_WEATHER_CITY=$VITE_WEATHER_CITY \
    VITE_WEATHER_UNITS=$VITE_WEATHER_UNITS \
    VITE_WEATHER_LANG=$VITE_WEATHER_LANG \
    VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
