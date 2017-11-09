import expect from 'expect.js';
import Incarnate from './Incarnate';

const MOCK_PATHS = {
  A: [
    'some',
    'seriously',
    'cRazY',
    'junk',
    3
  ],
  B: [
    'other',
    'really',
    'seriously',
    4,
    'cRazY',
    'craziness'
  ],
  C: [
    'super',
    'amazing',
    'hash',
    'matrix',
    2
  ]
};
const MOCK_VALUES = {
  A: 'AMAZING',
  B: 'BANANAS',
  C: 'service'
};

let MOCK_SERVICE,
  MOCK_HASH_MATRIX;

export default {
  Incarnate: {
    beforeEach: () => {
      MOCK_HASH_MATRIX = undefined;
      MOCK_SERVICE = undefined;
    },
    static: {
      keyIsNumeric: {
        'should properly identify numeric keys': () => {
          const isNum1 = Incarnate.keyIsNumeric(3);
          const isNum2 = Incarnate.keyIsNumeric('five');

          expect(isNum1).to.be(true);
          expect(isNum2).to.be(false);
        }
      },
      getPathParts: {
        'should create path parts from a string': () => {
          const parts = Incarnate.getPathParts('this.is.a.path', '.');

          expect(parts).to.eql(['this', 'is', 'a', 'path']);
        },
        'should allow an array path to pass through': () => {
          const path = ['this', 'is', 'a', 'path'];
          const parts = Incarnate.getPathParts(path, '.');

          expect(parts).to.equal(path);
        },
        'should throw an error when path is not a valid type': () => {
          const invalidPathObject = {};

          let pathError;

          try {
            Incarnate.getPathParts(invalidPathObject, '.');
          } catch (error) {
            pathError = error;
          }

          expect(pathError.message).to.equal(Incarnate.ERRORS.INVALID_PATH);
          expect(pathError.path).to.equal(invalidPathObject);
        }
      },
      getStringPath: {
        'should convert an array path to a string path': () => {
          const path = Incarnate.getStringPath(['this', 'is', 'a', 'path'], '.');

          expect(path).to.equal('this.is.a.path');
        },
        'should allow a string path to pass through': () => {
          const path = Incarnate.getStringPath('this.is.a.path', '.');

          expect(path).to.equal('this.is.a.path');
        }
      },
      getPathInfo: {
        'should provide the top path and the sub-path for a path array': () => {
          const {topPath, subPath} = Incarnate.getPathInfo(['this', 'is', 'a', 'path']);

          expect(topPath).to.equal('this');
          expect(subPath).to.eql(['is', 'a', 'path']);
        }
      }
    },
    setPath: {
      beforeEach: () => {
        MOCK_HASH_MATRIX = {
          super: {
            amazing: {
              hash: {
                matrix: [
                  undefined,
                  undefined,
                  'service'
                ]
              }
            }
          }
        };
        MOCK_SERVICE = new Incarnate({
          hashMatrix: MOCK_HASH_MATRIX
        });
      },
      'should set the value of a deeply nested path on an empty hash matrix': () => {
        MOCK_SERVICE.setPath(MOCK_PATHS.A, MOCK_VALUES.A);

        expect(MOCK_SERVICE.hashMatrix.some.seriously.cRazY.junk[3]).to.equal(MOCK_VALUES.A);
        expect(MOCK_SERVICE.getPath(MOCK_PATHS.A)).to.equal(MOCK_VALUES.A);
      }
    },
    getPath: {
      beforeEach: () => {
        MOCK_HASH_MATRIX = {
          super: {
            amazing: {
              hash: {
                matrix: [
                  undefined,
                  undefined,
                  'service'
                ]
              }
            }
          }
        };
        MOCK_SERVICE = new Incarnate({
          hashMatrix: MOCK_HASH_MATRIX
        });
      },
      'should not throw when accessing a value from a nonexistent branch of a hash matrix': () => {
        const value = MOCK_SERVICE.getPath(MOCK_PATHS.B);

        expect(value).to.equal(undefined);
      },
      'should return the value from a deeply nested path': () => {
        const value = MOCK_SERVICE.getPath(MOCK_PATHS.C);

        expect(value).to.equal(MOCK_VALUES.C);
      }
    },
    prefixPath: {
      beforeEach: () => {
        MOCK_HASH_MATRIX = {};
        MOCK_SERVICE = new Incarnate({
          map: {},
          hashMatrix: MOCK_HASH_MATRIX
        });
      },
      'should combine path parts with the path delimiter as a separator': () => {
        const prefixedPath = MOCK_SERVICE.prefixPath('path', 'test');

        expect(prefixedPath).to.equal('test.path');
      }
    },
    updateDependency: {
      beforeEach: () => {
        MOCK_HASH_MATRIX = {
          other: {
            dependency: 'OTHER_DEPENDENCY'
          }
        };
        MOCK_SERVICE = new Incarnate({
          map: {
            test: {
              required: [
                'other.dependency'
              ],
              factory: (otherDependency) => {
                return {
                  other: otherDependency
                };
              }
            },
            nested: {
              subMap: true,
              required: [
                'other.dependency'
              ],
              factory: (otherDependency) => {
                return {
                  value: {
                    factory: () => {
                      return {
                        nestedOther: otherDependency
                      };
                    }
                  }
                }
              }
            },
            deeply: {
              subMap: true,
              required: [
                'other.dependency'
              ],
              factory: async (otherDependency) => {
                return {
                  otherDependency: {
                    factory: async () => otherDependency
                  },
                  nested: {
                    subMap: true,
                    required: [
                      'otherDependency'
                    ],
                    factory: async (oD) => {
                      return {
                        asyncDependency: {
                          factory: async () => {
                            return {
                              other: oD
                            };
                          }
                        }
                      };
                    }
                  }
                }
              }
            }
          },
          hashMatrix: MOCK_HASH_MATRIX
        });
      },
      'should use the dependency map to resolve synchronous dependencies': () => {
        MOCK_SERVICE.updateDependency('test', MOCK_SERVICE.map);

        const testObject = MOCK_SERVICE.hashMatrix.test;
        const {other} = testObject;

        expect(testObject).to.be.an(Object);
        expect(other).to.equal('OTHER_DEPENDENCY');
      },
      'should use the dependency map to resolve nested, synchronous dependencies': () => {
        MOCK_SERVICE.updateDependency('nested.value', MOCK_SERVICE.map);

        const testObject = MOCK_SERVICE.hashMatrix.nested.value;
        const {nestedOther} = testObject;

        expect(testObject).to.be.an(Object);
        expect(nestedOther).to.equal('OTHER_DEPENDENCY');
      },
      'should use the dependency map to resolve deeply nested, asynchronous dependencies': async () => {
        const deeplyNestedAsyncPath = 'deeply.nested.asyncDependency';
        await new Promise((res, rej) => {
          MOCK_SERVICE.addEventListener(Incarnate.EVENTS.PATH_CHANGE, (p) => {
            if (MOCK_SERVICE.pathIsSet(deeplyNestedAsyncPath) && p === deeplyNestedAsyncPath) {
              res(true);
            } else {
              MOCK_SERVICE.updateDependency(deeplyNestedAsyncPath, MOCK_SERVICE.map);
            }
          });
          MOCK_SERVICE.addEventListener(Incarnate.EVENTS.ERROR, (data) => rej(data));

          MOCK_SERVICE.updateDependency(deeplyNestedAsyncPath, MOCK_SERVICE.map);
        });

        const testObject = MOCK_SERVICE.hashMatrix.deeply.nested.asyncDependency;
        const {other} = testObject;

        expect(testObject).to.be.an(Object);
        expect(other).to.equal('OTHER_DEPENDENCY');
      }
    }
  }
};
