"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCoreServer = createCoreServer;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const runtime_control_js_1 = require("../node/runtime-control.js");
const identity_js_1 = require("../node/identity.js");
const render_engine_js_1 = require("../node/render-engine.js");
function ensureClientId(input) {
    const value = String(input || '').trim();
    return value || `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function createCoreServer(options = {}) {
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    const io = new socket_io_1.Server(server, {
        pingInterval: 5000,
        pingTimeout: 8000,
    });
    const viewerTokenTtlSec = Number(options.viewerTokenTtlSec || process.env.LUMESYNC_VIEWER_TOKEN_TTL_SEC || 14400);
    const viewerTokenSecret = String(options.viewerTokenSecret || process.env.LUMESYNC_VIEWER_TOKEN_SECRET || '');
    app.use(express_1.default.json({ limit: '1mb' }));
    const engineDir = (0, render_engine_js_1.resolveEngineSrcDir)();
    app.use('/engine', express_1.default.static(engineDir));
    app.use('/engine/src', express_1.default.static(engineDir));
    app.get('/api/health', (_req, res) => {
        res.json({ ok: true, app: 'LumeSync-Core', port: Number(process.env.PORT || options.port || 3000) });
    });
    app.get('/api/courses', (_req, res) => {
        res.json({ courses: [], folders: [], mode: 'core-runtime' });
    });
    app.get('/api/course-status', (_req, res) => {
        res.json({ mode: 'core-runtime' });
    });
    app.post('/api/refresh-courses', (_req, res) => {
        res.json({ success: true, courses: [], folders: [], mode: 'core-runtime' });
    });
    app.get('/api/components-manifest', (_req, res) => {
        res.json({ success: true, files: [], mode: 'core-runtime' });
    });
    app.get('/api/runtime-status', (_req, res) => {
        res.json((0, runtime_control_js_1.buildCoreRuntimeSnapshot)(io));
    });
    app.get('/api/students', (_req, res) => {
        res.json({ students: (0, runtime_control_js_1.listCompatibilityStudents)(io), mode: 'core-runtime' });
    });
    app.get('/api/student-log', (_req, res) => {
        res.json({ log: (0, runtime_control_js_1.listCompatibilityLog)(io), mode: 'core-runtime' });
    });
    app.post('/api/session/bootstrap', (req, res) => {
        const role = String(req.body?.role || 'viewer').trim().toLowerCase();
        const clientId = ensureClientId(req.body?.clientId);
        const clientIp = (0, identity_js_1.normalizeIp)(req.ip || req.socket?.remoteAddress || '');
        if (role !== 'viewer') {
            res.status(400).json({ success: false, error: 'Only viewer bootstrap is supported' });
            return;
        }
        if (!viewerTokenSecret) {
            res.status(500).json({ success: false, error: 'Viewer token secret is not configured on server' });
            return;
        }
        const token = (0, identity_js_1.createViewerSessionToken)({
            clientId,
            ttlSec: viewerTokenTtlSec,
            secret: viewerTokenSecret,
        });
        const expiresAt = new Date(Date.now() + viewerTokenTtlSec * 1000).toISOString();
        res.json({
            success: true,
            role: 'viewer',
            clientId,
            token,
            expiresAt,
            clientIp,
            serverTime: new Date().toISOString(),
        });
    });
    app.get('*', (_req, res) => {
        res.status(404).send('LumeSync Core runtime is running. This service does not host course files.');
    });
    (0, runtime_control_js_1.setupSocketHandlers)(io, {
        ...options,
        viewerTokenSecret,
    });
    function startServer(port) {
        const resolvedPort = Number(port || options.port || process.env.PORT || 3000);
        server.listen(resolvedPort, () => {
            console.log(`[core] LumeSync core runtime running on port ${resolvedPort}`);
        });
        process.on('SIGTERM', () => {
            server.close(() => process.exit(0));
        });
        process.on('SIGINT', () => {
            server.close(() => process.exit(0));
        });
        return server;
    }
    return { app, server, io, startServer };
}
//# sourceMappingURL=create-core-server.js.map