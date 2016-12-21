async function resolveDependency ({
  map,
  context,
  dependencyDefinition,
  pathDelimiter,
  cacheMap,
  path,
  incarnate
}) {
  let instance;

  if (dependencyDefinition instanceof Object) {
    const {
      args,
      factory,
      refreshCache
    } = dependencyDefinition;

    if (args instanceof Array && factory instanceof Function) {
      const resolvedArgs = [];

      for (let i = 0; i < args.length; i++) {
        const argItem = args[i];

        if (typeof argItem === 'string') {
          resolvedArgs.push(
            incarnate(
              argItem,
              map,
              context,
              pathDelimiter,
              cacheMap
            )
          );
        } else if (argItem instanceof Function) {
          resolvedArgs.push(argItem(context));
        }
      }

      if (
        cacheMap instanceof Object &&
        refreshCache instanceof Function &&
        typeof path === 'string'
      ) {
        const cachedValue = cacheMap[path];

        if (!cacheMap.hasOwnProperty(path) || await refreshCache(context, cachedValue, path)) {
          instance = await factory.apply(
            null,
            await Promise.all(resolvedArgs)
          );

          cacheMap[path] = instance;
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

async function incarnate (path, map, context, pathDelimiter = '.', cacheMap) {
  const delimiter = typeof pathDelimiter === 'string' ? pathDelimiter : '.';

  let instance;

  if (typeof path === 'string' && map instanceof Object) {
    const pathParts = path.split(delimiter);
    // TRICKY: Use `shift` to remove the current path part being processed.
    const currentPath = pathParts.shift();
    const subMapResolver = map[currentPath];
    const dependencyDefinition = map[path];

    if (pathParts.length && subMapResolver instanceof Function) {
      if (subMapResolver instanceof Function) {
        const subPath = pathParts.join(delimiter);
        const subMap = await subMapResolver(context, subPath);

        let subCache;

        if (cacheMap instanceof Object) {
          subCache = {};
          cacheMap[currentPath] = subCache;
        }

        instance = incarnate(
          subPath,
          subMap,
          context,
          pathDelimiter,
          subCache
        );
      }
    } else {
      instance = resolveDependency({
        map,
        context,
        dependencyDefinition,
        pathDelimiter,
        cacheMap,
        path,
        incarnate
      });
    }
  }

  return instance;
}

export default incarnate;

// TODO: Lifecycle.
// TODO: Documentation.
// TODO: Comprehensive Examples.
