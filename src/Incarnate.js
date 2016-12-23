// TODO: Lifecycle.
// TODO: Documentation.
// TODO: Comprehensive Examples.

export default class Incarnate {
  map;
  context;
  pathDelimiter;
  cacheMap;

  _nestedMap = {};

  constructor ({
    map,
    context,
    pathDelimiter,
    cacheMap
  }) {
    if (map instanceof Object) {
      this.map = map;
    } else {
      throw new Error('A normalized dependency map is required.');
    }

    this.context = context instanceof Object ? context : {};
    this.pathDelimiter = typeof pathDelimiter === 'string' ? pathDelimiter : '.';
    this.cacheMap = cacheMap instanceof Object ? cacheMap : undefined;
  }

  invalidateCachedDependencies (dependencies) {
    if (
      this.cacheMap instanceof Object &&
      this.map instanceof Object &&
      dependencies instanceof Array &&
      dependencies.length
    ) {
      const invalidRelatedDepPaths = [];

      for (let i = 0; i < dependencies.length; i++) {
        const invalidDepPath = dependencies[i];

        if (typeof invalidDepPath === 'string') {
          const invalidDepPathParts = invalidDepPath.split(this.pathDelimiter);
          // TRICKY: Remove the top path from the path parts.
          const currentPath = invalidDepPathParts.shift();
          const depDef = this.map[invalidDepPath];
          const subIncarnate = this._nestedMap[currentPath];

          if (depDef instanceof Function && subIncarnate instanceof Incarnate) {
            subIncarnate.invalidateCachedDependencies([invalidDepPathParts.join(this.pathDelimiter)]);
          } else if (depDef instanceof Object) {
            const notify = this.cacheMap.hasOwnProperty(invalidDepPath);

            delete this.cacheMap[invalidDepPath];

            if (notify) {
              // TODO: Notify handlers.
            }
          }

          for (const k in this.map) {
            if (this.map.hasOwnProperty(k)) {
              const relatedDepDef = this.map[k];

              if (
                invalidRelatedDepPaths.indexOf(k) === -1 &&
                relatedDepDef instanceof Object &&
                relatedDepDef.args instanceof Array &&
                relatedDepDef.args.indexOf(invalidDepPath) !== -1
              ) {
                invalidRelatedDepPaths.push(k);
              }
            }
          }
        }
      }

      this.invalidateCachedDependencies(invalidRelatedDepPaths);
    }
  }

  getResolvedArgs (args) {
    const resolvedArgs = [];

    if (args instanceof Array) {
      for (let i = 0; i < args.length; i++) {
        const argItem = args[i];

        if (typeof argItem === 'string') {
          resolvedArgs.push(this.resolvePath(argItem));
        } else if (argItem instanceof Function) {
          resolvedArgs.push(argItem(this.context));
        } else {
          resolvedArgs.push(argItem);
        }
      }
    }

    return resolvedArgs;
  }

  async resolveDependencies (path, dependencyDefinition) {
    let instance;

    if (dependencyDefinition instanceof Object) {
      const {
        args,
        factory,
        cache
      } = dependencyDefinition;

      if (factory instanceof Function) {
        const resolvedArgs = this.getResolvedArgs(args);

        if (
          cache !== false &&
          this.cacheMap instanceof Object &&
          typeof path === 'string'
        ) {
          const cachedValue = this.cacheMap[path];

          if (!this.cacheMap.hasOwnProperty(path)) {
            instance = await factory.apply(
              null,
              await Promise.all(resolvedArgs)
            );

            this.cacheMap[path] = instance;
          } else {
            instance = cachedValue;
          }
        } else {
          instance = factory.apply(
            null,
            await Promise.all(resolvedArgs)
          );
        }
      }
    }

    return instance;
  }

  async resolvePath (path) {
    let instance;

    if (typeof path === 'string' && this.map instanceof Object) {
      const pathParts = path.split(this.pathDelimiter);
      // TRICKY: Use `shift` to remove the current path part being processed.
      const currentPath = pathParts.shift();
      const subMapResolver = this.map[currentPath];
      const dependencyDefinition = this.map[path];

      if (pathParts.length && subMapResolver instanceof Function) {
        if (subMapResolver instanceof Function) {
          const subPath = pathParts.join(this.pathDelimiter);
          const subMap = await subMapResolver(this.context, subPath);

          let subCache;
          let subIncarnate;

          if (this.cacheMap instanceof Object) {
            // TRICKY: Get the potentially existing `subCache`.
            subCache = this.cacheMap[currentPath] instanceof Object ?
              this.cacheMap[currentPath] :
              {};
            this.cacheMap[currentPath] = subCache;
          }

          const subProps = {
            map: subMap,
            context: this.context,
            pathDelimiter: this.pathDelimiter,
            cacheMap: subCache
          };

          if (this._nestedMap[currentPath] instanceof Incarnate) {
            subIncarnate = this._nestedMap[currentPath];
            Object.assign(subIncarnate, subProps);
          } else {
            subIncarnate = new Incarnate(subProps);
          }

          this._nestedMap[currentPath] = subIncarnate;
          instance = subIncarnate.resolvePath(subPath);
        }
      } else {
        instance = this.resolveDependencies(path, dependencyDefinition);
      }
    }

    return instance;
  }

  destroy () {
    // TRICKY: Destroy nested instances.
    for (const k in this._nestedMap) {
      if (this._nestedMap.hasOwnProperty(k)) {
        const subIncarnate = this._nestedMap[k];

        if (subIncarnate instanceof Incarnate) {
          subIncarnate.destroy();
        }
      }
    }

    this._nestedMap = {};
  }
}
