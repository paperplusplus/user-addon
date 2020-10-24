"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var MRE = __importStar(require("@microsoft/mixed-reality-extension-sdk"));
var fetchJSON_1 = __importDefault(require("./fetchJSON"));
var latlng = require('utm-latlng');
var API_KEY = process.env['API_KEY'];
// CONFIGARABLES.
var JOINED_SOUND_DURATION = 4860;
var LEFT_SOUND_DURATION = 3200;
var DELAY_BETWEEN_SOUNDS = 100;
/**
 * The main class of this app. All the logic goes here.
 */
var Inventory = /** @class */ (function () {
    // constructor
    function Inventory(_context, params, _baseUrl) {
        var _this = this;
        this._context = _context;
        this.params = params;
        this.context = _context;
        this.baseUrl = _baseUrl;
        this.assets = new MRE.AssetContainer(this.context);
        this.utm = new latlng();
        this.joinedSound = this.assets.createSound('joined', { uri: this.baseUrl + "/joined.ogg" });
        this.leftSound = this.assets.createSound('left', { uri: this.baseUrl + "/left.ogg" });
        this.box = MRE.Actor.Create(this.context, {
            actor: {
                transform: {
                    local: {
                        position: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 }
                    }
                },
                appearance: {
                    enabled: false,
                    meshId: this.assets.createBoxMesh('box_mesh', 0.1, 0.1, 0.1).id,
                    materialId: this.assets.createMaterial('box_material', { color: MRE.Color3.LightGray() }).id
                },
                collider: {
                    geometry: { shape: MRE.ColliderType.Auto },
                    layer: MRE.CollisionLayer.Hologram
                }
            }
        });
        this.context.onStarted(function () { return _this.init(); });
        this.context.onUserJoined(function (user) { return _this.userJoined(user); });
        this.context.onUserLeft(function (user) { return _this.userLeft(user); });
    }
    /**
     * Once the context is "started", initialize the app.
     */
    Inventory.prototype.init = function () {
    };
    Inventory.prototype.userJoined = function (user) {
        var _this = this;
        this.playSound(this.joinedSound);
        setTimeout(function () {
            _this.greet(user);
        }, JOINED_SOUND_DURATION + DELAY_BETWEEN_SOUNDS);
    };
    Inventory.prototype.userLeft = function (user) {
        var _this = this;
        this.playSound(this.leftSound);
        setTimeout(function () {
            _this.bye(user);
        }, LEFT_SOUND_DURATION + DELAY_BETWEEN_SOUNDS);
    };
    Inventory.prototype.playSound = function (musicAsset) {
        this.box.startSound(musicAsset.id, {
            volume: 0.5,
            looping: false,
            rolloffStartDistance: 2.5
        });
    };
    Inventory.prototype.parseUser = function (user) {
        return {
            id: user.id,
            name: user.name,
            device: user.properties['device-model'],
            ip: user.properties['remoteAddress']
        };
    };
    Inventory.prototype.ip2location = function (ip) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("http://api.ipapi.com/" + ip + "?access_key=" + API_KEY);
                        return [4 /*yield*/, fetchJSON_1.default("http://api.ipapi.com/" + ip + "?access_key=" + API_KEY)];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, {
                                lat: res.latitude,
                                lng: res.longitude,
                                cc: res.country_code,
                                country: res.country_name
                            }];
                }
            });
        });
    };
    Inventory.prototype.greet = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var u, name, loc, greetText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        u = this.parseUser(user);
                        name = u.name;
                        return [4 /*yield*/, this.ip2location(u.ip)];
                    case 1:
                        loc = _a.sent();
                        console.log('UTC', this.utm.convertLatLngToUtm(loc.lat, loc.lng).ZoneNumber);
                        greetText = '';
                        return [2 /*return*/];
                }
            });
        });
    };
    Inventory.prototype.bye = function (user) {
    };
    return Inventory;
}());
exports.default = Inventory;
