const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const runtimeControl = require('../runtime-control');
const { resolveEngineSrcDir } = require('../render-engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingInterval: 5000,
    pingTimeout: 8000
});

let currentCourseId = null;
let currentSlideIndex = 0;

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
