import HashMatrixInternal from './HashMatrix';
import LifePodInternal from './LifePod';
import DependencyDeclarationInternal from './DependencyDeclaration';
import SubMapDeclarationInternal from './SubMapDeclaration';

export const DependencyDeclaration = DependencyDeclarationInternal;
export const SubMapDeclaration = SubMapDeclarationInternal;
export const HashMatrix = HashMatrixInternal;
export const LifePod = LifePodInternal;

/**
 * Manage the lifecycle of application dependencies.
 * Use dependencies as application entry-points and keep track of live changes.
 * */
export default class Incarnate extends HashMatrix {
  static DEFAULT_NAME = 'Incarnate';
  static ERRORS = {
    INVALID_MAP: 'INVALID_MAP',
    UNSATISFIED_SHARED_DEPENDENCY: 'UNSATISFIED_SHARED_DEPENDENCY'
  };

  /**
   * The map of dependency and subMap declarations.
   * @type {Object.<DependencyDeclaration|SubMapDeclaration|Incarnate|LifePod|HashMatrix>}
   * */
  map;

  /**
   * A function used to transform the arguments for a `LifePod` factory.
   * @type {Function}
   * @see LifePod::transformArgs
   * */
  transformArgs;

  _parsedMap = {};

  /**
   * When `true`, `LifePod` objects will throw an error when dependencies resolve to `undefined`.
   * Default: `false`.
   * */
  strictRequired;

  constructor(config = {}) {
    super(config);

    if (!(this.map instanceof Object)) {
      throw {
        message: Incarnate.ERRORS.INVALID_MAP,
        data: this
      };
    }

    if (!this.hasOwnProperty('strictRequired')) {
      this.strictRequired = false;
    }
  }

  createLifePod(name, dependencyDeclaration = {}) {
    const {
      required = [],
      optional = [],
      getters = [],
      setters = [],
      invalidators = [],
      listeners = [],
      targets = [],
      transformArgs,
      strictRequired
    } = dependencyDeclaration;
    const config = {
      ...dependencyDeclaration,
      name: this.getPathString(name, this.name),
      targetPath: name,
      hashMatrix: this,
      required: required.map(this.getDependency),
      optional: optional.map(this.getDependency),
      getters: getters.map(this.createGetter),
      setters: setters.map(this.createSetter),
      invalidators: invalidators.map(this.createInvalidator),
      listeners: listeners.map(this.createListener),
      targets: targets.map(this.createTarget),
      transformArgs: typeof transformArgs !== 'undefined' ?
        transformArgs :
        this.transformArgs,
      strictRequired: typeof strictRequired !== 'undefined' ?
        strictRequired :
        this.strictRequired
    };

    return new LifePod(config);
  }

  createIncarnate(name, subMapDeclaration = {}) {
    const {
      subMap = {},
      shared = {},
      transformArgs,
      strictRequired
    } = subMapDeclaration;
    const parsedSharedMap = Object.keys(shared)
      .reduce((acc, k) => {
        const p = shared[k];

        acc[k] = this.getDependency(p);

        return acc;
      }, {});
    const subMapWithShared = {
      ...subMap,
      ...parsedSharedMap
    };
    const config = {
      ...subMapDeclaration,
      name: this.getPathString(name, this.name),
      targetPath: name,
      hashMatrix: this,
      map: subMapWithShared,
      transformArgs: typeof transformArgs !== 'undefined' ?
        transformArgs :
        this.transformArgs,
      strictRequired: typeof strictRequired !== 'undefined' ?
        strictRequired :
        this.strictRequired
    };

    return new Incarnate(config);
  }

  convertDeclaration(name, declaration = {}) {
    if (declaration instanceof HashMatrix) {
      return declaration;
    }

    const {subMap} = declaration;

    if (subMap instanceof Object) {
      return this.createIncarnate(name, declaration);
    } else {
      return this.createLifePod(name, declaration);
    }
  }

  /**
   * Get a dependency by path.
   * @param {Array|string} path The path to the dependency.
   * @returns {Incarnate|LifePod|HashMatrix} The dependency.
   * */
  getDependency = (path = '') => {
    const pathArray = this.getPathArray(path);
    const pathString = this.getPathString(pathArray);

    if (!pathArray.length) {
      return this;
    }

    const name = pathArray.shift();
    const subPath = [...pathArray];

    if (!this._parsedMap.hasOwnProperty(name) && this.map.hasOwnProperty(name)) {
      this._parsedMap[name] = this.convertDeclaration(name, this.map[name]);
    }

    const dep = this._parsedMap[name];

    if (dep instanceof Incarnate) {
      return dep.getDependency(subPath);
    } else if (dep instanceof HashMatrix) {
      if (subPath.length) {
        if (dep instanceof LifePod) {
          return new LifePod({
            name: pathString,
            targetPath: subPath,
            hashMatrix: dep,
            strictRequired: this.strictRequired
          });
        } else {
          return new HashMatrix({
            name: pathString,
            targetPath: subPath,
            hashMatrix: dep
          });
        }
      } else {
        return dep;
      }
    } else {
      return new HashMatrix({
        name: pathString,
        targetPath: [
          name,
          ...subPath
        ],
        hashMatrix: this
      });
    }
  };

  createGetter = (path) => {
    return (subPath = []) => {
      // TRICKY: Get the `dep` "just in time" to avoid recursion.
      const dep = this.getDependency(path);

      return dep.getPath(subPath);
    }
  };

  createSetter = (path) => {
    return (value, subPath = []) => {
      // TRICKY: Get the `dep` "just in time" to avoid recursion.
      const dep = this.getDependency(path);

      return dep.setPath(subPath, value);
    }
  };

  createInvalidator = (path) => {
    const setter = this.createSetter(path);

    return () => setter(undefined);
  };

  createListener = (path) => {
    return (handler, subPath = []) => {
      // TRICKY: Get the `dep` "just in time" to avoid recursion.
      const dep = this.getDependency(path);

      return dep.addChangeHandler(subPath, handler);
    }
  };

  createTarget = (path) => {
    return this.getDependency(path);
  };
}
