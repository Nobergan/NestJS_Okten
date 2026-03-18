FROM node:20-alpine

LABEL maintainer='Some DEV'

RUN mkdir /app
WORKDIR /app

COPY backend/package.json ./
RUN npm i --production
RUN npm i -g @nestjs/cli