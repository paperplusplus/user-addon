"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var mixed_reality_extension_sdk_1 = require("@microsoft/mixed-reality-extension-sdk");
var path_1 = require("path");
var app_1 = __importDefault(require("./app"));
mixed_reality_extension_sdk_1.log.enable('app');
process.on('uncaughtException', function (err) { return console.log('uncaughtException', err); });
process.on('unhandledRejection', function (reason) { return console.log('unhandledRejection', reason); });
// Start listening for connections, and serve static files
// Note that process.env.BASE_URL/PORT variables will automatically be used if defined in the .env file
var server = new mixed_reality_extension_sdk_1.WebHost({
    baseDir: path_1.resolve(__dirname, '../public'),
    optionalPermissions: [mixed_reality_extension_sdk_1.Permissions.UserInteraction]
});
// Handle new application sessions
server.adapter.onConnection(function (context, params) { return new app_1.default(context, params, server.baseUrl); });
exports.default = server;
