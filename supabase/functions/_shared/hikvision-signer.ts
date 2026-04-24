// HMAC-SHA256 signer para HikCentral Connect OpenAPI.
// Uso desde una Edge Function (Deno):
//
//   import { hikFetch } from '../_shared/hikvision-signer.ts';
//   const resp = await hikFetch('/artemis/api/resource/v1/person/advance/personList', {
//     method: 'POST',
//     body: { pageNo: 1, pageSize: 50 },
//   });
//
// Variables requeridas en el entorno de la Edge Function:
//   HIK_BASE_URL, HIK_API_KEY, HIK_API_SECRET

const BASE_URL = Deno.env.get('HIK_BASE_URL') ?? '';
const API_KEY = Deno.env.get('HIK_API_KEY') ?? '';
const API_SECRET = Deno.env.get('HIK_API_SECRET') ?? '';

export type HikFetchOpts = {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
};

function nonce(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

async function hmacSha256Base64(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function hikFetch<T = unknown>(path: string, opts: HikFetchOpts = {}): Promise<T> {
  if (!BASE_URL || !API_KEY || !API_SECRET) {
    throw new Error('Faltan HIK_BASE_URL / HIK_API_KEY / HIK_API_SECRET');
  }

  const method = opts.method ?? 'POST';
  const timestamp = Date.now().toString();
  const n = nonce();
  const contentType = 'application/json';
  const accept = 'application/json';

  // String-to-sign estilo Artemis/Apigateway de HikCentral.
  // Formato: METHOD\nAccept\nContent-Type\nx-ca-key:...\nx-ca-nonce:...\nx-ca-timestamp:...\nPATH
  const headersToSign = [
    `x-ca-key:${API_KEY}`,
    `x-ca-nonce:${n}`,
    `x-ca-timestamp:${timestamp}`,
  ].join('\n');
  const stringToSign = `${method}\n${accept}\n${contentType}\n${headersToSign}\n${path}`;

  const signature = await hmacSha256Base64(API_SECRET, stringToSign);

  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const resp = await fetch(url, {
    method,
    headers: {
      Accept: accept,
      'Content-Type': contentType,
      'x-ca-key': API_KEY,
      'x-ca-nonce': n,
      'x-ca-timestamp': timestamp,
      'x-ca-signature': signature,
      'x-ca-signature-headers': 'x-ca-key,x-ca-nonce,x-ca-timestamp',
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Hik API ${resp.status}: ${text}`);
  }
  return (await resp.json()) as T;
}
