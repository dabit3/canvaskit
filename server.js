/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const MAX_PAYLOAD_SIZE = 2048; // 2KB

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/', true);
    if (pathname === '/multiplayer') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws) => {
    // Assign a unique ID to this connection
    const connectionId = randomUUID();

    // Send the ID to the client
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify({ type: 'init', id: connectionId }));
    }

    ws.on('message', (data, isBinary) => {
      // 1. DoS Protection: Check payload size
      if (data.length > MAX_PAYLOAD_SIZE) {
        console.warn(`[WS] Payload too large from ${connectionId}. Ignoring.`);
        return;
      }

      // 2. Anti-Spoofing: Ensure the message ID matches the connection ID
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id && msg.id !== connectionId) {
             // Silently correct the ID or ignore.
             // Here we correct it to ensure the broadcast is truthful about the source.
             msg.id = connectionId;
             data = JSON.stringify(msg);
          }
        } catch (e) {
          // Invalid JSON, ignore
          return;
        }
      }

      // Broadcast to all other clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) { // WebSocket.OPEN
          client.send(data, { binary: isBinary });
        }
      });
    });

    ws.on('error', console.error);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
