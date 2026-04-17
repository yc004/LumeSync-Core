"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCoreServer = exports.startServer = exports.io = exports.server = exports.app = void 0;
const create_core_server_js_1 = require("./create-core-server.js");
Object.defineProperty(exports, "createCoreServer", { enumerable: true, get: function () { return create_core_server_js_1.createCoreServer; } });
const runtime = (0, create_core_server_js_1.createCoreServer)();
if (typeof require !== 'undefined' && require.main === module) {
    runtime.startServer();
}
exports.app = runtime.app;
exports.server = runtime.server;
exports.io = runtime.io;
exports.startServer = runtime.startServer;
//# sourceMappingURL=index.js.map