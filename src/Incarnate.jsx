import InternalHashMatrix from './HashMatrix';

export const HashMatrix = InternalHashMatrix;

export default class Incarnate extends HashMatrix {
  static ERRORS = {
    INVALID_MAP: 'INVALID_MAP'
  };

  map;

  constructor({map = {}, initialCache = {}, pathDelimiter}) {
    super({
      hashMatrix: initialCache,
      pathDelimiter
    });

    this.map = map;

    if (!(map instanceof Object)) {
      throw new Error(Incarnate.ERRORS.INVALID_MAP);
    }
  }

  resolvePath(path) {
    // TODO: Implement.
  }
}
