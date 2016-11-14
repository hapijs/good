'use strict';

const Stream = require('stream');

module.exports = class extends Stream.Writable {
    constructor(objectMode) {

        super({ objectMode });
        this.data = [];
        this.once('finish', () => {

            this._finalized = true;
        });
    }
    _write(chunk, end, callback) {

        this.data.push(chunk);
        callback(null);
    }
};
