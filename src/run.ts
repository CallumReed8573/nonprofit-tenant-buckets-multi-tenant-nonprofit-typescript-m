import { provisionTenant, issueUploadUrl, offboardTenant } from "./tenant_buckets.js";

const input = {
  tenantId: process.env.TENANT_ID ?? "harbor-help",
  organization: process.env.ORGANIZATION ?? "Harbor Help",
};

const provisioned = await provisionTenant(input);
try {
  const upload = await issueUploadUrl(input.tenantId, "receipt");
  console.log(JSON.stringify({
    tenant: provisioned.tenant.tenantId,
    bucket: provisioned.bucket,
    credentialId: provisioned.credentialId,
    receiptUploadUrl: upload.url,
    next: "PUT JSON bytes to receiptUploadUrl",
  }, null, 2));
} catch (error) {
  try {
    await offboardTenant(provisioned.tenant.tenantId, provisioned.credentialId);
  } catch (cleanupError) {
    throw new AggregateError([error, cleanupError], "Upload URL creation and cleanup failed");
  }
  throw error;
}
