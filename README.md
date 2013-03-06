<a href="https://github.com/spumko"><img src="https://raw.github.com/spumko/spumko/master/images/from.png" align="right" /></a>
![good Logo](https://raw.github.com/spumko/good/master/images/good.png)

[**hapi**](https://github.com/walamrtlabs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/spumko/good.png)](http://travis-ci.org/spumko/good)

The _'Monitor'_ should be configured using a _'hapi'_ server instead of calling the _'Monitor'_ constructor directly.


**hapi** comes with a built-in process monitor for three types of events:
- System and process performance (ops) - CPU, memory, disk, and other metrics.
- Requests logging (request) - framework and application generated logs generated during the lifecycle of each incoming request.
- General events (log) - logging information not bound to a specific request such as system errors, background processing, configuration errors, etc. Described in [General Events Logging](#general-events-logging).

The monitor is _off_ by default and can be turned on using the `monitor` server option. To use the default settings, simply set the value to _true_.
Applications with multiple server instances, each with its own monitor should only include one _log_ subscription per destination as general events (log)
are a process-wide facility and will result in duplicated log events. To override some or all of the defaults, set `monitor` to an object with the following
optional settings:
- `broadcastInterval` - the interval in milliseconds to send collected events to subscribers. _0_ means send immediately. Defaults to _0_.
- `opsInterval` - the interval in milliseconds to sample system and process performance metrics. Minimum is _100ms_. Defaults to _15 seconds_.
- `extendedRequests` - determines if the full request log is sent or only the event summary. Defaults to _false_.
- `requestsEvent` - the event type used to capture completed requests. Defaults to 'tail'. Options are:
    - 'response' - the response was sent but request tails may still be pending.
    - 'tail' - the response was sent and all request tails completed.
- `subscribers` - an object where each key is a destination and each value is either an array or object with an array of subscriptions. The subscriptions that are available are _ops_, _request_, and _log_. The destination can be a URI or _console_. Defaults to a console subscription to all three. To disable the console output for the server instance pass an empty array into the subscribers "console" configuration. 

For example:
```javascript
var options = {
    monitor: {
        subscribers: {
            console: ['ops', 'request', 'log'],
            'http://localhost/logs': ['log']
        }
    }
};
```

Disabling hapi console output:
```javascript
var options = {
    monitor: {
        subscribers: {
            console: [],
            'http://localhost/logs': ['log']
        }
    }
};
```

Log messages are created with tags.  Usually a log will include a tag to indicate if it is related to an error or info along with where the message originates.  If, for example, the console should only output error's that were logged you can use the following configuration:
```javascript
var options = {
    monitor: {
        subscribers: {
            console: { tags: ['error'], events: ['log'] }
        }
    }
};
```
