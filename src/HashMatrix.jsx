export default class HashMatrix {
  static DEFAULT_PATH_DELIMITER = '.';
  static ERRORS = {
    INVALID_PATH: 'INVALID_PATH'
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

  static validatePath(path) {
    if (!(path instanceof Array) || !path.length || path[0] === '') {
      throw new Error(HashMatrix.ERRORS.INVALID_PATH);
    }
  }

  pathDelimiter;
  hashMatrix;
  onPathChange;

  constructor({
                hashMatrix = {},
                pathDelimiter = HashMatrix.DEFAULT_PATH_DELIMITER,
                onPathChange
              }) {
    this.hashMatrix = hashMatrix;
    this.pathDelimiter = pathDelimiter;
    this.onPathChange = onPathChange;
  }

  getPathArray(path = '') {
    const pathArray = path instanceof Array ?
      path :
      `${path}`.split(this.pathDelimiter);

    HashMatrix.validatePath(path);

    return pathArray;
  }

  getPathString(path) {
    return this.getPathArray(path).join(this.pathDelimiter);
  }

  getPathInfo(path) {
    const pathArray = this.getPathArray(path);
    const name = pathArray.pop();

    return {
      parentPath: pathArray,
      name
    };
  }

  pathIsSet(path) {
    const pathArray = this.getPathArray(path);
    const {parentPath, name} = this.getPathInfo(pathArray) || {};

    if (parentPath instanceof Array && parentPath.length) {
      const parentObject = this.getPath(parentPath);

      if (parentObject instanceof Object && parentObject.hasOwnProperty(name)) {
        return true;
      }
    } else if (typeof name === 'string' && this.hashMatrix.hasOwnProperty(name)) {
      return true;
    }

    return false;
  }

  getPath(path) {
    const pathArray = this.getPathArray(path);

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
  }

  setPath(path, value) {
    // TODO: DO NOT set if the value is exactly equal UNLESS the path WAS NOT set.
    const newHashMatrix = {
      ...this.hashMatrix
    };
    const pathArray = this.getPathArray(path);
    const lastIndex = pathArray.length - 1;
    const lastPart = pathArray[lastIndex];

    let currentValue = newHashMatrix;

    for (let i = 0; i < lastIndex; i++) {
      const part = pathArray[i];
      const nextPart = pathArray[i + 1];

      // TRICKY: Build out the tree is it's not there.
      if (!currentValue.hasOwnProperty(part)) {
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

    currentValue[lastPart] = value;

    this.hashMatrix = newHashMatrix;

    // Notify lifecycle listeners of changes all the way up the path.
    if (this.onPathChange instanceof Function && pathArray.length) {
      const currentPath = [...pathArray];

      // TRICKY: Start with the deepest path and move up to the most shallow.
      while (currentPath.length) {
        this.onPathChange(this.getPathString(currentPath));
        currentPath.pop();
      }
    }
  }

  unsetPath(path) {
    // TODO: DO NOT unset if the path WAS NOT set.
    const pathArray = this.getPathArray(path);
    const {parentPath, name} = this.getPathInfo(pathArray) || {};

    if (parentPath instanceof Array && parentPath.length) {
      const parentObject = this.getPath(parentPath);

      if (parentObject instanceof Object && parentObject.hasOwnProperty(name)) {
        const newParentObject = {
          ...parentObject
        };

        delete newParentObject[name];

        this.setPath(parentPath, newParentObject);
      }
    } else if (typeof name === 'string' && this.hashMatrix.hasOwnProperty(name)) {
      const newHashMatrix = {
        ...this.hashMatrix
      };

      delete newHashMatrix[name];

      this.hashMatrix = newHashMatrix;

      if (this.onPathChange instanceof Function) {
        this.onPathChange(name);
      }
    }
  }
}
