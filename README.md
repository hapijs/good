<a href="http://hapijs.com"><img src="https://github.com/hapijs/assets/blob/master/images/family.svg" width="180px" align="right" /></a>

# good

[**hapi**](https://github.com/hapijs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/hapijs/good.svg?branch=master)](http://travis-ci.org/hapijs/good)

**good** is a hapi plugin to monitor and report on a variety of hapi server events as well as ops information from the host machine. It listens for events emitted by hapi server instances and pushes standardized events to a collection of streams.

## Example Usage

```javascript
const Hapi = require('@hapi/hapi');

const server = Hapi.server();

const options = {
    ops: {
        interval: 1000
    },
    reporters: {
        myConsoleReporter: [
            {
                module: 'good-squeeze',
                name: 'Squeeze',
                args: [{ log: '*', response: '*' }]
            },
            {
                module: 'good-console'
            },
            'stdout'
        ]
    }
};

await server.register({
    plugin: require('good'),
    options,
});

await server.start();

console.info(`Server started at ${ server.info.uri }`);

```

See the [Reporter Interface section of the API documentation](https://github.com/hapijs/good/blob/master/API.md#reporter-interface) on how to configure reporters.

Looking for more examples? Check out the [examples folder](https://github.com/hapijs/good/tree/master/examples).

## Existing streams

The following streams are maintained by the hapi community and are known to work with good. Any transform or write stream can work with good, these are just a few inside the hapijs organization.

- [good-squeeze](https://github.com/hapijs/good-squeeze)
- [good-console](https://github.com/hapijs/good-console)

## API

See the [API Reference](API.md).
