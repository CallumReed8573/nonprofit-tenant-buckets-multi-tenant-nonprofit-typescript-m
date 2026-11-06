import test from "node:test";
import assert from "node:assert/strict";
import { bucketName, documentKeys, TenantRequest } from "../src/tenant_buckets.js";

test("tenant input selects an isolated bucket and three domain records", () => {
  const tenant = TenantRequest.parse({ tenantId: "harbor-help", organization: "Harbor Help" });
  assert.equal(bucketName(tenant.tenantId), "nonprofit-harbor-help");
  assert.deepEqual([
    documentKeys.receipt(tenant.tenantId),
    documentKeys.reminder(tenant.tenantId),
    documentKeys.report(tenant.tenantId),
  ], [
    "receipts/harbor-help/donor-receipt.json",
    "reminders/harbor-help/volunteer-reminder.json",
    "reports/harbor-help/campaign-report.json",
  ]);
});
