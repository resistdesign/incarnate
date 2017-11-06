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
    }
  }
};
