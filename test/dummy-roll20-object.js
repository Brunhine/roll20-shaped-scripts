'use strict';
const _ = require('underscore');

class Roll20Object {

  constructor(type) {
    this.props = {};
    this.id = _.uniqueId();
    this.type = type;
  }

  // noinspection JSUnusedGlobalSymbols
  get(propName) {
    return this.props[propName];
  }

  set(propName, value) {
    this.props[propName] = value;
  }
}

module.exports = Roll20Object;
