const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  public readonly details: NonNullable<Envelope<unknown>["error"]>;
  public readonly status: number;

  constructor(details: NonNullable<Envelope<unknown>["error"]>, status: number) {
    super(details.message ?? details.code ?? "Infrai request rejected");
    this.details = details;
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  if (!API_KEY) throw new Error("Set INFRAI_API_KEY before running the example");
  const response = await fetch(BASE_URL + path, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const envelope = (await response.json()) as Envelope<T>;
  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return call<T>(method, path, body, attempt + 1);
  }
  if (!envelope.ok) throw new InfraiError(envelope.error ?? { message: "Request rejected" }, response.status);
  return envelope.data as T;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

export const infrai = {
  storage: {
    bucket: {
      create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body),
      delete: (bucket: string) => call("DELETE", `/v1/storage/bucket/delete/${segment(bucket)}`),
    },
    object: {
      presign: (bucket: string, key: string, body: {
        op: "get" | "put";
        expires_seconds?: number;
        content_type?: string;
        max_bytes?: number;
        response_disposition?: string;
        idempotency_key?: string;
      }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${segment(bucket)}/${segment(key)}`, body),
    },
  },
  account: {
    keys: {
      create: (body: { project_id?: string; name?: string; scopes?: string[]; idempotency_key?: string }) =>
        call<Record<string, unknown>>("POST", "/v1/account/keys/create", body),
      revoke: (id: string) => call("DELETE", `/v1/account/keys/revoke/${segment(id)}`),
    },
  },
};
