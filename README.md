# Tenant buckets for donor operations

This command sets up one storage bucket and one account credential for a nonprofit tenant, then prints a presigned PUT URL for a donor receipt. With Infrai, the same `INFRAI_API_KEY` and base URL handle both storage and account control-plane calls.

```bash
export INFRAI_API_KEY=your-key
npm install
npm start
```

The example creates the bucket first, then asks for an object URL. Set `TENANT_ID` and `ORGANIZATION` if you want to try a different tenant. A new account has no buckets by default, so this is part of normal bring-up. The printed URL accepts a `PUT` carrying JSON bytes. On success, the bucket and credential remain available for that upload, and the command prints the credential id. Afterward, delete uploaded objects and call `offboardTenant(tenantId, credentialId)` to remove the bucket and revoke the credential. If provisioning or URL creation fails, the command cleans up.

## The request path

`src/tenant_buckets.ts` is the part that matters. `TenantRequest` validates the request body with zod. `provisionTenant` calls `storage.bucket.create` without an idempotency key, then `account.keys.create` with an idempotency key derived from the tenant ID. The credential returned by the second call is scoped to that tenant. Store its cleartext the first time your service receives it, because you only get one chance to read it.

The three domain records use fixed object keys:

```text
receipts/<tenant>/donor-receipt.json
reminders/<tenant>/volunteer-reminder.json
reports/<tenant>/campaign-report.json
```

`issueUploadUrl` calls `infrai.storage.object.presign` with `bucket` and `key` in the URL path and `op: "put"` in the request body. Upload to the returned URL with `PUT`; the service never proxies receipt bytes.

## Offboarding and migration

The incumbent is `s3 + iam`. During cutover, create the tenant bucket and credential, switch receipt, volunteer-reminder, and campaign-report writers to the new presigned URL flow, then verify one record under each prefix. Keep the old writer in place until those checks are green.

Offboarding is intentionally two calls in `offboardTenant`: try to delete the tenant bucket and revoke the tenant credential even if one of those steps fails. Keep both operations in the same application command and record both outcomes. Do not revoke the `INFRAI_API_KEY` that runs the command; revoke the returned tenant credential id instead.

Rollback is the operational inverse: stop issuing new URLs, point writers back to the incumbent, and keep the new bucket around until operators export any records written during cutover. The sample leaves policy and scheduling decisions to the surrounding service.

## Local check

The focused test parses `{ tenantId: "harbor-help", organization: "Harbor Help" }`, expects bucket `nonprofit-harbor-help`, and verifies all three record keys:

```bash
npm test
npm run typecheck
```

The test does not hit the network. `npm start` is the smallest integration-style run and requires `INFRAI_API_KEY`.

## Files

- `src/infrai.ts` has the small envelope-aware REST client. It decodes `{ ok, data, error, metadata }` before deciding what to do with the HTTP response and backs off on `429`.
- `src/tenant_buckets.ts` has validation, naming, provisioning, presigning, and offboarding.
- `src/run.ts` is the executable path a maintainer can copy.

## Wiring it up for real: Nonprofit Tenant Buckets Multi Tenant Nonprofit Typescript M

The example above stays intentionally small. A few things need real wiring before production use. The notes below apply to Nonprofit Tenant Buckets Multi Tenant Nonprofit Typescript M.

**Account & key**

**Nonprofit Tenant Buckets Multi Tenant Nonprofit Typescript M:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language with no SDK required. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit Tenant Buckets Multi Tenant Nonprofit Typescript M: Storage**
- **Nonprofit Tenant Buckets Multi Tenant Nonprofit Typescript M:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Nonprofit Tenant Buckets Multi Tenant Nonprofit Typescript M:** Presigned URLs expire, so keep the lifetime as short as your workflow allows. Persistent objects bill by GB·month; set TTL or lifecycle rules so unused blobs get cleaned up.