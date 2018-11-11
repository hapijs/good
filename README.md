![good Logo](images/good.png)

[**hapi**](https://github.com/hapijs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/hapijs/good.svg)](http://travis-ci.org/hapijs/good)[![Current Version](https://img.shields.io/npm/v/good.svg)](https://www.npmjs.com/package/good)

Lead Maintainer: [Open position](https://github.com/hapijs/good/issues/589)

*good 8 only supports hapi 17+ for hapi 16 please use good 7*

**good** is a hapi plugin to monitor and report on a variety of hapi server events as well as ops information from the host machine. It listens for events emitted by hapi server instances and pushes standardized events to a collection of streams.

## Example Usage

```javascript
const Hapi = require('hapi');
const server = new Hapi.Server();

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

await server.register({
    plugin: require('good'),
    options,
});

await server.start();

console.info(`Server started at ${ server.info.uri }`);

```

This example does the following:

1. Sets up the reporter named `myConsoleReporter` listening for 'response' and 'log' events and writes them to `process.stdout`.
2. Sets up the reporter named `myFileReporter` to listen for 'ops' events and logs them to `./test/fixtures/awesome_log`.
3. Sets up the reporter named `myHTTPReporter` to listen for error events and POSTs them to `http://prod.logs:3000` with additional settings to passed into `Wreck`

See the [Reporter Interface section of the API documentation](https://github.com/hapijs/good/blob/master/API.md#reporter-interface) on how to configure reporters.

**NOTE**: Ensure calling `server.connection` prior to registering `Good`. `request` and `response` event listeners are only registered on connections that exist on `server` at the time `Good` is registered.

Looking for more examples? Check out the [examples folder](https://github.com/hapijs/good/tree/master/examples).

## Existing streams

The following streams are maintained by the hapi community and are known to work with good. Any transform or write stream can work with good, these are just a few inside the hapijs organization.

- [good-squeeze](https://github.com/hapijs/good-squeeze)
- [good-file](https://github.com/hapijs/good-file)
- [good-http](https://github.com/hapijs/good-http)
- [good-console](https://github.com/hapijs/good-console)

## API

See the [API Reference](API.md).
