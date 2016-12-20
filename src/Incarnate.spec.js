import expect from 'expect';
import Incarnate from './Incarnate';

module.exports = {
  'Incarnate': {
    'should be a function': () => {
      expect(Incarnate).toBeA(Function);
    }
  }
};
