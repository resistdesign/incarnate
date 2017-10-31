import expect from 'expect.js';
import Incarnate, {HashMatrix} from './Incarnate';

const MOCK_INSTANCE = {x: 10};
const MOCK_DEPENDENCY = {y: 100};
const MOCK_DEPENDENCY_DEPENDENCY = {z: 1000};
const MOCK_CTX_PROP_VALUE = 'MOCK_CTX_PROP_VALUE';
const MOCK_CTX_PROP_VALUE_2 = 'MOCK_CTX_PROP_VALUE_2';
const MOCK_ARG_1_VALUE = 'MOCK_ARG_1_VALUE';
const MOCK_ARG_2_VALUE = 'MOCK_ARG_2_VALUE';

let CACHE_COUNT;

module.exports = {
  'Incarnate': {
    'should be a class': () => {
      expect(Incarnate).to.be.a(Function);
    },
    'resolvePath': {
      beforeEach: () => {
        CACHE_COUNT = 0;
      },
      'should be a function': () => {
        const inc = new Incarnate({
          map: {}
        });

        expect(inc.resolvePath).to.be.a(Function);
      },
      'should resolve a path asynchronously': async () => {
        const inc = new Incarnate({
          map: {
            'mock': {
              args: [],
              factory: async () => {
                return await new Promise((res, rej) => {
                  setTimeout(() => res(MOCK_INSTANCE), 0);
                });
              }
            }
          }
        });
        const instance = await inc.resolvePath('mock');

        expect(instance).to.equal(MOCK_INSTANCE);
      },
      'should resolve an injected dependency asynchronously': async () => {
        const inc = new Incarnate({
          map: {
            'mock-dep': {
              args: [],
              factory: async () => {
                return await new Promise((res, rej) => {
                  setTimeout(() => res(MOCK_DEPENDENCY), 0);
                });
              }
            },
            'mock': {
              args: [
                'mock-dep'
              ],
              factory: async (mockDep) => {
                return mockDep;
              }
            }
          }
        });
        const instance = await inc.resolvePath('mock');

        expect(instance).to.equal(MOCK_DEPENDENCY);
      },
      'should resolve injected dependencies recursively and asynchronously': async () => {
        const inc = new Incarnate({
          map: {
            'mock-dep-dep': {
              args: [],
              factory: async () => {
                return await new Promise((res, rej) => {
                  setTimeout(() => res(MOCK_DEPENDENCY_DEPENDENCY), 0);
                });
              }
            },
            'mock-dep': {
              args: [
                'mock-dep-dep'
              ],
              factory: (mockDepDep) => {
                return mockDepDep;
              }
            },
            'mock': {
              args: [
                'mock-dep'
              ],
              factory: (mockDep) => {
                return mockDep;
              }
            }
          }
        });
        const instance = await inc.resolvePath('mock');

        expect(instance).to.equal(MOCK_DEPENDENCY_DEPENDENCY);
      },
      'should resolve a context specific dependency asynchronously': async () => {
        const inc = new Incarnate({
          map: {
            'mock-dep-dep': {
              args: [],
              factory: () => {
                return MOCK_DEPENDENCY_DEPENDENCY;
              }
            },
            'mock-dep': {
              args: [
                'mock-dep-dep',
                async (ctx) => {
                  return await new Promise((res, rej) => {
                    setTimeout(() => res(ctx.mockCtxProp), 0);
                  });
                }
              ],
              factory: (mockDepDep, mockCtxProp) => {
                return {
                  a: mockDepDep,
                  b: mockCtxProp
                };
              }
            },
            'mock': {
              args: [
                'mock-dep'
              ],
              factory: (mockDep) => {
                return mockDep;
              }
            }
          },
          context: {
            mockCtxProp: MOCK_CTX_PROP_VALUE
          }
        });
        const instance = await inc.resolvePath('mock');

        expect(instance.b).to.equal(MOCK_CTX_PROP_VALUE);
      },
      'should resolve a context specific dependency from both instance and parameter contexts': async () => {
        const inc = new Incarnate({
          map: {
            'mock-dep-dep': {
              args: [],
              factory: () => {
                return MOCK_DEPENDENCY_DEPENDENCY;
              }
            },
            'mock-dep': {
              args: [
                'mock-dep-dep',
                async (ctx) => {
                  return await new Promise((res, rej) => {
                    setTimeout(() => res(ctx.mockCtxProp), 0);
                  });
                },
                async (ctx) => {
                  return await new Promise((res, rej) => {
                    setTimeout(() => res(ctx.mockCtxProp2), 0);
                  });
                }
              ],
              factory: (mockDepDep, mockCtxProp, mockCtxProp2) => {
                return {
                  a: mockDepDep,
                  b: mockCtxProp,
                  c: mockCtxProp2
                };
              }
            },
            'mock': {
              args: [
                'mock-dep'
              ],
              factory: (mockDep) => {
                return mockDep;
              }
            }
          },
          context: {
            mockCtxProp: MOCK_CTX_PROP_VALUE,
            mockCtxProp2: MOCK_CTX_PROP_VALUE_2
          }
        });
        const instance = await inc.resolvePath(
          'mock',
          {
            mockCtxProp2: MOCK_CTX_PROP_VALUE_2
          }
        );

        expect(instance.b).to.equal(MOCK_CTX_PROP_VALUE);
        expect(instance.c).to.equal(MOCK_CTX_PROP_VALUE_2);
      },
      'should resolve args asynchronously and in parallel': async () => {
        const inc = new Incarnate({
          map: {
            'mock': {
              args: [
                async () => await new Promise((res, rej) => setTimeout(() => res(MOCK_ARG_1_VALUE), 10)),
                async () => await new Promise((res, rej) => setTimeout(() => res(MOCK_ARG_2_VALUE), 10))
              ],
              factory: async (arg1, arg2) => {
                return {
                  a: arg1,
                  b: arg2
                };
              }
            }
          }
        });
        const start = new Date().getTime();
        const instance = await inc.resolvePath('mock');
        const diff = new Date().getTime() - start;

        expect(instance).to.be.an(Object);
        expect(instance.a).to.equal(MOCK_ARG_1_VALUE);
        expect(instance.b).to.equal(MOCK_ARG_2_VALUE);
        expect(diff < 20).to.equal(true);
      },
      'should resolve deeply nested dependencies asynchronously': async () => {
        const inc = new Incarnate({
          map: {
            'nested': async ctx => {
              return await new Promise((res, rej) => {
                setTimeout(() => res({
                  'mock-dep': {
                    args: [],
                    factory: async () => {
                      return await new Promise((res2, rej2) => {
                        setTimeout(() => res2(ctx.mockCtxProp), 0);
                      });
                    }
                  }
                }), 0);
              });
            },
            'mock-dep': {
              args: [],
              factory: () => MOCK_DEPENDENCY
            },
            'mock': {
              args: [
                'mock-dep',
                'nested/mock-dep'
              ],
              factory: async (arg1, arg2) => {
                return await new Promise((res, rej) => {
                  setTimeout(() => res({
                    a: arg1,
                    b: arg2
                  }), 0);
                });
              }
            }
          },
          context: {
            mockCtxProp: MOCK_CTX_PROP_VALUE
          },
          pathDelimiter: '/'
        });
        const instance = await inc.resolvePath('mock');

        expect(instance).to.be.an(Object);
        expect(instance.a).to.equal(MOCK_DEPENDENCY);
        expect(instance.b).to.equal(MOCK_CTX_PROP_VALUE);
      },
      'should cache dependencies': async () => {
        const map = {
          'mock-dep': {
            args: [],
            factory: async () => {
              return await new Promise((res, rej) => {
                const cacheCount = CACHE_COUNT;

                setTimeout(() => res(cacheCount), 0);
                CACHE_COUNT += 1;
              });
            }
          },
          'mock': {
            args: [
              'mock-dep'
            ],
            factory: async (arg1) => {
              return {
                a: arg1
              };
            }
          }
        };
        const context = {};
        const cache = {};
        const inc = new Incarnate({
          map,
          context,
          cacheMap: cache
        });
        const instance = await inc.resolvePath('mock');
        const dependency = await inc.resolvePath('mock-dep');

        expect(cache['mock-dep']).to.equal(dependency);
        expect(CACHE_COUNT).to.equal(1);
        expect(instance).to.be.an(Object);
        expect(instance.a).to.equal(0);
        expect(dependency).to.equal(0);
      },
      'should not cache dependencies marked with cache = `false`': async () => {
        const map = {
          'mock-dep': {
            args: [],
            cache: false,
            factory: async () => {
              return await new Promise((res, rej) => {
                const cacheCount = CACHE_COUNT;

                setTimeout(() => res(cacheCount), 0);
                CACHE_COUNT += 1;
              });
            }
          },
          'mock': {
            args: [
              'mock-dep'
            ],
            factory: async (arg1) => {
              return {
                a: arg1
              };
            }
          }
        };
        const context = {};
        const cache = {};
        const inc = new Incarnate({
          map,
          context,
          cacheMap: cache
        });
        const instance = await inc.resolvePath('mock');
        const dependency = await inc.resolvePath('mock-dep');

        expect(cache['mock-dep']).to.not.equal(dependency);
        expect(CACHE_COUNT).to.equal(2);
        expect(instance).to.be.an(Object);
        expect(instance.a).to.equal(0);
        expect(dependency).to.equal(1);
      },
      'should enable invalidation of cached dependencies including all dependants': async () => {
        const map = {
          'mock-dep': {
            args: [],
            factory: async () => {
              return await new Promise((res, rej) => {
                const cacheCount = CACHE_COUNT;

                setTimeout(() => res(cacheCount), 0);
                CACHE_COUNT += 1;
              });
            }
          },
          'mock': {
            args: [
              'mock-dep',
              (ctx, inc) => {
                return () => inc.invalidate(['mock-dep']);
              }
            ],
            factory: async (arg1, arg2) => {
              return {
                a: arg1,
                b: arg2
              };
            }
          }
        };
        const context = {};
        const cache = {};
        const inc = new Incarnate({
          map,
          context,
          cacheMap: cache
        });
        const instance1 = await inc.resolvePath('mock');
        instance1.b();
        const dependency = await inc.resolvePath('mock-dep');
        const instance2 = await inc.resolvePath('mock');

        expect(instance2).to.not.equal(instance1);
        expect(cache['mock-dep']).to.equal(dependency);
        expect(CACHE_COUNT).to.equal(2);
        expect(instance1).to.be.an(Object);
        expect(instance1.a).to.equal(0);
        expect(instance2).to.be.an(Object);
        expect(instance2.a).to.equal(1);
        expect(dependency).to.equal(1);
      },
      'should resolve an alias': async () => {
        const value = {};
        const map = {
          subMap: () => {
            return {
              subDep: {
                args: [
                  ''
                ],
                factory: () => value
              }
            };
          },
          dep: 'subMap.subDep'
        };
        const context = {};
        const cacheMap = {};
        const inc = new Incarnate({
          map,
          context,
          cacheMap
        });
        const resolvedValue = await inc.resolvePath('dep');

        expect(resolvedValue).to.equal(value);
      },
      'should support factory supplied subMaps': async () => {
        const sharedValue = {SHARED: 'SHARED'};
        const inc = new Incarnate({
          context: {},
          cacheMap: {},
          map: {
            shared: {
              args: [],
              factory: () => sharedValue
            },
            subDeps: {
              subMap: true,
              args: [
                'shared'
              ],
              factory: (shared) => {
                return {
                  secondLevel: {
                    args: [],
                    factory: async () => await shared()
                  }
                };
              }
            },
            topLevel: {
              args: [
                'subDeps.secondLevel'
              ],
              factory: (sharedFromSecondLevel) => sharedFromSecondLevel
            }
          }
        });
        const resolvedDep = await inc.resolvePath('topLevel');

        expect(resolvedDep).to.equal(sharedValue);
      },
      'should use a HashMatrix for dependencies simply declared as `true`': async () => {
        const inc = new Incarnate({
          context: {},
          cacheMap: {},
          map: {
            first: {
              subMap: true,
              args: [],
              factory: () => ({
                second: true
              })
            }
          }
        });
        const secondLevelHashMatrix = await inc.resolvePath('first.second');

        let fourthInvalidated = false;

        inc.addInvalidationListener('first.second.third.fourth', () => fourthInvalidated = true);

        // TRICKY: Initialize the Incarnate lifecycle by
        // requesting the target value for the first time before modifying it.
        await inc.resolvePath('first.second.third.fourth');

        secondLevelHashMatrix.setPath('third.fourth', 'FOURTH');

        const fourthLevelValue = await inc.resolvePath('first.second.third.fourth');

        expect(fourthInvalidated).to.equal(true);
        expect(fourthLevelValue).to.equal('FOURTH');
      },
      'should use a preconfigured HashMatrix for a dependency declared as a HashMatrix instance': async () => {
        const inc = new Incarnate({
          context: {},
          cacheMap: {},
          map: {
            first: {
              subMap: true,
              args: [],
              factory: () => ({
                second: new HashMatrix({hashMatrix: {third: {fourth: 'USE THE FOURTH'}}})
              })
            }
          }
        });

        const fourthLevelValue = await inc.resolvePath('first.second.third.fourth');

        expect(fourthLevelValue).to.equal('USE THE FOURTH');
      }
    },
    'addInvalidationListener/removeInvalidationListener': {
      beforeEach: () => {
        CACHE_COUNT = 0;
      },
      'should listen and un-listen for dependency invalidation for a specified path': async () => {
        const map = {
          'mock-dep': {
            args: [],
            factory: async () => {
              return await new Promise((res, rej) => {
                const cacheCount = CACHE_COUNT;

                setTimeout(() => res(cacheCount), 0);
                CACHE_COUNT += 1;
              });
            }
          },
          'mock': {
            args: [
              'mock-dep',
              (ctx, inc) => {
                return () => inc.invalidate(['mock-dep']);
              }
            ],
            factory: async (arg1, arg2) => {
              return {
                a: arg1,
                b: arg2
              };
            }
          }
        };
        const context = {};
        const cache = {};
        const inc = new Incarnate({
          map,
          context,
          cacheMap: cache
        });
        const instance1 = await inc.resolvePath('mock');
        const onInvalidation = () => {
          invalidationTriggered += 1;
        };

        let invalidationTriggered = 0;

        inc.addInvalidationListener('mock-dep', onInvalidation);
        instance1.b();
        inc.removeInvalidationListener('mock-dep', onInvalidation);
        await inc.resolvePath('mock-dep');
        instance1.b();

        expect(invalidationTriggered).to.equal(1);
      },
      'should listen and un-listen for dependency invalidation for a specified, deeply nested path': async () => {
        const map = {
          'mock-dep': () => ({
            'mock-deep': {
              args: [],
              factory: () => true
            }
          }),
          'mock': {
            args: [
              'mock-dep.mock-deep',
              (ctx, inc) => {
                return () => inc.invalidate(['mock-dep.mock-deep']);
              }
            ],
            factory: async (arg1, arg2) => {
              return {
                a: arg1,
                b: arg2
              };
            }
          }
        };
        const context = {};
        const cache = {};
        const inc = new Incarnate({
          map,
          context,
          cacheMap: cache
        });
        const instance1 = await inc.resolvePath('mock');
        const onInvalidation = () => {
          invalidationTriggered += 1;
        };

        let invalidationTriggered = 0;

        inc.addInvalidationListener('mock-dep.mock-deep', onInvalidation);
        instance1.b();
        inc.removeInvalidationListener('mock-dep.mock-deep', onInvalidation);
        await inc.resolvePath('mock-dep.mock-deep');
        instance1.b();

        expect(invalidationTriggered).to.equal(1);
      }
    },
    'invalidate': {
      'should trigger invalidation for all dependents of multiple, deeply nested dependencies': async () => {
        const map = {
          xyz: () => {
            return {
              opq: () => {
                return {
                  nop: {
                    args: [
                      (ctx, inc1) => inc1
                    ],
                    factory: inc2 => inc2
                  },
                  hij: {
                    args: [],
                    factory: () => true
                  },
                  qrs: {
                    args: [
                      'hij',
                      'nop'
                    ],
                    factory: () => true
                  }
                };
              },
              gh: {
                args: [
                  'opq.qrs',
                  'opq.hij'
                ],
                factory: () => true
              },
              tuv: {
                args: [],
                factory: () => true
              },
              ijk: {
                args: [
                  'gh',
                  'tuv'
                ],
                factory: () => true
              },
              lmn: {
                args: [
                  'ijk',
                  (ctx, inc3) => inc3
                ],
                factory: (arg1, inc4) => inc4
              }
            };
          },
          abc: {
            args: [
              'xyz.lmn'
            ],
            factory: () => true
          },
          def: {
            args: [
              'abc',
              'xyz.opq.nop'
            ],
            factory: () => true
          }
        };
        const context = {};
        const cacheMap = {};
        const inc = new Incarnate({
          map,
          context,
          cacheMap
        });
        const deepInc = await inc.resolvePath('xyz.lmn');
        const deepDeepInc = await inc.resolvePath('xyz.opq.nop');

        let invalidatedPaths = [];

        await inc.resolvePath('def');

        inc.addInvalidationListener('abc', ::invalidatedPaths.push);
        inc.addInvalidationListener('def', ::invalidatedPaths.push);
        deepInc.addInvalidationListener('lmn', ::invalidatedPaths.push);

        inc.invalidate(['abc']);

        await inc.resolvePath('def');

        deepDeepInc.invalidate(['nop']);

        expect(invalidatedPaths.length).to.equal(5);
        expect(invalidatedPaths).to.eql(['abc', 'def', 'abc', 'def', 'lmn']);
      }
    }
  }
};
