// TODO: Lifecycle.
// TODO: Documentation.
// TODO: Comprehensive Examples.

export default class Incarnate {
  map;
  context;
  pathDelimiter;
  cacheMap;

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
    this.cacheMap = cacheMap;
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

          if (this.cacheMap instanceof Object) {
            // TRICKY: Get the existing `subCache` or a new one.
            subCache = this.cacheMap[currentPath] instanceof Object ?
              this.cacheMap[currentPath] :
              {};
            this.cacheMap[currentPath] = subCache;
          }

          const subIncarnate = new Incarnate({
            map: subMap,
            context: this.context,
            pathDelimiter: this.pathDelimiter,
            cacheMap: subCache
          });

          instance = subIncarnate.resolvePath(subPath);
        }
      } else {
        instance = this.resolveDependencies(path, dependencyDefinition);
      }
    }

    return instance;
  }
}
