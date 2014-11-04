![good Logo](https://raw.github.com/spumko/good/master/images/good.png)

[**hapi**](https://github.com/hapijs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/hapijs/good.png)](http://travis-ci.org/hapijs/good)

Lead Maintainer: [Lloyd Benson](https://github.com/lloydbenson)

The _'Monitor'_ should be configured using a _'hapi'_ server instead of calling the _'Monitor'_ constructor directly.


**good** is a process monitor for the following types of events:
- System and process performance (ops) - CPU, memory, disk, and other metrics.
- Requests logging (request) - framework and application generated logs generated during the lifecycle of each incoming request.
- General events (log) - logging information not bound to a specific request such as system errors, background processing,
  configuration errors, etc.
- Internal errors (error) - request responses that have a status code of 500. Described in the
  [server events documentation](https://github.com/hapijs/hapi/blob/master/docs/Reference.md#server-events).

Applications with multiple server instances, each with its own monitor should only include one _log_ subscription per destination
as general events are a process-wide facility and will result in duplicated log events. To override some or all of the defaults,
set `options` to an object with the following optional settings:

- `broadcastInterval` - the interval in milliseconds to send collected events to HTTP subscribers. _0_ means send immediately. Defaults to _0_.
- `opsInterval` - the interval in milliseconds to sample system and process performance metrics. Minimum is _100ms_. Defaults to _15 seconds_.
- `extendedRequests` - determines if the full request log is sent or only the event summary. Defaults to _false_.
- `maxLogSize` - the maximum byte size to allow log files to become before creating a new log file.  Default is _0_ which means log files will
  not be split.  When split the log file extension will be incremented by 1.  The initial log file has an extension of .001.
- `requestsEvent` - the event type used to capture completed requests. Defaults to 'tail'. Options are:
    - 'response' - the response was sent but request tails may still be pending.
    - 'tail' - the response was sent and all request tails completed.
- `requestsTimeout` - the number of milliseconds to set the request timeout to when broadcasting to HTTP subscribers
- `subscribers` - an object where each key is a destination and each value is either an array or object with an array of subscriptions.
  The subscriptions that are available are _ops_, _request_, _log_ and _error_. The destination can be a URI, file or directory path, and _console_.
  Defaults to a console subscriber for _ops_, _request_, and _log_ events. To disable the console output for the server instance pass an empty array
  into the subscribers "console" configuration.
- `extraFields` - an object containing extra fields to be included on the broadcast log message.
- `logRequestHeaders` - determines if all request headers will be logged. Defaults to _false_
- `logRequestPayload` - determines if the request payload will be logged. Defaults to _false_
- `logResponsePayload` - determines if the response payload will be logged. Defaults to _false_
- `logPid` - determines if the pid will be logged. Defaults to _false_
  
For example:

```javascript
var Hapi = require('hapi');

var server = new Hapi.Server();

var options = {
    subscribers: {
        'console':                         ['ops', 'request', 'log', 'error'],
        'http://localhost/logs':           ['log'],
        '/tmp/logs/':                      ['request', 'log'],
        'udp://127.0.0.1:9000':            ['request'],
        'redis://127.0.0.1:6379/listname': ['request']
    }
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

Disabling console output:

```javascript
var options = {
    subscribers: {
        console: [],
        'http://localhost/logs': ['log']
    }
};
```

Log messages are created with tags.  Usually a log will include a tag to indicate if it is related to an error or info along with where the message originates.  If, for example, the console should only output error's that were logged you can use the following configuration:

```javascript
var options = {
    subscribers: {
        console: { tags: ['error'], events: ['log'] }
    }
};
```

Log file subscribers can either be a file or a directory.  When logging to a file (there isn't a trailing slash) then the files will be written with the file name in the provided path.  Otherwise, when the subscriber is a directory the log files will be named with a timestamp and placed in the directory.

Below is an example of file and directory subscribers when maxLogSize is not set (default).

```javascript
var options = {
    subscribers: {
        '/logs/good_log': { tags: ['error'], events: ['log'] },     // Creates good_log file in /logs/
        '/logs/': { events: ['request'] }                           // Creates {timestamp} file in /logs/
    }
};
```

If maxLogSize is set to be greater than 0 then all log files will have .00x formatted extensions.  Below is an example of file and directory subscribers:

```javascript
var options = {
    maxLogSize: 1024 * 1024 * 1024, // 1 gig
    subscribers: {
        '/logs/good_log': { tags: ['error'], events: ['log'] },     // Creates good_log.001 file in /logs/
        '/logs/': { events: ['request'] }                           // Creates {timestamp}.001 file in /logs/
    }
};
```

### Broadcast Request Structure

When **good** broadcasts data to a remote endpoint it sends json that has the following properties:

- `schema` - the value of 'schemaName' in the settings.  Default is 'good.v1'
- `host` - the operating system [hostname](http://nodejs.org/api/os.html#os_os_hostname)
- `appVer` - the version of **good**
- `timestamp` - the current time of the server
- `events` - an array of the events that are subscribed to
- ... and any extra fields specified in the options

```javascript
var options = {
  extraFields: {
    'identifier': 'myapplication-logs'
    'build': '0.1.0'
  }
}
```


### Replaying request logs

Good includes a _'replay'_ script that is capable of replaying any request events found in a log file.  Below is the command to use to execute _'replay'_:

`replay -l log.json -u http://host -n #_of_concurrent_requests`

### Redis Logging

Redis logging requires a url formatted like this:

`redis://<hostname>:<port>/<listname>`

e.g.

`redis://127.0.0.1:6379/mylogs`

This will append to the specified list using an [RPUSH](http://redis.io/commands/rpush).
