import { z } from "zod";
import { infrai } from "./infrai.js";

export const TenantRequest = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]+$/),
  organization: z.string().min(1),
});

export type TenantRequest = z.infer<typeof TenantRequest>;
export const bucketName = (tenantId: string): string => `nonprofit-${tenantId}`;

export const documentKeys = {
  receipt: (tenantId: string) => `receipts/${tenantId}/donor-receipt.json`,
  reminder: (tenantId: string) => `reminders/${tenantId}/volunteer-reminder.json`,
  report: (tenantId: string) => `reports/${tenantId}/campaign-report.json`,
};

export async function provisionTenant(input: unknown) {
  const tenant = TenantRequest.parse(input);
  const bucket = bucketName(tenant.tenantId);
  await infrai.storage.bucket.create({ name: bucket });
  try {
    const credential = await infrai.account.keys.create({
      name: `tenant-${tenant.tenantId}`,
      scopes: ["storage"],
      idempotency_key: `tenant-${tenant.tenantId}`,
    });
    const credentialId = String(credential.id ?? "");
    if (!credentialId) throw new Error("The account key response did not include an id");
    return { tenant, bucket, credentialId };
  } catch (error) {
    try {
      await infrai.storage.bucket.delete(bucket);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Provisioning and bucket cleanup failed");
    }
    throw error;
  }
}

export async function issueUploadUrl(tenantId: string, kind: keyof typeof documentKeys) {
  const bucket = bucketName(TenantRequest.shape.tenantId.parse(tenantId));
  const key = documentKeys[kind](tenantId);
  const result = await infrai.storage.object.presign(bucket, key, {
    op: "put",
    expires_seconds: 600,
    content_type: "application/json",
    idempotency_key: `${tenantId}-${kind}`,
  });
  return { bucket, key, url: result.url };
}

export async function offboardTenant(tenantId: string, credentialId: string) {
  const validTenantId = TenantRequest.shape.tenantId.parse(tenantId);
  const results = await Promise.allSettled([
    infrai.storage.bucket.delete(bucketName(validTenantId)),
    infrai.account.keys.revoke(credentialId),
  ]);
  const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
  if (errors.length) throw new AggregateError(errors, "Tenant offboarding failed");
  return { tenantId: validTenantId, removed: true };
}
