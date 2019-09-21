<a href="http://hapijs.com"><img src="https://raw.githubusercontent.com/hapijs/assets/master/images/family.png" width="180px" align="right" /></a>

# @hapi/good

[**hapi**](https://github.com/hapijs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/hapijs/good.svg?branch=master)](http://travis-ci.org/hapijs/good)

**good** is a hapi plugin to monitor and report on a variety of hapi server events as well as ops information from the host machine. It listens for events emitted by hapi server instances and pushes standardized events to a collection of streams.

## Note: this module is being deprecated on December 1st, 2019 due to lack to available support resources. Please consider using [another logging plugin](https://hapi.dev/plugins/#logging).

## Example Usage

### Log to Console

```js
const Hapi = require('@hapi/hapi');


const start = async function () {

    const server = Hapi.server();

    const handler = function (request, h) {

        request.server.log(['a', 'b', 'c'], 'some message');
        return 'ok';
    };

    server.route({ path: '/', method: 'GET', handler })

    await server.register({
        plugin: require('@hapi/good'),
        options: {
            ops: {
                interval: 1000
            },
            reporters: {
                myConsoleReporter: [
                    {
                        module: '@hapi/good-squeeze',
                        name: 'Squeeze',
                        args: [{ log: '*', response: '*', ops: '*' }]
                    },
                    {
                        module: '@hapi/good-console'
                    },
                    'stdout'
                ]
            }
        }
    });

    await server.start();
    console.info(`Server started at ${server.info.uri}`);
    await server.inject('/');
};

start();
```

This reporter spec logs ops statistics, request responses, and server log events to the console. It should log to the console something like:
```
Server started at http://localhost:41759
190921/234014.495, [log,a,b,c] data: some message
190921/234014.494, (1569109214494:localhost:3616:k0u742ki:10000) [response] http://localhost:41759: get / {} 200 (6ms)
190921/234015.494, [ops] memory: 52Mb, uptime (seconds): 1.148846148, load: [0.02734375,0.0302734375,0]
190921/234016.493, [ops] memory: 52Mb, uptime (seconds): 2.149207332, load: [0.02734375,0.0302734375,0]
190921/234017.494, [ops] memory: 52Mb, uptime (seconds): 3.149818512, load: [0.02734375,0.0302734375,0]
```

It uses `@hapi/good-squeeze` to select only log and response events.

Events that pass the filter stream to `@hapi/good-console` for formatting. See the `good console` [constructor docs](https://github.com/hapijs/good-console#new-goodconsoleconfig) for details on `args` values.

Formatted events stream to `process.stdout` for display.

### Log to file

Create a basic write stream class and use with good:

```js
const Fs = require('fs-extra');
const Hapi = require('@hapi/hapi');


class GoodFile extends Fs.WriteStream {

    constructor(path, options) {

        const defaults = {
            encoding: 'utf8',
            flags: 'a',
            mode: 0o666
        };

        const settings = Object.assign({}, defaults, options);
        settings.fd = -1;       // Prevent open from being called in `super`

        super(path, settings);
        this.open();
    }

    open() {

        this.fd = null;
        Fs.ensureFile(this.path, (err) => {

            if (err) {
                this.destroy();
                this.emit('error', err);
                return;
            }

            super.open();
        });
    }
}


const start = async function () {

    const server = Hapi.server();

    const handler = function (request, h) {

        request.server.log(['a', 'b', 'c'], 'some message');
        return 'ok';
    };

    server.route({ path: '/', method: 'GET', handler })

    await server.register({
        plugin: require('@hapi/good'),
        options: {
            ops: {
                interval: 1000
            },
            reporters: {
                myReporter: [
                    {
                        module: '@hapi/good-squeeze',   // Transform payload into a safe string
                        name: 'SafeJson'
                    },
                    {
                        module: GoodFile,
                        args: ['./log.json']
                    }
                ]
            }
        }
    });

    await server.start();
    server.log(['log'], 'Server Started');
    await server.inject('/');
};

start();
```

This will create or append a file `./log.json` with the following:
```json
{"event":"log","timestamp":1569109412144,"tags":["log"],"data":"Server Started","pid":3630}
{"event":"log","timestamp":1569109412148,"tags":["a","b","c"],"data":"some message","pid":3630}
{"event":"response","timestamp":1569109412146,"id":"1569109412146:localhost:3630:k0u78b2x:10000","instance":"http://localhost:44883","method":"get","path":"/","query":{},"responseTime":5,"statusCode":200,"pid":3630,"httpVersion":"1.1","route":"/","log":[],"source":{"remoteAddress":"127.0.0.1","userAgent":"shot"},"config":{}}
{"event":"ops","timestamp":1569109413146,"host":"localhost","pid":3630,"os":{"load":[0.0029296875,0.02001953125,0],"mem":{"total":16682434560,"free":6650597376},"uptime":851831},"proc":{"uptime":1.160361771,"mem":{"rss":54652928,"heapTotal":18948096,"heapUsed":8310912,"external":1271839},"delay":0.9361389875411987},"load":{"requests":{"44883":{"total":1,"disconnects":0,"statusCodes":{"200":1}}},"responseTimes":{"44883":{"avg":5,"max":5}},"sockets":{"http":{"total":0},"https":{"total":0}}}}
{"event":"ops","timestamp":1569109414145,"host":"localhost","pid":3630,"os":{"load":[0.0029296875,0.02001953125,0],"mem":{"total":16682434560,"free":6650597376},"uptime":851832},"proc":{"uptime":2.160405932,"mem":{"rss":54652928,"heapTotal":18948096,"heapUsed":8358032,"external":1271887},"delay":0.29865598678588867},"load":{"requests":{"44883":{"total":0,"disconnects":0,"statusCodes":{}}},"responseTimes":{"44883":{"avg":null,"max":0}},"sockets":{"http":{"total":0},"https":{"total":0}}}}
```

### Add custom transform stream

```js
const Stream = require('stream');
const Hapi = require('@hapi/hapi');


class LogDateTransform extends Stream.Transform {

    constructor() {

        super({ objectMode: true });
    }

    _transform(data, enc, next) {

        const date = new Date(Date.now()).toLocaleString('en-US');

        if (data.data) {
            return next(null, `${data.event}: ${date}: ${data.data}\n`);
        }

        next(null);
    }
}


const start = async function () {

    const server = Hapi.server();

    const handler = function (request, h) {

        request.server.log(['a', 'b', 'c'], 'some message');
        return 'ok';
    };

    server.route({ path: '/', method: 'GET', handler })

    await server.register({
        plugin: require('@hapi/good'),
        options: {
            ops: {
                interval: 1000
            },
            reporters: {
                myReporter: [
                    new LogDateTransform(),
                    'stdout'
                ]
            }
        }
    });

    await server.start();
    server.log('info', 'Server is running...');
    await server.inject('/');
};

start();
```

This reporter logs data with a date time, writing to the console something like:

```
log: 9 / 21 / 2019, 4: 47: 25 PM: Server is running...
log: 9 / 21 / 2019, 4: 47: 25 PM: some message
```

## Existing streams

The following streams are maintained by the hapi community and are known to work with good. Any transform or write stream can work with good, these are just a few inside the hapijs organization.

- [good-squeeze](https://github.com/hapijs/good-squeeze)
- [good-console](https://github.com/hapijs/good-console)

## API

See the [API Reference](API.md).
