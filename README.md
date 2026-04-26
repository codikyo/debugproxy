
# debugproxy

A TypeScript proxy utility built with Deno that provides debugging capabilities for network requests and responses.

This does not work like an actual proxy, meaning you cannot configure a proxy like `HTTP_PROXY=""`. 
Instead it provides an endpoint that forwards requests to a target server, specified in the first path segment. 

Due to this limitation, the application you want to debug must be able to configure the target domain as part of the request path. 

Additionally, this debugproxy includes several utilities to test applications and loadbalancer capabilities.


> [!CAUTION] **Not Recommended for Public Deployment**
> This debugproxy is designed for **local development and testing only**. Deploying it publicly is strongly discouraged for the following reasons:
>
> - **No authentication** - All endpoints are publicly accessible without credentials
> - **Information disclosure** - Request/response logging exposes sensitive data like headers, tokens, and payloads
>   - The `/stream` endpoint can leak detailed request/response information to anyone who accesses it
> - **Denial of service** - The `/delay` endpoint can be abused to tie up server resources
> - **Arbitrary forwarding** - The `/proxy` endpoint allows forwarding to any target without restrictions
>
> Use this tool only in controlled, local environments for development and debugging purposes.


## Features

- Intercept and log HTTP requests and responses
  - viewable via console output or via a simple web interface available at /stream
- Debug request/response headers and payloads
- Utility endpoints for testing:
  - `/delay/:ms` - Simulate response delays where `:ms` is the delay in milliseconds. Responds with a simple 200 OK after the specified delay.
  - `/status/:code` - Return specific HTTP status codes where `:code` is the desired status code (e.g., 200, 404, 500). Responds with the specified status code and a simple message body.
  - `/echo` - Echo back the request body and headers in the response. 
  - `/stream` - Provides a real-time stream of intercepted requests and responses in a human-readable format. This endpoint streams HTML and is intendended to be viewed in a web browser for easy debugging.
  - `/proxy/:target/*` - Forward requests to a specified target server where `:target` is the base URL of the target server (e.g., `http://localhost:8080`) and `*` represents the path to be forwarded. The proxy will forward the request to the target server and return the response back to the client, while also logging the request and response details for debugging purposes.
  - `/websocket` - A simple WebSocket endpoint that echoes back messages sent by the client. Useful for testing gateways and load balancers.
  - `/exit` - Shuts down the proxy server gracefully. This endpoint can be used to stop the proxy when it's no longer needed, allowing for easy cleanup after testing.

## Requirements

- **Deno Runtime** - No other external dependencies required

Simply ensure you have Deno installed to use this proxy.

## Usage

Run your proxy with:

```bash
deno run --allow-net --allow-env proxy.ts
```

Setting the `PORT` environment variable allows you to specify a custom port for the proxy to listen on. For example, to run the proxy on port 4000:

Bash
```bash
PORT=4000 deno run --allow-net --allow-env proxy.ts
```

PowerShell
```ps 
$env:PORT=4000; deno run --allow-net --allow-env proxy.ts
```

## Permissions

The proxy requires the `--allow-net` permission to handle network operations.
If you want to use a different port, you also need to set the `PORT` environment variable, which requires the `--allow-env` permission.
