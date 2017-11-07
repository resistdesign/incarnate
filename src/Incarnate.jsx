export default class Incarnate {
  static DEFAULT_PATH_DELIMITER = '.';
  static ERRORS = {
    INVALID_PATH: 'INVALID_PATH',
    UNRESOLVED_PATH: 'UNRESOLVED_PATH'
  };

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
    if (typeof path === 'string') {
      return path.split(pathDelimiter);
    } else if (path instanceof Array) {
      return path;
    } else {
      const error = new Error(Incarnate.ERRORS.INVALID_PATH);

      error.path = path;

      throw error;
    }
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

  _subMapCache = {};

  map;
  pathDelimiter;
  hashMatrix;
  onPathChange;
  onResolveError;

  constructor({
                map,
                hashMatrix = {},
                pathDelimiter = Incarnate.DEFAULT_PATH_DELIMITER,
                onPathChange,
                onResolveError
              }) {
    this.map = map;
    this.hashMatrix = hashMatrix;
    this.pathDelimiter = pathDelimiter;
    this.onPathChange = onPathChange;
    this.onResolveError = onResolveError;
  }

  dispatchChanges(path) {
    const pathParts = Incarnate.getPathParts(path, this.pathDelimiter);

    // Notify lifecycle listeners of changes all the way up the path.
    if (this.onPathChange instanceof Function && pathParts.length) {
      const currentPath = [...pathParts];

      // TRICKY: Start with the deepest path and move up to the most shallow.
      while (currentPath.length) {
        this.onPathChange(currentPath.join(this.pathDelimiter));
        currentPath.pop();
      }
    }
  }

  handleResolveError(path, error) {
    if (this.onResolveError instanceof Function) {
      this.onResolveError(path, error);
    }
  }

  pathIsSet(path) {
    const pathParts = Incarnate.getPathParts(path, this.pathDelimiter);

    let isSet = true,
      currentValue = this.hashMatrix;

    for (const part of pathParts) {
      if (currentValue instanceof Array && Incarnate.keyIsNumeric(part)) {
        if (currentValue.length < (parseInt(part, 10) + 1)) {
          isSet = false;
          break;
        }
      } else if (currentValue instanceof Object) {
        if (!currentValue.hasOwnProperty(part)) {
          isSet = false;
          break;
        }
      } else {
        isSet = false;
        break;
      }

      // Don't fail, just return `false`.
      try {
        currentValue = currentValue[part];
      } catch (error) {
        isSet = false;
        break;
      }
    }

    return isSet;
  }

  async handleAsyncDependency(path, promise, subMap) {
    let value;

    try {
      value = await promise;
    } catch (error) {
      this.handleResolveError(path, error);

      return;
    }

    if (subMap) {
      this._subMapCache = value;
    } else {
      this.setPath(path, value);
    }
  }

  updateDependencyList(paths, map, prefix) {
    let fullyResolved = true;

    if (paths instanceof Array) {
      paths.forEach(path => {
        try {
          if (!this.updateDependency(path, map, prefix)) {
            fullyResolved = false;
          }
        } catch (error) {
          fullyResolved = false;
        }
      });
    }

    return fullyResolved;
  }

  createSetter(path) {
    return (value) => {
      this.setPath(path, value);
    };
  }

  createInvalidator(path) {
    return () => {
      this.invalidatePath(path);
    };
  }

  prefixPath(path = [], prefix = []) {
    return Incarnate.getStringPath(
      [
        ...Incarnate.getPathParts(prefix, this.pathDelimiter),
        ...Incarnate.getPathParts(path, this.pathDelimiter)
      ],
      this.pathDelimiter
    );
  }

  updateDependency(path, map, prefix = []) {
    const pathParts = Incarnate.getPathParts(path, this.pathDelimiter);
    const {topPath: topPathBase, subPath = []} = Incarnate.getPathInfo(pathParts);
    const topPath = this.prefixPath(topPathBase, prefix);

    let resolved = false;

    if (map instanceof Object && map.hasOwnProperty(topPathBase)) {
      const {
        [topPathBase]: {
          subMap,
          required = [],
          optional = [],
          setters = [],
          invalidators = [],
          factory
        }
      } = map;

      if (
        factory instanceof Function &&
        // Don't process if there is an unresolved sub-map for this path.
        !(subMap && this._subMapCache[topPath] instanceof Promise)
      ) {
        const topPathIsSet = subMap ? this._subMapCache.hasOwnProperty(topPath) : this.pathIsSet(topPath);

        if (!topPathIsSet) {
          // The value for the current path is mapped as a dependency but
          // has not been added to the `hashMatrix`, so get it.
          const requiredDependenciesResolved = this.updateDependencyList(required, map, prefix);

          if (requiredDependenciesResolved) {
            // The required dependencies have been resolved and are available on the `hashMatrix`.
            const requiredValues = required
              .map(p => this.prefixPath(p, prefix))
              .map(::this.getPath);
            const optionalValues = optional
              .map(p => this.prefixPath(p, prefix))
              .map(::this.getPath);
            const setterHandlers = setters
              .map(p => this.prefixPath(p, prefix))
              .map(::this.createSetter);
            const invalidationHandlers = invalidators
              .map(p => this.prefixPath(p, prefix))
              .map(::this.createInvalidator);
            const factoryArgs = [
              ...requiredValues,
              ...optionalValues,
              ...setterHandlers,
              ...invalidationHandlers
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
                this._subMapCache[topPath] = factoryValue;
              }

              this.handleAsyncDependency(topPath, factoryValue, subMap);
            } else if (subMap) {
              this._subMapCache[topPath] = factoryValue;

              if (subPath.length) {
                resolved = this.updateDependency(subPath, factoryValue, topPath);
              } else {
                resolved = true;
              }
            } else {
              this.updateHashMatrix(topPath, factoryValue);

              resolved = true;
            }
          }
        } else if (subMap && subPath.length) {
          // The value for the current path is set and it is a sub-map with remaining path parts to be resolved.
          const subMapValue = this._subMapCache[topPath];

          resolved = this.updateDependency(subPath, subMapValue, topPath);
        } else {
          resolved = true;
        }
      }
    } else {
      resolved = true;
    }

    return resolved;
  }

  invalidatePath(path = []) {
    const stringPath = Incarnate.getStringPath(path, this.pathDelimiter);

    // Invalidate sub-maps.
    delete this._subMapCache[stringPath];

    // Unset path on `hashMatrix`.
    this.updateHashMatrix(stringPath, undefined, true);

    // Dispatch changes AFTER removing cached values and sub-maps.
    this.dispatchChanges(stringPath);

    // Invalidate dependents.
    for (const k in this._subMapCache) {
      if (stringPath.indexOf(`${k}${this.pathDelimiter}`) === 0) {
        // IMPORTANT: The path is a sub-path of the current sub-map.

        const subMap = this._subMapCache[k];

        if (subMap instanceof Object && !(subMap instanceof Promise)) {
          for (const s in subMap) {
            const subDep = subMap[s];

            if (subDep instanceof Object) {
              // Compare paths.
              const {required = [], optional = []} = subDep;
              const invalidPaths = [];

              // Required dependencies.
              for (const rp of required) {
                const fullPath = this.prefixPath(rp, k);

                if (stringPath === fullPath) {
                  invalidPaths.push(this.prefixPath(s, k));
                }
              }

              // Optional dependencies.
              for (const op of required) {
                const fullPath = this.prefixPath(op, k);

                if (stringPath === fullPath) {
                  const optionalPath = this.prefixPath(s, k);

                  if (invalidPaths.indexOf(optionalPath) === -1) {
                    invalidPaths.push(optionalPath);
                  }
                }
              }

              // Invalidate.
              invalidPaths.forEach(::this.invalidatePath);
            }
          }
        }
      }
    }
  }

  getPathValue(path) {
    const pathParts = Incarnate.getPathParts(path, this.pathDelimiter);

    let value,
      currentValue = this.hashMatrix,
      finished = true;

    for (const part of pathParts) {
      // Don't fail, just return `undefined`.
      try {
        currentValue = currentValue[part];
      } catch (error) {
        finished = false;
        break;
      }
    }

    // TRICKY: Don't select the current value if the full path wasn't processed.
    if (finished) {
      value = currentValue;
    }

    return value;
  }

  getPath(path) {
    if (!this.updateDependency(path, this.map)) {
      const error = new Error(Incarnate.ERRORS.UNRESOLVED_PATH);

      error.path = path;

      throw error;
    }

    return this.getPathValue(path);
  }

  updateHashMatrix(path, value, unset) {
    if (!unset || this.pathIsSet(path)) {
      const newHashMatrix = {
        ...this.hashMatrix
      };
      const pathParts = Incarnate.getPathParts(path, this.pathDelimiter);
      const lastIndex = pathParts.length - 1;
      const lastPart = pathParts[lastIndex];

      let currentValue = newHashMatrix;

      for (let i = 0; i < lastIndex; i++) {
        const part = pathParts[i];
        const nextPart = pathParts[i + 1];

        // TRICKY: Build out the tree is it's not there.
        if (!currentValue.hasOwnProperty(part)) {
          currentValue[part] = Incarnate.keyIsNumeric(nextPart) ? [] : {};
        } else if (currentValue[part] instanceof Array) {
          currentValue[part] = [
            ...currentValue[part]
          ];
        } else if (currentValue[part] instanceof Object) {
          currentValue[part] = {
            ...currentValue[part]
          };
        }

        currentValue = currentValue[part];
      }

      if (unset) {
        delete currentValue[lastPart];
      } else {
        currentValue[lastPart] = value;
      }

      this.hashMatrix = newHashMatrix;
    }
  }

  setPath(path, value) {
    this.updateHashMatrix(path, value);
    this.dispatchChanges(path, value);
  }
}
