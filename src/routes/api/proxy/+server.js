import { error } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, fetch, request }) {
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    throw error(400, 'Missing URL parameter');
  }
  
  console.log(`[PROXY GET] Forwarding request to: ${targetUrl}`);
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!response.ok) {
      console.error(`[PROXY GET] Failed with status: ${response.status} ${response.statusText}`);
      throw error(response.status, 'Failed to fetch from target URL');
    }
    
    const content = await response.text();
    console.log(`[PROXY GET] Received response from ${targetUrl} (${content.length} bytes)`);
    
    return new Response(content, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'max-age=600'
      }
    });
  } catch (e) {
    console.error('[PROXY GET] Error:', e);
    throw error(500, 'Failed to fetch from target URL');
  }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ url, request, fetch }) {
  const targetUrl = url.searchParams.get('url');
  const refererUrl = url.searchParams.get('referer'); // Get referer from query params
  
  if (!targetUrl) {
    throw error(400, 'Missing URL parameter');
  }
  
  try {
    const body = await request.text();
    console.log(`[PROXY POST] Forwarding POST request to: ${targetUrl}`);
    console.log(`[PROXY POST] Using referer: ${refererUrl || 'Not specified'}`);
    console.log(`[PROXY POST] Request body: ${body}`);
    
    // Get user's actual headers when possible
    const userAgent = request.headers.get('User-Agent') || 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36 Edg/135.0.0.0';
    
    // Use the reference test URL from which the answers are being submitted
    // If not provided, try to infer it from the results.php URL
    const actualReferer = refererUrl || targetUrl.replace('/results.php', '/ap/calculus-bc/test1.html');
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        'Cache-Control': 'max-age=0',
        'Origin': 'https://www.crackap.com',
        'Referer': actualReferer,
        'Sec-Ch-Ua': '"Microsoft Edge";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Priority': 'u=0, i'
      },
      body: body
    });
    
    console.log(`[PROXY POST] Response received: Status ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`[PROXY POST] Failed with status: ${response.status} ${response.statusText}`);
      throw error(response.status, 'Failed to fetch from target URL');
    }
    
    const content = await response.text();
    console.log(`[PROXY POST] Received response from ${targetUrl} (${content.length} bytes)`);
    
    // Check for common error indicators in the response
    if (content.includes("Warning") || content.includes("mysql_num_rows()")) {
      console.warn("[PROXY POST] Response contains PHP error messages but will pass it to client for handling");
    }
    
    // Check if the response contains table.results which would indicate success
    const hasResultsTable = content.includes('table class="results"');
    console.log(`[PROXY POST] Response contains results table: ${hasResultsTable}`);
    
    return new Response(content, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (e) {
    console.error('[PROXY POST] Error:', e);
    throw error(500, 'Failed to submit to target URL: ' + (e instanceof Error ? e.message : String(e)));
  }
} 