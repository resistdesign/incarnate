import expect from 'expect';
import Incarnate from './Incarnate';

const MOCK_INSTANCE = { x: 10 };
const MOCK_DEPENDENCY = { y: 100 };
const MOCK_DEPENDENCY_DEPENDENCY = { z: 1000 };
const MOCK_CTX_PROP_VALUE = 'MOCK_CTX_PROP_VALUE';
const MOCK_CTX_PROP_VALUE_2 = 'MOCK_CTX_PROP_VALUE_2';
const MOCK_ARG_1_VALUE = 'MOCK_ARG_1_VALUE';
const MOCK_ARG_2_VALUE = 'MOCK_ARG_2_VALUE';

let CACHE_COUNT;

module.exports = {
  'Incarnate': {
    'should be a class': () => {
      expect(Incarnate).toBeA(Function);
    },
    'resolvePath': {
      beforeEach: () => {
        CACHE_COUNT = 0;
      },
      'should be a function': () => {
        const inc = new Incarnate({
          map: {}
        });

        expect(inc.resolvePath).toBeA(Function);
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

        expect(instance).toBe(MOCK_INSTANCE);
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

        expect(instance).toBe(MOCK_DEPENDENCY);
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

        expect(instance).toBe(MOCK_DEPENDENCY_DEPENDENCY);
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

        expect(instance.b).toBe(MOCK_CTX_PROP_VALUE);
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
            mockCtxProp2: MOCK_CTX_PROP_VALUE
          }
        });
        const instance = await inc.resolvePath(
          'mock',
          {
            mockCtxProp2: MOCK_CTX_PROP_VALUE_2
          }
        );

        expect(instance.b).toBe(MOCK_CTX_PROP_VALUE);
        expect(instance.c).toBe(MOCK_CTX_PROP_VALUE_2);
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

        expect(instance).toBeAn(Object);
        expect(instance.a).toBe(MOCK_ARG_1_VALUE);
        expect(instance.b).toBe(MOCK_ARG_2_VALUE);
        expect(diff < 20).toBe(true);
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

        expect(instance).toBeAn(Object);
        expect(instance.a).toBe(MOCK_DEPENDENCY);
        expect(instance.b).toBe(MOCK_CTX_PROP_VALUE);
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

        expect(cache['mock-dep']).toBe(dependency);
        expect(CACHE_COUNT).toBe(1);
        expect(instance).toBeAn(Object);
        expect(instance.a).toBe(0);
        expect(dependency).toBe(0);
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

        expect(cache['mock-dep']).toNotBe(dependency);
        expect(CACHE_COUNT).toBe(2);
        expect(instance).toBeAn(Object);
        expect(instance.a).toBe(0);
        expect(dependency).toBe(1);
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

        expect(instance2).toNotBe(instance1);
        expect(cache['mock-dep']).toBe(dependency);
        expect(CACHE_COUNT).toBe(2);
        expect(instance1).toBeAn(Object);
        expect(instance1.a).toBe(0);
        expect(instance2).toBeAn(Object);
        expect(instance2.a).toBe(1);
        expect(dependency).toBe(1);
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

        expect(invalidationTriggered).toBe(1);
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

        expect(invalidationTriggered).toBe(1);
      }
    }
  }
};
