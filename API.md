## Introduction

**good** is a hapi plugin process monitor that listens for one or more of the below 'event types'. All of these events, _except_ 'ops' map to a hapi event documented [here](https://github.com/hapijs/hapi/blob/master/API.md#server-events).

Applications with multiple server instances, each with its own monitor should only include one _log_ subscription per destination
as general events are a process-wide facility and will result in duplicated log events.

Note: this module is being deprecated on December 1st, 2019 due to lack to available support resources. Please consider using [another logging plugin](https://hapi.dev/plugins/#logging).

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

## Usage

### Options
- `[includes]` - optional configuration object
    - `[request]` - array of extra hapi request object fields to supply to reporters on "request", "response", and "error" events. Valid values ['headers', 'payload']. Defaults to `[]`.
    - `[response]` - array of extra hapi response object fields to supply to reporters on "response" events. Valid values ['headers', 'payload']. Defaults to `[]`.
- `[ops]` - options for controlling the ops reporting from good. Set to `false` to disable ops monitoring completely.
    - `config` - options passed directly into the [`Oppsy`](https://github.com/hapijs/oppsy) constructor as the `config` value. Defaults to `{}`
    - `interval` - interval used when calling `Oppsy.start()`. Defaults to `15000`.
- `[extensions]` - an array of [hapi event names](https://github.com/hapijs/hapi/blob/master/API.md#server.events) to listen for and report via the good reporting mechanism. Can not be any of ['log', 'ops', 'request', 'response', 'tail']. **Disclaimer** This option should be used with caution. This option will allow users to listen to internal events that are not meant for public consumption. The list of available events can change with any changes to the hapi event system. Also, *none* of the official hapijs reporters have been tested against these custom events. The schema for these events can not be guaranteed because they vary from version to version of hapi.
- `[reporters]` - Defaults to `{}`. `reporters` is an object of `key`, `value` pairs where the `key` is a reporter name and the `value` is an array of mixed value types. Valid values for the array items are:
    - streams specifications object with the following keys
        - `module` - can be :
            - a string that will be used to import a module from node_modules or a local file. Should export a single constructor function that can be invoked with `new`.
            - a function that is the constructor of your stream. It's a safer alternative to the string version when you risk having module conflicts.
        - `[name]` - if the imported module exports more than one constructor function, use `name` to specify which one to use.
        - `[args]` - an array of arguments to pass to the constructor when this stream object is created via `new`.
    - instantiated stream objects
    - string name of a built in `process` stream. Valid values are `'stdout'` and `'stderr'`.

### Reporter Interface

The reporter interface uses the standard stream-and-pipe interface found commonly in the node ecosystem. Each item in the array of streams will be piped together in the array order. Any stream described using a stream specification object will be constructed with `new` to prevent any cross contamination from one reporter to another. For example, when passing the following specification for an "ops-console" reporter:

```js
{
    'ops-console': [{
        module: '@hapi/good-squeeze',
        name: 'Squeeze',
        args: [{ ops: '*' }]
    }, {
        module: '@hapi/good-squeeze',
        name: 'SafeJson'
    }, 'stdout']
}
```

Internally, this would create an array (`streams`), import `good-squeeze` from node_modules, and then create a new "Squeeze" transform stream via `new Squeeze({ ops: '*' })` and push that result into `streams`. Then it would create a "SafeJson" transform stream via `new SafeJson()` and push that into `streams`. Finally, since 'stdout' is an existing process stream, it gets pushed directly into `streams`. Once all of the streams have been created and collected, the algorithm does essentially the following:

```js
const result = streams[0].pipe(streams[1]).pipe(streams[2]);
```

*Any* time one of the "good events" occurs, a unique copy of the event is pushed into each reporter stream pipeline. It is up to the developer to filter events they don't care about on a per pipeline basis. The "Squeeze" transform stream provides the basic event type and tag filtering used in previous versions of good which should meet many filtering needs.

It is also up to the developer to manage `objectMode` in each pipeline from one stream to the next. The first stream will *always* receive an object. After that, it's up to the developer to manage the message type throughout the pipeline. In the above example, because we want to write to `stdout`, we needed to add a transform stream to convert the payload coming out of "Squeeze" to a string using "SafeJson" before sending it to `process.stdout`. Objects can not be written directly to `process.stdout`, so "SafeJson" was used to safely stringify the message coming from the "Squeeze" stream.

Finally, the developer must make sure the reporting pipeline makes sense. In the above example, we pipe through two transform streams, convert the object to a string, and then write send it to `process.stdout` which is a write stream. If the developer mixes up the order, this pipeline would crash the process.

Each reporter pipeline receives it's own copy of the message from good. That means the payload can be freely modified without worrying about impacting other reporters. Just add more and more transform streams into the pipeline to fine-tune any reporting needs. Need a different filtering mechanism? Write a new transform stream to filter based on IP, request route, payload type... Want to add extra data about events? Just add a transform stream into the mix to add the current date, something specific to your company, filter out sensitive information before logging it... the sky is the limit.

These changes address the two most common requests; "how do I filter on `X`?" and "how do I add `Y` to the message payload?". Now developers are empowered to customize the reporting pipeline to suit their needs. While there is far less hand-holding with this interface, developers have much more control of reporting coming out of good.

**This change also allows user to leverage *any* existing transform or write stream in the node ecosystem to be used with good.**

#### Stream Transforms Using Plugin Configs

To drive route or request level behavior in your stream transform one option is to use the plugin config feature of hapi. Here is an example where a plugin config is used to drive a stream transform that will suppress "response" events when `suppressResponseEvent === true`.

Setting plugin config at the route level:
```js
var routeConfig = {
    plugins: {
        good: {
            suppressResponseEvent: true
        }
    }
};

server.route({ method: 'GET', path: '/user', config: routeConfig });
```

Setting plugin config at the request level:
```js
const handler = function (request, reply) {

    request.plugins.good = {
        suppressResponseEvent: true
    };

    reply.continue();
}
```

Consuming the plugin config in the stream transform:
```js
_transform(data, enc, next) {

    if (data.event === 'response' && data.config.suppressResponseEvent === true) {
        return next();
    }

    return next(null, data);
}
```

#### Reporter Lifecycle

**Startup**

1. When "onPreStart" is emitted from the hapi server, the monitoring operation starts.
2. All of the streams are created via `new` (if needed) and collected into a temporary internal array.
3. All of the streams in the temporary array are piped together. This will cause any standard [Node stream](https://nodejs.org/api/stream.html) events to occur that instances can listen for.

At this point, data will start flowing to each of the reporters through the pipe interface. Data can be accessed in individual instances though any of the standard stream methods and events.

**Shutdown**

1. When "onPostStop" is emitted from the hapi server, the shutdown sequence starts.
2. `null` is pushed through each reporter pipeline. Any synchronous teardown can happen on stream instances in "end" or "finish" events. See [Node stream](https://nodejs.org/api/stream.html) for more information about end-of-stream events. The callback signaling to hapi that our logic is done executing will happen on the next tick.

### Event Types

- `ops` - System and process performance - CPU, memory, disk, and other metrics.
- `response` - Information about incoming requests and the response. This maps to either the "response" or "tail" event emitted from hapi servers.
- `log` - logging information not bound to a specific request such as system errors, background processing, configuration errors, etc. Maps to the "log" event emitted from hapi servers.
- `error` - request responses that have a status code of 500. This maps to the "request" hapi event on the "error" channel.
- `request` - Request logging information. This maps to the hapi 'request' event that is emitted via `request.log()`.

### Event Payloads

Each event emitted from Good has a unique object representing the payload. This is useful for three reasons:

1. It provides a predictable interface.
2. It makes tracking down issues with MDB much easier because the payloads aren't just generic objects.
3. It is more likely to be optimized because the V8 runtime has a better idea of what the structure of each object is going to be much sooner.

#### `ServerLog`

Event object associated with 'log' events.

- `event` - 'log'
- `timestamp` - JavaScript timestamp indicating when the 'log' event occurred.
- `tags` - array of strings representing any tags associated with the 'log' event.
- `data` - string or object passed via `server.log()` calls.
- `error` - error object, replacing `data` if only an error object is passed to `server.log()`
- `pid` - the current process id.

#### `RequestError`

Event object associated with 'error' events.

- `event` - 'error'
- `timestamp` - JavaScript timestamp indicating when the 'log' event occurred.
- `id` - request id. Maps to `request.id`.
- `url` - url of the request that originated the error. Maps to `request.url`.
- `method` - method of the request that originated the error. Maps to `request.method`.
- `pid` - the current process id.
- `error` - the raw error object.
- `config` - plugin-specific config object combining `request.route.settings.plugins.good` and `request.plugins.good`. Request-level overrides route-level. Reporters could use `config` for additional filtering logic.
- `headers` - the request headers if `includes.request` includes "headers"

The `toJSON` method of `GreatError` has been overwritten because `Error` objects can not be stringified directly. A stringified `GreatError` will have `error.message` and `error.stack` in place of the raw `Error` object.

#### `RequestSent`

Event object associated with the response event option into Good.

- `event` - 'response'
- `timestamp` - JavaScript timestamp that maps to `request.info.received`.
- `id` - id of the request, maps to `request.id`.
- `instance` - maps to `server.info.uri`.
- `labels` - maps to `server.settings.labels`
- `method` - method used by the request. Maps to `request.method`.
- `path` - incoming path requested. Maps to `request.path`.
- `query` - query object used by request. Maps to `request.query`.
- `responseTime` - calculated value of `request.info.responded - request.info.received`.
- `statusCode` - the status code of the response.
- `pid` - the current process id.
- `httpVersion` - the http protocol information from the request.
- `source` - object with the following values:
    - `remoteAddress` - information about the remote address. maps to `request.info.remoteAddress`
    - `userAgent` - the user agent of the incoming request.
    - `referer` - the referer headed of the incoming request.
- `route` - route path used by request. Maps to `request.route.path`.
- `log` - maps to `request.logs` of the hapi request object.
- `tags` - array of strings representing any tags from route config. Maps to `request.route.settings.tags`.
- `config` - plugin-specific config object combining `request.route.settings.plugins.good` and `request.plugins.good`. Request-level overrides route-level. Reporters could use `config` for additional filtering logic.
- `headers` - the request headers if `includes.request` includes "headers"
- `requestPayload` - the request payload if `includes.request` includes "payload"
- `responsePayload` - the response payload if `includes.response` includes "payload"

#### `Ops`

Event object associated with the 'ops' event emitted from Oppsy.

- `event` - 'ops'
- `timestamp` - current time when the object is created.
- `host` - the host name of the current machine.
- `pid` - the current process id.
- `os` - object with the following values:
    - `load` - array containing the 1, 5, and 15 minute load averages.
    - `mem` - object with the following values:
        - `total` - total system memory in bytes.
        - `free` - total free system memory in bytes.
    - `uptime` - system uptime in seconds.
- `proc` - object with the following values:
    - `uptime` - uptime of the running process in seconds
    - `mem` - returns result of `process.memoryUsage()`
        - `rss` - 'resident set size' which is the amount of the process held in memory.
        - `heapTotal` - V8 heap total
        - `heapUsed` - V8 heap used
    - `delay` - the calculated Node event loop delay in milliseconds.
- `load` - object with the following values:
    - `requests` - object containing information about all the requests passing through the server.
    - `concurrents` - object containing information about the number of concurrent connections associated with each `listener` object associated with the hapi server.
    - `responseTimes` - object with calculated average and max response times for requests.
    - `sockets` - object with the following values:
        - `http` - socket information http connections. Each value contains the name of the socket used and the number of open connections on the socket. It also includes a `total` for total number of open http sockets.
        - `https` - socket information https connections. Each value contains the name of the socket used and the number of open connections on the socket. It also includes a `total` for total number of open https sockets.

#### `RequestLog`

Event object associated with the "request" event. This is the hapi event emitter via `request.log()`.

- `event` - 'request'
- `timestamp` - timestamp of the incoming `event` object.
- `tags` - array of strings representing any tags associated with the 'log' event.
- `data` - the string or object mapped to `event.data`.
- `error` - the error instance mapped to `event.error`.
- `pid` - the current process id.
- `id` - id of the request, maps to `request.id`.
- `method` - method used by the request. Maps to `request.method`.
- `path` - incoming path requested. Maps to `request.path`.
- `config` - plugin-specific config object combining `request.route.settings.plugins.good` and `request.plugins.good`. Request-level overrides route-level. Reporters could use `config` for additional filtering logic.
- `headers` - the request headers if `includes.request` includes "headers"

#### Extension Payloads

Because the extension payloads from hapi can vary from one version to another and one event to another, the payload is only loosely defined.
- `event` - the event name.
- `timestamp` - the time the event occurred.
- `payload` - array of arguments hapi passed to our event handler function

## Existing streams

The following streams are maintained by the hapi community and are known to work with good. Any transform or write stream can work with good, these are just a few inside the hapijs organization.

- [good-squeeze](https://github.com/hapijs/good-squeeze)
- [good-console](https://github.com/hapijs/good-console)
