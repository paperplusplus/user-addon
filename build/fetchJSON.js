"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var http_1 = require("http");
function fetchJSON(url) {
    return new Promise(function (resolve, reject) {
        http_1.get(url, function (res) {
            var statusCode = res.statusCode;
            var contentType = res.headers['content-type'];
            var error;
            if (statusCode !== 200) {
                error = new Error('Request Failed.\n' +
                    ("Status Code: " + statusCode));
            }
            else if (!/^application\/json/.test(contentType)) {
                error = new Error('Invalid content-type.\n' +
                    ("Expected application/json but received " + contentType));
            }
            if (error) {
                reject(error.message);
                // consume response data to free up memory
                res.resume();
                return;
            }
            res.setEncoding('utf8');
            var rawData = '';
            res.on('data', function (chunk) { rawData += chunk; });
            res.on('end', function () {
                try {
                    var parsedData = JSON.parse(rawData);
                    resolve(parsedData);
                }
                catch (e) {
                    reject(e.message);
                }
            });
        });
    });
}
exports.default = fetchJSON;
