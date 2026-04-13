const HOST_TOKEN = String(process.env.LUMESYNC_HOST_TOKEN || '');
const VIEWER_TOKEN_SECRET = String(process.env.LUMESYNC_VIEWER_TOKEN_SECRET || '');
const IDENTITY_LEGACY_COMPAT = String(process.env.LUMESYNC_IDENTITY_LEGACY_COMPAT || 'true').toLowerCase() !== 'false';
const STUDENT_LOG_MAX = Number(process.env.LUMESYNC_STUDENT_LOG_MAX || 500);
const { normalizeIp, verifyViewerSessionToken } = require('./identity');

const RESERVED_CLIENT_EVENTS = new Set([
    'connect',
    'connect_error',
    'disconnect',
    'disconnecting',
    'newListener',
    'removeListener'
]);

const SERVER_ONLY_EVENTS = new Set([
    'role-assigned',
    'identity-rejected',
    'participant-joined',
    'participant-left'
]);

function getStringValue(value) {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return getStringValue(value[0]);
    return String(value).trim();
}

function normalizeDeclaredRole(rawRole) {
    const role = getStringValue(rawRole).toLowerCase();
    if (role === 'host' || role === 'teacher') return 'host';
    if (role === 'viewer' || role === 'student') return 'viewer';
    return '';
}

function rejectIdentity(socket, code, message) {
    socket.emit('identity-rejected', { code, message });
    socket.disconnect(true);
}

function resolveConnectionIdentity(socket) {
    const auth = socket?.handshake?.auth || {};
    const query = socket?.handshake?.query || {};

    const clientIp = normalizeIp(socket?.handshake?.address || '');
    const declaredRole = normalizeDeclaredRole(auth.role || query.role);
    const token = getStringValue(auth.token || query.token);
    const clientId = getStringValue(auth.clientId || query.clientId);

    if (!declaredRole) {
        if (!IDENTITY_LEGACY_COMPAT) {
            return { ok: false, code: 'identity_missing', message: 'Missing role declaration' };
        }
        const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1';
        const legacyRole = isLocalhost ? 'host' : 'viewer';
        return {
            ok: true,
            role: legacyRole,
            token: '',
            clientId: clientId || clientIp,
            clientIp,
            clientKey: clientId || clientIp,
            isLegacy: true
        };
    }

    const normalizedClientId = clientId || (declaredRole === 'host' ? `host-${clientIp || 'unknown'}` : '');
    if (!normalizedClientId) {
        return { ok: false, code: 'client_id_missing', message: 'Missing clientId' };
    }

    const identity = {
        ok: true,
        role: declaredRole,
        token,
        clientId: normalizedClientId,
        clientIp,
        clientKey: normalizedClientId || clientIp,
        isLegacy: false
    };

    if (declaredRole === 'host') {
        if (!HOST_TOKEN) {
            return { ok: false, code: 'host_token_not_configured', message: 'Host token not configured on server' };
        }
        if (!token || token !== HOST_TOKEN) {
            return { ok: false, code: 'host_auth_failed', message: 'Invalid host token' };
        }
        return identity;
    }

    if (!VIEWER_TOKEN_SECRET) {
        return { ok: false, code: 'viewer_token_not_configured', message: 'Viewer token secret not configured on server' };
    }
    if (!token) {
        return { ok: false, code: 'viewer_token_missing', message: 'Missing viewer token' };
    }

    const verifyResult = verifyViewerSessionToken(token, VIEWER_TOKEN_SECRET);
    if (!verifyResult.ok) {
        return { ok: false, code: verifyResult.code, message: 'Viewer token verification failed' };
    }
    if (String(verifyResult.payload.sub) !== normalizedClientId) {
        return { ok: false, code: 'viewer_client_mismatch', message: 'Token subject and clientId mismatch' };
    }

    return identity;
}

function buildParticipantPayload(identity, socket) {
    return {
        role: identity.role,
        clientIp: identity.clientIp,
        clientId: identity.clientId,
        clientKey: identity.clientKey,
        legacyMode: !!identity.isLegacy,
        socketId: socket.id
    };
}

function stripTargetId(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, 'targetId')) {
        return value;
    }
    const { targetId, ...rest } = value;
    return rest;
}

function isForwardableEvent(eventName) {
    return !RESERVED_CLIENT_EVENTS.has(eventName) && !SERVER_ONLY_EVENTS.has(eventName);
}

function sanitizeArgs(args) {
    return args.map((arg) => stripTargetId(arg));
}

function normalizeTargetId(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    return getStringValue(value.targetId);
}

function getTargetId(args) {
    for (const arg of args) {
        const targetId = normalizeTargetId(arg);
        if (targetId) return targetId;
    }
    return '';
}

function logForward(eventName, role, targetId) {
    const targetText = targetId ? ` target=${targetId}` : '';
    console.log(`[forward] role=${role} event=${eventName}${targetText}`);
}

function routeEvent(io, socket, role, eventName, args) {
    if (!isForwardableEvent(eventName)) return;

    const targetId = getTargetId(args);
    const routedArgs = sanitizeArgs(args);
    logForward(eventName, role, targetId);

    if (targetId) {
        io.to(targetId).emit(eventName, ...routedArgs);
        return;
    }

    if (role === 'host') {
        socket.broadcast.emit(eventName, ...routedArgs);
        return;
    }

    io.to('hosts').emit(eventName, ...routedArgs);
}

function getParticipantPayloads(io, room) {
    return Array.from(io.sockets.adapter.rooms.get(room) || [])
        .map((socketId) => io.sockets.sockets.get(socketId)?.data?.identity)
        .filter(Boolean);
}

function buildCoreRuntimeSnapshot(io) {
    return {
        mode: 'core-runtime',
        hosts: getParticipantPayloads(io, 'hosts'),
        viewers: getParticipantPayloads(io, 'viewers')
    };
}

function listCompatibilityStudents(io) {
    return getParticipantPayloads(io, 'viewers').map((participant) => participant.clientIp);
}

function buildLogEntry(type, participant) {
    return {
        time: new Date().toISOString(),
        type,
        ip: participant.clientIp,
        clientId: participant.clientId,
        clientKey: participant.clientKey,
        role: participant.role,
        socketId: participant.socketId
    };
}

function getTransportState(io) {
    if (!io.__lumesyncTransportState) {
        io.__lumesyncTransportState = { compatibilityLog: [] };
    }
    return io.__lumesyncTransportState;
}

function pushCompatibilityLog(io, type, participant) {
    const state = getTransportState(io);
    state.compatibilityLog.push(buildLogEntry(type, participant));
    if (state.compatibilityLog.length > STUDENT_LOG_MAX) {
        state.compatibilityLog.shift();
    }
}

function listCompatibilityLog(io) {
    return getTransportState(io).compatibilityLog.slice();
}

function emitParticipantJoined(io, socket, participant) {
    if (participant.role === 'host') {
        socket.to('hosts').emit('participant-joined', participant);
        socket.to('viewers').emit('participant-joined', participant);
        return;
    }
    io.to('hosts').emit('participant-joined', participant);
}

function emitParticipantLeft(io, socket, participant) {
    if (participant.role === 'host') {
        socket.to('hosts').emit('participant-left', participant);
        socket.to('viewers').emit('participant-left', participant);
        return;
    }
    io.to('hosts').emit('participant-left', participant);
}

function setupSocketHandlers(io) {
    getTransportState(io);

    io.on('connection', (socket) => {
        const identity = resolveConnectionIdentity(socket);
        if (!identity.ok) {
            rejectIdentity(socket, identity.code, identity.message);
            return;
        }

        const participant = buildParticipantPayload(identity, socket);
        const room = identity.role === 'host' ? 'hosts' : 'viewers';

        socket.join(room);
        socket.data.identity = participant;

        console.log(`[conn] IP=${identity.clientIp} role=${identity.role} clientId=${identity.clientId} legacy=${identity.isLegacy}`);
        pushCompatibilityLog(io, 'join', participant);
        socket.emit('role-assigned', participant);
        emitParticipantJoined(io, socket, participant);

        socket.onAny((eventName, ...args) => {
            routeEvent(io, socket, identity.role, eventName, args);
        });

        socket.on('disconnect', () => {
            console.log(`[disconnect] IP=${identity.clientIp} role=${identity.role} clientId=${identity.clientId}`);
            pushCompatibilityLog(io, 'leave', participant);
            emitParticipantLeft(io, socket, participant);
        });
    });

    return io;
}

module.exports = {
    setupSocketHandlers,
    buildCoreRuntimeSnapshot,
    listCompatibilityStudents,
    listCompatibilityLog
};
