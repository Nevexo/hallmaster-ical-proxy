# hallmaster-ical-proxy
# Dockerfile using Bun runtime.

FROM oven/bun:1 as base
WORKDIR /app

# copy the source code
COPY . .

# install dependencies
RUN bun install --production

# run the app
ENTRYPOINT [ "bun", "run", "index.js" ]