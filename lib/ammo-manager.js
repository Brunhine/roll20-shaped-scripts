'use strict';
const _ = require('underscore');
const ShapedModule = require('./shaped-module');
const ShapedConfig = require('./shaped-config');

class AmmoManager extends ShapedModule {


  addCommands(commandProcessor) {
    return commandProcessor.addCommand('ammo', this.process.bind(this))
      .option('start', ShapedConfig.booleanValidator)
      .option('report', ShapedConfig.booleanValidator)
      .option('reset', ShapedConfig.booleanValidator);
  }

  process(options) {
    if (options.start) {
      if (!_.isEmpty(this.ammoLog)) {
        if (options.reset) {
          this.startTracking();
        }
        else {
          this.report('Ammo Manager', `Ammo is already being tracked. Do you want to ${this.resetLink}?`);
          return;
        }
      }
    }

    if (options.report) {
      this.reportAmmoUsed();
    }
  }

  consumeAmmo(options, msg) {
    const ammoAttr = _.chain(this.roll20.findObjs({ type: 'attribute', characterid: options.character.id }))
      .filter(attribute => attribute.get('name').indexOf('repeating_ammo') === 0)
      .groupBy(attribute => attribute.get('name').replace(/(repeating_ammo_[^_]+).*/, '$1'))
      .find(attributeList =>
        _.find(attributeList, attribute =>
          attribute.get('name').match(/.*name$/) && attribute.get('current') === options.ammoName)
      )
      .find(attribute => attribute.get('name').match(/.*qty$/))
      .value();

    if (!ammoAttr) {
      this.logger.error('No ammo attribute found corresponding to name $$$', options.ammoName);
      return;
    }

    let ammoUsed = 1;
    if (options.ammo) {
      const rollRef = options.ammo.match(/\$\[\[(\d+)\]\]/);
      if (rollRef) {
        const rollExpr = msg.inlinerolls[rollRef[1]].expression;
        const match = rollExpr.match(/\d+-(\d+)/);
        if (match) {
          ammoUsed = match[1];
        }
      }
    }

    const val = parseInt(ammoAttr.get('current'), 10) || 0;
    ammoAttr.set('current', Math.max(0, val - ammoUsed));

    if (_.isUndefined(this.ammoLog)) {
      this.startTracking();
    }

    // check if character is being tracked
    if (_.has(this.ammoLog, options.character.id) === false) {
      this.ammoLog[options.character.id] = {
        characterName: options.character.get('name') || 'unkown',
        ammoUsed: {},
      };
    }

    this.ammoLog[options.character.id].ammoUsed[options.ammoName] =
      (this.ammoLog[options.character.id].ammoUsed[options.ammoName] || 0) + parseInt(ammoUsed, 10);

    this.logger.debug(JSON.stringify(this.ammoLog));
  }

  startTracking() {
    this.ammoLog = {};
  }

  reportAmmoUsed() {
    let res = '<ul>';

    _.each(this.ammoLog, (char) => {
      res += `<li>${char.characterName}<ul>`;
      _.each(char.ammoUsed, (ammo, ammoName) => {
        res += `<li>${ammoName}: ${ammo}</li>`;
      });
      res += '</ul></li>';
    });

    res += `</ul><br/>${this.resetLink}`;

    this.report('Ammo Manager', res);
  }

  get resetLink() {
    return '<a href=\'!shaped-ammo --start --reset\'>reset</a>';
  }

}

module.exports = AmmoManager;
