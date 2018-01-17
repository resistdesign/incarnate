import HashMatrix from './HashMatrix';

export default class Incarnate {
  static DEFAULT_INSTANCE_NAME = 'INCARNATE';
  static DEFAULT_PATH_DELIMITER = '.';
  static WARNINGS = {
    INVALID_DEPENDENCY_DECLARATION_PROPERTY_NAME: 'INVALID_DEPENDENCY_DECLARATION_PROPERTY_NAME'
  };
  static ERRORS = {
    INVALID_PATH_DELIMITER: 'INVALID_PATH_DELIMITER',
    INVALID_MAP: 'INVALID_MAP',
    INVALID_PATH: 'INVALID_PATH',
    INVALID_SUB_MAP: 'INVALID_SUB_MAP'
  };

  static validatePath(path) {
    if (!(path instanceof Array) || path.length < 1) {
      throw {
        message: Incarnate.ERRORS.INVALID_PATH,
        path
      };
    }
  }

  instanceName;
  pathDelimiter;
  map = {};
  hashMatrix;
  subInstanceCache = {};

  constructor({
                instanceName = Incarnate.DEFAULT_INSTANCE_NAME,
                pathDelimiter = Incarnate.DEFAULT_PATH_DELIMITER,
                map = {},
                hashMatrix
              }) {
    this.instanceName = instanceName;
    this.pathDelimiter = pathDelimiter;
    this.map = map;

    if (typeof pathDelimiter !== 'string') {
      throw new Error(Incarnate.ERRORS.INVALID_PATH_DELIMITER);
    }

    if (!(map instanceof Object)) {
      throw new Error(Incarnate.ERRORS.INVALID_MAP);
    }

    this.hashMatrix = hashMatrix || new HashMatrix({pathDelimiter, onPathChange: this.onPathChange});
  }

  onPathChange = (path) => {
  };

  checkDependencyDeclaration(name, dependencyDeclaration = {}) {
    const propertyNames = [
      'subMap',
      'shared',
      'required',
      'optional',
      'getters',
      'setters',
      'invalidators',
      'listeners',
      'factory'
    ];
    const depDecPropertyNames = Object.keys(dependencyDeclaration);

    depDecPropertyNames.forEach(ddpn => {
      if (propertyNames.indexOf(ddpn) === -1) {
        console.warn({
          message: Incarnate.WARNINGS.INVALID_DEPENDENCY_DECLARATION_PROPERTY_NAME,
          path: this.getStringPath([
            this.instanceName,
            name
          ])
        });
      }
    });
  }

  getPathParts(stringPath) {
    return String(stringPath).split(this.pathDelimiter);
  }

  getStringPath(path) {
    Incarnate.validatePath(path);

    return path.join(this.pathDelimiter);
  }

  getPathInfo(path) {
    Incarnate.validatePath(path);

    const newPath = [...path];
    const name = newPath.shift();
    const subPath = newPath;

    return {
      name,
      subPath
    };
  }

  async getSubInstance(name) {
    if (!(this.subInstanceCache[name] instanceof Incarnate)) {
      const path = [name];
      const subMap = await this.resolvePath(path);
      const subInstanceName = this.getStringPath([this.instanceName, name]);

      if (!(subMap instanceof Object)) {
        throw {
          message: Incarnate.ERRORS.INVALID_SUB_MAP,
          path
        };
      }

      this.subInstanceCache[name] = new Incarnate({
        instanceName: subInstanceName,
        pathDelimiter: this.pathDelimiter,
        map: subMap,
        hashMatrix: {
          getPath: this.createGetter(path),
          setPath: this.createSetter(path)
        }
      });
    }

    return this.subInstanceCache[name];
  }

  getDependencyDeclaration(name) {
    const depDec = this.map[name];

    this.checkDependencyDeclaration(name, depDec);

    return depDec;
  }

  createGetter(path) {
    // TODO: Implement.
  }

  createSetter(path) {
    // TODO: Implement.
  }

  createInvalidator(path) {
    // TODO: Implement.
  }

  createListener(path) {
    Incarnate.validatePath(path);

    return (handler) => this.listen(path, handler);
  }

  listen(path, handler) {
    // TODO: Implement.
    Incarnate.validatePath(path);
  }

  async resolvePath(path) {
    Incarnate.validatePath(path);

    // TODO: Check if `path` is set on HashMatrix.

    const {name, subPath} = this.getPathInfo(path);

    if (subPath.length) {
      const subInstance = await this.getSubInstance(name);

      return await subInstance.resolvePath([name]);
    } else {
      const depDec = this.map[name];
      const {
        subMap = false,
        shared = {},
        required = [],
        optional = [],
        getters = [],
        setters = [],
        invalidators = [],
        listeners = [],
        factory
      } = depDec;
      const resolvedDependencies = [
        ...await Promise.all(required.map((depPath) => {
          return this.resolvePath(this.getPathParts(depPath));
        })),
        ...await Promise.all(optional.map((depPath) => {
          return async () => {
            try {
              return await this.resolvePath(this.getPathParts(depPath));
            } catch (error) {
              // Ignore.
            }
          };
        })),
        ...getters.map((getterPath) => this.createGetter(this.getPathParts(getterPath))),
        ...setters.map((setterPath) => this.createSetter(this.getPathParts(setterPath))),
        ...invalidators.map((invalidatorPath) => this.createInvalidator(this.getPathParts(invalidatorPath))),
        ...listeners.map((listenerPath) => this.createListener(this.getPathParts(listenerPath)))
      ];

      this.checkDependencyDeclaration(name, depDec);

      // TODO: Submaps, call factory, shared, etc...

      // TODO: Set resolved value on HashMatrix unless it is a sub-map.
    }
  }

  getPath(path) {
    return this.hashMatrix.getPath(path);
  }

  setPath(path, value) {
    // TODO: Optimize changes. Only set values if they are not `===` to the existing value.
    return this.hashMatrix.setPath(path, value);
  }
}
