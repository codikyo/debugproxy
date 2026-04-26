import util from "node:util";

const port = Number(Deno.env.get("PORT") || 3001);

const connected_streams = new Map<
  string,
  ReadableStreamDefaultController<Uint8Array<ArrayBufferLike>>
>();
const encoder = new TextEncoder();

const streamPageTemplate = `
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    div.pre {
      white-space: pre-wrap;
    }
  </style>
</head>
<body>

`;

const encodeHTML = (str: string): string => {
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
};

const requestSlots = {
  REQUEST: "request",
  REQUEST_BODY: "requestBody",
  RESPONSE: "response",
  RESPONSE_BODY: "responseBody",
  STATUS: "info",
} as const;

const requestTemplate = (uuid: string, requestPath: string) => {
  console.log(`${requestPath}`)
  return `
      <br/>
      <hr/>
      <div>
        ${requestPath}
      </div>
  `;
};

function statusMessage(s: string) {
  console.log(s)
  return `<p>${s}</p>`;
}

function requestStatus(uuid: string, s: string) {
  console.log(`${uuid}: ${s}`)
  return `<div>${s}</div>`;
}

function objectToString(obj: unknown) {
  return encodeHTML(util.inspect(obj));
}

function requestOrResponse(uuid: string, obj: unknown, slot: typeof requestSlots[keyof typeof requestSlots]) {
  console.log(`${uuid} - logging ${slot}`)
  console.log(obj);
  return `<details><summary style="user-select: none;">${uuid}-${slot}</summary><div class="pre">${objectToString(obj)}</div></details>`
}

function sendToStreams(s: string) {
  connected_streams.values().forEach((controller) => {
    controller.enqueue(encoder.encode(s + "\n"));
  });
}

const streamsHeartbeatInterval = setInterval(() => {
  sendToStreams(`<div slot="keepalive"></div>`);
}, 25000);

Deno.addSignalListener("SIGINT", () => {
  sendToStreams(statusMessage("Sigint catched, exiting. Will restart in a second."));
  clearInterval(streamsHeartbeatInterval);
  setTimeout(Deno.exit, 0, 0); // using set timeout here to allow the stream to send the info out.
});

const handler = async (request: Request): Promise<Response> => {
  const uuid = crypto.randomUUID();
  const url = new URL(request.url);

  sendToStreams(requestTemplate(uuid, `${new Date().toISOString()}: ${request.method} - ${url.href}`))

  if (url.pathname === "/exit") {
    setTimeout(Deno.exit, 0, 0);
    return new Response("closing proxy");
  }

  if (url.pathname === "/echo") {
    return new Response(request.body, {
      headers: request.headers,
    });
  }

  if (url.pathname === "/websocket") {
    const { socket, response } = Deno.upgradeWebSocket(request);
    socket.addEventListener("open", () => {
      console.log("Websocket opened");
    });
    socket.addEventListener("message", (event) => {
      if (event.data === "ping") {
        socket.send("pong");
        return;
      }
      socket.send(event.data);
    });
    return response;
  }

  if (url.pathname === "/dump") {
    sendToStreams(requestStatus(uuid, "Dump Request (this dumps regardless of body existing or not)"))
    sendToStreams(requestOrResponse(uuid, request, requestSlots.REQUEST));
    sendToStreams(requestOrResponse(uuid, await request.text(), requestSlots.REQUEST_BODY));
    return new Response("OK", {
      status: 200,
      statusText: "OK",
    });
  }

  let response = new Response("Hallo Welt.");
  if (url.pathname.startsWith("/local/")) {
    return response;
  }

  if (url.pathname == "/stream") {
    setTimeout(sendToStreams, 100, statusMessage("Stream initiated"));

    const stream = new ReadableStream({
      start(controller) {
        connected_streams.set(uuid, controller);
        controller.enqueue(encoder.encode(streamPageTemplate));
      },
      cancel() {
        connected_streams.delete(uuid);
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/html",
      },
    });
  }

  if (url.pathname == "/favicon.ico") {
    return new Response(null, {
      status: 404,
      statusText: "not found",
    });
  }

  if (url.pathname.startsWith("/delay/")) {
    const delay = Number(url.pathname.split("/").pop()) || 20000; // defaulting to 20000ms --> 20s if not valid
    response = new Response(
      `Returning with ${delay}ms delay. Default delay is 20000ms == 20s`,
      { status: 200 }
    );
    await new Promise((r) => setTimeout(r, delay));
    return response;
  }

  if (url.pathname.startsWith("/status/")) {
    const status = Number(url.pathname.split("/").pop()) || 200; // defaulting to 200 if not valid
    response = new Response(
      `Returning with status ${status}. (If you receive 200 and did not request 200, conversion failed.)`,
      { status: status }
    );
    return response;
  }

  const pathname = url.pathname.startsWith("/")
    ? url.pathname.replace("/", "")
    : url.pathname;

  const splitted = pathname.split("/");
  const domain = splitted.shift();
  const path = splitted.join("/");

  if (!domain?.match(/[^\.]\./g)) {
    sendToStreams(requestStatus(uuid, `Not a proxy request: ${url.href}`));
    return new Response(
      `Not a proxy request: ${url.href}.\nUse /domain.com/path/to/file`
    );
  }
  try {
    const clonedRequest = request.clone();
    const headers = new Headers(request.headers);
    headers.set("Host", domain);

    //headers.set("user-agent", "curl/7.61.1")
    const remoteRequest = new Request(
      `https://${domain}/${path}${url.search}`,
      {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: "manual",
      }
    );

    sendToStreams(requestOrResponse(uuid, remoteRequest, requestSlots.REQUEST));
    const contentType = headers.get("content-type");
    const contentLength = headers.get("content-length") || "0";
    const requestBodyIsTextBased = contentType?.match(
      /(text)|(json)|(script)|(xml)|(form)/g
    )?.length;
    if (
      (request.method !== "HEAD" && request.method !== "GET") &&
      requestBodyIsTextBased &&
      Number(contentLength) > 0
    ) {
      sendToStreams(requestOrResponse(uuid, await clonedRequest.text(), requestSlots.REQUEST_BODY));
    }

    const requestPromise = fetch(remoteRequest, {}); // includes leading /

    requestPromise.then(
      (remoteResponse) => {
        const response = remoteResponse.clone();

        const responseHeader = new Headers(response.headers);
        const contentType = responseHeader.get("content-type");
        const isTextBased = contentType?.match(
          /(text)|(json)|(script)|(xml)/g
        )?.length;

        sendToStreams(requestOrResponse(uuid, response, requestSlots.RESPONSE));

        if (request.method != "HEAD" && isTextBased) {
          response.text().then((responseText) => {
            sendToStreams(requestOrResponse(uuid, responseText, requestSlots.RESPONSE_BODY));
          });
        } else {
          // assume non-text data, pass as is to client
          sendToStreams(requestStatus(uuid, `Head Request or none-text-response-content: ${request.method}: ${contentType}`));
        }

        return remoteResponse;
      },
      (e) => {
        if (e instanceof Error) {
          sendToStreams(requestStatus(uuid, objectToString(e)));
          return new Response(e.message, {
            status: 500,
            statusText: e.name,
          });
        } else {
          return new Response("unknown error in forwarding request", {
            status: 500,
            statusText: "unknown error",
          });
        }
      }
    );

    const remoteResponse = await requestPromise;

    response = remoteResponse;
  } catch (e) {
    sendToStreams(requestStatus(uuid, objectToString(e)));
    if (e instanceof Error) {
      response = new Response(e.message, {
        status: 500,
        statusText: e.name,
      });
    } else {
      response = new Response("Unknown Error", {
        status: 500,
      });
    }
  }

  //console.log(`Returning Response:`);
  //console.log(response);
  return response;
};

console.log(`Server is running on port ${port}`);

const server = Deno.serve({ port }, handler);

if(Deno.build.os !== "windows") {
  Deno.addSignalListener("SIGTERM", () => {
    console.log("SIGTERM catched, gracefully exiting.");
    server.shutdown();
  });
}
else {
  console.log("Running on windows, SIGINT should work, but SIGTERM is not supported. Use CTRL+C to stop the server.");
}
