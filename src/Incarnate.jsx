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
    UNSATISFIED_SHARED_DEPENDENCY: 'UNSATISFIED_SHARED_DEPENDENCY'
  };

  /**
   * The map of dependency and subMap declarations.
   * @type {Object.<DependencyDeclaration|SubMapDeclaration|Incarnate|LifePod|HashMatrix>}
   * */
  subMap;

  _parsedSubMap = {};

  /**
   * If `true`, `LifePod` factories will NOT be called until **none** of the `dependencies` are `undefined`.
   * @type {boolean}
   * */
  strict;

  /**
   * @param {SubMapDeclaration} subMapDeclaration The `SubMapDeclaration` to be managed.
   * */
  constructor(subMapDeclaration = new SubMapDeclaration()) {
    super(subMapDeclaration);

    if (!(this.subMap instanceof Object)) {
      this.subMap = {};
    }

    if (!(this.hashMatrix instanceof Object)) {
      this.hashMatrix = {};
    }
  }

  createLifePod(name, dependencyDeclaration = {}) {
    const {
      dependencies = {},
      getters = {},
      setters = {},
      invalidators = {},
      listeners = {},
      strict,
      ...otherConfig
    } = dependencyDeclaration;
    const newDependencyDeclaration = new DependencyDeclaration({
      ...otherConfig,
      name: this.getPathString(name, this.name),
      targetPath: name,
      hashMatrix: this,
      dependencies: this.getDependenciesFromMap(dependencies),
      getters: this.createFromMap(getters, this.createGetter),
      setters: this.createFromMap(setters, this.createSetter),
      invalidators: this.createFromMap(invalidators, this.createInvalidator),
      listeners: this.createFromMap(listeners, this.createListener),
      strict: typeof strict !== 'undefined' ?
        strict :
        this.strict
    });

    return new LifePod(newDependencyDeclaration);
  }

  createIncarnate(name, subMapDeclaration = {}) {
    const {
      subMap = {},
      shared = {},
      strict,
      ...otherConfig
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
    const newSubMapDeclaration = new SubMapDeclaration({
      ...otherConfig,
      name: this.getPathString(name, this.name),
      targetPath: name,
      hashMatrix: this,
      subMap: subMapWithShared,
      strict: typeof strict !== 'undefined' ?
        strict :
        this.strict
    });

    for (const k in subMap) {
      const depDec = subMap[k];

      if (depDec === true && !shared.hasOwnProperty(k)) {
        throw {
          message: Incarnate.ERRORS.UNSATISFIED_SHARED_DEPENDENCY,
          data: k,
          subject: subMapDeclaration,
          context: this
        };
      }
    }

    return new Incarnate(newSubMapDeclaration);
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

    if (!this._parsedSubMap.hasOwnProperty(name) && this.subMap.hasOwnProperty(name)) {
      this._parsedSubMap[name] = this.convertDeclaration(name, this.subMap[name]);
    }

    const dep = this._parsedSubMap[name];

    if (dep instanceof Incarnate) {
      return dep.getDependency(subPath);
    } else if (dep instanceof HashMatrix) {
      if (subPath.length) {
        if (dep instanceof LifePod) {
          return new LifePod(new DependencyDeclaration({
            name: pathString,
            targetPath: subPath,
            hashMatrix: dep,
            strict: this.strict
          }));
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

  getDependenciesFromMap(dependencyMap = {}) {
    return Object
      .keys(dependencyMap)
      .reduce((acc, k) => {
        const depPath = dependencyMap[k];
        acc[k] = this.getDependency(depPath);

        return acc;
      }, {});
  }

  createFromMap(map = {}, creator) {
    return Object
      .keys(map)
      .reduce((acc, k) => {
        const path = map[k];
        acc[k] = creator(path);

        return acc;
      }, {});
  }

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

  /**
   * The same as `getPath` but triggers `LifePod` dependency resolution.
   * */
  getResolvedPath(path) {
    const dep = this.getDependency(path);

    if (dep instanceof LifePod) {
      return dep.getValue();
    } else {
      return this.getPath(path);
    }
  }

  /**
   * The same as `getPath` but triggers `LifePod` dependency resolution and waits for a value.
   * */
  async getResolvedPathAsync(path) {
    const dep = this.getDependency(path);

    if (dep instanceof LifePod) {
      return dep.getValueAsync();
    } else {
      return this.getPath(path);
    }
  }
}
