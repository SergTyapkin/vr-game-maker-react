# Build WebXR app
FROM node:22-alpine AS builder

WORKDIR /app

# configure npm gitlab registry access
ARG GITLAB_NPM_REGISTRY_ACCESS_TOKEN

# download packages
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && \
    pnpm config set @widgets:registry https://git.sberrobots.ru/api/v4/groups/3503/-/packages/npm/ && \
    pnpm config set //git.sberrobots.ru/api/v4/groups/3503/-/packages/npm/:_authToken ${GITLAB_NPM_REGISTRY_ACCESS_TOKEN} && \
    pnpm config set //git.sberrobots.ru/api/v4/projects/2364/packages/npm/:_authToken ${GITLAB_NPM_REGISTRY_ACCESS_TOKEN} && \
    pnpm config set //git.sberrobots.ru/api/v4/packages/npm/:_authToken ${GITLAB_NPM_REGISTRY_ACCESS_TOKEN} && \
    pnpm install

# build project
COPY . .
RUN pnpm build

# Static hosting via nginx
FROM nginx:alpine

RUN apk add bash

# Копируем собранное приложение
COPY --from=builder /app/out /usr/share/nginx/html

# Nginx конфиг
COPY ./docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Исправленный скрипт для подмены переменных окружения (runtime)
COPY ./docker/10-replace-env.sh /docker-entrypoint.d/10-replace-env.sh
RUN chmod +x /docker-entrypoint.d/10-replace-env.sh

# Сертификаты
COPY ./certificates/localhost.pem /etc/nginx/certs/localhost.pem
COPY ./certificates/localhost-key.pem /etc/nginx/certs/localhost-key.pem