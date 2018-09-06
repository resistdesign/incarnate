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
      }
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
    }
  }
};
