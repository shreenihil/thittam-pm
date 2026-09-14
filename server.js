const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

// Project presence map: projectId -> Map<socketId, { userId, name, designation, role }>
const projectPresence = new Map();

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Attach global.io for Next.js API routes to dispatch real-time events
  global.io = io;

  // Socket Authentication Middleware
  io.use(async (socket, nextMiddleware) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const cookies = parseCookies(cookieHeader);
      const token = cookies['__Host-thittam_session'] || cookies['thittam_session'];

      if (!token) {
        return nextMiddleware(new Error('Authentication token required'));
      }

      const session = await prisma.session.findUnique({
        where: { sessionToken: token },
        include: {
          user: {
            include: {
              department: true,
              team: true,
            },
          },
        },
      });

      if (!session || session.expiresAt < new Date() || !session.user || !session.user.isActive) {
        return nextMiddleware(new Error('Invalid or expired session'));
      }

      socket.data.user = session.user;
      nextMiddleware();
    } catch (err) {
      console.error('Socket authentication error:', err);
      nextMiddleware(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;

    // Join default personal and hierarchy rooms
    socket.join(`user:${user.id}`);
    if (user.departmentId) {
      socket.join(`dept:${user.departmentId}`);
    }
    if (user.teamId) {
      socket.join(`team:${user.teamId}`);
    }
    if (user.role === 'ADMIN') {
      socket.join('admin');
    }

    // Dynamic Project Room Join with Access Control & Presence Tracking
    socket.on('join:project', async (projectId) => {
      try {
        if (!projectId) return;

        // Access Control: Validate that user has permission to view this project
        if (user.role !== 'ADMIN') {
          const hasAccess = await prisma.project.findFirst({
            where: {
              id: projectId,
              OR: [
                { departmentId: user.departmentId || '__none__' },
                { createdById: user.id },
                { pointOfContactId: user.id },
                { members: { some: { userId: user.id } } },
              ],
            },
            select: { id: true },
          });

          if (!hasAccess) {
            socket.emit('error', { message: 'Unauthorized project access' });
            return;
          }
        }

        // Join project room
        const roomName = `project:${projectId}`;
        socket.join(roomName);

        // Update Presence
        if (!projectPresence.has(projectId)) {
          projectPresence.set(projectId, new Map());
        }
        const viewers = projectPresence.get(projectId);
        viewers.set(socket.id, {
          userId: user.id,
          name: user.name,
          designation: user.designation,
          role: user.role,
        });

        // Broadcast unique viewers stack to project room
        const uniqueViewers = Array.from(
          new Map(Array.from(viewers.values()).map((v) => [v.userId, v])).values()
        );
        io.to(roomName).emit('presence:update', { projectId, viewers: uniqueViewers });
      } catch (err) {
        console.error('join:project socket error:', err);
      }
    });

    // Project Room Leave
    socket.on('leave:project', (projectId) => {
      if (!projectId) return;
      const roomName = `project:${projectId}`;
      socket.leave(roomName);

      if (projectPresence.has(projectId)) {
        const viewers = projectPresence.get(projectId);
        viewers.delete(socket.id);

        const uniqueViewers = Array.from(
          new Map(Array.from(viewers.values()).map((v) => [v.userId, v])).values()
        );
        io.to(roomName).emit('presence:update', { projectId, viewers: uniqueViewers });
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      projectPresence.forEach((viewers, projectId) => {
        if (viewers.has(socket.id)) {
          viewers.delete(socket.id);
          const roomName = `project:${projectId}`;
          const uniqueViewers = Array.from(
            new Map(Array.from(viewers.values()).map((v) => [v.userId, v])).values()
          );
          io.to(roomName).emit('presence:update', { projectId, viewers: uniqueViewers });
        }
      });
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Thittam ready on http://${hostname}:${port} (Node + WebSocket Server)`);
  });
});
