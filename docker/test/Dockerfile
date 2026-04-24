FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
COPY . .
RUN npm install --ignore-scripts --no-save

FROM build AS test

WORKDIR /test
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
RUN npm install -g vitest
COPY --from=build /app/server ./server
RUN cp /app/server/services/*.ts ./services/ && \
    cp /app/server/tests/*.test.ts ./tests/ && \
    cp /app/vitest.setup.ts . && \
    cp /app/vitest.config.ts .

CMD ["npx", "vitest", "run"]
