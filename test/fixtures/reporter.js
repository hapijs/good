'use strict';

const Stream = require('stream');


module.exports = class extends Stream.Transform {

    constructor() {

        super({ objectMode: true });
    }

    _transform(value, enc, callback) {

        callback(null, JSON.stringify(value));
    }
};
