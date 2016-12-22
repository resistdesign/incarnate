import expect from 'expect';
import Incarnate from './Incarnate';

const MOCK_INSTANCE = { x: 10 };
const MOCK_DEPENDENCY = { y: 100 };
const MOCK_DEPENDENCY_DEPENDENCY = { z: 1000 };
const MOCK_CTX_PROP_VALUE = 'MOCK_CTX_PROP_VALUE';
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
      'should asynchronously cache dependencies': async () => {
        const map = {
          'mock-dep': {
            args: [],
            factory: async () => {
              return await new Promise((res, rej) => {
                const cacheCount = CACHE_COUNT;

                setTimeout(() => res(cacheCount), 0);
                CACHE_COUNT += 1;
              });
            },
            cacheIsValid: async (ctx, cachedValue) => {
              return await new Promise((res, rej) => {
                setTimeout(() => res(ctx.refreshProp), 0);
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
        const context = {
          refreshProp: true
        };
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
      }
    }
  }
};
