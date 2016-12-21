import expect from 'expect';
import incarnate from './incarnate';

const MOCK_INSTANCE = {};
const MOCK_DEPENDENCY = {};
const MOCK_DEPENDENCY_DEPENDENCY = {};
const MOCK_CTX_PROP_VALUE = 'MOCK_CTX_PROP_VALUE';

module.exports = {
  'incarnate': {
    'should be a function': () => {
      expect(incarnate).toBeA(Function);
    },
    'should resolve a path': () => {
      const instance = incarnate('mock', {
        'mock': {
          args: [],
          factory: () => {
            return MOCK_INSTANCE;
          }
        }
      }, {});

      expect(instance).toBe(MOCK_INSTANCE);
    },
    'should resolve an injected dependency': () => {
      const instance = incarnate('mock', {
        'mock-dep': {
          args: [],
          factory: () => {
            return MOCK_DEPENDENCY;
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
      }, {});

      expect(instance).toBe(MOCK_DEPENDENCY);
    },
    'should resolve injected dependencies recursively': () => {
      const instance = incarnate('mock', {
        'mock-dep-dep': {
          args: [],
          factory: () => {
            return MOCK_DEPENDENCY_DEPENDENCY;
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
      }, {});

      expect(instance).toBe(MOCK_DEPENDENCY_DEPENDENCY);
    },
    'should resolve a context specific dependency': () => {
      const instance = incarnate('mock', {
        'mock-dep-dep': {
          args: [],
          factory: () => {
            return MOCK_DEPENDENCY_DEPENDENCY;
          }
        },
        'mock-dep': {
          args: [
            'mock-dep-dep',
            ctx => ctx.mockCtxProp
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
            return mockDep.b;
          }
        }
      }, {
        mockCtxProp: MOCK_CTX_PROP_VALUE
      });

      expect(instance).toBe(MOCK_CTX_PROP_VALUE);
    }
  }
};
