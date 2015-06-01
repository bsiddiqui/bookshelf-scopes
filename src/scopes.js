'use strict';

var _ = require('lodash');

module.exports = function(bookshelf) {
  var baseExtend = bookshelf.Model.extend;
  // `bookshelf.knex()` was deprecated in knex v0.8.0, use `knex.queryBuilder()` instead if available
  var QueryBuilder = (bookshelf.knex.queryBuilder) ? bookshelf.knex.queryBuilder().constructor : bookshelf.knex().constructor;

  bookshelf.Model.extend = function(protoProps) {
    var self = this;
    protoProps.scopes = _.extend({}, self.prototype.scopes || {}, protoProps.scopes || {});

    Object.keys(protoProps.scopes).forEach(function(property) {
      protoProps[property] = function() {
        var _this = this;
        var passedInArguments = _.toArray(arguments);

        if (passedInArguments.length > 0 && passedInArguments[0] instanceof QueryBuilder) {
          protoProps.scopes[property].apply(this, passedInArguments);

          return self;
        } else {
          return this.query(function(qb) {
            passedInArguments.unshift(qb);
            protoProps.scopes[property].apply(_this, passedInArguments);
          });
        }
      };

      self[property] = function() {
        var model = this.forge();
        return model[property].apply(model, arguments);
      };
    });

    _.each(['hasMany', 'hasOne', 'belongsToMany', 'morphOne', 'morphMany',
      'belongsTo', 'through'], function(method) {
      var original = self.prototype[method];
      self.prototype[method] = function() {
        var relationship = original.apply(this, arguments);
        if (protoProps.scopes && protoProps.scopes.default) {
          var originalSelectConstraints = relationship.relatedData.selectConstraints;
          relationship.relatedData.selectConstraints = function(knex, options) {
            originalSelectConstraints.apply(this, arguments);
            protoProps.scopes.default.apply(this, [knex]);
          };
        }
        return relationship;

      };
    });

    return baseExtend.apply(self, arguments);
  };

  var Model = bookshelf.Model.extend({

    scopes: null,

    initialize: function() {
      this.addScope();
    },

    addScope: function() {
      var self = this;
      if (self.scopes && self.scopes.default) {
        self.query(function(qb) {
          var args = [];
          args.push(qb);
          self.scopes.default.apply(self, args);
        });
      }
    },

    unscoped: function() {
      return this.resetQuery();
    }
  }, {
    unscoped: function() {
      return this.forge().unscoped();
    }
  });

  bookshelf.Model = Model;
};
