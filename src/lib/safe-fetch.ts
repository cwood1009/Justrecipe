import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

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

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);

    let res: Response;
    try {
      res = await fetch(url, { headers: HEADERS, redirect: "manual", signal });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new FetchError("That website took too long to respond.");
      }
      throw new FetchError("Couldn't reach that website.");
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new FetchError("That website sent a bad redirect.");
      url = new URL(location, url);
      continue;
    }

    if (!res.ok) {
      throw new FetchError(
        res.status === 403 || res.status === 429
          ? "That website blocked our request. Try again in a bit, or try another recipe."
          : `That website returned an error (${res.status}).`,
      );
    }

    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml/i.test(type)) {
      throw new FetchError("That link isn't a web page.");
    }

    return { html: await readCapped(res), url: url.toString() };
  }

  throw new FetchError("That link redirected too many times.");
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
