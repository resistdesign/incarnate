import expect from 'expect.js';
import Incarnate, {
  HashMatrix,
  SubMapDeclaration,
  LifePod
} from './index';
import DemoApp from '../demo/app';

export default {
  Incarnate: {
    'should be a class': () => {
      expect(Incarnate).to.be.a(Function);
    },
    'should automatically update dependants when their dependencies change': async () => {
      let ok = false;

      try {
        await DemoApp();

        ok = true;
      } catch (error) {
        console.log(error);
      }

      expect(ok).to.equal(true);
    },
    'getDependency': {
      'should get a declared dependency': () => {
        const inc = new Incarnate(new SubMapDeclaration({
          subMap: {
            testDep: {
              factory: () => 'Tomato'
            }
          }
        }));
        const dep = inc.getDependency('testDep');

        expect(dep).to.be.a(LifePod);
      },
      'should get an undeclared dependency': () => {
        const inc = new Incarnate(new SubMapDeclaration({
          subMap: {}
        }));
        const dep = inc.getDependency('testDep');

        expect(dep).to.be.a(HashMatrix);
      }
    },
    'getResolvedPath': {
      'should resolve a synchronous dependency': () => {
        const inc = new Incarnate(new SubMapDeclaration({
          subMap: {
            testDep: {
              factory: () => {
                return 'Tomato';
              }
            }
          }
        }));
        const testDep = inc.getResolvedPath('testDep');

        expect(testDep).to.equal('Tomato');
      }
    },
    'getResolvedPathAsync': {
      'should resolve an asynchronous dependency': async () => {
        const inc = new Incarnate(new SubMapDeclaration({
          subMap: {
            testDep: {
              factory: async () => {
                return 'Tomato';
              }
            }
          }
        }));
        const testDep = await inc.getResolvedPathAsync('testDep');

        expect(testDep).to.equal('Tomato');
      },
      'should not hang the process when timing out': async () => {
        const inc = new Incarnate(new SubMapDeclaration({
          subMap: {
            dep1: {
              factory: () => undefined
            },
            testDep: {
              dependencies: {
                dep1: 'dep1'
              },
              strict: true,
              factory: async () => {
                return 'Tomato';
              }
            }
          }
        }));
        const testDepPod = inc.getDependency('testDep');

        let resError = undefined;

        try {
          await inc.getResolvedPathAsync('testDep', 1000);
        } catch (error) {
          resError = error;
        }

        expect(resError).to.be.an(Object);
        expect(testDepPod.resolving).to.equal(false);
      }
    },
    'createIncarnate': {
      'should throw when a required, shared dependency is not satisfied': () => {
        let missingSharedDependencyError;

        try {
          const inc = new Incarnate(new SubMapDeclaration({
            subMap: {
              needsShared: {
                subMap: {
                  missing: true
                }
              }
            }
          }));

          inc.getDependency('needsShared');
        } catch (error) {
          missingSharedDependencyError = error;
        }

        expect(missingSharedDependencyError).to.be.an(Object);
        expect(missingSharedDependencyError.message).to.equal(
          Incarnate.ERRORS.UNSATISFIED_SHARED_DEPENDENCY
        );
        expect(missingSharedDependencyError.data).to.equal('missing');
      }
    },
    'addErrorHandler': {
      'should call the handler when an asynchronous error occurs at the given path': async () => {
        const asyncNestedDepError = new Error('Error from `a.b`.');
        const inc = new Incarnate(new SubMapDeclaration({
          subMap: {
            a: {
              subMap: {
                b: {
                  factory: async () => {
                    throw asyncNestedDepError;
                  }
                }
              }
            },
            c: {
              dependencies: {
                dep: 'a.b'
              },
              strict: true,
              factory: () => true
            }
          }
        }));

        try {
          await inc.getResolvedPathAsync('c');

          expect(true).to.equal(false);
        } catch (error) {
          const {
            source: {
              error: sourceError
            }
          } = error;

          expect(sourceError).to.equal(asyncNestedDepError);
        }
      }
    }
  }
};
