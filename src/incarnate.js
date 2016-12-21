export default async function incarnate (path, map, context) {
  let instance;

  if (typeof path === 'string' && map instanceof Object) {
    const def = map[path];
    const args = def.args;
    const factory = def.factory;

    if (args instanceof Array && factory instanceof Function) {
      const resolvedArgs = [];

      for (let i = 0; i < args.length; i++) {
        const argItem = args[i];

        if (typeof argItem === 'string') {
          resolvedArgs.push(incarnate(argItem, map, context));
        } else if (argItem instanceof Function) {
          resolvedArgs.push(argItem(context));
        }
      }

      instance = factory.apply(
        null,
        await Promise.all(resolvedArgs)
      );
    }
  }

  return instance;
}
