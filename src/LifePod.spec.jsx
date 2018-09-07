import expect from 'expect.js';
import DependencyDeclaration from './DependencyDeclaration';
import LifePod from './LifePod';

export default {
  LifePod: {
    'should be a class': () => {
      expect(LifePod).to.be.a(Function);
    },
    'getValue': {
      'should resolve a synchronous value': () => {
        const lifePod = new LifePod(new DependencyDeclaration({
          factory: () => {
            return 'Tomato';
          }
        }));
        const testDep = lifePod.getValue();

        expect(testDep).to.equal('Tomato');
      }
    },
    'getValueAsync': {
      'should resolve an asynchronous value': async () => {
        const lifePod = new LifePod(new DependencyDeclaration({
          factory: async () => {
            return 'Tomato';
          }
        }));
        const testDep = await lifePod.getValueAsync();

        expect(testDep).to.equal('Tomato');
      }
    }
  }
};
