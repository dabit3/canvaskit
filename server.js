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

  // Attach WebSocket Server with maxPayload enforcement
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_SIZE });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/', true);

    // Origin validation
    // For this demo, we allow localhost and potentially others if needed.
    // In production, strictly allow only your domain.
    const origin = req.headers.origin;
    const allowedOrigins = [
        `http://localhost:${port}`,
        `http://${hostname}:${port}`,
        // Add other origins if necessary
    ];

    // If origin is present (browsers send it), validate it.
    // Tools might not send it, but we should be careful.
    if (origin) {
        // Simple check for localhost inclusion or exact match
        const isAllowed = allowedOrigins.some(o => origin === o) || origin.startsWith('http://localhost');
        if (!isAllowed) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
        }
    }

    if (pathname === '/multiplayer') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
    // Do not destroy other paths (let Next.js handle them, e.g. HMR)
  });

  wss.on('connection', (ws) => {
    // Assign a unique ID to this connection
    const connectionId = randomUUID();

    // Send the ID to the client
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify({ type: 'init', id: connectionId }));
    }

    ws.on('message', (data, isBinary) => {
      // Note: ws.maxPayload handles the hard limit and closes connection if exceeded.

      // 2. Anti-Spoofing & Input Validation
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString());

          // Enforce ID
          if (msg.id && msg.id !== connectionId) {
             msg.id = connectionId;
          } else if (!msg.id) {
             msg.id = connectionId;
          }

          // Sanitize/Validate fields
          if (msg.type === 'presence') {
              if (typeof msg.name === 'string') {
                  msg.name = msg.name.slice(0, 20); // Enforce max length
              }
              if (typeof msg.color === 'string') {
                  msg.color = msg.color.slice(0, 20); // Enforce max length
              }
          }

          data = JSON.stringify(msg);
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
