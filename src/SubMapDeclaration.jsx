import DependencyDeclaration from './DependencyDeclaration';
import ConfigurableInstance from './ConfigurableInstance';

/**
 * Declare an available map of dependencies.
 * */
export default class SubMapDeclaration extends ConfigurableInstance {
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
}
