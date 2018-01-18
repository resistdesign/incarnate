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

  getPathInfo(path) {
    if (typeof path === 'string' || path instanceof Array) {
      const pathParts = path instanceof Array ? [...path] : path.split(this.pathDelimiter);
      const name = pathParts.pop();

      return {
        parentPath: pathParts,
        name
      };
    }
  }

  pathIsSet(path) {
    if (typeof path === 'string' || path instanceof Array) {
      const pathParts = path instanceof Array ? [...path] : path.split(this.pathDelimiter);
      const {parentPath, name} = this.getPathInfo(pathParts) || {};

      if (parentPath instanceof Array && parentPath.length) {
        const parentObject = this.getPath(parentPath);

        if (parentObject instanceof Object && parentObject.hasOwnProperty(name)) {
          return true;
        }
      } else if (typeof name === 'string' && this.hashMatrix.hasOwnProperty(name)) {
        return true;
      }
    }

    return false;
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

  setPath(path, value) {
    if (typeof path === 'string' || path instanceof Array) {
      const newHashMatrix = {
        ...this.hashMatrix
      };
      const pathParts = path instanceof Array ? [...path] : path.split(this.pathDelimiter);
      const lastIndex = pathParts.length - 1;
      const lastPart = pathParts[lastIndex];

      let currentValue = newHashMatrix;

      for (let i = 0; i < lastIndex; i++) {
        const part = pathParts[i];
        const nextPart = pathParts[i + 1];

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
      if (this.onPathChange instanceof Function && pathParts.length) {
        const currentPath = [...pathParts];

        // TRICKY: Start with the deepest path and move up to the most shallow.
        while (currentPath.length) {
          this.onPathChange(currentPath.join(this.pathDelimiter));
          currentPath.pop();
        }
      }
    }
  }

  unsetPath(path) {
    if (typeof path === 'string' || path instanceof Array) {
      const pathParts = path instanceof Array ? [...path] : path.split(this.pathDelimiter);
      const {parentPath, name} = this.getPathInfo(pathParts) || {};

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
}
