FROM node:24 AS build

WORKDIR /build

COPY package*.json ./
RUN npm install

COPY . .
ARG VITE_SERVER_ADDR
ENV VITE_SERVER_ADDR=$VITE_SERVER_ADDR
RUN npm run build

FROM nginx:stable
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80
CMD [ "nginx", "-g", "daemon off;" ]
