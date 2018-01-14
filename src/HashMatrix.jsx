export default class HashMatrix {
  static DEFAULT_PATH_DELIMITER = '.';

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

  getPath(path) {
    let value;

    if (typeof path === 'string' || path instanceof Array) {
      const pathParts = path instanceof Array ? [...path] : path.split(this.pathDelimiter);

      let currentValue = this.hashMatrix,
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
    }

    return value;
  }

  pathIsSet(path) {
    const pathParts = HashMatrix.getPathParts(path, this.pathDelimiter);

    let isSet = true,
      currentValue = this.hashMatrix;

    for (const part of pathParts) {
      if (currentValue instanceof Array && HashMatrix.keyIsNumeric(part)) {
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

  setPath(path, value, unset) {
    // TODO: Compare before setting and don't set or dispatch change if the values match.
    if (!unset || this.pathIsSet(path)) {
      const newHashMatrix = {
        ...this.hashMatrix
      };
      const pathParts = HashMatrix.getPathParts(path, this.pathDelimiter);
      const lastIndex = pathParts.length - 1;
      const lastPart = pathParts[lastIndex];

      let currentValue = newHashMatrix;

      for (let i = 0; i < lastIndex; i++) {
        const part = pathParts[i];
        const nextPart = pathParts[i + 1];

        // TRICKY: Build out the tree if it's not there.
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

      if (unset) {
        delete currentValue[lastPart];
      } else {
        currentValue[lastPart] = value;
      }

      this.hashMatrix = newHashMatrix;
      // TODO: Dispatch changes!!!
    }
  }
}
