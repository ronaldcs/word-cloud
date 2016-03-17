/**
 * main.js
 */
var injector;
(function() {
  'use strict';

  angular.module('wordCloudEx', [
      'ngAnimate',
      'ngRoute'
    ])
    .config(['$routeProvider', '$compileProvider', function($routeProvider, $compileProvider) {
      $routeProvider
        .when("/", {}) /* Default route redirect */
        .when("/word-cloud/:synonym", {}) /* word-cloud directive route handler */
        .otherwise({
          redirectTo: "/"
        });
      $compileProvider.debugInfoEnabled(false); /* $compileProvider options */
    }])
    /* The main controller to start up the load animation */
    .controller('mainCtrl', ['$scope', function($scope) {
      var vm = this;
    }])
    /* Just a utility function to shuffle arrays */
    .factory('shuffle', function() {
      return function(array) {
        return array
          .map(function(n) {
            return [Math.random(), n];
          })
          .sort().map(function(n) {
            return n[1];
          });
      }
    })
    /**
     * word-cloud START
     */
    /* word-cloud: Word factory for the word-cloud directive */
    .factory('synonymFactory', ['$http', '$q', function($http, $q) {
      return {
        fetchData: function(w) {
          var deferred = $q.defer();
          var req = {
            method: 'GET',
            url: '//api.wordnik.com/v4/word.json/' + w + '/relatedWords?useCanonical=false&relationshipTypes=synonym&limitPerRelationshipType=20&api_key=f8979edb36da0149db0050058a50dbce47ff64ecde9b2746d'
          };
          $http(req)
            .success(function(data, status) {
              deferred.resolve((data[0] || {}).words || []);
            })
            .error(function(error) {
              deferred.reject(error);
              console.log('synonymFactory ERROR', JSON.stringify(error));
            });
          return deferred.promise;
        }
      };
    }])
    /* word-cloud: Quote factory for the word-cloud directive */
    .factory('topExampleFactory', ['$http', '$q', function($http, $q) {
      return {
        fetchData: function(w) {
          var deferred = $q.defer();
          var req = {
            method: 'GET',
            url: '//api.wordnik.com/v4/word.json/' + w + '/topExample?useCanonical=false&api_key=f8979edb36da0149db0050058a50dbce47ff64ecde9b2746d'
          };
          $http(req)
            .success(function(data, status) {
              deferred.resolve(data || {});
            })
            .error(function(error) {
              deferred.reject(error);
              console.log('topExampleFactory ERROR', JSON.stringify(error));
            });
          return deferred.promise;
        }
      };
    }])
    /* word-cloud: The word-cloud directive controller */
    .controller('wordCloudCtrl', ['$scope', '$element', 'shuffle', 'synonymFactory', 'topExampleFactory', '$route', '$location', '$timeout', function($scope, $el, shuffle, synonymFactory, topExampleFactory, $route, $location, $timeout) {
      var me = this;
      var cel = $el.find('.cloud');
      var spiral = function(a, b) { /* Provides the pathing for the words */
        var coords = [],
          centerx = cel.width() / 2,
          centery = cel.height() / 2;
        for (var i = 0; i < 1250; i++) {
          var angle = 0.1 * i;
          var x = centerx + (a + b * angle) * Math.cos(angle);
          var y = centery + (a + b * angle) * Math.sin(angle);
          if ((x > 0 && x < cel.width()) && (y > 0 && y < cel.height())) {
            coords.push([x, y]);
          }
        }
        return coords;
      };
      var boxesIntersect = function(a, b) { /* Collision detection */
        return !(b.left > a.right || b.right < a.left || b.top > a.bottom || b.bottom < a.top);
      }
      var collision = function(el, a) { /* Given an element, cycles through all existing elements to check for collision */
        var els = cel.find('div');
        for (var x = 0; x < els.length; x++) {
          if (els[x] !== el[0]) {
            var b = {
              top: angular.element(els[x]).position().top,
              left: angular.element(els[x]).position().left,
              bottom: angular.element(els[x]).position().top + angular.element(els[x]).height(),
              right: angular.element(els[x]).position().left + angular.element(els[x]).width()
            };
            if (boxesIntersect(a, b) || a.left < 0 || a.right > cel.width() || a.top < 0 || a.bottom > (cel.height() + cel.position().top)) {
              return true;
            }
          }
        };
        return false;
      };
      var setPosition = function(el, pos) { /* Sets the specified position, given the element */
        el.css({
          position: 'absolute'
        }).css({
          top: pos[1] - (el.height() / 2) + cel.position().top,
          left: pos[0] - (el.width() / 2)
        });
        return {
          top: el.position().top,
          left: el.position().left,
          bottom: el.position().top + el.height(),
          right: el.position().left + el.width()
        };
      };
      me.arrangeWords = function(keyword) { /* Arrange the default or fetched set words */
        var w = shuffle($scope.wordCloudConfig.words),
          l = 0,
          bb = {};
        var el = angular.element('<div class="keyword">' + $scope.wordCloudConfig.keyword + '</div>');
        cel.append(el);
        setPosition(el, path[0]);
        for (var i = 0; i < w.length && l < path.length; i++) {
          if (w[i] === $scope.wordCloudConfig.keyword) continue;
          el = angular.element('<div class="word"><a href="#/word-cloud/' + w[i] + '">' + w[i] + '</a></div>');
          cel.append(el);
          el.css({
            fontSize: (Math.random() * (1.75 - 0.3) + 0.3) + 'em'
          });
          bb = setPosition(el, path[l]);
          while (collision(el, bb)) {
            l++;
            if (l >= path.length) {
              el.remove();
              break;
            };
            bb = setPosition(el, path[l]);
          }
        };
      }
      var path = spiral(0, 1);
      $scope.$on("$routeChangeSuccess", function(event, newRoute, oldRoute) { /* Handle route (i.e. word) changes */
        cel.find('div').remove();
        switch ($location.path().match(/\/?.*\//)[0]) {
          case '/word-cloud/':
            /* Use the fetched data for word set */
            $scope.wordCloudConfig.keyword = newRoute.params.synonym;
            if (newRoute.params.synonym === 'Passion') {
              $scope.vm.start = false;
              $scope.wordCloudConfig = angular.extend({}, $scope.wordCloudConfigDefault);
              me.arrangeWords();
              $timeout(function () { /* Yep, a hack */
                $scope.vm.start = true;
              }, 1);
            } else {
              var synonymPromise = synonymFactory.fetchData($scope.wordCloudConfig.keyword);
              synonymPromise
                .then(
                  function(d) {
                    $scope.vm.start = false;
                    $scope.wordCloudConfig.words = d;
                    var topExamplePromise = topExampleFactory.fetchData($scope.wordCloudConfig.keyword);
                    topExamplePromise
                      .then(
                        function(d) {
                          $scope.wordCloudConfig.topExample = d;
                          me.arrangeWords();
                          $scope.vm.start = true;
                        }
                      );
                  },
                  function(error) {
                    console.log('synonymPromise ERROR', JSON.stringify(error));
                  }
                );
            }
            break;
          case '/':
            /* Use the default configuration for word set */
          default:
            $scope.vm.start = false;
            $scope.wordCloudConfig = angular.extend({}, $scope.wordCloudConfigDefault);
            me.arrangeWords();
            $timeout(function () { /* Yep, a hack */
              $scope.vm.start = true;
            }, 1);
        }
      });
    }])
    /* word-cloud: The word-cloud directive */
    .directive('wordCloud', function() {
      return {
        restrict: 'E',
        scope: {
          wordCloudConfigDefault: '=',
          vm: '='
        },
        controller: 'wordCloudCtrl',
        controllerAs: 'wcvm',
        template: "<div class='cloud'></div><div class='word-cloud-footer'><div class='text'><i class='fa fa-quote-left'></i><span>{{ wordCloudConfig.topExample.text }}</span><div class='title'><a href='{{ wordCloudConfig.topExample.url }}' target='_blank'>{{ wordCloudConfig.topExample.title }}</a> ({{ wordCloudConfig.topExample.year }})</div></div></div>",
        link: function($scope, $el, $attrs) {
          $scope.wordCloudConfig = angular.extend({}, $scope.wordCloudConfigDefault);
        }
      };
    })
    /* word-cloud: Animation for the word-cloud directive */
    .animation('.word-cloud', ['$rootScope', function($rootScope) {
      var tl = new TimelineMax();
      return {
        addClass: function(element, className, done) {
          if (className === 'start') {
            var height = element.find('.word-cloud-footer div')[0].getBoundingClientRect().height;
            tl
              .clear()
              .to(element.find('.word-cloud-footer'), 0.25, {
                height: height,
                ease: Ease.easeOut
              })
              .fromTo(element.find('.word-cloud-footer span'), 0.25, {
                opacity: 0,
                top: -10
              }, {
                opacity: 1,
                top: 0,
                ease: Ease.easeOut
              })
              .fromTo(element.find('.word-cloud-footer .title'), 0.25, {
                opacity: 0,
                left: 10
              }, {
                opacity: 1,
                left: 0,
                ease: Ease.easeOut
              }, 'title')
              .fromTo(element.find('.word-cloud-footer i'), 0.25, {
                opacity: 0,
                left: -10
              }, {
                opacity: 1,
                left: 0,
                ease: Ease.easeOut
              }, 'title')
              .staggerFromTo(element.find('.cloud div'), 0.5, {
                scale: 0,
                opacity: 0
              }, {
                scale: 1,
                opacity: 1,
                ease: Back.easeOut,
                onComplete: done
              }, 0.025);
          }
        }
      }
    }])
    /**
     * word-cloud END
     */
  injector = angular.bootstrap(document, ['wordCloudEx']); /* I do this out of habit in case I need it */
})();