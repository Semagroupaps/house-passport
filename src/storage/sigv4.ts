import { createHash, createHmac } from 'node:crypto';

const sha256hex = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data, 'utf8').digest();

export interface S3SignedRequest { url: string; headers: Record<string, string> }

/**
 * Signerer en S3-request med AWS Signature Version 4. Understøtter path-style
 * (MinIO/R2/Coolify) og virtual-host-style. Ingen SDK — kun node:crypto + fetch.
 */
export function signS3Request(opts: {
  method: string; endpoint: string; bucket: string; key: string;
  region: string; accessKeyId: string; secretAccessKey: string;
  body: Buffer; pathStyle: boolean; extraHeaders?: Record<string, string>;
}): S3SignedRequest {
  const endpoint = opts.endpoint.replace(/\/$/, '');
  const endpointUrl = new URL(endpoint);
  const encodedKey = opts.key.split('/').map(encodeURIComponent).join('/');

  let urlStr: string;
  let host: string;
  let canonicalUri: string;
  if (opts.pathStyle) {
    host = endpointUrl.host;
    urlStr = `${endpoint}/${opts.bucket}/${encodedKey}`;
    canonicalUri = `/${opts.bucket}/${encodedKey}`;
  } else {
    host = `${opts.bucket}.${endpointUrl.host}`;
    urlStr = `${endpointUrl.protocol}//${host}/${encodedKey}`;
    canonicalUri = `/${encodedKey}`;
  }

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(opts.body);

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  for (const [k, v] of Object.entries(opts.extraHeaders || {})) headers[k.toLowerCase()] = v;

  const signedKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedKeys.map((k) => `${k}:${headers[k].trim()}\n`).join('');
  const signedHeaders = signedKeys.join(';');
  const canonicalRequest = [opts.method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${dateStamp}/${opts.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');

  const kDate = hmac('AWS4' + opts.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, opts.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  headers['authorization'] =
    `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { url: urlStr, headers };
}
