/**
 * Declare an available dependency with various types of requirements.
 * */
export default class DependencyDeclaration {
  /**
   * A map of named dependencies.
   * @type {Object.<string|*>}
   * */
  dependencies;

  /**
   * A map of named getters.
   * @type {Object.<string|Function>}
   * */
  getters;

  /**
   * A map of named setters.
   * @type {Object.<string|Function>}
   * */
  setters;

  /**
   * A map of named invalidators.
   * @type {Object.<string|Function>}
   * */
  invalidators;

  /**
   * A map of named change handler receivers.
   * @type {Object.<string|Function>}
   * */
  listeners;

  /**
   * The factory function used to create the value of the dependency.
   * @type {Function}
   * @param {DependencyDeclaration} dependencyValues A `DependencyDeclaration` with resolved values rather than paths.
   * @returns {*|Promise} The value of the dependency.
   * */
  factory;

  /**
   * If `true`, the `factory` is NOT called until **none** of the `dependencies` are `undefined`.
   * @type {boolean}
   * */
  strict;
}
