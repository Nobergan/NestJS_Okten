FROM node:20-alpine

LABEL maintainer='Some DEV'

RUN mkdir /app
WORKDIR /app

COPY package.json ./
RUN npm i --production

COPY dist/ ./dist