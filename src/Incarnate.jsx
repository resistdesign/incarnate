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

        // TODO: IMPORTANT: Shared dependencies need to invalidate dependents from the sub-map.
        acc[key] = {
          factory: () => this.resolvePath(fullPathArray)
        };

        return acc;
      }, {})
    };
  }

  cacheDependencyDeclarationsByPath(path) {
    const pathArray = this.getPathArray(path);

    let currentPathArray = [],
      currentMap = this.map;

    for (let i = 0; i < pathArray.length; i++) {
      const name = pathArray[i];
      const declaration = currentMap[name];
      const currentPathString = this.getPathString(currentPathArray);

      currentPathArray = [
        ...currentPathArray,
        name
      ];

      // TRICKY: Cache anything, even `undefined` to denote that the path has been processed.
      this._declarationCache[currentPathString] = declaration;

      if (declaration instanceof Object) {
        const {subMap, shared} = declaration;

        if (subMap instanceof Object) {
          const subMapWithSharedDependencies = this.getSubMapWithSharedDependencies(subMap, shared, currentPathArray);

          // Replace the cached value with a sub-map with shared dependencies mapped.
          this._declarationCache[currentPathString] = {
            ...declaration,
            subMap: subMapWithSharedDependencies
          };

          this.cacheDependencyMap(subMapWithSharedDependencies, currentPathArray);
        }
      } else {
        break;
      }
    }
  }

  getSubPathInfo(path) {
    const pathArray = this.getPathArray(path);
    const newPathArray = [...pathArray];
    const name = [newPathArray.pop()];

    return {
      name,
      subPath: newPathArray
    };
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
    // TODO: Implement.
  }

  createListener(path) {
    // TODO: Implement.
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
          return dependencyDeclaration;
        } else if (factory instanceof Function) {
          const args = [
            // required
            ...Promise.all(required.map((depPathString) => {
              const depPathArray = this.getPathArray(depPathString);
              const fullPathArray = [
                ...parentPath,
                depPathArray
              ];

              return this.resolvePath(fullPathArray);
            })),
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
