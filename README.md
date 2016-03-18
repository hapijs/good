![good Logo](images/good.png)

[**hapi**](https://github.com/hapijs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/hapijs/good.svg)](http://travis-ci.org/hapijs/good)![Current Version](https://img.shields.io/npm/v/good.svg)

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
        console: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ log: '*', response: '*' }]
        }, {
            module: 'good-console'
        }, 'stdout'],
        file: [{
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
        http: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ error: '*' }]
        }, {
            module: 'good-http',
            args: ['http://prod.logs:3000', {
                wreck: headers: {
                    'x-api-key': 12345
                }
            }]
        }]
    }
};

server.register({
    register: require('good'),
    options: options
}, (err) => {

    if (err) {
        console.error(err);
    } else {
        server.start(() => {

            console.info('Server started at ' + server.info.uri);
        });
    }
});

```

This example does the following:

1. Sets up the `console` reporter reporter listening for 'response' and 'log' events.
2. Sets up the `file` reporter to listen for 'ops' events and log them to `./test/fixtures/awesome_log` according to the file rules listed in the good-file documentation.
3. Sets up the `http` reporter to listen for error events and POSTs them to `http://prod.logs:3000` with additional settings to passed into `Wreck`

**NOTE**: Ensure calling `server.connection` prior to registering `Good`. `request` and `response` event listeners are only registered on connections that exist on `server` at the time `Good` is registered.

## Existing streams

A single reporter is either a write stream or a transform stream. Every effort has been made to support any generic stream in the node ecosystem. As long as the stream is properly implemented, you can use it in your reporting pipeline. The following streams were built specifically to work with good.

- [good-squeeze](https://github.com/hapijs/good-squeeze)
- [good-udp](https://github.com/hapijs/good-udp)
- [good-file](https://github.com/hapijs/good-file)
- [good-http](https://github.com/hapijs/good-http)
- [good-console](https://github.com/hapijs/good-console)
- [good-influxdb](https://github.com/totherik/good-influxdb)
- [good-loggly](https://github.com/continuationlabs/good-loggly)
- [good-winston](https://github.com/lancespeelmon/good-winston)
- [hapi-good-logstash](https://github.com/atroo/hapi-good-logstash)
- [good-graylog2](https://github.com/CascadeEnergy/good-graylog2)

## API

See the [API Reference](API.md).
