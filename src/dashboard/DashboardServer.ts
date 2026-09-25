/**
 * DashboardServer.ts
 * Express HTTP + WebSocket server that serves the customer dashboard UI
 * and provides real-time bidirectional communication between the automation
 * agent and the browser dashboard.
 *
 * Routes:
 * - GET  /           → Serves the dashboard HTML
 * - POST /api/profile → Save customer profile
 * - GET  /api/profile → Get current profile
 * - POST /api/approve → Customer approves the intent
 * - POST /api/control → pause / resume / stop / mode switch
 * - GET  /api/status  → Current telemetry snapshot
 * - WS   /ws          → Real-time telemetry + log stream
 */

import express, { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CustomerProfile, AgentTelemetry, OperationIntent } from '../types/CustomerProfile.js';
import { ThreadsOperator } from '../agent/ThreadsOperator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DashboardServer {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private operator: ThreadsOperator;
  private port: number;
  private connectedClients: Set<WebSocket> = new Set();

  constructor(operator: ThreadsOperator, port: number = 3000) {
    this.operator = operator;
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.configureExpress();
    this.configureWebSocket();
    this.wireOperatorCallbacks();
  }

  private configureExpress(): void {
    this.app.use(express.json());

    // Serve static dashboard files
    const webDir = path.join(__dirname, 'web');
    this.app.use(express.static(webDir));

    // API: Save customer profile
    this.app.post('/api/profile', (req: Request, res: Response) => {
      try {
        const profileData = req.body as Omit<CustomerProfile, 'id' | 'createdAt' | 'updatedAt'>;
        const profile: CustomerProfile = {
          ...profileData,
          id: `profile_${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Persist profile to disk
        const profilePath = path.join(process.cwd(), '.customer-profile.json');
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

        this.operator.loadCustomerProfile(profile);
        res.json({ success: true, profile });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    });

    // API: Get current profile
    this.app.get('/api/profile', (_req: Request, res: Response) => {
      const profile = this.operator.getCustomerProfile();
      res.json({ profile });
    });

    // API: Load saved profile from disk
    this.app.get('/api/profile/saved', (_req: Request, res: Response) => {
      try {
        const profilePath = path.join(process.cwd(), '.customer-profile.json');
        if (fs.existsSync(profilePath)) {
          const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as CustomerProfile;
          res.json({ profile });
        } else {
          res.json({ profile: null });
        }
      } catch {
        res.json({ profile: null });
      }
    });

    // API: Get pending intent
    this.app.get('/api/intent', (_req: Request, res: Response) => {
      const intent = this.operator.getPendingIntent();
      res.json({ intent });
    });

    // API: Customer approves intent
    this.app.post('/api/approve', (req: Request, res: Response) => {
      const { notes } = req.body as { notes?: string };
      this.operator.approveIntent(notes);
      this.broadcast({ type: 'INTENT_APPROVED', notes });
      res.json({ success: true });
    });

    // API: Control commands
    this.app.post('/api/control', async (req: Request, res: Response) => {
      const { action, mode, username } = req.body as {
        action: string;
        mode?: string;
        username?: string;
      };

      switch (action) {
        case 'pause':
          this.operator.pause();
          break;
        case 'resume':
          this.operator.resume();
          break;
        case 'stop':
          this.operator.stop();
          break;
        case 'mode':
          if (mode) {
            this.operator.setMode(mode as any);
          }
          break;
        case 'target':
          if (username) {
            await this.operator.targetProfile(username);
          }
          break;
        default:
          res.status(400).json({ error: 'Unknown action' });
          return;
      }

      res.json({ success: true, telemetry: this.operator.getTelemetry() });
    });

    // API: Create new post / thread directly from dashboard
    this.app.post('/api/post', async (req: Request, res: Response) => {
      const { text } = req.body as { text: string };
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Post text is required' });
        return;
      }
      const result = await (this.operator as any).publishCustomPost(text.trim());
      res.json(result);
    });

    // API: Trigger immediate comment from dashboard
    this.app.post('/api/comment', async (req: Request, res: Response) => {
      const { text } = req.body as { text?: string };
      const result = await (this.operator as any).triggerImmediateComment(text);
      res.json(result);
    });

    // API: Current telemetry snapshot
    this.app.get('/api/status', (_req: Request, res: Response) => {
      res.json(this.operator.getTelemetry());
    });

    // Serve dashboard for all other routes (SPA fallback)
    this.app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'web', 'index.html'));
    });
  }

  private configureWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.connectedClients.add(ws);
      console.log(`[DashboardServer] Client connected. Total: ${this.connectedClients.size}`);

      // Send current state immediately on connect
      const telemetry = this.operator.getTelemetry();
      ws.send(JSON.stringify({ type: 'TELEMETRY', data: telemetry }));

      const profile = this.operator.getCustomerProfile();
      if (profile) {
        ws.send(JSON.stringify({ type: 'PROFILE', data: profile }));
      }

      const intent = this.operator.getPendingIntent();
      if (intent) {
        ws.send(JSON.stringify({ type: 'INTENT', data: intent }));
      }

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString()) as { type: string; payload?: any };
          this.handleClientMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.connectedClients.delete(ws);
      });

      ws.on('error', () => {
        this.connectedClients.delete(ws);
      });
    });
  }

  private handleClientMessage(msg: { type: string; payload?: any }): void {
    switch (msg.type) {
      case 'PING':
        this.broadcast({ type: 'PONG', timestamp: Date.now() });
        break;
      default:
        break;
    }
  }

  /**
   * Wire operator callbacks to broadcast to all connected WebSocket clients.
   */
  private wireOperatorCallbacks(): void {
    this.operator.onTelemetryUpdate = (telemetry: AgentTelemetry) => {
      this.broadcast({ type: 'TELEMETRY', data: telemetry });
    };

    this.operator.onIntentReady = (intent: OperationIntent) => {
      this.broadcast({ type: 'INTENT', data: intent });
    };

    this.operator.onSecurityAlert = (details: string) => {
      this.broadcast({ type: 'SECURITY_ALERT', message: details });
    };

    this.operator.onLogEntry = (entry: string) => {
      this.broadcast({ type: 'LOG', entry });
    };
  }

  public broadcast(data: object): void {
    const payload = JSON.stringify(data);
    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch {
          this.connectedClients.delete(client);
        }
      }
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`\n╔════════════════════════════════════════════════╗`);
        console.log(`║  🚀 ANTIGRAVITY AUTOMATION DASHBOARD              ║`);
        console.log(`║  Open: http://localhost:${this.port}                    ║`);
        console.log(`╚════════════════════════════════════════════════╝\n`);
        resolve();
      });
    });
  }

  public stop(): void {
    this.server.close();
    this.wss.close();
  }
}
