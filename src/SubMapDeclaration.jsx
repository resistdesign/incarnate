import DependencyDeclaration from './DependencyDeclaration';

/**
 * Declare an available map of dependencies.
 * */
export default class SubMapDeclaration {
  /**
   * The map of dependencies.
   * @type {Object.<DependencyDeclaration>}
   * */
  subMap;

  /**
   * The dependencies from the current level that should be shared to the `subMap`.
   * Keys are the keys from the `subMap`, values are the paths to the dependencies to be shared.
   * @type {Object.<string>}
   * */
  shared;

  /**
   * A function used to transform the arguments for dependency factories.
   * @type {Function}
   * @see DependencyDeclaration::transformArgs
   * */
  transformArgs;

  constructor(config = {}) {
    Object.assign(this, config);
  }
}
