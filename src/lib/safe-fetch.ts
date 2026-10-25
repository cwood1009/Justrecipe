import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1_500;

// The headers Chrome sends when you open a link, so bot filters treat us like a browser.
// (Node's fetch() can't send these faithfully: it forces "Sec-Fetch-Mode: cors".)
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Ch-Ua": '"Google Chrome";v="141", "Chromium";v="141", "Not?A_Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

const BLOCKED_MESSAGE = "This site blocked us. Try again in a minute.";

export class FetchError extends Error {}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe80") ||
    v6.startsWith("ff")
  );
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("Only http and https links are supported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host)
      ? [host]
      : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new FetchError(`Couldn't find the website "${url.hostname}".`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new FetchError("That address isn't allowed.");
  }
}

/**
 * DNS lookup used when connecting, so the private-address check also applies to
 * the address actually dialed (a host can't pass the pre-check, then re-resolve).
 */
const publicLookup = ((hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, "", 0);
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(new FetchError("That address isn't allowed."), "", 0);
    }
    if (options.all) return (callback as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}) as LookupFunction;

type RawResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  body: Readable;
  discard: () => void;
};

function get(url: URL, signal: AbortSignal): Promise<RawResponse> {
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = send(url, { headers: HEADERS, signal, lookup: publicLookup }, (res) => {
      const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
      const decoder =
        encoding === "gzip" ? createGunzip() :
        encoding === "br" ? createBrotliDecompress() :
        encoding === "deflate" ? createInflate() :
        null;
      const body = decoder ? res.pipe(decoder) : res;
      if (decoder) res.on("error", (e) => decoder.destroy(e));
      resolve({ status: res.statusCode ?? 0, headers: res.headers, body, discard: () => res.destroy() });
    });
    req.on("error", reject);
    req.end();
  });
}

function isTimeout(err: unknown) {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

/**
 * Fetches a public web page as text. Blocks private/internal addresses
 * (checked on every redirect hop), and caps the time and size of the download.
 * Returns the page body and the final URL after redirects.
 */
export async function fetchPublicPage(
  input: string,
): Promise<{ html: string; url: string }> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FetchError("That doesn't look like a valid link.");
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let retried = false;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);

    let res: RawResponse;
    try {
      res = await get(url, signal);
    } catch (err) {
      if (err instanceof FetchError) throw err;
      if (isTimeout(err)) {
        throw new FetchError(retried ? BLOCKED_MESSAGE : "That website took too long to respond.");
      }
      throw new FetchError("Couldn't reach that website.");
    }

    // Rate limits and bot filters often let a second, slightly later request through.
    if ((res.status === 403 || res.status === 429) && !retried) {
      retried = true;
      res.discard();
      try {
        await sleep(retryDelay(header(res.headers["retry-after"])), signal);
      } catch {
        throw new FetchError(BLOCKED_MESSAGE);
      }
      hop--;
      continue;
    }

    if (res.status >= 300 && res.status < 400) {
      res.discard();
      const location = header(res.headers.location);
      if (!location) throw new FetchError("That website sent a bad redirect.");
      url = new URL(location, url);
      continue;
    }

    if (res.status < 200 || res.status >= 300) {
      res.discard();
      throw new FetchError(
        res.status === 403 || res.status === 429
          ? BLOCKED_MESSAGE
          : `That website returned an error (${res.status}).`,
      );
    }

    const type = header(res.headers["content-type"]) ?? "";
    if (type && !/html|xml/i.test(type)) {
      res.discard();
      throw new FetchError("That link isn't a web page.");
    }

    try {
      return { html: await readCapped(res), url: url.toString() };
    } catch (err) {
      throw new FetchError(
        isTimeout(err) ? "That website took too long to respond." : "Couldn't read that page.",
      );
    }
  }

  throw new FetchError("That link redirected too many times.");
}

function header(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/** Honors a short Retry-After (in seconds); otherwise waits a moment. */
function retryDelay(retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 5 ? seconds * 1000 : RETRY_DELAY_MS;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function readCapped(res: RawResponse): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += (chunk as Buffer).byteLength;
    chunks.push(chunk as Buffer);
    if (total > MAX_BYTES) {
      res.discard();
      break;
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
