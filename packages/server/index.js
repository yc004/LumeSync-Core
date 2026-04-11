const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const runtimeControl = require('../runtime-control');
const { resolveEngineSrcDir } = require('../render-engine');
const {
    createViewerSessionToken,
    normalizeIp
} = require('../runtime-control/identity');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingInterval: 5000,
    pingTimeout: 8000
});

let currentCourseId = null;
let currentSlideIndex = 0;
const VIEWER_TOKEN_TTL_SEC = Number(process.env.LUMESYNC_VIEWER_TOKEN_TTL_SEC || 14400);
const VIEWER_TOKEN_SECRET = String(process.env.LUMESYNC_VIEWER_TOKEN_SECRET || '');

app.use(express.json({ limit: '1mb' }));

const engineDir = resolveEngineSrcDir();
app.use('/engine', express.static(engineDir));
app.use('/engine/src', express.static(engineDir));

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, app: 'LumeSync-Core', port: Number(process.env.PORT || 3000) });
});

// Compatibility shim: core runtime no longer owns course/files data.
app.get('/api/courses', (_req, res) => {
    res.json({
        courses: [],
        folders: [],
        currentCourseId,
        currentSlideIndex,
        mode: 'core-runtime'
    });
});

app.get('/api/course-status', (_req, res) => {
    res.json({ currentCourseId, currentSlideIndex, mode: 'core-runtime' });
});

app.post('/api/refresh-courses', (_req, res) => {
    res.json({ success: true, courses: [], folders: [], mode: 'core-runtime' });
});

app.get('/api/components-manifest', (_req, res) => {
    res.json({ success: true, files: [], mode: 'core-runtime' });
});

app.get('/api/students', (_req, res) => {
    const studentIPs = runtimeControl.getStudentIPs();
    const students = Array.from(studentIPs.keys() || []).map((ip) =>
        ip.startsWith('::ffff:') ? ip.slice(7) : ip
    );
    res.json({ students });
});

app.get('/api/student-log', (_req, res) => {
    res.json({ log: runtimeControl.getStudentLog() });
});

app.post('/api/session/bootstrap', (req, res) => {
    const role = String(req.body?.role || 'viewer').trim().toLowerCase();
    const providedClientId = String(req.body?.clientId || '').trim();
    const clientId = providedClientId || `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const clientIp = normalizeIp(req.ip || req.socket?.remoteAddress || '');

    if (role !== 'viewer') {
        res.status(400).json({ success: false, error: 'Only viewer bootstrap is supported' });
        return;
    }
    if (!VIEWER_TOKEN_SECRET) {
        res.status(500).json({ success: false, error: 'Viewer token secret is not configured on server' });
        return;
    }

    const token = createViewerSessionToken({
        clientId,
        ttlSec: VIEWER_TOKEN_TTL_SEC,
        secret: VIEWER_TOKEN_SECRET
    });
    const expiresAt = new Date(Date.now() + VIEWER_TOKEN_TTL_SEC * 1000).toISOString();

    res.json({
        success: true,
        role: 'viewer',
        clientId,
        token,
        expiresAt,
        clientIp,
        serverTime: new Date().toISOString()
    });
});

app.get('*', (_req, res) => {
    res.status(404).send('LumeSync Core runtime is running. This service does not host course files.');
});

runtimeControl.setupSocketHandlers(io, {
    setCurrentCourseId: (id) => {
        currentCourseId = id;
    },
    setCurrentSlideIndex: (index) => {
        currentSlideIndex = index;
    },
    getCurrentCourseId: () => currentCourseId,
    getCurrentSlideIndex: () => currentSlideIndex,
    getCourseCatalog: () => ({ courses: [], folders: [] })
});

function startServer(port) {
    const PORT = Number(port || process.env.PORT || 3000);
    server.listen(PORT, () => {
        console.log(`[core] LumeSync core runtime running on port ${PORT}`);
    });

    process.on('SIGTERM', () => {
        server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
        server.close(() => process.exit(0));
    });

    return server;
}

if (require.main === module) {
    startServer();
}

module.exports = { app, server, io, startServer };
