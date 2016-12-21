async function resolveFactory (map, context, args, factory, pathDelimiter) {
  let instance;

  if (args instanceof Array && factory instanceof Function) {
    const resolvedArgs = [];

    for (let i = 0; i < args.length; i++) {
      const argItem = args[i];

      if (typeof argItem === 'string') {
        resolvedArgs.push(incarnate(argItem, map, context, pathDelimiter));
      } else if (argItem instanceof Function) {
        resolvedArgs.push(argItem(context));
      }
    }

    instance = factory.apply(
      null,
      await Promise.all(resolvedArgs)
    );
  }

  return instance;
}

async function incarnate (path, map, context, pathDelimiter = '.') {
  const delimiter = typeof pathDelimiter === 'string' ? pathDelimiter : '.';

  let instance;

  if (typeof path === 'string' && map instanceof Object) {
    const pathParts = path.split(delimiter);
    // TRICKY: Use `shift` to remove the current path part.
    const subMapResolver = map[pathParts.shift()];
    const def = map[path];

    if (
      pathParts.length &&
      pathParts.indexOf('') === -1 &&
      subMapResolver instanceof Function
    ) {
      if (subMapResolver instanceof Function) {
        const subPath = pathParts.join(delimiter);
        const subMap = await subMapResolver(context, subPath);

        instance = incarnate(
          subPath,
          subMap,
          context,
          pathDelimiter
        );
      }
    } else if (def instanceof Object) {
      const args = def.args;
      const factory = def.factory;

      instance = resolveFactory(map, context, args, factory, pathDelimiter);
    }
  }

  return instance;
}

export default incarnate;

// TODO: Lifecycle.
// TODO: Caching.
// TODO: Documentation.
// TODO: Comprehensive Examples.
