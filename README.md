
# debugproxy

![Deno](https://img.shields.io/badge/Deno-white?style=flat-square&logo=deno&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A TypeScript proxy utility built with Deno that provides debugging capabilities for network requests and responses.

This does not work like an actual proxy, meaning you cannot configure a proxy like `HTTP_PROXY=""`. 
Instead it provides an endpoint that forwards requests to a target server, specified in the first path segment. 

Due to this limitation, the application you want to debug must be able to configure the target domain as part of the request path. This probably makes it more compareable with an Gateway or httpbin.

Additionally, this debugproxy includes several utilities to test applications and loadbalancer capabilities.


> [!CAUTION]
> **Not Recommended for Public Deployment**
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
  - <span style="color: #2ea043;">`/delay/:ms`</span> - Simulate response delays.
    ```bash
    time curl http://localhost:3001/delay/2000
    ```
  - <span style="color: #2ea043;">`/dump`</span> - Dump all received requests to the console and the stream. Always returns a 200 OK response.
    ```bash
    curl -i http://localhost:3001/dump
    ```
  - <span style="color: #2ea043;">`/status/:code`</span> - Return specific HTTP status codes.
    ```bash
    curl -i http://localhost:3001/status/404
    ```
  - <span style="color: #2ea043;">`/echo`</span> - Echo back the request body and headers.
    ```bash
    curl -X POST http://localhost:3001/echo -d "hello world"
    ```
  - <span style="color: #2ea043;">`/stream`</span> - Real-time stream of intercepted requests (HTML). Intended to be used for monitoring requests in a web browser.
  - <span style="color: #2ea043;">`/proxy/:target/*`</span> - Forward requests to a specified target.
    ```bash
    curl http://localhost:3001/example.com/api/data
    ```
  - <span style="color: #2ea043;">`/websocket`</span> - Simple WebSocket echo endpoint.
  - <span style="color: #2ea043;">`/exit`</span> - Shuts down the proxy server.
    ```bash
    curl -X POST http://localhost:3001/exit
    ```

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
