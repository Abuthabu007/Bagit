# Bagit microservices

Bagit now runs four independently deployable backend services:

| Service | Owns | Public API |
| --- | --- | --- |
| Catalog | Product catalogue, categories, and inventory | `/api/products` |
| Identity | Customers, addresses, OTP challenges, and sessions | `/api/auth` |
| Orders | Orders and order items | `/api/orders` |
| Delivery | Demo PIN-code serviceability | `/api/delivery` |

The React/Nginx frontend is the public entry point. Nginx routes each API path to
the corresponding service. Backend services use private service names and do not
expose their ports to the host in Compose or through the Kubernetes Ingress.

## Service-to-service flow

- Orders asks Identity to validate the browser session before reading or
  creating orders.
- Orders asks Catalog to reserve inventory. If saving the order fails, Orders
  asks Catalog to release the reservation.
- Identity asks Delivery whether a PIN code is serviceable during signup.
- Internal calls use `INTERNAL_SERVICE_TOKEN`; public frontend requests do not
  receive this token.
- Compose has a predictable local-only fallback token. Set a random
  `INTERNAL_SERVICE_TOKEN` in the ignored local `.env` file before using
  anything beyond local practice; never deploy that fallback.

This order/inventory interaction is a learning-sized compensation pattern. It
does not yet implement durable idempotency or a message broker, so it should
not be treated as a production payment or inventory workflow.

## Local data ownership

For local practice, one PostgreSQL server is used with separate schemas:
`catalog`, `identity`, and `orders`. Each database-backed service sets its
`PGSCHEMA`, and existing tables are moved into those schemas by migration
`009_service_boundaries.sql`. The migration moves the existing tables rather
than deleting/reseeding them. Delivery is currently stateless and needs no
database.

This teaches service ownership without running several database servers on a
developer machine. The Compose stack still uses one database account with
access to all schemas; for a production deployment, use per-service database
roles/credentials or separate databases and narrowly scoped AWS Secrets
Manager/Pod Identity access.

## Run locally

From the repository root:

```powershell
docker compose up --build -d
docker compose ps
```

Open <http://localhost:8080>. The one-shot `db-migrate` service completes
before the database-backed services start. View a service's logs with:

```powershell
docker compose logs -f orders
```

Stop the containers without deleting the database volume:

```powershell
docker compose stop
```

Do not use `docker compose down -v` if you want to keep local database data.

## Kubernetes and EKS

`k8s/base` contains Deployments and internal ClusterIP Services for the four
backend services, the frontend, a database migration Job, and an ALB Ingress.
The database itself is expected to be PostgreSQL reachable at `PGHOST` (for
AWS, normally a private RDS endpoint). Create the `bagit-database` Secret with
the database connection variables and `bagit-service-auth` Secret with the
`internal-service-token` key before applying the resources. Do not commit secret
values. For AWS, prefer Secrets Manager with EKS Pod Identity or IRSA.

The image names in the manifests are local placeholders; publish the five
application images and the `bagit-db-migrate` image to ECR and update them
before deploying to EKS. The ALB Ingress also requires AWS Load Balancer
Controller and a real DNS name. TLS/ACM configuration is intentionally left
for the infrastructure step.

Run the database migration Job and wait for it to complete before applying the
application Deployments:

```powershell
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/migrations.yaml
kubectl wait --for=condition=complete job/bagit-db-migrate --timeout=180s
kubectl apply -k k8s/base
```

The database Secret must already exist for the migration Job. The service-auth
Secret must exist before the Catalog, Identity, and Orders pods start.
