'use strict';

const Stream = require('stream');

class Stringify extends Stream.Transform {
    constructor() {

        super({ objectMode: true });
    }
    _transform(value, enc, callback) {

        callback(null, JSON.stringify(value));
    }
}

module.exports = Stringify;
