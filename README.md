![good Logo](https://raw.github.com/spumko/good/master/images/good.png)

[**hapi**](https://github.com/hapijs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/hapijs/good.png)](http://travis-ci.org/hapijs/good)![Current Version](https://img.shields.io/npm/v/good.svg)

Lead Maintainer: [Lloyd Benson](https://github.com/lloydbenson)

The _'Monitor'_ should be configured using a _'hapi'_ server instead of calling the _'Monitor'_ constructor directly.


**good** is a process monitor that listens for one or more of the below "event types":
- `ops` - System and process performance - CPU, memory, disk, and other metrics.
- `request` - framework and application generated logs generated during the lifecycle of each incoming request. This maps to either the "response" or "tail" event emitted from hapi servers.
- `log` - logging information not bound to a specific request such as system errors, background processing, configuration errors, etc.
- `error` - request responses that have a status code of 500. Described in the [server events documentation](https://github.com/hapijs/hapi/blob/master/docs/Reference.md#server-events).

With the exception of the `ops` event, all of the other events are emitted by a hapi server. The `ops` event is implemented internally by the good plugin.

Applications with multiple server instances, each with its own monitor should only include one _log_ subscription per destination
as general events are a process-wide facility and will result in duplicated log events. To override some or all of the defaults,
set `options` to an object with the following optional settings:

- `[extendedRequests]` - determines if the full request log is sent or only the event summary. Defaults to _false_.
- `[httpAgents]` - the list of `httpAgents` to report socket information about. Can be a single `http.Agent` or an array of agents objects. Defaults to `Http.globalAgent`.
- `[httpsAgents]` - the list of `httpsAgents` to report socket information about. Can be a single `https.Agent` or an array of agents. Defaults to `Https.globalAgent`.
- `[logRequestHeaders]` - determines if all request headers will be logged. Defaults to _false_
- `[logRequestPayload]` - determines if the request payload will be logged. Defaults to _false_
- `[logResponsePayload]` - determines if the response payload will be logged. Defaults to _false_
- `[opsInterval]` - the interval in milliseconds to sample system and process performance metrics. Minimum is _100ms_. Defaults to _15 seconds_.
- `[requestsEvent]` - the event type used to capture completed requests. Defaults to 'tail'. Options are:
    - 'response' - the response was sent but request tails may still be pending.
    - 'tail' - the response was sent and all request tails completed.
- `reporters` - Defaults to *no* reporters. All reporting objects must be installed in your project. `reporters` is an array of instantiated objects that implement the [good-reporter](https://github.com/hapijs/good-reporter) interface or an object with the following keys:
    - `reporter` - indicates the reporter object to create. Can be one of two values
        - a constructor function generally via `require`, ie `require('good-file')`
        - a module name to `require`. Uses the built-in Node `require` function so you can pass a module name or a path. The supplied module must implement the good-reporter interface. Note: if you want the built-in console reporter, pass "good-console".
    - `args` - an array of arguments that will be passed into the constructor named by `reporter`. Each reporter has different arguments for the constructor, check the documentation for more information.

  
For example:

```javascript
var Good = require('good');
var Hapi = require('hapi');

var server = new Hapi.Server();

var options = {
    opsInterval: 1000,
    reporters: [{
        reporter: require('good-console'),
        args:[{ log: '*', request: '*' }]
    }, {
        reporter: require('good-file'),
        args: ['./test/fixtures/awesome_log', { ops: '*' }]
    }, {
        reporter: require('good-http'),
        args: ['http://prod.logs:3000', { error: '*' } , {
            threshold: 20,
            wreck: {
                headers: { 'x-api-key' : 12345 }
            }
        }]
    }]
};

server.pack.register({
    plugin: require('good'),
    options: options
}, function (err) {

   if (err) {
      console.log(err);
      return;
   }
});

```

This example does the following:

1. Sets up the [`GoodConsole`](https://github.com/hapijs/good-console) reporter listening for "request" and "log" events.
2. Sets up the [`GoodFile`](https://github.com/hapijs/good-file) reporter to listen for "ops" events and log them to `./test/fixtures/awesome_log` according to the file rules listed in the good-file documentation.
3. Sets up the [`GoodHttp`](https://github.com/hapijs/good-http) reporter to listen for error events and POSTs them to `http://prod.logs:3000` with additional settings to pass into `Wreck`

Log messages are created with tags. Usually a log will include a tag to indicate if it is related to an error or info along with where the message originates. If, for example, the console should only output error's that were logged you can use the following configuration:

```javascript
var options = {
    reporters: [{
        reporter: require('good-console'),
        args: [{ log: ['error', 'medium'] }]
    }]
};
```

This will now _only_ log "log" events that have the "error" _or_ "medium" tag attached to them. Any "log" events without one of those tags will be ignored. Please see the documentation of the [good-reporter](https://github.com/hapijs/good-reporter) interface for more information about tags and event filtering.

## Reporters

### Officially supported by hapijs
This is a list of good-reporters under the hapijs umbrella:
- [good-udp](https://github.com/hapijs/good-udp)
- [good-file](https://github.com/hapijs/good-file)
- [good-http](https://github.com/hapijs/good-http)
- [good-console](https://github.com/hapijs/good-console)

### Community powered
Here are some additional reporters that are available from the hapijs community:
- [good-influxdb](https://github.com/totherik/good-influxdb)
