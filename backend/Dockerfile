FROM node:24-alpine AS dependencies
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS service-base
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node backend/package.json ./package.json
COPY --chown=node:node backend/src/createServiceApp.js ./src/createServiceApp.js
COPY --chown=node:node backend/src/db/pool.js ./src/db/pool.js
USER node
EXPOSE 3000

FROM service-base AS catalog
COPY --chown=node:node backend/src/catalogServer.js ./src/catalogServer.js
COPY --chown=node:node backend/src/internalServiceAuth.js ./src/internalServiceAuth.js
COPY --chown=node:node backend/src/routes/productRoutes.js ./src/routes/productRoutes.js
COPY --chown=node:node backend/src/services/productService.js ./src/services/productService.js
CMD ["node", "src/catalogServer.js"]

FROM service-base AS identity
COPY --chown=node:node backend/src/identityServer.js ./src/identityServer.js
COPY --chown=node:node backend/src/internalServiceAuth.js ./src/internalServiceAuth.js
COPY --chown=node:node backend/src/routes/authRoutes.js ./src/routes/authRoutes.js
COPY --chown=node:node backend/src/routes/internalIdentityRoutes.js ./src/routes/internalIdentityRoutes.js
COPY --chown=node:node backend/src/services/authService.js ./src/services/authService.js
CMD ["node", "src/identityServer.js"]

FROM service-base AS orders
COPY --chown=node:node backend/src/ordersServer.js ./src/ordersServer.js
COPY --chown=node:node backend/src/routes/orderRoutes.js ./src/routes/orderRoutes.js
COPY --chown=node:node backend/src/middleware/requireCustomer.js ./src/middleware/requireCustomer.js
COPY --chown=node:node backend/src/services/orderService.js ./src/services/orderService.js
CMD ["node", "src/ordersServer.js"]

FROM service-base AS delivery
COPY --chown=node:node backend/src/deliveryServer.js ./src/deliveryServer.js
COPY --chown=node:node backend/src/routes/deliveryRoutes.js ./src/routes/deliveryRoutes.js
CMD ["node", "src/deliveryServer.js"]

FROM postgres:17-alpine AS migrator
WORKDIR /migrations
COPY backend/src/db/ ./
CMD ["sh", "/migrations/migrate.sh"]
