import T from 'prop-types';
import InternalHashMatrix from './HashMatrix';

export const HashMatrix = InternalHashMatrix;

export default class Incarnate {
  static INCARNATE_LABEL = 'Incarnate';
  static DEPENDENCY_DECLARATION_LABEL = 'Dependency Declaration';
  static DEPENDENCY_DECLARATION_PROPERTY_LABEL = 'Dependency Declaration Property';
  static DEFAULT_PATH_DELIMITER = '.';
  static ERRORS = {
    INVALID_PATH: 'INVALID_PATH',
    UNRESOLVED_PATH: 'UNRESOLVED_PATH',
    FACTORY_ERROR: 'FACTORY_ERROR'
  };
  static EVENTS = {
    PATH_CHANGE: 'PATH_CHANGE',
    PATH_INVALIDATED: 'PATH_INVALIDATED',
    ERROR: 'ERROR'
  };

  static validateDependencyDeclaration(dependencyDeclaration, dependencyName = Incarnate.DEPENDENCY_DECLARATION_LABEL) {
    if (dependencyDeclaration instanceof Object) {
      const validatorShape = {
        subMap: T.bool,
        required: T.arrayOf(T.string),
        optional: T.arrayOf(T.string),
        getters: T.arrayOf(T.string),
        setters: T.arrayOf(T.string),
        invalidators: T.arrayOf(T.string),
        listeners: T.arrayOf(T.string),
        factory: T.func.isRequired
      };
      const validPropList = Object.keys(validatorShape);
      const dependencyPropList = Object.keys(dependencyDeclaration);

      dependencyPropList.forEach(key => {
        if (validPropList.indexOf(key) === -1) {
          console.warn(
            `Warning: Invalid ${Incarnate.DEPENDENCY_DECLARATION_PROPERTY_LABEL} \`${key}\` in \`${Incarnate.INCARNATE_LABEL}: ${dependencyName}\`.`
          );
        }
      });

      T.checkPropTypes(
        validatorShape,
        dependencyDeclaration,
        Incarnate.DEPENDENCY_DECLARATION_PROPERTY_LABEL,
        `${Incarnate.INCARNATE_LABEL}: ${dependencyName}`
      );
    } else {
      console.warn(`Warning: Invalid ${Incarnate.DEPENDENCY_DECLARATION_LABEL} \`${dependencyName}\`.`);
    }
  }

  static keyIsNumeric(key) {
    let numeric = false;

    try {
      numeric = Number.isInteger(parseInt(key, 10));
    } catch (error) {
      // Ignore.
    }

    return numeric;
  }

  static getPathParts(path, pathDelimiter) {
    return HashMatrix.getPathParts(path, pathDelimiter);
  }

  static getStringPath(pathParts, pathDelimiter) {
    if (typeof pathParts === 'string') {
      return pathParts;
    } else if (pathParts instanceof Array) {
      return pathParts.join(pathDelimiter);
    }
  }

  static getPathInfo(pathParts) {
    const pathInfo = {};

    if (pathParts instanceof Array) {
      const newPathParts = [...pathParts];

      pathInfo.topPath = newPathParts.shift();
      pathInfo.subPath = newPathParts;
    }

    return pathInfo;
  }

  static prefixPath(path = [], prefix = [], pathDelimiter) {
    return Incarnate.getStringPath(
      [
        ...Incarnate.getPathParts(prefix, pathDelimiter),
        ...Incarnate.getPathParts(path, pathDelimiter)
      ],
      pathDelimiter
    );
  }

  _subMapCache = {};

  map;
  pathDelimiter;
  cache;

  constructor({
                map,
                hashMatrix = {},
                pathDelimiter = Incarnate.DEFAULT_PATH_DELIMITER
              }) {
    this.map = map;
    this.cache = new HashMatrix({
      hashMatrix,
      pathDelimiter,
      onPathChange: this.onPathChange
    });
    this.pathDelimiter = pathDelimiter;
  }

  onPathChange() {
    // TODO: Implement.
  }

  listen(path, handler) {
    // TODO: Build listener tree for path and all dependencies of path.
    // TODO: Trigger resolve for path???
  }

  getDependencyIsDependent(path, dependencyDeclaration = {}, prefix = []) {
    const stringPath = Incarnate.getStringPath(
      Incarnate.getPathParts(path, this.pathDelimiter),
      this.pathDelimiter
    );
    const {required = [], optional = []} = dependencyDeclaration;
    const allDepPaths = [...required, ...optional];

    for (const depPath of allDepPaths) {
      const prefixedDepPath = Incarnate.getStringPath([
        ...Incarnate.getPathParts(prefix, this.pathDelimiter),
        ...Incarnate.getPathParts(depPath, this.pathDelimiter)
      ], this.pathDelimiter);

      if (prefixedDepPath === stringPath) {
        return true;
      }
    }

    return false;
  }

  getDependentsFromMap(path, map = {}, prefix) {
    return Object.keys(map).filter((depName) => this.getDependencyIsDependent(path, map[depName], prefix));
  }

  getDependents(path) {
    // Get the dependents from `map`.
    const topDependents = this.getDependentsFromMap(path, this.map);

    // Get the dependent from each sub-map.
    const subDependents = this.getSubMapNames().reduce((acc, subMapPath) => {
      const subMap = this.getSubMap(subMapPath);

      let dependents = acc;

      if (subMap instanceof Object && !(subMap instanceof Promise)) {
        dependents = [
          ...dependents,
          ...this.getDependentsFromMap(path, subMap, subMapPath)
        ];
      }

      return dependents;
    }, []);

    return [
      ...subDependents,
      ...topDependents
    ]
      .reduce((acc, item) => {
        if (acc.indexOf(item) === -1) {
          acc.push(item);
        }

        return acc;
      }, []);
  }

  handleResolveError(path, error) {
    // TODO: How do errors work? Keep them on a HashMatrix???
  }

  invalidatePath(path = []) {
    // TODO: Is this method needed???
    const stringPath = Incarnate.getStringPath(path, this.pathDelimiter);

    // Invalidate sub-maps.
    this.removeSubMap(stringPath);

    // Unset path on `hashMatrix`.
    this.updateHashMatrix(stringPath, undefined, true);

    // Dispatch the invalidation event.
    this.dispatchEvent(Incarnate.EVENTS.PATH_INVALIDATED, stringPath);

    // Dispatch changes AFTER removing cached values and sub-maps.
    this.dispatchChanges(stringPath);
  }

  async handleAsyncDependency(path, promise, subMap, fullPaths = []) {
    const stringPath = Incarnate.getStringPath(path, this.pathDelimiter);
    let value;

    try {
      value = await promise;
    } catch (error) {
      this.handleResolveError(path, error);

      return;
    }

    if (subMap) {
      this.setSubMap(path, value);
    } else {
      this.setPath(path, value);
    }

    // IMPORTANT: Invalidate all full paths to dependents.
    if (fullPaths instanceof Array) {
      for (const fp of fullPaths) {
        const stringFullPath = Incarnate.getStringPath(fp, this.pathDelimiter);

        if (stringFullPath !== '' && stringPath !== stringFullPath) {
          this.invalidatePath(stringFullPath);
        }
      }
    }
  }

  updateDependencyList(paths, map, prefix, fullPaths) {
    let fullyResolved = true;

    if (paths instanceof Array) {
      paths.forEach(path => {
        try {
          if (!this.updateDependency(path, map, prefix, fullPaths)) {
            fullyResolved = false;
          }
        } catch (error) {
          fullyResolved = false;
        }
      });
    }

    return fullyResolved;
  }

  createGetter(path) {
    return (subPath = []) => this.getPath(Incarnate.getStringPath(
      [
        ...Incarnate.getPathParts(path, this.pathDelimiter),
        ...Incarnate.getPathParts(subPath, this.pathDelimiter)
      ],
      this.pathDelimiter
    ));
  }

  createSetter(path) {
    return (value, subPath = []) => {
      this.setPath(
        Incarnate.getStringPath(
          [
            ...Incarnate.getPathParts(path, this.pathDelimiter),
            ...Incarnate.getPathParts(subPath, this.pathDelimiter)
          ],
          this.pathDelimiter
        ),
        value
      );
    };
  }

  createInvalidator(path) {
    return () => {
      this.invalidatePath(path);
    };
  }

  createListener(path) {
    return (handler) => this.addEventListener(Incarnate.EVENTS.PATH_CHANGE, (changedPath) => {
      if (changedPath === path) {
        let value;

        try {
          value = this.getPath(path);
        } catch (error) {
          // Ignore.
        }

        handler(value);
      }
    });
  }

  updateDependency(path, map, prefix = [], fullPaths = []) {
    const pathParts = Incarnate.getPathParts(path, this.pathDelimiter);
    const {topPath: topPathBase, subPath = []} = Incarnate.getPathInfo(pathParts);
    const topPath = this.prefixPath(topPathBase, prefix);
    const prefixedFullPath = this.prefixPath(path, prefix);
    // IMPORTANT: Accumulate all full paths depending on the current dependency in case of
    // asynchronous resolution.
    const fullPathsAccumulator = [...fullPaths, prefixedFullPath];

    let resolved = false;

    if (map instanceof Object && map.hasOwnProperty(topPathBase)) {
      Incarnate.validateDependencyDeclaration(map[topPathBase], prefixedFullPath);

      const {
        [topPathBase]: {
          subMap,
          required = [],
          optional = [],
          getters = [],
          setters = [],
          invalidators = [],
          listeners = [],
          factory
        }
      } = map;
      const topPathSubMap = this.getSubMap(topPath);

      if (
        factory instanceof Function &&
        // Don't process if there is an unresolved sub-map for this path.
        !(subMap && topPathSubMap instanceof Promise)
      ) {
        const topPathIsSet = subMap ? this.subMapIsSet(topPath) : this.pathIsSet(topPath);

        if (!topPathIsSet) {
          // The value for the current path is mapped as a dependency but
          // has not been added to the `hashMatrix`, so get it.
          const requiredDependenciesResolved = this.updateDependencyList(required, map, prefix, fullPathsAccumulator);

          if (requiredDependenciesResolved) {
            // The required dependencies have been resolved and are available on the `hashMatrix`.
            const requiredValues = required
              .map(p => this.prefixPath(p, prefix))
              .map(::this.getPath);
            const optionalValues = optional
              .map(p => this.prefixPath(p, prefix))
              .map(p => {
                try {
                  return this.getPath(p);
                } catch (error) {
                  // Ignore.
                }
              });
            const getterHandlers = getters
              .map(p => this.prefixPath(p, prefix))
              .map(::this.createGetter);
            const setterHandlers = setters
              .map(p => this.prefixPath(p, prefix))
              .map(::this.createSetter);
            const invalidationHandlers = invalidators
              .map(p => this.prefixPath(p, prefix))
              .map(::this.createInvalidator);
            const listenerHandlers = listeners
              .map(p => this.prefixPath(p, prefix))
              .map(::this.createListener);
            const factoryArgs = [
              ...requiredValues,
              ...optionalValues,
              ...getterHandlers,
              ...setterHandlers,
              ...invalidationHandlers,
              ...listenerHandlers
            ];
            let factoryValue;

            try {
              factoryValue = factory(...factoryArgs);
            } catch (error) {
              this.handleResolveError(topPath, error);

              return false;
            }

            if (factoryValue instanceof Promise) {
              if (subMap) {
                // IMPORTANT: Cache the promise so that dependency resolution isn't repeatedly attempted while
                // resolving a complex nested path.
                this.setSubMap(topPath, factoryValue);
              }

              this.handleAsyncDependency(topPath, factoryValue, subMap, fullPathsAccumulator);
            } else if (subMap) {
              this.setSubMap(topPath, factoryValue);

              if (subPath.length) {
                resolved = this.updateDependency(subPath, factoryValue, topPath, fullPathsAccumulator);
              } else {
                resolved = true;
              }
            } else {
              this.setPath(topPath, factoryValue);

              resolved = true;
            }
          }
        } else if (subMap && subPath.length) {
          // The value for the current path is set and it is a sub-map with remaining path parts to be resolved.
          const subMapValue = this.getSubMap(topPath);

          resolved = this.updateDependency(subPath, subMapValue, topPath, fullPathsAccumulator);
        } else {
          resolved = true;
        }
      }
    } else {
      resolved = true;
    }

    return resolved;
  }

  getPath(path) {
    return this.cache.getPath(path);
  }

  setPath(path, value, unset) {
    return this.cache.setPath(path, value, unset);
  }

  subMapIsSet(path) {
    return this._subMapCache.hasOwnProperty(path);
  }

  getSubMap(path) {
    return this._subMapCache[path];
  }

  setSubMap(path, value) {
    // TODO: Should a HashMatrix with change events be used???
    // Check for actual changes.
    const currentValue = this.getSubMap(path);

    if (value !== currentValue) {
      this._subMapCache[path] = value;
      this.dispatchChanges(path);
    }
  }

  removeSubMap(path) {
    delete this._subMapCache[path];
  }

  getSubMapNames() {
    return Object.keys(this._subMapCache);
  }
}