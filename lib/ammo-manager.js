'use strict';
const _ = require('underscore');
const utils = require('./utils');
const ShapedModule = require('./shaped-module');
const ShapedConfig = require('./shaped-config');

class AmmoManager extends ShapedModule {

  get shouldTrackAmmo() {
    return this.myState.config.sheetEnhancements.ammoManager.enabled;
  }

  get shouldUseTurnCounter() {
    return this.myState.config.sheetEnhancements.ammoManager.useTurnCounter;
  }

  get recoveryPercent() {
    return this.myState.config.sheetEnhancements.ammoManager.recoveryPercent;
  }

  get shouldAutoRecover() {
    return this.myState.config.sheetEnhancements.ammoManager.autoRecover;
  }

  get resetLink() {
    return '<a href=\'!shaped-ammo --start --reset\'>reset</a>';
  }

  addCommands(commandProcessor) {
    return commandProcessor.addCommand('ammo', this.process.bind(this))
      .option('start', ShapedConfig.booleanValidator)
      .option('report', ShapedConfig.booleanValidator)
      .option('reset', ShapedConfig.booleanValidator)
      .option('recover', ShapedConfig.objectValidator)
      .option('char', ShapedConfig.getCharacterValidator(this.roll20), false)
      .option('ammo', ShapedConfig.stringValidator)
      .option('quant', ShapedConfig.integerValidator);
  }

  process(options) {
    if (options.start) {
      if (!_.isEmpty(this.ammoLog)) {
        if (options.reset) {
          this.startAmmoTracking();
        }
        else {
          this.report('Ammo Manager', `Ammo is already being tracked. Do you want to ${this.resetLink}?`);
          return;
        }
      }
    }

    if (options.recover) {
      this.recoverAmmo(options.char.id, options.ammo, options.quant);
    }

    if (options.report) {
      this.reportAmmoUsed();
    }
  }

  getAmmoAttr(charid, ammoName) {
    return _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charid }))
      .filter(attribute => attribute.get('name').indexOf('repeating_ammo') === 0)
      .groupBy(attribute => attribute.get('name').replace(/(repeating_ammo_[^_]+).*/, '$1'))
      .find(attributeList =>
        _.find(attributeList, attribute =>
          attribute.get('name').match(/.*name$/) && attribute.get('current') === ammoName)
      )
      .find(attribute => attribute.get('name').match(/.*qty$/))
      .value();
  }

  consumeAmmo(options, msg) {
    const ammoAttr = this.getAmmoAttr(options.character.id, options.ammoName);

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

    if (this.shouldTrackAmmo) {
      this.trackAmmoConsumption(options, ammoUsed);
    }
  }

  trackAmmoConsumption(options, ammoUsed) {
    if (_.isUndefined(this.ammoLog)) {
      this.startAmmoTracking();
    }

    // start tracking character if not already tracked.
    if (_.has(this.ammoLog, options.character.id) === false) {
      this.ammoLog[options.character.id] = {
        characterName: options.character.get('name') || 'unkown',
        ammoUsed: {},
      };
    }

    this.ammoLog[options.character.id].ammoUsed[options.ammoName] =
      (this.ammoLog[options.character.id].ammoUsed[options.ammoName] || 0) + parseInt(ammoUsed, 10);
  }

  startAmmoTracking() {
    this.ammoLog = {};
  }

  endAmmoTracking() {
    if (this.shouldAutoRecover) {
      _.each(this.ammoLog, (char, charId) => {
        _.each(char.ammoUsed, (ammo, ammoName) => {
          this.recoverAmmo(charId, ammoName, Math.floor(ammo * this.recoveryPercent));
        });
      });
    }
    else {
      this.reportAmmoUsed();
    }
  }

  reportAmmoUsed() {
    if (!this.shouldTrackAmmo) {
      return;
    }

    if (_.isEmpty(this.ammoLog)) {
      this.report('Ammo Manager', 'No ammo used this encounter.');
      return;
    }

    let res = '';
    _.each(this.ammoLog, (char, charId) => {
      res += utils.buildHTML('h5', char.characterName);
      let items = '';
      _.each(char.ammoUsed, (ammo, ammoName) => {
        const cmd = `!shaped-ammo --recover --char ${charId} --ammo ${ammoName} ` +
          `--quant ?{Recover how many ${ammoName}?|${Math.floor(ammo * this.recoveryPercent)}}`;
        const link = utils.buildHTML('a', 'recover', { href: cmd });
        items += utils.buildHTML('li', `${ammo}x ${ammoName} ${link}`);
      });
      res += utils.buildHTML('ul', items);
    });

    res += `<br/>${this.resetLink}`;

    this.report('Ammo Manager', res);
  }

  recoverAmmo(charId, ammoName, quant) {
    const ammoAttr = this.getAmmoAttr(charId, ammoName);
    const charName = this.roll20.getObj('character', charId).get('name');

    if (!ammoAttr) {
      this.logger.error('No ammo attribute found corresponding to name $$$', ammoName);
      return;
    }

    const current = parseInt(ammoAttr.get('current'), 10);
    ammoAttr.set('current', current + quant);

    this.roll20.sendChat('Ammo Manager', utils.buildRollTemplate({
      title: 'Ammo Recovery',
      show_character_name: 1,
      character_name: charName,
      text: `${charName} recovers ${quant} ${ammoName}`,
    }));
  }
}

module.exports = AmmoManager;
