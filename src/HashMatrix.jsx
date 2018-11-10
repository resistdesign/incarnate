import ConfigurableInstance from './ConfigurableInstance';

/**
 * An object used to invalidate a path.
 * */
const INVALID = {};

/**
 * Easily manage a data structure that can be dynamically built
 * from paths with out throwing errors for accessing undefined
 * portions of the structure.
 * */
export default class HashMatrix extends ConfigurableInstance {
  static DEFAULT_NAME = 'HashMatrix';
  static DEFAULT_PATH_DELIMITER = '.';
  static ERRORS = {
    INVALID_HASH_MATRIX: 'INVALID_HASH_MATRIX',
    INVALID_PATH_DELIMITER: 'INVALID_PATH_DELIMITER',
    INVALID_PATH_CHANGE_HANDLER: 'INVALID_PATH_CHANGE_HANDLER',
    PROTECTED_HASH_MATRIX: 'PROTECTED_HASH_MATRIX'
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

  _changeHandlerMap = {};

  /**
   * The name of this `HashMatrix`.
   * @type {string}
   * */
  name;

  /**
   * The target path for a proxied `HashMatrix`.
   * @type {Array|string}
   * */
  targetPath;

  /**
   * An automatically maintained structure that acts as the source of all values.
   * If set a to a `HashMatrix`, it will be proxied.
   * @type {Object.<*>|HashMatrix}
   * */
  hashMatrix;

  /**
   * The `string` used to delimit all paths.
   * @type {string}
   * */
  pathDelimiter;

  constructor(config = {}) {
    super(config);

    if (!this.hasOwnProperty('pathDelimiter')) {
      this.pathDelimiter = HashMatrix.DEFAULT_PATH_DELIMITER;
    }

    if (typeof this.pathDelimiter !== 'string') {
      throw {
        message: HashMatrix.ERRORS.INVALID_PATH_DELIMITER,
        data: this
      };
    }

    this._setDefaultName();
  }

  _setDefaultName() {
    if (!this.hasOwnProperty('name')) {
      if (typeof this.constructor.DEFAULT_NAME === 'string') {
        this.name = this.constructor.DEFAULT_NAME;
      } else {
        this.name = HashMatrix.DEFAULT_NAME;
      }
    }
  }

  getChangeHandlerList(path) {
    const pathString = this.getPathString(path);

    return this._changeHandlerMap[pathString] || [];
  }

  setChangeHandlerList(path, handlerList = []) {
    const pathString = this.getPathString(path);

    this._changeHandlerMap[pathString] = handlerList;
  }

  addChangeHandler(path = '', handler) {
    if (this.hashMatrix instanceof HashMatrix) {
      return this.hashMatrix.addChangeHandler(
        this.getPathArray(path, this.targetPath),
        handler
      );
    }

    if (handler instanceof Function) {
      const handlerList = this.getChangeHandlerList(path);

      if (handlerList.indexOf(handler) === -1) {
        handlerList.push(handler);

        this.setChangeHandlerList(path, handlerList);

        return () => this.removeChangeHandler(handler);
      }
    }
  }

  removeChangeHandler(path = '', handler) {
    if (this.hashMatrix instanceof HashMatrix) {
      return this.hashMatrix.removeChangeHandler(
        this.getPathArray(path, this.targetPath),
        handler
      );
    }

    const handlerList = this.getChangeHandlerList(path);

    if (handlerList.indexOf(handler) !== -1) {
      const newHandlerList = [];

      handlerList.forEach((h) => {
        if (h !== handler) {
          newHandlerList.push(h);
        }
      });

      this.setChangeHandlerList(path, newHandlerList);
    }
  }

  onChange(path, causePath) {
    const handlerList = this.getChangeHandlerList(path);

    handlerList.forEach((h) => h(path, causePath, this));
  }

  getBasePathArray(path = '') {
    return path instanceof Array ?
      [...path] :
      (path === '' ? [] : `${path}`.split(this.pathDelimiter));
  }

  getPathArray(path = '', prefixPath = '') {
    const prefixPathArray = this.getBasePathArray(prefixPath);
    const pathArray = this.getBasePathArray(path);

    return [
      ...prefixPathArray,
      ...pathArray
    ];
  }

  getPathString(path, prefixPath) {
    return this.getPathArray(path, prefixPath)
      .join(this.pathDelimiter);
  }

  dispatchChanges(path) {
    const pathArray = this.getPathArray(path);
    const pathString = this.getPathString(pathArray);

    // Notify lifecycle listeners of changes all the way up the path.

    if (pathArray.length) {
      const currentPath = [...pathArray];

      // TRICKY: Start with the deepest path and move up to the most shallow.
      while (currentPath.length) {
        this.onChange(
          // Path as a string.
          this.getPathString(currentPath),
          // The cause path.
          pathString
        );
        currentPath.pop();
      }
    }

    this.onChange('', pathString);
  }

  _getPathInternal(path) {
    if (this.hashMatrix instanceof HashMatrix) {
      return this.hashMatrix.getPath(
        this.getPathArray(path, this.targetPath)
      );
    }

    const pathArray = this.getPathArray(path);

    if (pathArray.length) {
      let value,
        currentValue = this.hashMatrix,
        finished = true;

      for (const part of pathArray) {
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
    } else {
      return this.hashMatrix;
    }
  }

  getPath(path) {
    return this._getPathInternal(path);
  }

  _setPathInternal(path, value) {
    if (this.hashMatrix instanceof HashMatrix) {
      return this.hashMatrix.setPath(
        this.getPathArray(path, this.targetPath),
        value
      );
    }

    const targetValue = value === INVALID ? undefined : value;
    const pathArray = this.getPathArray(path);

    // TRICKY: DO NOT set if the value is exactly equal.
    if (targetValue !== this._getPathInternal(path)) {
      const newHashMatrix = {
        ...this.hashMatrix
      };

      if (pathArray.length) {
        const lastIndex = pathArray.length - 1;
        const lastPart = pathArray[lastIndex];

        let currentValue = newHashMatrix;

        for (let i = 0; i < lastIndex; i++) {
          const part = pathArray[i];
          const nextPart = pathArray[i + 1];

          // TRICKY: Build out the tree is it's not there.
          if (typeof currentValue[part] === 'undefined') {
            currentValue[part] = HashMatrix.keyIsNumeric(nextPart) ? [] : {};
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

        currentValue[lastPart] = targetValue;

        this.hashMatrix = newHashMatrix;
      } else {
        this.hashMatrix = targetValue;
      }

      this.dispatchChanges(pathArray);
    } else if (value === INVALID) {
      this.dispatchChanges(pathArray);
    }
  }

  setPath(path, value) {
    return this._setPathInternal(path, value);
  }

  invalidatePath(path) {
    this.setPath(path, INVALID);
  }

  getValue() {
    return this.getPath([]);
  }

  setValue(value) {
    return this.setPath([], value);
  }

  invalidate() {
    this.setValue(INVALID);
  }
}
