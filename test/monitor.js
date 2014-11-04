// Load modules

var Lab = require('lab');
var Hapi = require('hapi');
var Hoek = require('hoek');
var Http = require('http');
var Path = require('path');
var Fs = require('fs');
var Monitor = require('../lib/monitor');
var Dgram = require('dgram');
var Net = require('net');
var Async = require('async');
var SafeStringify = require('json-stringify-safe');
var Wreck = require('wreck');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Lab.expect;
var before = lab.before;
var after = lab.after;
var describe = lab.describe;
var it = lab.it;


describe('Monitor', function () {

    var makePack = function (callback) {

        var holder = null;

        var plugin = {
            name: '--test',
            version: '0.0.0',
            register: function (pack, options, next) {

                holder = pack;
                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(holder).to.exist;
            callback(holder, server);
        });
    };

    it('throws an error constructed without new', function (done) {

        var fn = function () {

            var monitor = Monitor();
        };

        expect(fn).throws(Error, 'Monitor must be instantiated using new');
        done();
    });

    it('has no options', function (done) {

        makePack(function (pack, server) {

            var fn = function () {

                var monitor = new Monitor(pack);
            };
            expect(fn).to.not.throw();
            done();
        });
    });

    it('throws an error if opsInterval is too small', function (done) {

        var options = {
            subscribers: {},
            opsInterval: 50
        };

        makePack(function (pack, server) {

            var fn = function () {

                var monitor = new Monitor(pack, options);
            };

            expect(fn).to.throw(Error, /opsInterval must be larger than or equal to 100/gi);
            done();
        });
    });

    it('does not throw an error when opsInterval is more than 100', function (done) {

        var options = {
            subscribers: {},
            opsInterval: 100
        };

        makePack(function (pack, server) {

            var fn = function () {

                var monitor = new Monitor(pack, options);
            };

            expect(fn).not.to.throw(Error);
            done();
        });
    });

    it('throws an error if requestsEvent is not response or tail', function (done) {

        var options = {
            requestsEvent: 'test'
        };

        makePack(function (pack, server) {

            var fn = function () {
                var monitor = new Monitor(pack, options);
            };

            expect(fn).to.throw(Error, /requestsEvent must be one of response, tail/gi);
            done();
        });
    });

    it('throws an error if extra options are passed in', function (done) {

        var options = {
            subscriptionz: ['ops', 'error']
        };

        makePack(function (pack, server) {
            var fn = function () {
                var monitor = new Monitor(pack, options);
            };

            expect(fn).to.throw(Error, /invalid monitorOptions options/gi);
            done();
        });

    });

    it('throws an error if unsupported events are passed in', function (done) {

        var options = {
            subscribers: {
                console: ['disconnect', 'request']
            }
        };

        makePack(function (pack, server) {

            var fn = function () {

                var monitor = new Monitor(pack, options);
            };

            expect(fn).to.throw(Error, /position 0 fails because value must be one of ops, request, log, error/gi);
            done();
        });

    });

    it('requestsEvent is a response', function (done) {

        var options = {
            subscribers: {},
            requestsEvent: 'response'
        };

        makePack(function (pack, server) {

            var fn = function () {

                var monitor = new Monitor(pack, options);
            };

            expect(fn).not.to.throw(Error);
            done();
        });
    });

    it('uses the passed in broadcastInterval and sets the event queue correctly', function (done) {

        var options = {
            broadcastInterval: 5
        };

        makePack(function (pack, server) {

            var monitor = new Monitor(pack, options);

            expect(monitor._subscriberQueues.console).to.exist;
            expect(monitor._eventQueues.request).to.exist;
            expect(monitor._eventQueues.log).to.exist;
            monitor.stop();
            done();
        });
    });

    describe('#_broadcastConsole', function () {

        it('filters out events that don\'t contain the subscribers tag', function (done) {

            var options = {
                subscribers: {
                    'console': { tags: ['ERROR', 'WARNING'], events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._subscriberQueues.console).to.exist;
                expect(monitor._eventQueues.log).to.exist;

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    expect(string).to.not.exist;
                };
                server.log('other', 'not used');
                monitor.stop();
                // reset console.log back to normal
                console.log = trapConsole;
                done();
            });
        });

        it('shows events that the subscriber tags match', function (done) {

            var options = {
                subscribers: {
                    'console': { tags: ['ERROR', 'WARNING'], events: ['log', 'error'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._subscriberQueues.console).to.exist;
                expect(monitor._eventQueues.log).to.exist;

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    expect(string).to.contain('included in output');
                };
                server.log('ERROR', 'included in output');
                monitor.stop();
                // reset console.log back to normal
                console.log = trapConsole;
                done();
            });
        });

        it('displays request events correctly', function (done) {

            var options = {
                subscribers: {
                    'console': { events: ['request'] }
                }
            };

            var server = new Hapi.Server(0);

            var plugin = {
                register: require('../lib/index').register,
                options: options
            }

            server.pack.register(plugin, function () {

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                server.start(function () {

                    console.log = function(string) {

                        expect(string).to.not.contain('undefined');
                        expect(string).to.contain('test');
                        console.log = trapConsole;
                        done();
                    };
                    Http.get('http://127.0.0.1:' + server.info.port + '/?q=test');
                });
            });
        });

        it('displays error events correctly', function (done) {

            var options = {
                subscribers: {
                    'console': { events: ['error'] }
                }
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'GET', path: '/err', handler: function (request, reply) {
                reply(new Hapi.error.internal('my error'))
            }});

            var plugin = {
                register: require('../lib/index').register,
                options: options
            }

            server.pack.register(plugin, function () {

                server.start(function () {

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.not.contain('undefined');
                        expect(string).to.contain('test');
                        // reset console.log
                        console.log = trapConsole;
                        done();
                    };

                    Http.get('http://127.0.0.1:' + server.info.port + '/err');
                });
            });
        });

        it('displays payload events correctly', function (done) {

            var options = {
                subscribers: {
                    'console': { events: ['request'] }
                },
                logRequestPayload: true,
                logResponsePayload: true
            };

            var server = new Hapi.Server('127.0.0.1', 0);
            server.route({
                method: 'POST',
                path: '/test',
                handler: function (request, reply) {
                    server.stop({timeout: 1});
                    reply({bar: 'foo'});
                }
            });

            var plugin = {
                register: require('../lib/index').register,
                options: options
            }

            server.pack.register(plugin, function (err) {

               if (err) {
                   console.log('did not register plugin: ' + err);
               }
            });

            server.start(function () {

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    expect(string).to.contain('response payload: {"bar":"foo"}');
                    // reset console.log
                    console.log = trapConsole;
                    done();
                };
                var payload = JSON.stringify({ payload: { foo: "bar" } }); 
                Wreck.request('POST', server.info.uri + '/test', payload);
            });
        });

        it('displays payload events correctly circular', function (done) {

            var options = {
                subscribers: {
                    'console': { events: ['request'] }
                },
                logRequestPayload: true,
                logResponsePayload: true
            };

            var server = new Hapi.Server('127.0.0.1', 0);
            server.route({
                method: 'POST',
                path: '/test',
                handler: function (request, reply) {
              
                    reply(request.raw.req);
                }
            });

            var plugin = {
                register: require('../lib/index').register,
                options: options
            }

            server.pack.register(plugin, function (err) {

               if (err) {
                   console.log('did not register plugin: ' + err);
               }
            });

            server.start(function () {

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    //console.error(string);
                    expect(string).to.contain('response payload: ');
                    expect(string).to.contain('[Circular ~]');
                    // reset console.log
                    console.log = trapConsole;
                    done();
                };
                var payload = JSON.stringify({ payload: { foo: "bar" } }); 
                Wreck.request('POST', server.info.uri + '/test', payload);
            });
        });


        it('display events for objects that can not be stringified', function (done) {
            var options = {
                subscribers: {
                    'console': { events: ['log'] }
                }
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'GET', path: '/log', handler: function (request, reply) {
                var t = {};
                t.value = t;
                request.server.log(['log'], t);
                reply('ok');
            }});

            var plugin = {
                register: require('../lib/index').register,
                options: options
            }

            server.pack.register(plugin, function () {

                server.start(function () {

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('JSON Error: Converting circular structure to JSON');
                        // reset console.log
                        console.log = trapConsole;
                        done();
                    };

                    Http.get('http://127.0.0.1:' + server.info.port + '/log');
                });
            });
        });
    });

    describe('#_broadcastHttp', function () {

        it('does not do anything if there are no subscribers', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);
                expect(monitor._broadcastHttp()).to.not.exist;
                done();
            });
        });

        it('broadcasts all events when no tags are provided', function (done) {

            var options = {
                subscribers: {
                    'console': { events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._subscriberQueues.console).to.exist;
                expect(monitor._eventQueues.log).to.exist;

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    expect(string).to.contain('included in output');
                };
                server.log('ERROR', 'included in output');
                monitor._broadcastHttp();
                monitor.stop();
                // reset console.log back to normal
                console.log = trapConsole;
                done();
            });
        });

        it('sends all events to a remote server subscriber', function (done) {

            var remoteServer = new Hapi.Server(0);
            remoteServer.route({
                method: 'POST', path: '/', handler: function (request, reply) {

                    expect(request.payload.appVer).to.exist;
                    expect(request.payload.appVer).to.not.equal('unknown');
                    done();
                }
            });

            var options = {
                subscribers: {}
            };

            remoteServer.start(function () {

                options.subscribers['http://127.0.0.1:' + remoteServer.info.port] = { events: ['log'] };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    expect(monitor._eventQueues.log).to.exist;

                    server.log('ERROR', 'included in output');
                    monitor._broadcastHttp();
                });
            });
        });

        it('sends response status code to remote subscribers', function (done) {

            var remoteServer = new Hapi.Server(0);
            var server = new Hapi.Server(0);

            remoteServer.route({
                method: 'POST', path: '/', handler: function (request, reply) {

                    expect(request.payload.events[0].statusCode).to.equal(200);
                    reply('Success');
                    done();
                }
            });

            server.route({
                method: 'GET', path: '/', handler: function (request, reply) {

                    reply('Success');
                }
            });

            var options = {
                subscribers: {}
            };

            remoteServer.start(function () {

                options.subscribers['http://127.0.0.1:' + remoteServer.info.port] = { events: ['request'] };
                var plugin = {
                    register: require('../lib/index').register,
                    options: options
                }

                server.pack.register(plugin, function () {

                    server.start(function () {

                        Http.get('http://127.0.0.1:' + server.info.port, function () {

                            server.plugins.good.monitor._broadcastHttp();
                        });
                    });
                });
            });
        });

        it('does not fail when a remote subscriber is unavailable', function (done) {

            var options = {
                subscribers: {
                    'http://notfound/server': { events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                monitor._broadcastHttp();

                setTimeout(function () {

                    done();
                }, 100);
            });
        });
    });

    describe('#_broadcastUdp', function () {

        it('does not do anything if there are no subscribers', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._broadcastUdp()).to.not.exist;
                done();
            });
        });

        it('broadcasts all events when no tags are provided', function (done) {

            var options = {
                subscribers: {
                    'console': { events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._subscriberQueues.console).to.exist;
                expect(monitor._eventQueues.log).to.exist;

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    expect(string).to.contain('included in output');
                };
                server.log('ERROR', 'included in output');
                monitor._broadcastUdp();
                monitor.stop();
                // reset console.log back to normal
                console.log = trapConsole;
                done();
            });
        });

        it('does not fail when a remote subscriber is unavailable', function (done) {

            var options = {
                subscribers: {
                    'udp://notfound:1234': { events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                monitor._broadcastUdp();

                setTimeout(function () {
                    done();
                }, 100);
            });
        });

        it('sends all events to a remote server subscriber', function (done) {

            var remoteServer = Dgram.createSocket('udp4');

            remoteServer.on('message', function (msg, rinfo) {

                done();
            });

            remoteServer.on('listening', function () {

                var options = {
                    subscribers: {}
                };
                options.subscribers['udp://127.0.0.1:' + remoteServer.address().port] = { events: ['log'] };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    expect(monitor._eventQueues.log).to.exist;

                    server.log('ERROR', 'included in output');
                    monitor._broadcastUdp();
                });
            });

            remoteServer.bind(0, '127.0.0.1');
        });
    });

    describe('#_broadcastRedis', function () {

        it('does not do anything if there are no subscribers', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._broadcastRedis()).to.not.exist;
                done();
            });
        });

        it('broadcasts all events when no tags are provided', function (done) {

            var options = {
                subscribers: {
                    'console': { events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._subscriberQueues.console).to.exist;
                expect(monitor._eventQueues.log).to.exist;

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    expect(string).to.contain('included in output');
                };
                server.log('ERROR', 'included in output');
                monitor._broadcastRedis();
                monitor.stop();
                // reset console.log back to normal
                console.log = trapConsole;
                done();
            });
        });

        it('does not fail when a remote subscriber is unavailable', function (done) {

            var options = {
                subscribers: {
                    'redis://notfound:1234/listname': { events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                monitor._broadcastRedis();

                setTimeout(function () {
                    done();
                }, 100);
            });
        });

        it('sends all events to a remote server subscriber', function (done) {

            var remoteServer = Net.createServer(function (c) {
                c.on('data', function (data) {
                    var d = data.toString();

                    if (d.indexOf("rpush\r\n") > -1) {
                        c.write(':1\r\n');
                    }

                    if (d.indexOf("info\r\n") > -1) {
                        c.write('$32\r\n# Server\r\nredis_version:2.6.16\r\n');
                    }

                    if (d.indexOf("quit\r\n") > -1) {
                        c.end();
                        done();
                    }
                });
            });

            remoteServer.listen(function () {

                var options = {
                    subscribers: {}
                };

                options.subscribers['redis://127.0.0.1:' + remoteServer.address().port + '/listname'] = { events: ['log'] };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    expect(monitor._eventQueues.log).to.exist;

                    server.log('ERROR', 'included in output');
                    monitor._broadcastRedis();
                });
            });
        });
    });

    describe('#_broadcastFile', function () {

        before(function (done) {

            var folderPath = Path.join(__dirname, 'logs');

            if (!Fs.existsSync(folderPath)) {
                Fs.mkdirSync(folderPath);
            }

            done();
        });

        after(function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            Fs.readdirSync(folderPath).forEach(function (filePath) {

                Fs.unlinkSync(Path.join(folderPath, filePath));
            });

            Fs.rmdir(folderPath, done);
        });

        it('filters out events that don\'t contain the subscribers tag', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog0');
            options.subscribers[dest] = { tags: ['ERROR', 'WARNING'], events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);
                server.log('other', 'not used');

                var fn = function () {

                    var file = Fs.readFileSync(dest + '.001');
                };

                expect(fn).to.throw(Error);

                done();
            });
        });


        it('handles circular reference when stringifying', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog11');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                var circObj = { howdy: 'hi' };
                circObj.obj = circObj;

                server.log('ERROR', circObj);

                setTimeout(function () {

                    var file = Fs.readFileSync(dest);
                    var formatted = file.toString().split('\n');

                    expect(formatted[0]).to.contain('Circular');

                    done();
                }, 10);
            });
        });


        it('sends all events to a log file', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog1');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    setTimeout(function () {

                        var file = Fs.readFileSync(dest);
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.equal('included in output');

                        done();
                    }, 10);
                }, 10);
            });
        });

        it('sends all events to a log file with an extension', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog1.log');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    setTimeout(function () {

                        var file = Fs.readFileSync(dest);
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.equal('included in output');

                        done();
                    }, 10);
                }, 10);
            });
        });

        it('handles logging to file when event queue is empty', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog_empty.log');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);
                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                monitor._broadcastFile();

                setTimeout(function () {
                    server.log('ERROR', 'another error');
                    setTimeout(function () {

                        var file = Fs.readFileSync(dest);
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[1].data).to.equal('another error');
                        done();
                    }, 20);
                }, 10);
            });
        });

        it('writes to the next file when one already exists', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {},
                maxLogSize: 100000
            };

            var dest = Path.join(folderPath, 'mylog2');

            if (!Fs.exists(dest + '.001')) {
                Fs.writeFileSync(dest + '.001', '');
            }

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    setTimeout(function () {

                        var file = Fs.readFileSync(dest + '.002');
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.equal('included in output');

                        done();
                    }, 10);
                }, 10);
            });
        });

        it('writes to the next file when one already exists with extension on destination', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {},
                maxLogSize: 100000
            };

            var dest = Path.join(folderPath, 'mylog2.log');

            if (!Fs.exists(dest + '.001')) {
                Fs.writeFileSync(dest + '.001', '');
            }

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    setTimeout(function () {

                        var file = Fs.readFileSync(dest + '.002');
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.equal('included in output');

                        done();
                    }, 10);
                }, 10);
            });
        });

        it('splits log files when maxLogSize exceeded', function (done) {

            var folderPath = Path.join(__dirname, 'logs');

            var options = {
                subscribers: {},
                maxLogSize: 200
            };

            var dest = Path.join(folderPath, 'mylog3');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'here is one more error');
                    server.log('ERROR', 'here is one more error');
                    server.log('ERROR', 'here is one more error');

                    setTimeout(function () {

                        var file = Fs.readFileSync(dest + '.002');
                        var formatted = file.toString().split('\n');
                        var result = JSON.parse('[' + formatted + ']');

                        expect(result[0].data).to.equal('here is one more error');

                        done();
                    }, 10);
                }, 10);
            });
        });

        it('handles large amounts of log events', function (done) {

            var folderPath = Path.join(__dirname, 'logs');

            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog7.log');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                server.log('ERROR', 'here is one more error');
                server.log('ERROR', 'here is one more error');
                server.log('ERROR', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'another error');

                    setTimeout(function () {

                        var file = Fs.readFileSync(dest);
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.equal('included in output');
                        expect(result.length).to.equal(17);

                        done();
                    }, 20);
                }, 30);
            });
        });

        it('handles large amounts of log events with multiple file subscribers', function (done) {

            var folderPath = Path.join(__dirname, 'logs');

            var options = {
                subscribers: {}
            };

            var dest1 = Path.join(folderPath, 'mylog8.log');
            var dest2 = Path.join(folderPath, 'mylog9.log');

            options.subscribers[dest1] = { events: ['log'] };
            options.subscribers[dest2] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                server.log('ERROR', 'here is one more error');
                server.log('ERROR', 'here is one more error');
                server.log('ERROR', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');
                server.log('MYTAG', 'here is one more error');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'another error');

                    setTimeout(function () {

                        var file = Fs.readFileSync(dest1);
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.equal('included in output');
                        expect(result.length).to.be.greaterThan(12);

                        done();
                    }, 20);
                }, 30);
            });
        });

        it('logs correct events to multiple file subscribers', function (done) {

            var results = {
                osload: 1,
                osmem: 20,
                osup: 50
            };

            var folderPath = Path.join(__dirname, 'logs');

            var options = {
                subscribers: {}
            };

            var dest1 = Path.join(folderPath, 'requestlog.log');
            var dest2 = Path.join(folderPath, 'opslog.log');

            options.subscribers[dest1] = { events: ['request'] };
            options.subscribers[dest2] = { events: ['ops'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);
                monitor.emit('ops', results);

                server.inject('/notfound', function () {

                    setTimeout(function () {

                        var file1 = Fs.readFileSync(dest1);
                        var formatted1 = file1.toString().split('\n');
                        var file2 = Fs.readFileSync(dest2);
                        var formatted2 = file2.toString().split('\n');

                        var result1 = JSON.parse('[' + formatted1 + ']');
                        var result2 = JSON.parse('[' + formatted2 + ']');

                        expect(result1[0].event).to.equal('request');
                        expect(result2[0].event).to.equal('ops');

                        done();
                    }, 50);
                });
            });
        });

        it('does not overwrite log file with several initial log events', function (done) {

            var folderPath = Path.join(__dirname, 'logs');

            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog4');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                server.log('ERROR', 'another error');
                server.log('ERROR', 'here is one more error');

                setTimeout(function () {

                    var file = Fs.readFileSync(dest);
                    var formatted = file.toString().split('\n');

                    var result = JSON.parse('[' + formatted + ']');
                    expect(result[0].data).to.equal('included in output');
                    expect(result[1].data).to.equal('another error');

                    done();
                }, 30);
            });
        });

        it('logs to a directory when provided', function (done) {

            var folderPath = Path.join(__dirname, 'logsdir');

            var options = {
                subscribers: {}
            };

            if (!Fs.existsSync(folderPath)) {
                Fs.mkdirSync(folderPath);
            }

            options.subscribers[folderPath + '/'] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                server.log('ERROR', 'another error');
                server.log('ERROR', 'here is one more error');

                setTimeout(function () {

                    var files = Fs.readdirSync(folderPath);
                    var file = Fs.readFileSync(Path.join(folderPath, files[0]));
                    var formatted = file.toString().split('\n');

                    var result = JSON.parse('[' + formatted + ']');
                    expect(result[0].data).to.equal('included in output');
                    expect(result[1].data).to.equal('another error');

                    Fs.readdirSync(folderPath).forEach(function (filePath) {

                        Fs.unlinkSync(Path.join(folderPath, filePath));
                    });

                    Fs.rmdir(folderPath, done);
                }, 20);
            });
        });

        it('sends all events to a log file through multiple log emits', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog5.log');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);
                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'and another error');
                    setTimeout(function () {

                        var file = Fs.readFileSync(dest);
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.exist;
                        expect(result[0].data).to.equal('included in output');
                        expect(result[1].data).to.equal('another error');

                        done();
                    }, 20);
                }, 10);
            });
        });

        it('handles errors with reading a directory', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog6.log');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);
                expect(monitor._eventQueues.log).to.exist;

                var readdir = Fs.readdir;
                Fs.readdir = function (path, callback) {

                    callback(new Error());
                    Fs.readdir = readdir;
                }

                server.log('ERROR', 'another error');
                done();
            });
        });

        it('handles the error when destination file exists', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {},
                maxLogSize: 0
            };

            var dest = Path.join(folderPath, 'mylog7.log.001');

            if (Fs.exists(dest)) {
                Fs.unlinkSync(dest);
            }

            var s = Fs.openSync(dest, 'wx+');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    done();
                }, 20);
            });
        });

        it('handles the error when directory does not exist', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {},
                maxLogSize: 100
            };

            var dest = Path.join(folderPath, 'mylogpath/');

            if (Fs.exists(dest)) {
                Fs.unlinkSync(dest);
            }

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    done();
                }, 20);
            });
        });
    });

    describe('#_ops', function () {

        it('sets the event with the result data correctly', function (done) {

            var results = {
                osload: 1,
                osmem: 20,
                osup: 50
            };

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var event = monitor._ops()(results);

                expect(event.os.load).to.equal(1);
                expect(event.os.mem).to.equal(20);
                done();
            });
        });

        it('log pid for ops if options are set', function (done) {

            var results = {
                osload: 1,
                osmem: 20,
                osup: 50
            };

            var options = {
                subscribers: {},
                logPid: true
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var event = monitor._ops()(results);

                expect(event.os.load).to.equal(1);
                expect(event.os.mem).to.equal(20);
                expect(event.pid).to.exist;
                done();
            });
        });

        it('emits ops data', function (done) {

            var options = {
                subscribers: {
                    'http://localhost:1023/': ['ops']
                },
                opsInterval: 100
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                server.inject({ url: '/' }, function () {
                    server.inject({ url: '/' }, function () {
                        server.inject({ url: '/test' }, function () {

                            monitor.once('ops', function (event) {

                                expect(event.requests['80'].total).to.equal(3);
                                //expect(event.requests['80'].statusCodes['404']).to.equal(2);
                                expect(event.osload).to.exist;
                                monitor.stop();
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('emits an event when everything succeeds', function (done) {

            var options = {
                subscribers: {},
                opsInterval: 100,
                alwaysMeasureOps: true
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                monitor.once('ops', function (event) {

                    expect(event.osup).to.be.greaterThan(0);
                    monitor.stop();
                    done();
                });
            });
        });

        it('gracefully handles error conditions', function (done) {

            var options = {
                subscribers: {},
                opsInterval: 100,
                alwaysMeasureOps: true
            };

            makePack(function (pack, server) {

                var parallel = Async.parallel;

                Async.parallel = function (methods, callback) {

                    var _callback = function (error, results) {

                        callback(error, results);

                        expect(error).to.exist;
                        monitor.stop();
                        Async.parallel = parallel;
                        done();
                    };

                    methods.createError = function (callback) {

                        return callback(new Error('there was an error during processing'));
                    }

                    parallel(methods, _callback);
                }

                var monitor = new Monitor(pack, options);
            });
        });
    });

    describe('#_handle', function () {

        it('dispatches immediately when broadcastInterval is 0', function (done) {

            var options = {
                subscribers: {
                    'http://localhost:1023/': ['log']
                },
                broadcastInterval: 0
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                monitor._broadcastHttp = function () {

                    done();
                };

                monitor._handle('log')({ timestamp: Date.now(), tags: ['test'], data: 'test' });
            });
        });

        it('broadcastInterval not 0', function (done) {

            var options = {
                subscribers: {
                    'http://localhost:1023/': ['log']
                },
                broadcastInterval: 5
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);
                var cnt = 0;

                monitor._broadcastHttp = function () {
                    cnt++;
                    if (cnt === 2) {
                        done();
                    }
                };

                monitor._handle('log')({ timestamp: Date.now(), tags: ['test'], data: 'test' });
            });
        });

        it('throws an error when eventName is invalid', function (done) {

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, { subscribers: {} });

                expect(function () {

                    monitor._handle('notFound');
                }).to.throw();
                done();
            });
        });
    });

    describe('#_request', function () {

        it('sets the event with the request data correctly', function (done) {

            makePack(function (pack, server) {

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            }
                        },
                        res: {

                        }
                    },
                    info: {},
                    server: server
                };

                var monitor = new Monitor(pack, { subscribers: {} });
                var event = monitor._request()(request);

                expect(event.event).to.equal('request');
                expect(event.source.userAgent).to.equal('test');
                done();
            });
        });

        it('sets the event with the request remote connection address', function (done) {

            makePack(function (pack, server) {

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            }
                        },
                        res: {

                        }
                    },
                    info: {
                        remoteAddress: 'hapi.com'
                    },
                    server: server
                };

                var monitor = new Monitor(pack, { subscribers: {} });
                var event = monitor._request()(request);

                expect(event.event).to.equal('request');
                expect(event.source.remoteAddress).to.equal('hapi.com');
                done();
            });
        });

        it('logs errors when they occur', function (done) {

            var options = {
                subscribers: {},
                extendedRequests: true
            };

            makePack(function (pack, server) {

                var item = { ts: Date.now(), tags: ['a', 'b'], data: 'hello!' };

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            }
                        },
                        res: {

                        }
                    },
                    info: {},
                    server: server,
                    getLog: function () {

                        return [item];
                    }
                };

                var monitor = new Monitor(pack, options);

                var event = monitor._request()(request);

                expect(event.event).to.equal('request');
                expect(event.source.userAgent).to.equal('test');
                expect(event.log).to.deep.equal([item]);
                done();
            });
        });

        it('logs all headers when option is set', function (done) {

            var options = {
                subscribers: {},
                logRequestHeaders: true
            };

            makePack(function (pack, server) {

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'foo': 'bar'
                            }
                        },
                        res: {

                        }
                    },
                    info: {},
                    server: server,
                    getLog: function () {}
                };

                var monitor = new Monitor(pack, options);

                var event = monitor._request()(request);

                expect(event.headers['foo']).to.equal('bar');
                done();
            });
        });

        it('logs pid for request when option is set', function (done) {

            var options = {
                subscribers: {},
                logPid: true
            };

            makePack(function (pack, server) {

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            }
                        },
                        res: {
                        }
                    },
                    info: {},
                    server: server,
                    getLog: function () {}
                };

                var monitor = new Monitor(pack, options);

                var event = monitor._request()(request);
                expect(event.pid).to.exist;
                done();
            });
        });
    });

    describe('#_display', function () {

        it('prints to the log event data for ops events', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var events = [{
                    event: 'ops',
                    os: { load: [ 1.0, 1.0, 1.0 ] },
                    proc: {
                        mem: {
                            rss: 1
                        },
                        cpu: 10
                    }
                }];

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    expect(string).to.contain('memory');
                };
                monitor._display(events);
                // reset console.log back to normal
                console.log = trapConsole;
                done();
            });
        });

        it('prints to the log event data for request events', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var events = [{
                    event: 'request',
                    instance: 'testInstance',
                    method: 'testMethod'
                }];

                // trap console output so it doesnt show up in stdout
                var trapConsole = console.log;
                console.log = function(string) {

                    expect(string).to.contain('testMethod');
                };
                monitor._display(events);
                // reset console.log back to normal
                console.log = trapConsole;
                done();
            });
        });

        describe('#print status code', function () {

            it('200', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'GET',
                        statusCode: 200
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[32m200');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });

            it('304', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'GET',
                        statusCode: 304
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[36m304');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });

            it('404', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'GET',
                        statusCode: 404
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[33m404');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });

            it('500', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'GET',
                        statusCode: 500
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[31m500');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });
        });

        describe('print http verb', function() {

              it('get', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'get',
                        statusCode: 200
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[1;32mget');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });

            it('post', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'post',
                        statusCode: 200
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[1;33mpost');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });

            it('put', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'put',
                        statusCode: 200
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[1;36mput');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });

            it('delete', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'delete',
                        statusCode: 200
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[1;31mdelete');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });

            it('other', function (done) {

                var options = {
                    subscribers: {}
                };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    var events = [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'other',
                        statusCode: 200
                    }];

                    // trap console output so it doesnt show up in stdout
                    var trapConsole = console.log;
                    console.log = function(string) {

                        expect(string).to.contain('[1;34mother');
                    };
                    monitor._display(events);
                    // reset console.log back to normal
                    console.log = trapConsole;
                    done();
                });
            });
        });
    });

    describe('#_error', function () {

        it('logs pid for error when option is set', function (done) {

            var options = {
                subscribers: {},
                logPid: true
            };

            makePack(function (pack, server) {

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            }
                        },
                        res: {
                        }
                    },
                    info: {},
                    server: server,
                    getLog: function () {}
                };

                var monitor = new Monitor(pack, options);

                var error = monitor._error()(request, { message: 'testerror', stack: 'thestack'} );
                expect(error.pid).to.exist;
                done();
            });
        });
    });

    describe('#_log', function () {

        it('returns wrapped events', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var event = monitor._log()({});

                expect(event.event).to.equal('log');
                done();
            });
        });

        it('logs pid for log when option is set', function (done) {

            var options = {
                subscribers: {},
                logPid: true
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var event = monitor._log()({});

                expect(event.event).to.equal('log');
                expect(event.pid).to.exist;
                done();
            });
        });
    });

    describe('#_eventsFilter', function () {

        it('successfully returns a filter array', function (done) {

            var result = Monitor.prototype._eventsFilter(['log'], [{
                tags: ['log', 'error']
            }]);

            expect(result).to.exist;
            expect(result.length).to.equal(1);
            done();
        });

        it('gracefully handles "undefined" tags', function (done) {

            var result = Monitor.prototype._eventsFilter(['log'], [{
                tags: undefined
            }]);

            expect(result).to.exist;
            expect(result.length).to.equal(0);
            done();
        });
    })
});
