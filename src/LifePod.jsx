import DependencyDeclaration from './DependencyDeclaration';
import HashMatrix from './HashMatrix';

/**
 * A container used to resolve a `DependencyDeclaration`.
 * @see DependencyDeclaration
 * */
export default class LifePod extends HashMatrix {
  static DEFAULT_NAME = 'LifePod';

  _dependencies;

  /**
   * @returns {Object.<HashMatrix>} A map of named dependencies.
   * */
  get dependencies() {
    return this._dependencies;
  }

  /**
   * @param {Object.<HashMatrix>} value A map of named dependencies.
   * */
  set dependencies(value) {
    if (this._dependencies instanceof Object) {
      this.removeDependencyMapChangeHandlers(this._dependencies);
    }

    this._dependencies = value;

    if (this._dependencies instanceof Object) {
      this.addDependencyMapChangeHandlers(this._dependencies);
    }
  }

  /**
   * A map of named getters.
   * `getter(path = ''):*`
   * @type {Object.<Function>}
   * */
  getters;

  /**
   * A map of named setters.
   * `setter(value = *, subPath = '')`
   * @type {Object.<Function>}
   * */
  setters;

  /**
   * A map of named invalidators.
   * `invalidator(subPath = '')`
   * @type {Object.<Function>}
   * */
  invalidators;

  /**
   * A map of named change handler receivers.
   * `listen(handler):Function (unlisten)`
   * @type {Object.<Function>}
   * */
  listeners;

  /**
   * The factory function used to create the value of the dependency.
   * @type {Function}
   * @param {DependencyDeclaration} dependencyValues A `DependencyDeclaration` with resolved values rather than paths.
   * @returns {*|Promise} The value of the dependency.
   * */
  factory;

  /**
   * If `true`, the `factory` is NOT called until **none** of the `dependencies` are `undefined`.
   * @type {boolean}
   * */
  strict;

  /**
   * Always call the `factory` when calling `getPath`, even if there is an existing value.
   * @type {boolean}
   * */
  noCache;

  /**
   * @param {DependencyDeclaration} dependencyDeclaration The `DependencyDeclaration` to be resolved.
   * */
  constructor(dependencyDeclaration = new DependencyDeclaration()) {
    const {
      dependencies = [],
      ...cleanDependencyDeclaration
    } = dependencyDeclaration;

    super(cleanDependencyDeclaration);

    this.dependencies = dependencies;
  }

  handleDependencyChange = () => {
    this.invalidate();
  };

  addDependencyChangeHandler = (dependency) => {
    if (dependency instanceof HashMatrix) {
      dependency.addChangeHandler('', this.handleDependencyChange);
    }
  };

  removeDependencyChangeHandler = (dependency) => {
    if (dependency instanceof HashMatrix) {
      dependency.removeChangeHandler('', this.handleDependencyChange);
    }
  };

  addDependencyMapChangeHandlers = (dependencyMap = {}) => {
    Object
      .keys(dependencyMap)
      .forEach(k => this.addDependencyChangeHandler(dependencyMap[k]));
  };

  removeDependencyMapChangeHandlers = (dependencyMap = {}) => {
    Object
      .keys(dependencyMap)
      .forEach(k => this.removeDependencyChangeHandler(dependencyMap[k]));
  };

  invalidate() {
    this.setValue(undefined);
  }

  resolveDependency(dependency) {
    if (dependency instanceof HashMatrix) {
      return dependency.getValue();
    }
  }

  resolveDependencyMap(dependencyMap = {}) {
    const resolvedDependencyDeclaration = new DependencyDeclaration();
    const dependencyValueMap = {};

    resolvedDependencyDeclaration.dependencies = dependencyValueMap;
    resolvedDependencyDeclaration.getters = this.getters;
    resolvedDependencyDeclaration.setters = this.setters;
    resolvedDependencyDeclaration.invalidators = this.invalidators;
    resolvedDependencyDeclaration.listeners = this.listeners;

    for (const k in dependencyMap) {
      const dep = dependencyMap[k];
      const depValue = this.resolveDependency(dep);

      if (this.strict && typeof depValue === 'undefined') {
        return undefined;
      } else {
        dependencyValueMap[k] = depValue;
      }
    }

    return resolvedDependencyDeclaration;
  }

  async handleFactoryPromise(factoryPromise) {
    if (factoryPromise instanceof Promise) {
      const value = await factoryPromise;

      this.resolving = false;

      super.setPath([], value);
    }
  }

  resolving = false;

  resolve() {
    let resolvedValue;

    if (!this.resolving) {
      this.resolving = true;

      if (this.factory instanceof Function) {
        const resolvedDependencyDeclaration = this.resolveDependencyMap(this.dependencies);

        if (typeof resolvedDependencyDeclaration !== 'undefined') {
          resolvedValue = this.factory(resolvedDependencyDeclaration);

          if (resolvedValue instanceof Promise) {
            this.handleFactoryPromise(resolvedValue);
          } else {
            this.resolving = false;
          }
        }
      } else {
        resolvedValue = super.getPath([]);

        this.resolving = false;
      }
    }

    return resolvedValue;
  }

  /**
   * @override
   * */
  getPath(path) {
    const directValue = super.getPath([]);

    let value;

    if (typeof directValue === 'undefined' || this.noCache) {
      const resolvedDirectValue = this.resolve();

      if (this.resolving) {
        value = undefined;
      } else {
        super.setPath([], resolvedDirectValue);

        value = super.getPath(path);
      }
    } else {
      value = super.getPath(path);
    }

    return value;
  }

  /**
   * The same as `getPath` but asynchronous and will wait for a value.
   * */
  async getPathAsync(path) {
    const pathString = this.getPathString(path);

    return new Promise((res, rej) => {
      const handler = () => {
        try {
          const value = this.getPath(path);

          if (typeof value !== 'undefined') {
            this.removeChangeHandler(pathString, handler);
            res(value);
          }
        } catch (error) {
          const {message = ''} = error || {};

          rej({
            message,
            subject: this,
            data: path,
            error
          });
        }
      };

      this.addChangeHandler(pathString, handler);

      handler();
    });
  }

  /**
   * The same as `getValue` but asynchronous and will wait for a value.
   * */
  async getValueAsync() {
    return this.getPathAsync([]);
  }
}
