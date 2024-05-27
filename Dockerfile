FROM node:alpine

WORKDIR .

COPY package.json index.js ./

RUN apk update && \
    apk add --no-cache bash curl && \
    chmod 755 index.js && \
    npm install -g pm2 && \
    npm install

CMD ["node", "index.js"]

EXPOSE 8080
USER 10001
