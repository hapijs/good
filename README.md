![good Logo](images/good.png)

[**hapi**](https://github.com/hapijs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/hapijs/good.svg)](http://travis-ci.org/hapijs/good)[![Current Version](https://img.shields.io/npm/v/good.svg)](https://www.npmjs.com/package/good)

Lead Maintainer: [Adam Bretz](https://github.com/arb)


**good** is a hapi plugin to monitor and report on a variety of hapi server events as well as ops information from the host machine. It listens for events emitted by hapi server instances and pushes standardized events to a collection of streams.

## Example Usage

```javascript
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection();

const options = {
    ops: {
        interval: 1000
    },
    reporters: {
        myConsoleReporter: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ log: '*', response: '*' }]
        }, {
            module: 'good-console'
        }, 'stdout'],
        myFileReporter: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ ops: '*' }]
        }, {
            module: 'good-squeeze',
            name: 'SafeJson'
        }, {
            module: 'good-file',
            args: ['./test/fixtures/awesome_log']
        }],
        myHTTPReporter: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ error: '*' }]
        }, {
            module: 'good-http',
            args: ['http://prod.logs:3000', {
                wreck: {
                    headers: { 'x-api-key': 12345 }
                }
            }]
        }]
    }
};

server.register({
    register: require('good'),
    options,
}, (err) => {

    if (err) {
        return console.error(err);
    }
    server.start(() => {
        console.info(`Server started at ${ server.info.uri }`);
    });

});

```

This example does the following:

1. Sets up the reporter named `myConsoleReporter` listening for 'response' and 'log' events and writes them to `process.stdout`.
2. Sets up the reporter named `myFileReporter` to listen for 'ops' events and logs them to `./test/fixtures/awesome_log`.
3. Sets up the reporter named `myHTTPReporter` to listen for error events and POSTs them to `http://prod.logs:3000` with additional settings to passed into `Wreck`

See the [Reporter Interface section of the API documentation](https://github.com/hapijs/good/blob/master/API.md#reporter-interface) on how to configure reporters.

**NOTE**: Ensure calling `server.connection` prior to registering `Good`. `request` and `response` event listeners are only registered on connections that exist on `server` at the time `Good` is registered.

Looking for more examples? Check out the [examples folder](https://github.com/hapijs/good/tree/master/examples).

## Reporter Type
Since there are multiple interfaces for `streams` in node, each good reporter is implicitly defined as one of two types -

1. `Transform` reporters
    _implements the `Stream.Transform` interface_
    `Transform` reporters are intended to pipe modified log data to another reporter they can either filter the data or change its format.
    [good-squeeze](https://github.com/hapijs/good-squeeze) and [good-console](https://github.com/hapijs/good-console) are example of such reporters
2. `Log` reporters
    _implements the `Stream.Writable` interface_
    `Log` reporters are terminal reporters and do not pass events to other reporters after logging the received data.
    [good-file](https://github.com/hapijs/good-file), [good-http](https://github.com/hapijs/good-http) and `stdout` are examples of such reporters

**NOTE**: You can get unexpected results and silent log failures by chaining reporters without setting a terminal `Log` reporter or chaining any type of reporter after a terminal `Log` reporter. See the [API Reference](API.md#reporter-type) for more information.

## Existing streams

The following streams are maintained by the hapi community and are known to work with good. Any transform or write stream can work with good, these are just a few inside the hapijs organization.

- [good-squeeze](https://github.com/hapijs/good-squeeze)
- [good-file](https://github.com/hapijs/good-file)
- [good-http](https://github.com/hapijs/good-http)
- [good-console](https://github.com/hapijs/good-console)

## API

See the [API Reference](API.md).
