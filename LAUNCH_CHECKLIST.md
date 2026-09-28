# OrgChai launch checklist

## Domain and Firebase

- [ ] Verify `orgchai.com` DNS and TLS on the production web service.
- [ ] Set the production `NEXT_PUBLIC_APP_URL` to `https://orgchai.com`.
- [ ] Add `orgchai.com` and the deployed host to Firebase Authentication authorized domains.
- [ ] Confirm the Firebase OAuth provider and popup callback handler in the production project.
- [ ] Set production `CORS_ORIGIN` to the exact HTTPS origins that call the API.

## Railway services

- [ ] Deploy the API from `api/Dockerfile` and the web service from `web/Dockerfile`.
- [ ] Set production secrets in Railway variables, including API keys, Firebase Admin credentials, database URLs, and Slack tokens.
- [ ] Configure `/api/health` for the API and `/` for the web service as health checks.
- [ ] Enable service logs, failure restart policy, and the intended deployment branch.

## Data and rollback

- [ ] Provision PostgreSQL with pgvector and run the checked-in Prisma migration from a controlled release step.
- [ ] Configure database backups and test restore before accepting production documents.
- [ ] Attach persistent storage for documents, connector state, audit data, and embeddings, or move those stores to managed services.
- [ ] Keep the `opsmate` Python package and existing data paths available until the OrgChai deployment is verified.
- [ ] Record the release version, migration result, backup timestamp, and rollback target.

## Access and operations

- [ ] Rotate local development API keys and production secrets before launch.
- [ ] Confirm administrator emails, organization claim settings, SSO provider, and SCIM bearer token.
- [ ] Configure Slack app name, `/orgchai` command, mention guidance, allowed channels, and required scopes.
- [ ] Verify admin access, sign-in, search, source links, document deletion, exports, and audit events in production.
- [ ] Record error monitoring ownership and the rollback contact.
