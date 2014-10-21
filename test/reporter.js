// Load modules
var Fs = require('fs');
var Path = require('path');
var Util = require('util');
var Hoek = require('hoek');
var Lab = require('lab');
var GoodConsole = require('../lib/reporter');
var EventEmitter = require('events').EventEmitter;


// Declare internals

var internals = {};
internals.ops = {
    event: 'ops',
    timestamp: 1411583264547,
    os: {
        load: [ 1.650390625, 1.6162109375, 1.65234375 ],
        mem: { total: 17179869184, free: 8190681088 },
        uptime: 704891
    },
    proc: {
        uptime: 6,
        mem: {
            rss: 30019584,
            heapTotal: 18635008,
            heapUsed: 9989304
        },
        delay: 0.03084501624107361
    },
    load: { requests: {}, concurrents: {}, responseTimes: {} },
    pid: 64291
};
internals.request = {
    event: 'request',
    method: 'post',
    statusCode: 200,
    timestamp: Date.now(),
    instance: 'localhost',
    path: '/data',
    responseTime: 150,
    query: {
        name: 'adam'
    },
    responsePayload: {
        foo:'bar',
        value: 1
    }
};

// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Lab.expect;
var before = lab.before;
var after = lab.after;
var describe = lab.describe;
var it = lab.it;

describe('GoodConsole', function () {

    var log;

    before(function (done) {

        log = console.log;
        done();
    });

    after(function (done) {

        console.log = log;
        done();
    });

    it('throw an error is not constructed with new', function (done) {

        expect(function () {

            var reporter = GoodConsole();
        }).to.throw('GoodConsole must be created with new');
        done();
    });

    it('timeString() correctly formats the time', function (done) {

        var time = new Date(1396207735000);
        var result = GoodConsole.timeString(time);

        expect(result).to.equal('140330/192855.000');
        done();
    });

    describe('_report()', function () {

        describe('printRequest()', function () {

            it('logs to the console for "request" events', function (done) {

                var reporter = new GoodConsole();
                var now = Date.now();
                var timeString = GoodConsole.timeString(now);
                var ee = new EventEmitter();

                console.log = function (value) {

                    expect(value).to.equal(timeString + ', request, localhost: [1;33mpost[0m /data {"name":"adam"} [32m200[0m (150ms) response payload: {"foo":"bar","value":1}');
                    done();
                };

                internals.request.timestamp = now;

                reporter.start(ee, function (err) {

                    expect(err).to.not.exist;

                    ee.emit('report', 'request', internals.request);
                });
            });

            it('logs to the console for "request" events without a query', function (done) {

                var reporter = new GoodConsole();
                var now = Date.now();
                var timeString = GoodConsole.timeString(now);
                var event = Hoek.clone(internals.request);
                var ee = new EventEmitter();

                delete event.query;

                console.log = function (value) {

                    expect(value).to.equal(timeString + ', request, localhost: [1;33mpost[0m /data  [32m200[0m (150ms) response payload: {"foo":"bar","value":1}');
                    done();
                };

                event.timestamp = now;

                reporter.start(ee, function (err) {

                    expect(err).to.not.exist;
                    ee.emit('report', 'request', event);
                });
            });

            it('logs to the console for "request" events without a responsePayload', function (done) {

                var reporter = new GoodConsole();
                var now = Date.now();
                var timeString = GoodConsole.timeString(now);
                var event = Hoek.clone(internals.request);
                var ee = new EventEmitter();

                delete event.responsePayload;

                console.log = function (value) {

                    expect(value).to.equal(timeString + ', request, localhost: [1;33mpost[0m /data {"name":"adam"} [32m200[0m (150ms) ');
                    done();
                };

                event.timestamp = now;

                reporter.start(ee, function (err) {

                    expect(err).to.not.exist;
                    ee.emit('report', 'request', event);
                });
            });

            it('provides a default color for request methods', function (done) {

                var reporter = new GoodConsole();
                var now = Date.now();
                var timeString = GoodConsole.timeString(now);
                var event = Hoek.clone(internals.request);
                var ee = new EventEmitter();

                console.log = function (value) {

                    expect(value).to.equal(timeString + ', request, localhost: [1;34mhead[0m /data {"name":"adam"} [32m200[0m (150ms) response payload: {"foo":"bar","value":1}');
                    done();
                };

                event.timestamp = now;
                event.method = 'head';

                reporter.start(ee, function (err) {

                    expect(err).to.not.exist;
                    ee.emit('report', 'request', event);
                });
            });

            it('does not log a status code if there is not one attached', function (done) {

                var reporter = new GoodConsole();
                var now = Date.now();
                var timeString = GoodConsole.timeString(now);
                var event = Hoek.clone(internals.request);
                var ee = new EventEmitter();

                console.log = function (value) {

                    expect(value).to.equal(timeString + ', request, localhost: [1;33mpost[0m /data {"name":"adam"}  (150ms) response payload: {"foo":"bar","value":1}');
                    done();
                };

                event.timestamp = now;
                delete event.statusCode;

                reporter.start(ee, function (err) {

                    expect(err).to.not.exist;
                    ee.emit('report', 'request', event);
                });

            });

            it('uses different colors for different status codes', function (done) {

                var counter = 1;
                var reporter = new GoodConsole();
                var now = Date.now();
                var timeString = GoodConsole.timeString(now);
                var colors = {
                    1: 32,
                    2: 32,
                    3: 36,
                    4: 33,
                    5: 31
                };
                var ee = new EventEmitter();

                console.log = function (value) {

                    var expected = Util.format('%s, request, localhost: [1;33mpost[0m /data  [%sm%s[0m (150ms) ', timeString, colors[counter], counter * 100);
                    expect(value).to.equal(expected);
                    counter++;

                    if (counter === 5) { done(); }
                };


                reporter.start(ee, function (err) {

                    expect(err).to.not.exist;

                    for (var i = 1; i < 6; ++i) {
                        var event = Hoek.clone(internals.request);
                        event.statusCode = i * 100;
                        event.timestamp = now;

                        delete event.query;
                        delete event.responsePayload;

                        ee.emit('report', 'request', event);
                    }
                });
            });
        });

        it('prints ops events', function (done) {

            var reporter = new GoodConsole({
                events:{
                    ops: '*'
                }
            });
            var now = Date.now();
            var timeString = GoodConsole.timeString(now);
            var event = Hoek.clone(internals.ops);
            var ee = new EventEmitter();

            console.log = function (value) {

                expect(value).to.equal(timeString + ', ops, memory: 29Mb, uptime (seconds): 6, load: 1.650390625,1.6162109375,1.65234375');
                done();
            };

            event.timestamp = now;

            reporter.start(ee, function (err) {

                expect(err).to.not.exist;
                ee.emit('report', 'ops', event);
            });
        });

        it('prints error events', function (done) {

            var reporter = new GoodConsole({
                events:{
                    error: '*'
                }
            });
            var now = Date.now();
            var timeString = GoodConsole.timeString(now);
            var event = {
                event: 'error',
                message: 'test message',
                stack: 'fake stack for testing'
            };
            var ee = new EventEmitter();

            console.log = function (value) {

                expect(value).to.equal(timeString + ', internalError, message: test message stack: fake stack for testing');
                done();
            };

            event.timestamp = now;

            reporter.start(ee, function (err) {

                expect(err).to.not.exist;
                ee.emit('report', 'error', event);
            });
        });

        it('has a fallback for unknown event types', function (done) {

            var reporter = new GoodConsole({
                events: {
                    test: '*'
                }
            });
            var now = Date.now();
            var timeString = GoodConsole.timeString(now);
            var event = {
                event: 'test',
                data: {
                    reason: 'for testing'
                },
                tags: ['user']
            };
            var ee = new EventEmitter();

            console.log = function (value) {

                expect(value).to.equal(timeString + ', user, {"reason":"for testing"}');
                done();
            };

            event.timestamp = now;

            reporter.start(ee, function (err) {

                expect(err).to.not.exist;
                ee.emit('report', 'test', event);
            });
        });
    });
});
