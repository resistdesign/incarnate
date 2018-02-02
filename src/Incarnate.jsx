import InternalHashMatrix from './HashMatrix';

export const HashMatrix = InternalHashMatrix;

export default class Incarnate extends HashMatrix {
  static ERRORS = {
    INVALID_MAP: 'INVALID_MAP',
    INVALID_DECLARATION: 'INVALID_DECLARATION'
  };

  /**
   * A map of full dependency paths to dependency declarations.
   * @type {Object.<Object>}
   * */
  _declarationCache = {};

  /**
   * A map of full dependency paths to lists of full dependent paths.
   * @type {Object.<Array.<string>>}
   * */
  _dependentPathMap = {};

  /**
   * A map of full dependency paths to lists of change handler functions.
   * @type {Object.<Array.<Function>>}
   * */
  _listenerMap = {};

  map;

  constructor({map = {}, initialCache = {}, pathDelimiter}) {
    super({
      hashMatrix: initialCache,
      pathDelimiter
    });

    if (!(map instanceof Object)) {
      throw new Error(Incarnate.ERRORS.INVALID_MAP);
    }

    this.map = map;
    this.onPathChange = this.handlePathChange;
    this.cacheDependencyMap(this.map);
  }

  cacheDependencyMap(map = {}, pathPrefix) {
    for (const k in map) {
      const declaration = map[k];
      const pathPrefixArray = pathPrefix ? this.getPathArray(pathPrefix) : [];
      const fullPathString = this.getPathString([
        ...pathPrefixArray,
        k
      ]);

      this._declarationCache[fullPathString] = declaration;
    }
  }

  cacheDependent(dependencyPath, requiredByPath) {
    const dependencyPathString = this.getPathString(dependencyPath);
    const requiredByPathString = this.getPathString(requiredByPath);
    const dependentsArray = this._dependentPathMap[dependencyPathString] || [];

    if (dependentsArray.indexOf(requiredByPathString) === -1) {
      dependentsArray.push(requiredByPathString);
    }

    this._dependentPathMap[dependencyPathString] = dependentsArray;
  }

  getSubMapWithSharedDependencies(subMap = {}, shared = {}, pathPrefix = []) {
    const pathPrefixArray = this.getPathArray(pathPrefix);

    return {
      ...subMap,
      ...Object.keys(shared).reduce((acc, key) => {
        const targetPathString = shared[key];
        const targetPathArray = this.getPathArray(targetPathString);
        const fullPathArray = [
          ...pathPrefixArray,
          ...targetPathArray
        ];
        const fullMappedPathArray = [
          ...pathPrefixArray,
          key
        ];

        // Cache shared dependency dependents.
        // IMPORTANT: Shared dependencies need to invalidate dependents from the sub-map.
        this.cacheDependent(fullPathArray, fullMappedPathArray);

        acc[key] = {
          factory: () => this.resolvePath(fullPathArray),
          // TRICKY: Copy changes to a source path in the cache (and trigger events) when the target path is set.
          unlisten: this.listen(
            fullMappedPathArray,
            (p, v, specificPath) => {
              const specificPathString = this.getPathString(specificPath);
              const fullMappedPathString = this.getPathString(fullMappedPathArray);
              const fullMappedPathArrayAsPrefix = `${fullMappedPathString}${this.pathDelimiter}`;

              if (specificPathString === fullMappedPathString) {
                // Update the path directly.
                return this.setPath(fullPathArray, this.getPath(fullMappedPathArray));
              } else if (specificPathString.indexOf(fullMappedPathArrayAsPrefix) === 0) {
                // Update the specific sub-path.

                // TRICKY: The sub path from the changing, mapped path **must**
                // be transposed to the source path being updated.
                const specificSubPathString = specificPathString.substring(
                  fullMappedPathArrayAsPrefix.length,
                  specificPathString.length
                );
                const specificSubPathArray = this.getPathArray(specificSubPathString);
                const pathToUpdateArray = [
                  ...fullPathArray,
                  ...specificSubPathArray
                ];

                return this.setPath(pathToUpdateArray, this.getPath(specificPath));
              }
            }
          )
        };

        return acc;
      }, {})
    };
  }

  cacheDependencyDeclarationsByPath(path) {
    const pathArray = this.getPathArray(path);

    let currentPathArray = [],
      currentPathString,
      currentMap = this.map;

    for (let i = 0; i < pathArray.length; i++) {
      const name = pathArray[i];
      const declaration = currentMap[name];

      currentPathArray = [
        ...currentPathArray,
        name
      ];
      currentPathString = this.getPathString(currentPathArray);

      // TRICKY: IMPORTANT: Cache anything, even `undefined` to denote that the path has been processed.
      this._declarationCache[currentPathString] = declaration;

      if (declaration instanceof Object) {
        const {
          subMap,
          shared,
          required = [],
          optional = []
        } = declaration;

        if (subMap instanceof Object) {
          // Sub-Map
          const subMapWithSharedDependencies = this.getSubMapWithSharedDependencies(subMap, shared, currentPathArray);

          // Replace the cached value with a sub-map with shared dependencies mapped.
          this._declarationCache[currentPathString] = {
            ...declaration,
            subMap: subMapWithSharedDependencies
          };

          this.cacheDependencyMap(subMapWithSharedDependencies, currentPathArray);
        } else {
          // Factory
          // Cache dependents.
          required.forEach((dependencyPathString) => this.cacheDependent(dependencyPathString, currentPathArray));
          optional.forEach((dependencyPathString) => this.cacheDependent(dependencyPathString, currentPathArray));
        }
      } else {
        break;
      }
    }
  }

  getDependencyDeclaration(path) {
    const pathString = this.getPathString(path);

    if (!this._declarationCache.hasOwnProperty(pathString)) {
      this.cacheDependencyDeclarationsByPath(path);
    }

    return this._declarationCache[pathString];
  }

  createGetter(path) {
    return (subPath = []) => this.getPath([
      ...this.getPathArray(path),
      ...this.getPathArray(subPath)
    ]);
  }

  createSetter(path) {
    return (value, subPath = []) => this.setPath([
      ...this.getPathArray(path),
      ...this.getPathArray(subPath)
    ], value);
  }

  createInvalidator(path) {
    return (subPath = []) => this.invalidate([
      ...this.getPathArray(path),
      ...this.getPathArray(subPath)
    ]);
  }

  createListener(path) {
    return (handler, subPath = []) => this.listen([
      ...this.getPathArray(path),
      ...this.getPathArray(subPath)
    ], handler);
  }

  processHandlers(path) {
    const pathArray = this.getPathArray(path);
    const pathString = this.getPathString(path);
    const listenerList = this._listenerMap[pathString] || [];

    // Call registered handlers.
    for (let i = 0; i < listenerList.length; i++) {
      const handler = listenerList[i];

      if (handler instanceof Function) {
        handler(pathString, this.getPath(pathArray), pathArray);
      }
    }

    // Invalidate dependents.
    this.invalidateDependents(path);
  }

  handlePathChange(path, pathDelta) {
    const pathArray = this.getPathArray(path);

    // Process handlers for each path change.
    this.processHandlers(pathArray);

    // TRICKY: Process handlers for parent paths, BUT ONLY for **direct** path changes to avoid noise.
    if (pathDelta === 0) {
      const changedPathString = this.getPathString(pathArray);

      for (const listenedOnPathString in this._listenerMap) {
        if (this._listenerMap.hasOwnProperty(listenedOnPathString)) {
          const listenedOnPathArray = this.getPathArray(listenedOnPathString);
          const listenedOnPathAsPrefix = `${listenedOnPathString}${this.pathDelimiter}`;

          if (changedPathString.indexOf(listenedOnPathAsPrefix) === 0) {
            // The listened path a parent of the changed path.
            this.processHandlers(listenedOnPathArray);
          }
        }
      }
    }
  }

  unlisten(path, handler) {
    const pathString = this.getPathString(path);
    const listenerList = this._listenerMap[pathString] || [];
    const newListenerList = [];

    for (let i = 0; i < listenerList.length; i++) {
      const currentHandler = listenerList[i];

      if (currentHandler !== handler) {
        newListenerList.push(currentHandler);
      }
    }

    this._listenerMap[pathString] = newListenerList;

    return this.unlisten(path, handler);
  }

  listen(path, handler) {
    const pathString = this.getPathString(path);
    const listenerList = this._listenerMap[pathString] || [];

    if (listenerList.indexOf(handler) === -1) {
      listenerList.push(handler);
    }

    this._listenerMap[pathString] = listenerList;

    return this.unlisten(path, handler);
  }

  invalidateDependents(path) {
    const pathString = this.getPathString(path);
    const dependentList = this._dependentPathMap[pathString] || [];

    // Invalidate each path.
    // TRICKY: DO NOT invalidate `path` directly.
    dependentList.forEach((depPathString) => this.invalidate(depPathString));
  }

  invalidate(path) {
    const pathArray = this.getPathArray(path);

    // Unset path.
    this.unsetPath(path);

    // Invalidate dependents.
    this.invalidateDependents(pathArray);
  }

  async resolvePath(path) {
    if (!this.pathIsSet(path)) {
      const pathArray = this.getPathArray(path);
      const {parentPath} = this.getPathInfo(pathArray);
      const dependencyDeclaration = this.getDependencyDeclaration(path);

      if (dependencyDeclaration instanceof Object) {
        // Process the dependency if it is declared.
        const {
          subMap,
          required = [],
          optional = [],
          getters = [],
          setters = [],
          invalidators = [],
          listeners = [],
          factory
        } = dependencyDeclaration;

        if (subMap instanceof Object) {
          // Just return the cached value for sub-mapped paths.
          return this.getPath(path);
        } else if (factory instanceof Function) {
          const args = [
            // required
            ...(await Promise.all(required.map((depPathString) => {
              const depPathArray = this.getPathArray(depPathString);
              const fullPathArray = [
                ...parentPath,
                depPathArray
              ];

              return this.resolvePath(fullPathArray);
            }))),
            // optional
            // TRICKY: Process async w/o await.
            ...optional.map((depPathString) => {
              const depPathArray = this.getPathArray(depPathString);
              const fullPathArray = [
                ...parentPath,
                depPathArray
              ];

              // TRICKY: Don't wait for optional values to resolve.
              this.resolvePath(fullPathArray);

              // Just return whatever value is stored.
              return this.getPath(fullPathArray);
            }),
            // getters
            ...getters.map((depPathString) => {
              const depPathArray = this.getPathArray(depPathString);
              const fullPathArray = [
                ...parentPath,
                depPathArray
              ];

              return this.createGetter(fullPathArray);
            }),
            // setters
            ...setters.map((depPathString) => {
              const depPathArray = this.getPathArray(depPathString);
              const fullPathArray = [
                ...parentPath,
                depPathArray
              ];

              return this.createSetter(fullPathArray);
            }),
            // invalidators
            ...invalidators.map((depPathString) => {
              const depPathArray = this.getPathArray(depPathString);
              const fullPathArray = [
                ...parentPath,
                depPathArray
              ];

              return this.createInvalidator(fullPathArray);
            }),
            // listeners
            ...listeners.map((depPathString) => {
              const depPathArray = this.getPathArray(depPathString);
              const fullPathArray = [
                ...parentPath,
                depPathArray
              ];

              return this.createListener(fullPathArray);
            })
          ];
          const value = factory(...args);

          if (value instanceof Promise) {
            this.setPath(path, await value);
          } else {
            this.setPath(path, value);
          }
        } else {
          throw new Error(Incarnate.ERRORS.INVALID_DECLARATION);
        }
      }
    }

    return this.getPath(path);
  }
}
