// functions/api/search.js
// Cloudflare Workers - search proxy to nal.tmmumbai.in

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const method = request.method;

  // Echo/CORS Helper
  const origin = request.headers.get("Origin") || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };

  // W1: OPTIONS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // W4: Method Allow-list
  if (method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Allow": "GET, OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  // Parse query params
  const searchString = url.searchParams.get("searchString");
  const warehouseId = url.searchParams.get("warehouseId") || "1";
  const page = url.searchParams.get("page") || "1";

  // W3: Missing searchString
  if (!searchString) {
    return new Response(JSON.stringify({ error: "searchString required" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // W8: Query validation (control characters or length > 120)
  const hasControlChars = /[\x00-\x1F\x7F]/.test(searchString);
  if (hasControlChars || searchString.length > 120) {
    return new Response(JSON.stringify({ error: "Invalid search string" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // W9: Drop unknown params, keep allowed ones
  const upstreamBase = env.UPSTREAM_BASE || "https://nal.tmmumbai.in";
  const targetUrl = new URL(`${upstreamBase}/SearchService/getSearchResult`);
  targetUrl.searchParams.set("searchString", searchString);
  targetUrl.searchParams.set("warehouseId", warehouseId);
  targetUrl.searchParams.set("page", page);
  targetUrl.searchParams.set("isMultiSearch", "true");
  targetUrl.searchParams.set("platform", "web");

  // W10: Header sanitization (exclude client Cookie/Authorization, inject Origin/Referer/UA)
  const headers = new Headers();
  headers.set("Origin", "https://www.truemeds.in");
  headers.set("Referer", "https://www.truemeds.in/");
  headers.set("Accept", "application/json");

  // Forward client incoming Accept-Language header if present
  const clientAcceptLang = request.headers.get("accept-language");
  if (clientAcceptLang) {
    headers.set("Accept-Language", clientAcceptLang);
  }

  // W10: Always rotate User-Agent and Client-Hints from a modern browser pool
  const userAgentsPool = [
    {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      secChUaMobile: "?0",
      secChUaPlatform: '"macOS"'
    },
    {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      secChUaMobile: "?0",
      secChUaPlatform: '"Windows"'
    },
    {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15"
    },
    {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Mobile/15E148 Safari/605.1.15"
    },
    {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
    },
    {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
      secChUaMobile: "?0",
      secChUaPlatform: '"Windows"'
    },
    {
      userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      secChUaMobile: "?1",
      secChUaPlatform: '"Android"'
    }
  ];

  // Pick a random pairing from the pool
  const selected = userAgentsPool[Math.floor(Math.random() * userAgentsPool.length)];
  headers.set("User-Agent", selected.userAgent);
  if (selected.secChUa) headers.set("Sec-Ch-Ua", selected.secChUa);
  if (selected.secChUaMobile) headers.set("Sec-Ch-Ua-Mobile", selected.secChUaMobile);
  if (selected.secChUaPlatform) headers.set("Sec-Ch-Ua-Platform", selected.secChUaPlatform);

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: "GET",
      headers,
    });

    // W5: Upstream error (5xx or other non-200)
    if (!upstreamResponse.ok) {
      const errorBody = await upstreamResponse.text();
      return new Response(errorBody, {
        status: upstreamResponse.status === 502 ? 502 : 502, // Pinned to 502 or proxy status
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    // Read body text first to validate JSON
    const text = await upstreamResponse.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // W7: Upstream invalid JSON
      return new Response(JSON.stringify({ error: "upstream_invalid_json" }), {
        status: 502,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    // W2 & W11 & W12: Success Response
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    // W6: Upstream throws
    return new Response(JSON.stringify({ error: "upstream_unreachable" }), {
      status: 502,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
