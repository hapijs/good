// Load modules
var GoodReporter = require('good-reporter');
var Hoek = require('hoek');

// Declare internals

var internals = {
    defaults: {
        events: {
            request: [],
            log: []
        }
    }
};

module.exports = internals.GoodConsole = function (options) {

	Hoek.assert(this.constructor === internals.GoodConsole, 'GoodConsole must be created with new');
	options = options || {};
    var settings = Hoek.clone(options);

    settings = Hoek.applyToDefaults(internals.defaults, settings);

	GoodReporter.call(this, settings);
};

Hoek.inherits(internals.GoodConsole, GoodReporter);

internals.printEvent = function(event) {

	var pad = function (value) {

		return (value < 10 ? '0' : '') + value;
	};

	var now = new Date(event.timestamp);
	var timestring = (now.getYear() - 100).toString() +
		pad(now.getMonth() + 1) +
		pad(now.getDate()) +
		'/' +
		pad(now.getHours()) +
		pad(now.getMinutes()) +
		pad(now.getSeconds()) +
		'.' +
		now.getMilliseconds();

	var data = event.data;
	if (typeof event.data !== 'string') {
		try {
			data = JSON.stringify(event.data);
		}
		catch (e) {
			data = 'JSON Error: ' + e.message;
		}
	}

	var output = timestring + ', ' + event.tags[0] + ', ' + data;
	console.log(output);
};

internals.GoodConsole.prototype.report = function (callback) {

	for (var i = 0, il = this._eventQueue.length; i < il; i++) {
		var event = this._eventQueue[i];
		if (event.event === 'ops') {
			internals.printEvent({
				timestamp: event.timestamp,
				tags: ['ops'],
				data: 'memory: ' + Math.round(event.proc.mem.rss / (1024 * 1024)) +
				'Mb, uptime (seconds): ' + event.proc.uptime +
				', load: ' + event.os.load
			});
		}
		else if (event.event === 'request') {

			var query = event.query ? JSON.stringify(event.query) : '';
			var responsePayload = ' ';
			var statusCode = '';

			if (event.responsePayload) {
				try {
					responsePayload = ' response payload: ' + JSON.stringify(event.responsePayload);
				} catch (err) {
					//responsePayload = ' response payload: ' + SafeStringify(event.responsePayload);
				}
			}

			var methodColors = { 'get': 32, 'delete': 31, 'put': 36, 'post': 33 };
			var color = methodColors[event.method] || 34;
			var method = '\x1b[1;' + color + 'm' + event.method + '\x1b[0m';

			if (event.statusCode) {
				color = (event.statusCode >= 500 ? 31 : (event.statusCode >= 400 ? 33 : (event.statusCode >= 300 ? 36 : 32)));
				statusCode = ' \x1b[' + color + 'm' + event.statusCode + '\x1b[0m';
			}

			internals.printEvent({
				timestamp: event.timestamp,
				tags: ['request'],
				data: event.instance + ': ' + method + ' ' + event.path + ' ' + query + statusCode + ' (' + event.responseTime + 'ms)' + responsePayload
			});
		}
		else if (event.event === 'error') {
			internals.printEvent({
				timestamp: event.timestamp,
				tags: ['internalError'],
				data: 'message: ' + event.message + ' stack: ' + event.stack
			});
		}
		else {
			internals.printEvent(event);
		}
	}

	this._eventQueue.length = 0;
	callback(null);
};
