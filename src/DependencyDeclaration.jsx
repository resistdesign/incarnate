/**
 * Declare an available dependency with various types of requirements.
 * */
export default class DependencyDeclaration {
  /**
   * A list of required dependencies.
   * @type {Array.<string>}
   * */
  required;

  /**
   * A list of optional dependencies.
   * @type {Array.<string>}
   * */
  optional;

  /**
   * A list of getters.
   * @type {Array.<string>}
   * */
  getters;

  /**
   * A list of setters.
   * @type {Array.<string>}
   * */
  setters;

  /**
   * A list of invalidators.
   * @type {Array.<string>}
   * */
  invalidators;

  /**
   * A list of change handler receivers.
   * @type {Array.<string>}
   * */
  listeners;

  /**
   * A list of paths that will resolve to dependency controllers rather than values directly.
   * @type {Array.<string>}
   * */
  targets;

  /**
   * An optional function used to transform factory arguments from an `Array`
   * to another `Array` containing a different structure. Used when the factory
   * might require a different configuration of arguments.
   * `transformArgs(args = []):Array (newArgs)`
   * @type {Function}
   * */
  transformArgs;

  /**
   * The factory function used to **resolve** the value of the dependency.
   * @type {Function}
   * @param {Array.<*>} ...args The various required dependencies in the order:
   * `required`, `optional`, `getters`, `setters`, `invalidators`, `listeners`
   * @returns {*|Promise} The value of the dependency.
   * */
  factory;
}
