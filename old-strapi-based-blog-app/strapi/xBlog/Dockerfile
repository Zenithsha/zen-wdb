FROM node:20-alpine

# libvips is required by Strapi's sharp-based image processing on alpine
RUN apk add --no-cache vips-dev python3 make g++

WORKDIR /opt/app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

ENV NODE_ENV=development
EXPOSE 1337

CMD ["npm", "run", "develop"]
