export default function incarnate (name, map, context) {
  let instance;

  if (typeof name === 'string' && map instanceof Object) {
    const def = map[name];
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

      instance = factory.apply(null, resolvedArgs);
    }
  }

  return instance;
}

/*** Async Solution Demo ***/

const items = [
  async () => {
    return await new Promise((res, rej) => {
      setTimeout(() => res(1), 10);
    });
  },
  () => 2,
  async () => {
    return await new Promise((res, rej) => {
      setTimeout(() => res(3), 800);
    });
  },
  async () => {
    return await new Promise((res, rej) => {
      setTimeout(() => res(4), 5000);
    });
  },
  async () => {
    return await new Promise((res, rej) => {
      setTimeout(() => res(5), 200);
    });
  },
  async () => {
    return await new Promise((res, rej) => {
      setTimeout(() => res(6), 1500);
    });
  },
  () => 7,
  async () => {
    return await new Promise((res, rej) => {
      setTimeout(() => res(8), 7000);
    });
  },
];

async function x (items = []) {
  const list = [];
  const promises = [];

  for (let i = 0; i < items.length; i++) {
    const f = items[i];
    const val = f();

    if (val instanceof Promise) {
      val.then(data => list[i] = data);
      promises.push(val);
    } else {
      list[i] = val;
    }
  }

  await Promise.all(promises);

  console.log(list);
}

x(items);
