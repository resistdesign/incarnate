import EventEmitter from 'event-emitter';

export default class Incarnate {
  name;
  map;
  context;
  pathDelimiter;
  cacheMap;

  _eventEmitter = new EventEmitter();
  _nestedMap = {};
  _nestedInvalidationCancellers = {};

  constructor({
                name,
                map,
                context,
                pathDelimiter,
                cacheMap
              }) {
    this.name = name;

    if (map instanceof Object) {
      this.map = map;
    } else {
      throw new Error('A normalized dependency map is required.');
    }

    this.context = context instanceof Object ? context : {};
    this.pathDelimiter = typeof pathDelimiter === 'string' ? pathDelimiter : '.';
    this.cacheMap = cacheMap instanceof Object ? cacheMap : undefined;
  }

  _addNestedInvalidationCanceller(fullPath, canceller) {
    if (typeof fullPath === 'string' && canceller instanceof Function) {
      const cancellerList = this._nestedInvalidationCancellers[fullPath] instanceof Array ?
        this._nestedInvalidationCancellers[fullPath] :
        [];

      if (cancellerList.indexOf(canceller) === -1) {
        cancellerList.push(canceller);
      }

      this._nestedInvalidationCancellers[fullPath] = cancellerList;
    }
  }

  _emitInvalidationEvent(path) {
    if (typeof path === 'string') {
      this._eventEmitter.emit(path, path);
    }
  }

  invalidate(dependencies) {
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
          const depDef = this.map[currentPath];
          const subIncarnate = this._nestedMap[currentPath];

          if (depDef instanceof Function && subIncarnate instanceof Incarnate) {
            subIncarnate.invalidate([invalidDepPathParts.join(this.pathDelimiter)]);
          } else if (depDef instanceof Object && invalidDepPathParts.length === 0) {
            if (this.cacheMap.hasOwnProperty(currentPath)) {
              delete this.cacheMap[currentPath];
              // IMPORTANT: Notify invalidation handler.
              this._emitInvalidationEvent(currentPath);
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

      this.invalidate(invalidRelatedDepPaths);
    }
  }

  getResolvedArgItem(argItem, context) {
    if (typeof argItem === 'string') {
      return this.resolvePath(argItem, context);
    } else if (argItem instanceof Function) {
      return argItem(
        {
          ...this.context,
          // Override instance level context with parameter level context.
          ...context
        },
        this
      );
    } else {
      return argItem;
    }
  }

  getResolvedArgs(args, context) {
    const resolvedArgs = [];

    if (args instanceof Array) {
      for (let i = 0; i < args.length; i++) {
        const argItem = args[i];

        resolvedArgs.push(this.getResolvedArgItem(argItem, context));
      }
    }

    return resolvedArgs;
  }

  getArgDelegates(args, context) {
    const delegates = [];

    if (args instanceof Array) {
      for (const arg of args) {
        delegates.push(async () => {
          return await this.getResolvedArgItem(arg, context);
        });
      }
    }

    return delegates;
  }

  async resolveDependencies(path, dependencyDefinition, context, subMap) {
    let instance;

    if (typeof dependencyDefinition === 'string') {
      // This path is an alias.
      instance = this.resolvePath(dependencyDefinition, context);
    } else if (dependencyDefinition instanceof Object) {
      const {
        args,
        factory,
        cache
      } = dependencyDefinition;

      if (factory instanceof Function) {
        if (
          !subMap &&
          !context &&
          cache !== false &&
          this.cacheMap instanceof Object &&
          typeof path === 'string'
        ) {
          const cachedValue = this.cacheMap[path];

          if (!this.cacheMap.hasOwnProperty(path)) {
            const resolvedArgs = subMap ?
              this.getArgDelegates(args) :
              this.getResolvedArgs(args);

            // IMPORTANT: Do not use `await`, the `Promise` will act as a
            // placeholder in the cache.
            instance = new Promise(async (res, rej) => {
              try {
                res(factory.apply(
                  null,
                  await Promise.all(resolvedArgs)
                ));
              } catch (error) {
                rej(error);
              }
            });

            // TRICKY: Caching a `Promise` will and MUST function correctly.
            this.cacheMap[path] = instance;

            // TRICKY: The resolved instance MUST be cached once a placeholder
            // is created.
            this.cacheMap[path] = await instance;
          } else {
            // IMPORTANT: The `cachedValue` *could be* a `Promise`.
            instance = cachedValue;
          }
        } else {
          const resolvedArgs = subMap ?
            this.getArgDelegates(args, context) :
            this.getResolvedArgs(args, context);

          instance = factory.apply(
            null,
            await Promise.all(resolvedArgs)
          );
        }
      }
    }

    // TRICKY: It is IMPORTANT and necessary to await the `instance` in case it
    // is a `Promise`.
    return await instance;
  }

  configureSubMap(subMap, path, currentPath, subPath) {
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
      name: typeof this.name === 'string' ?
        [this.name, currentPath].join(this.pathDelimiter) :
        currentPath,
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

    // Add a nested validation if none exists.
    if (!this._nestedInvalidationCancellers.hasOwnProperty(path)) {
      const onInvalid = () => {
        /*
         * TRICKY: Invalidate this *full* path so that anything listening for it or
         * depending on it can be updated/invalidated.
         * */
        this.invalidate([path]);
        this._emitInvalidationEvent(path);
      };

      // Listen for invalidation on the `subPath`.
      subIncarnate.addInvalidationListener(subPath, onInvalid);

      // TRICKY: Save a function used to remove the handler when destroying this instance.
      this._addNestedInvalidationCanceller(path, () => {
        subIncarnate.removeInvalidationListener(subPath, onInvalid);
      });
    }

    this._nestedMap[currentPath] = subIncarnate;

    return subIncarnate;
  }

  async resolvePath(path, context) {
    let instance;

    if (typeof path === 'string' && this.map instanceof Object) {
      const pathParts = path.split(this.pathDelimiter);
      // TRICKY: Use `shift` to remove the current path part being processed.
      const currentPath = pathParts.shift();
      const subMapResolver = this.map[currentPath];

      // Sub instances for nested resolution.
      if (pathParts.length) {
        const subPath = pathParts.join(this.pathDelimiter);

        let subMap,
          subIncarnate;

        if (subMapResolver instanceof Function) {
          subMap = await subMapResolver(context || this.context, subPath);
        } else if (subMapResolver instanceof Object && subMapResolver.subMap === true) {
          subMap = await this.resolveDependencies(currentPath, subMapResolver, context, true);
        } else {
          // TRICKY: No subMap.
          return undefined;
        }

        subIncarnate = this.configureSubMap(subMap, path, currentPath, subPath);

        instance = await subIncarnate.resolvePath(subPath, context);
      } else {
        const dependencyDefinition = this.map[path];

        instance = await this.resolveDependencies(path, dependencyDefinition, context);
      }
    }

    return instance;
  }

  addInvalidationListener(path, handler) {
    if (typeof path === 'string' && handler instanceof Function) {
      this._eventEmitter.on(path, handler);
    }
  }

  removeInvalidationListener(path, handler) {
    if (typeof path === 'string' && handler instanceof Function) {
      this._eventEmitter.off(path, handler);
    }
  }

  destroy() {
    // TRICKY: Cancel nested invalidation handlers before destroying the nested instances.
    // Destroy invalidation handlers.
    for (const k in this._nestedInvalidationCancellers) {
      if (this._nestedInvalidationCancellers.hasOwnProperty(k)) {
        const cancellerList = this._nestedInvalidationCancellers[k];

        if (cancellerList instanceof Array) {
          for (let i = 0; i < cancellerList.length; i++) {
            const canceller = cancellerList[i];

            if (canceller instanceof Function) {
              canceller();
            }
          }
        }
      }
    }

    this._nestedInvalidationCancellers = {};

    // Destroy nested instances.
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