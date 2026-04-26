// @fctry: #bootstrap-primitive-composition
//
// Spec 0.28: PrimitivesRegistry — the public class wrapping primitives
// and recipe storage for MCP/library/CLI callers.
//
// Built-in primitives are read-only in shape (the four shipped primitives
// can't be edited or deleted) but bindable in parameters per recipe step
// (§#project-bootstrap 2.13, S140). Custom primitives support full CRUD.
// Recipes attach to project types and are snapshotted by the bootstrap
// engine at start so mid-flight Retry uses the snapshot, not the live
// definition.

import { connect, getDbPath, initDb } from '../db.js';
import {
  listPrimitives,
  getPrimitive,
  getBuiltinPrimitiveByKey,
  createCustomPrimitive,
  updateCustomPrimitive,
  deleteCustomPrimitive,
  countRecipeReferences,
  listReferencingTypes,
  getRecipe,
  replaceRecipe,
  appendRecipeStep,
  snapshotRecipe,
  type CreatePrimitiveOpts,
  type UpdatePrimitiveOpts,
} from './store.js';
import type {
  Primitive,
  Recipe,
  RecipeStep,
  RecipeSnapshot,
  BuiltinPrimitiveKey,
} from './types.js';

export class PrimitivesRegistry {
  private _dbPath: string;

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? getDbPath();
    initDb(this._dbPath);
  }

  private open() {
    return connect(this._dbPath);
  }

  // -------------------------------------------------------------------------
  // Primitives
  // -------------------------------------------------------------------------

  /** List all primitives, built-ins first, then custom by name ascending. */
  listPrimitives(): Primitive[] {
    const db = this.open();
    try {
      return listPrimitives(db);
    } finally {
      db.close();
    }
  }

  /** Get one primitive by id. Returns null when not found. */
  getPrimitive(id: number): Primitive | null {
    const db = this.open();
    try {
      return getPrimitive(db, id);
    } finally {
      db.close();
    }
  }

  /** Get a built-in primitive by its stable key. */
  getBuiltinByKey(key: BuiltinPrimitiveKey): Primitive | null {
    const db = this.open();
    try {
      return getBuiltinPrimitiveByKey(db, key);
    } finally {
      db.close();
    }
  }

  /**
   * Create a user-authored primitive. Throws if `name` collides with an
   * existing primitive (built-in or custom — names are globally unique).
   */
  createPrimitive(opts: CreatePrimitiveOpts): Primitive {
    const db = this.open();
    try {
      return createCustomPrimitive(db, opts);
    } finally {
      db.close();
    }
  }

  /**
   * Update a custom primitive. Throws on built-ins (read-only in shape)
   * or when no row matches `id`.
   */
  updatePrimitive(id: number, opts: UpdatePrimitiveOpts): Primitive {
    const db = this.open();
    try {
      return updateCustomPrimitive(db, id, opts);
    } finally {
      db.close();
    }
  }

  /**
   * Delete a custom primitive. Throws on built-ins, and throws when any
   * recipe step still references the primitive — caller should use
   * `listReferencingTypes` first to surface a delete-blocked dialog.
   */
  deletePrimitive(id: number): void {
    const db = this.open();
    try {
      deleteCustomPrimitive(db, id);
    } finally {
      db.close();
    }
  }

  /** Count of recipe steps referencing a primitive (for the delete dialog). */
  countReferences(primitiveId: number): number {
    const db = this.open();
    try {
      return countRecipeReferences(db, primitiveId);
    } finally {
      db.close();
    }
  }

  /** Names of project types whose recipes reference a primitive. */
  listReferencingTypes(primitiveId: number): string[] {
    const db = this.open();
    try {
      return listReferencingTypes(db, primitiveId);
    } finally {
      db.close();
    }
  }

  // -------------------------------------------------------------------------
  // Recipes
  // -------------------------------------------------------------------------

  /** Get a project type's full ordered recipe (excludes the trailer). */
  getRecipe(projectTypeId: number): Recipe {
    const db = this.open();
    try {
      return getRecipe(db, projectTypeId);
    } finally {
      db.close();
    }
  }

  /** Replace a project type's full recipe atomically. */
  replaceRecipe(
    projectTypeId: number,
    steps: { primitive_id: number; params: Record<string, string> }[],
  ): Recipe {
    const db = this.open();
    try {
      return replaceRecipe(db, projectTypeId, steps);
    } finally {
      db.close();
    }
  }

  /** Append one step at the end of a recipe. */
  appendStep(
    projectTypeId: number,
    primitiveId: number,
    params: Record<string, string>,
  ): RecipeStep {
    const db = this.open();
    try {
      return appendRecipeStep(db, projectTypeId, primitiveId, params);
    } finally {
      db.close();
    }
  }

  /** Take an immutable snapshot of a recipe — used at bootstrap start. */
  snapshotRecipe(projectTypeId: number): RecipeSnapshot {
    const db = this.open();
    try {
      return snapshotRecipe(db, projectTypeId);
    } finally {
      db.close();
    }
  }
}
