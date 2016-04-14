/* globals describe: false, it:false, afterEach:false*/
require('chai').should();
var expect = require('chai').expect;
var _ = require('underscore');
var roll20 = require('../lib/roll20');
var mockery = require('mockery');
mockery.enable();
mockery.warnOnUnregistered(false);
mockery.registerMock('../lib/srd-converter', _.identity);
var ShapedScripts = require('../lib/shaped-script');
mockery.disable();
var sinon = require('sinon');
var logger = require('./dummy-logger');
var Reporter = require('./dummy-reporter');
var Roll20Object = require('./dummy-roll20-object');
var el = require('./dummy-entity-lookup');

describe('shaped-script', function () {
  'use strict';
  var sandbox = sinon.sandbox.create();

  afterEach(function () {
    sandbox.restore();
  });

  describe('checkForAmmoUpdate', function () {

    it('should decrement ammo correctly', function () {
      var roll20Mock = sandbox.stub(roll20);
      var characterStub = { id: 'myid' };

      /**
       * Test attribute
       * @param name
       * @param value
       * @constructor
       */
      function Attribute(name, value) {
        this.name = name;
        this.value = value;
      }

      //noinspection JSUnusedGlobalSymbols
      Attribute.prototype.get = function (propName) {
        switch (propName) {
          case 'current':
            return this.value;
          case 'name':
            return this.name;
          default:
            throw 'Unrecognised property name ' + propName;
        }
      };

      var arrowsQty = new Attribute('repeating_ammo_YYY_qty', 50);

      var attributeArray = [
        new Attribute('normalAttr', 'someVal'),
        new Attribute('anotherNormalAttr', 'someVal'),
        new Attribute('repeating_foo_XXX_something', 'someVal'),
        new Attribute('repeating_foo_XXX_other', 'someVal'),
        new Attribute('repeating_foo_YYY_something', 'someVal'),
        new Attribute('repeating_foo_YYY_other', 'someVal'),
        new Attribute('repeating_ammo_XXX_qty', 20),
        new Attribute('repeating_ammo_XXX_weight', 0.25),
        new Attribute('repeating_ammo_XXX_name', 'bolts'),
        arrowsQty,
        new Attribute('repeating_ammo_YYY_name', 'arrows'),
        new Attribute('repeating_ammo_YYY_weight', 0.1)
      ];

      roll20Mock.findObjs.withArgs({ _type: 'character', name: 'Bob' }).returns([characterStub]);
      roll20Mock.findObjs.withArgs({ type: 'attribute', characterid: characterStub.id }).returns(attributeArray);
      roll20Mock.getAttrByName.withArgs(characterStub.id, 'ammo_auto_use').returns('1');

      var shapedScript = new ShapedScripts(logger, { config: { updateAmmo: true } }, roll20Mock, null, null, new Reporter());

      var msg = {
        rolltemplate: '5e-shaped',
        content: '{{ammo_name=arrows}}{{character_name=Bob}}{{ammo=$[[0]]}}',
        inlinerolls: [{ expression: '50-2' }]
      };

      var options = shapedScript.getRollTemplateOptions(msg);

      var setVals = {};

      arrowsQty.set = function (propName, value) {
        setVals[propName] = value;
      };

      shapedScript.handleAmmo(options, msg);
      //noinspection JSUnresolvedVariable
      return setVals.should.deep.equal({ current: 48 });
    });
  });

  describe('#importMonsters', function () {


    it('token, no existing character, one monster', function () {
      var monsters = [
        {
          name: 'monster'
        }
      ];

      runImportMonsterTest(sandbox, monsters, {},
        function (token, character, roll20) {
          roll20.createObj.withArgs('character', { name: 'monster' }).returns(character);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });


    });

    it('token, existing character, one monster', function () {

      var monsters = [
        {
          name: 'monster'
        }
      ];

      runImportMonsterTest(sandbox, monsters, {},
        function (token, character, roll20) {
          token.set('represents', character.id);
          roll20.createObj.withArgs('character', { name: 'monster' }).returns(character);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });

    });

    it('token, existing character, one monster, overwrite', function () {

      var monsters = [
        {
          name: 'monster'
        }
      ];

      runImportMonsterTest(sandbox, monsters, { overwrite: true },
        function (token, character, roll20) {
          token.set('represents', character.id);
          roll20.getObj.withArgs('character', character.id).returns(character);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });

    });

    it('token, existing character, one monster, replace', function () {

      var monsters = [
        {
          name: 'monster'
        }
      ];

      runImportMonsterTest(sandbox, monsters, { replace: true },
        function (token, character, roll20) {
          character.set('name', 'monster2');
          token.set('represents', character.id);
          roll20.getObj.withArgs('character', character.id).returns(character);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });

    });

    it('token, existing character, one monster, replace', function () {

      var monsters = [
        {
          name: 'monster'
        }
      ];

      runImportMonsterTest(sandbox, monsters, { replace: true },
        function (token, character, roll20) {
          character.set('name', 'monster');
          roll20.findObjs.withArgs({ type: 'character', name: 'monster' }).returns([character]);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });

    });
  });

  describe('#triggerChatWatchers', function () {
    it('trigger hd watcher', function () {
      var roll20Mock = sandbox.stub(roll20);
      var characterStub = { id: 'myid' };
      roll20Mock.findObjs.withArgs({ _type: 'character', name: 'Bob' }).returns([characterStub]);
      var shapedScript = new ShapedScripts(logger, { config: { updateAmmo: true } }, roll20Mock, null, null, new Reporter());
      shapedScript.registerEventHandlers();
      var msg = {
        rolltemplate: '5e-shaped',
        content: '{{uses=@{Bellaluna|hd_d10}}}{{uses_max=@{Bellaluna|hd_d10|max}}{{character_name=Bob}}@{Bob|attacher_hit_dice}',
        inlinerolls: [{ expression: '50-2' }]
      };
      shapedScript.triggerChatWatchers(msg);
    });
  });

  describe('ability creation', function () {
    sandbox.restore();
    it('should create save ability', function () {
      var roll20Mock = sandbox.stub(roll20);
      var characterStub = new Roll20Object('character');
      characterStub.set('name', 'Bob');
      var tokenStub = new Roll20Object('graphic');
      var abilityStub = new Roll20Object('ability');
      tokenStub.set('represents', characterStub.id);
      roll20Mock.getObj.withArgs('graphic', tokenStub.id).returns(tokenStub);
      roll20Mock.getObj.withArgs('character', characterStub.id).returns(characterStub);
      roll20Mock.getOrCreateObj.withArgs('ability', {
        characterid: characterStub.id,
        name: 'Saves'
      }).returns(abilityStub);
      var reporter = new Reporter();
      var shapedScript = new ShapedScripts(logger, { config: { updateAmmo: true } }, roll20Mock, null, el.entityLookup, reporter);
      shapedScript.getCommandProcessor().processCommand({
        type: 'api',
        content: '!shaped-abilities --saves',
        selected: [{ _type: 'graphic', _id: tokenStub.id }]
      });
      expect(roll20Mock.getOrCreateObj.withArgs('ability', {
        characterid: characterStub.id,
        name: 'Saves'
      }).callCount).to.equal(1);
    });

  });
});


function runImportMonsterTest(sandbox, monsters, options, preConfigure, expectationChecker) {
  'use strict';
  sandbox.stub(roll20, 'createObj');
  sandbox.stub(roll20, 'findObjs');
  sandbox.stub(roll20, 'getAttrByName');
  sandbox.stub(roll20, 'sendChat');
  sandbox.stub(roll20, 'getObj');
  var shapedScript = new ShapedScripts(logger, {}, roll20, null, null, new Reporter());
  shapedScript.checkInstall();

  var token = new Roll20Object('graphic');
  token.set('imgsrc', 'imgsrc');

  var attributes = {};
  var character = new Roll20Object('character');

  preConfigure(token, character, roll20);

  sandbox.stub(roll20, 'setAttrByName', function (characterId, name, value) {
    expect(characterId).to.equal(character.id);
    var attr = attributes[name] || new Roll20Object('attribute');
    attr.set('current', value);
    attributes[name] = attr;
  });

  roll20.findObjs.withArgs({ type: 'attribute', characterid: character.id }).returns([]);
  sandbox.stub(roll20, 'getOrCreateAttr', function (characterId, name) {
    expect(characterId).to.equal(character.id);
    var attr = new Roll20Object('attribute');
    attributes[name] = attr;
    return attr;
  });
  roll20.getAttrByName.withArgs(character.id, 'locked').returns(null);

  shapedScript.importMonsters(monsters, options, token, []);
  expect(attributes.import_data_present.props.current).to.equal('on');
  expectationChecker(character, attributes, token);
}
