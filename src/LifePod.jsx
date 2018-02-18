import DependencyDeclaration from './DependencyDeclaration';
import HashMatrix from './HashMatrix';

/**
 * A container used to resolve a `DependencyDeclaration`.
 * @see DependencyDeclaration
 * */
export default class LifePod extends HashMatrix {
  static DEFAULT_NAME = 'LifePod';
  static ERRORS = {
    INVALID_FACTORY: 'INVALID_FACTORY',
    ASYNCHRONOUS_FACTORY_ERROR: 'ASYNCHRONOUS_FACTORY_ERROR',
    UNRESOLVED_ASYNCHRONOUS_DEPENDENCY: 'UNRESOLVED_ASYNCHRONOUS_DEPENDENCY',
    DEPENDENCY_RESOLUTION_RECURSION: 'DEPENDENCY_RESOLUTION_RECURSION',
    MISSING_REQUIRED_DEPENDENCY: 'MISSING_REQUIRED_DEPENDENCY'
  };

  _required;
  _optional;

  /**
   * @returns {Array.<LifePod>} A list of required dependencies.
   * */
  get required() {
    return this._required;
  }

  /**
   * @param {Array.<LifePod>} value A list of required dependencies.
   * */
  set required(value) {
    if (this._required instanceof Array) {
      this.removeDependencyListChangeHandlers(this._required);
    }

    this._required = value;

    if (this._required instanceof Array) {
      this.addDependencyListChangeHandlers(this._required);
    }
  }

  /**
   * @returns {Array.<LifePod>} A list of optional dependencies.
   * */
  get optional() {
    return this._optional;
  }

  /**
   * @param {Array.<LifePod>} value A list of optional dependencies.
   * */
  set optional(value) {
    if (this._optional instanceof Array) {
      this.removeDependencyListChangeHandlers(this._optional);
    }

    this._optional = value;

    if (this._optional instanceof Array) {
      this.addDependencyListChangeHandlers(this._optional);
    }
  }

  /**
   * A list of getters.
   * `getter(path = ''):*`
   * @type {Array.<Function>}
   * */
  getters;

  /**
   * A list of setters.
   * `setter(value = *, subPath = '')`
   * @type {Array.<Function>}
   * */
  setters;

  /**
   * A list of invalidators.
   * `invalidator(subPath = '')`
   * @type {Array.<Function>}
   * */
  invalidators;

  /**
   * A list of change handler receivers.
   * `listen(handler):Function (unlisten)`
   * @type {Array.<Function>}
   * */
  listeners;

  /**
   * A list of `HashMatrix` objects that will be passed directly to the `factory`.
   * @type {Array.<HashMatrix>}
   * */
  targets;

  /**
   * An optional function used to transform factory arguments from an argument map (Object)
   * (keys are the types of dependencies, values are arrays of resolved dependencies)
   * to an `Array` containing a different structure. Used when the factory
   * might require a different configuration of arguments.
   * `transformArgs(argMap = {required, optional, getters, setters, invalidators, listeners, targets}):Array (newArgs)`
   * If explicitly set to `false`, the factory is simply passed the arguments map directly.
   * The **default behavior** is to combine all dependencies, in order, into an array.
   * @type {Function|false}
   * */
  transformArgs;

  /**
   * The factory function used to **resolve** the value of the dependency.
   * @type {Function}
   * @param {Array.<*>} ...args The various required dependencies in the order:
   * `required`, `optional`, `getters`, `setters`, `invalidators`, `listeners`, `targets`
   * @returns {*|Promise} The value of the dependency.
   * */
  factory;

  /**
   * A function used to handle errors from an asynchronous factory.
   * @param {Object} errorInformation The error information.
   * `{message, error, data}`
   * */
  handlerAsyncFactoryError;

  /**
   * A flag designating whether or not this dependency is currently being resolved.
   * @type {boolean}
   * */
  resolving = false;

  /**
   * The current `Promise` responsible for resolving this dependency.
   * @type {Promise}
   * */
  resolver;

  strictRequired;

  constructor(config = {}) {
    const {
      required = [],
      optional = []
    } = config;
    const cleanConfig = {
      ...config
    };

    delete cleanConfig.required;
    delete cleanConfig.optional;

    super(cleanConfig);

    this.required = required;
    this.optional = optional;

    if (!(this.factory instanceof Function) && !(this.hashMatrix instanceof LifePod)) {
      throw {
        message: LifePod.ERRORS.INVALID_FACTORY,
        data: this
      };
    }
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

  addDependencyListChangeHandlers = (dependencyList = []) => {
    dependencyList.forEach(this.addDependencyChangeHandler);
  };

  removeDependencyListChangeHandlers = (dependencyList = []) => {
    dependencyList.forEach(this.removeDependencyChangeHandler);
  };

  transFormFactoryArgs(argMap = {}) {
    if (this.transformArgs === false) {
      return [argMap];
    } else if (this.transformArgs instanceof Function) {
      return this.transformArgs(argMap);
    } else {
      const {
        required = [],
        optional = [],
        getters = [],
        setters = [],
        invalidators = [],
        listeners = [],
        targets = []
      } = argMap;

      return [
        ...required,
        ...optional,
        ...getters,
        ...setters,
        ...invalidators,
        ...listeners,
        ...targets
      ];
    }
  }

  resolveDependency = (dependency, optional) => {
    let resolvedValue;

    if (dependency instanceof LifePod) {
      resolvedValue = dependency.resolve();
    } else if (dependency instanceof HashMatrix) {
      resolvedValue = dependency.getPath([]);
    } else {
      resolvedValue = dependency;
    }

    if (!optional) {
      if (resolvedValue instanceof Promise) {
        throw {
          message: LifePod.ERRORS.UNRESOLVED_ASYNCHRONOUS_DEPENDENCY,
          data: this,
          subject: dependency
        };
      }

      if (this.strictRequired && typeof resolvedValue === 'undefined') {
        throw {
          message: LifePod.ERRORS.MISSING_REQUIRED_DEPENDENCY,
          data: this,
          subject: dependency
        };
      }
    }

    return resolvedValue;
  };

  resolveDependencyList(dependencyList = [], optional) {
    return dependencyList.map((d) => this.resolveDependency(d, optional));
  }

  /**
   * @returns {*}
   * */
  async resolveAsyncFactoryPromise(promise) {
    this.resolving = true;
    this.resolver = promise;

    try {
      const value = await promise;

      this.resolving = false;
      this.resolver = undefined;

      this.setValue(value);
    } catch (error) {
      if (this.handlerAsyncFactoryError instanceof Function) {
        this.handlerAsyncFactoryError({
          message: LifePod.ERRORS.ASYNCHRONOUS_FACTORY_ERROR,
          error,
          data: this
        });
      }
    }
  }

  /**
   * Invalidate this dependency.
   * */
  invalidate() {
    this.setValue(undefined);
  }

  /**
   * Resolve the value of this dependency using the provided factory and various requirements.
   * If the value of this dependency is *valid* (not `undefined`), the current value is simply
   * returned in order to avoid recursive resolution.
   * @returns {*|Promise} The value of the dependency.
   * */
  resolve() {
    if (this.hashMatrix instanceof LifePod) {
      // TRICKY: If a `LifePod` is proxied it must be resolved.
      const proxiedValue = this.hashMatrix.resolve();

      if (proxiedValue instanceof Promise) {
        return new Promise(async (res, rej) => {
          try {
            await proxiedValue;

            res(this.getValue());
          } catch (error) {
            rej(error);
          }
        });
      } else {
        return this.getValue();
      }
    }

    if (this.resolving) {
      if (this.resolver instanceof Promise) {
        return this.resolver;
      } else {
        throw {
          message: LifePod.ERRORS.DEPENDENCY_RESOLUTION_RECURSION,
          data: this,
          subject: this
        };
      }
    }

    if (typeof this.getValue() === 'undefined') {
      this.resolving = true;

      try {
        const required = this.resolveDependencyList(this.required);
        const optional = this.resolveDependencyList(this.optional, true);
        const argMap = {
          required,
          optional,
          getters: this.getters,
          setters: this.setters,
          invalidators: this.invalidators,
          listeners: this.listeners,
          targets: this.targets
        };
        const args = this.transFormFactoryArgs(argMap);
        const value = this.factory(...args);

        if (value instanceof Promise) {
          this.resolveAsyncFactoryPromise(value);

          // TRICKY: Return the value but don't store it.
          // And do not cancel resolution.
          return value;
        } else {
          this.resolving = false;
          this.resolver = undefined;

          this.setValue(value);
        }
      } catch (error) {
        // IMPORTANT: If anything throws, cancel resolution.
        this.resolving = false;
        this.resolver = undefined;

        throw error;
      }
    }

    return this.getValue();
  }

  getValue() {
    return this.getPath([]);
  }

  setValue(value) {
    return this.setPath([], value);
  }
}
