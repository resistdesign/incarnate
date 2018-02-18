import expect from 'expect.js';
import Incarnate from './Incarnate';

export default {
  Incarnate: {
    'should be a class': () => {
      expect(Incarnate).to.be.a(Function);
    }
  }
};